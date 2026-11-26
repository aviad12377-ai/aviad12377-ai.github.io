-- Balances portal: database schema for Supabase (Postgres). Run once in Supabase > SQL Editor > New query > Run.
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE / DROP POLICY IF EXISTS.
-- Security model:
--   * Every table has row-level security (RLS) ON. The browser uses the public anon key + the user's JWT.
--     portal_docs is also FORCED (even the owner obeys RLS). The other tables are written only by the SECURITY DEFINER
--     functions below, which run as the table owner, so they are not forced (forcing would block those functions).
--   * Users can read/write only their own rows. Anonymous visitors can only call submit_request / submit_lead (rate limited).
--   * Admin rights come only from public.admins (an e-mail list you fill in below), checked server-side by public.is_admin().
--   * "Compare to others" returns only aggregated percentiles for groups of at least 20 people. Raw rows are never readable.

-- 0. extensions
create extension if not exists pgcrypto with schema extensions;

-- 1. per-user portal documents (one JSON doc per user per section, versioned)
create table if not exists public.portal_docs (
  user_id    uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  section    text        not null check (section in ('data', 'settings', 'options')),
  doc        jsonb       not null,
  version    integer     not null default 1,
  updated_at timestamptz not null default now(),
  device     text,
  primary key (user_id, section),
  constraint portal_docs_size check (pg_column_size(doc) < 2000000)
);
alter table public.portal_docs enable row level security;
alter table public.portal_docs force row level security;
drop policy if exists portal_docs_select on public.portal_docs;
drop policy if exists portal_docs_insert on public.portal_docs;
drop policy if exists portal_docs_update on public.portal_docs;
drop policy if exists portal_docs_delete on public.portal_docs;
create policy portal_docs_select on public.portal_docs for select to authenticated using ((select auth.uid()) = user_id);
create policy portal_docs_insert on public.portal_docs for insert to authenticated with check ((select auth.uid()) = user_id);
create policy portal_docs_update on public.portal_docs for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy portal_docs_delete on public.portal_docs for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.portal_docs from anon;
grant select, insert, update, delete on public.portal_docs to authenticated;

-- save with optimistic concurrency: succeeds only if p_base_version matches the stored version (or no row yet)
create or replace function public.save_doc(p_section text, p_doc jsonb, p_base_version integer, p_device text default null)
returns table (version integer, updated_at timestamptz, conflict boolean)
language plpgsql security invoker set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_cur integer; v_at timestamptz;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select d.version, d.updated_at into v_cur, v_at from public.portal_docs d where d.user_id = v_uid and d.section = p_section for update;
  if v_cur is null then
    insert into public.portal_docs (user_id, section, doc, version, device) values (v_uid, p_section, p_doc, 1, left(p_device, 40));
    return query select 1, now(), false;
  elsif p_base_version is distinct from v_cur then
    return query select v_cur, v_at, true;
  else
    update public.portal_docs d set doc = p_doc, version = v_cur + 1, updated_at = now(), device = left(p_device, 40)
      where d.user_id = v_uid and d.section = p_section;
    return query select v_cur + 1, now(), false;
  end if;
end $$;
revoke all on function public.save_doc(text, jsonb, integer, text) from public, anon;
grant execute on function public.save_doc(text, jsonb, integer, text) to authenticated;

-- 2. admins (fill in your own e-mail at the bottom of this file)
create table if not exists public.admins (email text primary key check (email = lower(email)));
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.admins a
    join auth.users u on lower(u.email) = a.email
    where u.id = auth.uid() and (u.email_confirmed_at is not null)
  );
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- 3. delete my account (cascades to every table that references auth.users)
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  delete from public.requests where user_id = auth.uid();
  delete from public.leads where user_id = auth.uid();
  delete from auth.users where id = auth.uid();
end $$;

-- 4. requests & support (ticker requests, bugs, features). Inserts only through submit_request().
create table if not exists public.requests (
  id            uuid        primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  user_id       uuid        references auth.users(id) on delete set null,
  token         uuid        not null default gen_random_uuid(),       -- lets anonymous submitters see replies on their device
  type          text        not null check (type in ('ticker', 'bug', 'feature', 'other')),
  title         text        not null default '' check (length(title) <= 200),
  body          text        not null default '' check (length(body) <= 5000),
  symbol        text        not null default '' check (length(symbol) <= 100),
  email         text        not null default '' check (length(email) <= 200),
  page          text        not null default '' check (length(page) <= 200),
  screenshot    text        check (screenshot is null or (length(screenshot) <= 600000 and screenshot like 'data:image/%')),
  status        text        not null default 'new' check (status in ('new', 'in_progress', 'done', 'rejected')),
  internal_note text        not null default '',
  reply_note    text        not null default '',
  ip_hash       text
);
alter table public.requests enable row level security;
drop policy if exists requests_admin_all on public.requests;
create policy requests_admin_all on public.requests for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.requests from anon;
grant select, update on public.requests to authenticated;  -- rows still filtered by the admin-only policy

-- 5. leads ("interested in speaking with a licensed agent?") - admin only
create table if not exists public.leads (
  id         uuid        primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id    uuid        references auth.users(id) on delete set null,
  name       text        not null check (length(name) between 1 and 120),
  contact    text        not null check (length(contact) between 3 and 200),
  topic      text        not null default '' check (length(topic) <= 60),
  consent    boolean     not null check (consent),
  consent_text text      not null default '',
  status     text        not null default 'new' check (status in ('new', 'contacted', 'closed')),
  ip_hash    text
);
alter table public.leads enable row level security;
drop policy if exists leads_admin_all on public.leads;
create policy leads_admin_all on public.leads for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.leads from anon;
grant select, update on public.leads to authenticated;

-- shared anti-abuse helper: hashed client IP (from the API gateway header), never the IP itself
create or replace function public._client_ip_hash() returns text
language sql stable security definer set search_path = '' as $$
  select encode(extensions.digest(coalesce(split_part(current_setting('request.headers', true)::json->>'x-forwarded-for', ',', 1), 'none') || ':portal-salt-change-me', 'sha256'), 'hex');
$$;
revoke all on function public._client_ip_hash() from public, anon, authenticated;

create or replace function public.submit_request(p_type text, p_title text, p_body text, p_symbol text, p_email text, p_screenshot text, p_page text, p_hp text, p_elapsed_ms integer)
returns table (id uuid, token uuid)
language plpgsql security definer set search_path = '' as $$
declare v_ip text := public._client_ip_hash(); v_recent int; v_global int; v_id uuid; v_token uuid;
begin
  if coalesce(p_hp, '') <> '' then raise exception 'rejected'; end if;                  -- honeypot field filled by a bot
  if coalesce(p_elapsed_ms, 0) < 3000 then raise exception 'too fast'; end if;          -- form submitted < 3 s after load
  if length(coalesce(p_title, '')) + length(coalesce(p_body, '')) + length(coalesce(p_symbol, '')) < 3 then raise exception 'empty'; end if;
  select count(*) into v_recent from public.requests r where r.ip_hash = v_ip and r.created_at > now() - interval '1 hour';
  if v_recent >= 5 then raise exception 'rate limit'; end if;
  select count(*) into v_global from public.requests r where r.user_id is null and r.created_at > now() - interval '1 hour';
  if auth.uid() is null and v_global >= 100 then raise exception 'rate limit'; end if;
  insert into public.requests (user_id, type, title, body, symbol, email, page, screenshot, ip_hash)
    values (auth.uid(), p_type, left(coalesce(p_title, ''), 200), left(coalesce(p_body, ''), 5000), left(coalesce(p_symbol, ''), 100), left(coalesce(p_email, ''), 200), left(coalesce(p_page, ''), 200), p_screenshot, v_ip)
    returning requests.id, requests.token into v_id, v_token;
  return query select v_id, v_token;
end $$;
revoke all on function public.submit_request(text, text, text, text, text, text, text, text, integer) from public;
grant execute on function public.submit_request(text, text, text, text, text, text, text, text, integer) to anon, authenticated;

-- my requests: signed-in users see their own; anonymous see the ones whose tokens are stored on their device. Never internal notes.
create or replace function public.my_requests(p_tokens uuid[] default '{}')
returns table (id uuid, created_at timestamptz, updated_at timestamptz, type text, title text, symbol text, status text, reply_note text)
language sql stable security definer set search_path = '' as $$
  select r.id, r.created_at, r.updated_at, r.type, r.title, r.symbol, r.status, r.reply_note
  from public.requests r
  where (auth.uid() is not null and r.user_id = auth.uid()) or r.token = any (coalesce(p_tokens, '{}'))
  order by r.created_at desc limit 100;
$$;
revoke all on function public.my_requests(uuid[]) from public;
grant execute on function public.my_requests(uuid[]) to anon, authenticated;

create or replace function public.submit_lead(p_name text, p_contact text, p_topic text, p_consent boolean, p_hp text, p_elapsed_ms integer)
returns void language plpgsql security definer set search_path = '' as $$
declare v_ip text := public._client_ip_hash(); v_recent int;
begin
  if coalesce(p_hp, '') <> '' or coalesce(p_elapsed_ms, 0) < 3000 then raise exception 'rejected'; end if;
  if not coalesce(p_consent, false) then raise exception 'consent required'; end if;
  select count(*) into v_recent from public.leads l where l.ip_hash = v_ip and l.created_at > now() - interval '1 day';
  if v_recent >= 3 then raise exception 'rate limit'; end if;
  insert into public.leads (user_id, name, contact, topic, consent, consent_text, ip_hash)
    values (auth.uid(), left(p_name, 120), left(p_contact, 200), left(coalesce(p_topic, ''), 60), true, 'consented to be contacted by a licensed agent (portal form v1)', v_ip);
end $$;
revoke all on function public.submit_lead(text, text, text, boolean, text, integer) from public;
grant execute on function public.submit_lead(text, text, text, boolean, text, integer) to anon, authenticated;

-- admin functions (all check is_admin() server-side)
create or replace function public.admin_list_requests(p_type text default null, p_status text default null)
returns setof public.requests language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query select * from public.requests r where (p_type is null or r.type = p_type) and (p_status is null or r.status = p_status) order by r.created_at desc limit 500;
end $$;
create or replace function public.admin_update_request(p_id uuid, p_status text, p_internal text, p_reply text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  update public.requests r set status = coalesce(p_status, r.status), internal_note = coalesce(p_internal, r.internal_note), reply_note = coalesce(p_reply, r.reply_note), updated_at = now() where r.id = p_id;
end $$;
create or replace function public.admin_list_leads()
returns setof public.leads language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query select * from public.leads l order by l.created_at desc limit 500;
end $$;
create or replace function public.admin_update_lead(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  update public.leads l set status = p_status where l.id = p_id;
end $$;
revoke all on function public.admin_list_requests(text, text) from public, anon;
revoke all on function public.admin_update_request(uuid, text, text, text) from public, anon;
revoke all on function public.admin_list_leads() from public, anon;
revoke all on function public.admin_update_lead(uuid, text) from public, anon;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.admin_list_requests(text, text) to authenticated;
grant execute on function public.admin_update_request(uuid, text, text, text) to authenticated;
grant execute on function public.admin_list_leads() to authenticated;
grant execute on function public.admin_update_lead(uuid, text) to authenticated;
grant execute on function public.delete_my_account() to authenticated;

-- 6. anonymous "how you compare to others" (opt-in). Values are pre-rounded by the browser; no select access to rows at all.
create table if not exists public.peer_stats (
  user_id         uuid        primary key default auth.uid() references auth.users(id) on delete cascade,
  age_band        text        not null default '' check (age_band in ('', '<30', '30-39', '40-49', '50-59', '60+')),
  net_worth       numeric,
  savings_rate    numeric     check (savings_rate is null or savings_rate between -100 and 100),
  pension_fee_acc numeric     check (pension_fee_acc is null or pension_fee_acc between 0 and 5),
  updated_at      timestamptz not null default now()
);
alter table public.peer_stats enable row level security;
revoke all on public.peer_stats from anon, authenticated;   -- no direct access; only the functions below

create or replace function public.peer_submit(p_age_band text, p_net_worth numeric, p_savings_rate numeric, p_pension_fee_acc numeric)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into public.peer_stats (user_id, age_band, net_worth, savings_rate, pension_fee_acc, updated_at)
    values (auth.uid(), coalesce(p_age_band, ''), round(p_net_worth, -4), round(p_savings_rate), round(p_pension_fee_acc, 2), now())
  on conflict (user_id) do update set age_band = excluded.age_band, net_worth = excluded.net_worth, savings_rate = excluded.savings_rate, pension_fee_acc = excluded.pension_fee_acc, updated_at = now();
end $$;
create or replace function public.peer_withdraw() returns void language sql security definer set search_path = '' as $$
  delete from public.peer_stats where user_id = auth.uid();
$$;
-- k-anonymity: percentiles only when the comparison group has >= 20 people; your percentile is rounded to 10.
create or replace function public.peer_compare()
returns table (metric text, n integer, p25 numeric, p50 numeric, p75 numeric, my_pct numeric)
language plpgsql stable security definer set search_path = '' as $$
declare me public.peer_stats%rowtype; k constant integer := 20;
begin
  select * into me from public.peer_stats s where s.user_id = auth.uid();
  if not found then return; end if;
  return query
  with grp as (
    select s.* from public.peer_stats s where s.updated_at > now() - interval '400 days' and (me.age_band = '' or s.age_band = me.age_band)
  ), m as (
    select 'net_worth'::text as metric, g.net_worth as v, me.net_worth as mine from grp g
    union all select 'savings_rate', g.savings_rate, me.savings_rate from grp g
    union all select 'pension_fee_acc', g.pension_fee_acc, me.pension_fee_acc from grp g
  )
  select m.metric, count(m.v)::integer,
    case when count(m.v) >= k then round(percentile_cont(0.25) within group (order by m.v)::numeric, 2) end,
    case when count(m.v) >= k then round(percentile_cont(0.50) within group (order by m.v)::numeric, 2) end,
    case when count(m.v) >= k then round(percentile_cont(0.75) within group (order by m.v)::numeric, 2) end,
    case when count(m.v) >= k and max(m.mine) is not null then round(100.0 * count(*) filter (where m.v < m.mine) / count(m.v), -1) end
  from m group by m.metric;
end $$;
revoke all on function public.peer_submit(text, numeric, numeric, numeric) from public, anon;
revoke all on function public.peer_withdraw() from public, anon;
revoke all on function public.peer_compare() from public, anon;
grant execute on function public.peer_submit(text, numeric, numeric, numeric) to authenticated;
grant execute on function public.peer_withdraw() to authenticated;
grant execute on function public.peer_compare() to authenticated;

-- 7. YOUR ADMIN E-MAIL (edit, then run). Lower-case only.
insert into public.admins (email) values ('replace-with-your-gmail@gmail.com') on conflict do nothing;
