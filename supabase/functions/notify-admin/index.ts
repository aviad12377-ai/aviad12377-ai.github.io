// Supabase Edge Function: e-mails the admin when a new request or lead arrives (optional).
// Triggered by a Database Webhook (Database > Webhooks) on INSERT into public.requests and public.leads.
// Secrets (Edge Functions > Secrets): RESEND_API_KEY, ADMIN_EMAIL, WEBHOOK_SECRET, FROM_EMAIL (optional), SITE_URL (optional).
// Privacy: the e-mail contains no personal details (no names, contacts, screenshots), only the type and a link to admin.html.
Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('method', { status: 405 });
  const secret = Deno.env.get('WEBHOOK_SECRET');
  if (!secret || req.headers.get('x-webhook-secret') !== secret) return new Response('unauthorized', { status: 401 });
  let payload: { type?: string; table?: string; record?: Record<string, unknown> };
  try { payload = await req.json(); } catch { return new Response('bad json', { status: 400 }); }
  if (payload.type !== 'INSERT' || !payload.record) return new Response('ignored');
  const site = Deno.env.get('SITE_URL') ?? 'https://aviad12377-ai.github.io';
  const isLead = payload.table === 'leads';
  const kind = isLead ? 'lead (licensed agent call)' : `request: ${String(payload.record.type ?? '')}`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: Deno.env.get('FROM_EMAIL') ?? 'Portal <onboarding@resend.dev>',
      to: [Deno.env.get('ADMIN_EMAIL')],
      subject: `New ${kind}`,
      text: `A new ${kind} arrived.\nOpen the control centre: ${site}/admin.html\n`,
    }),
  });
  return new Response(res.ok ? 'sent' : 'mail failed', { status: res.ok ? 200 : 502 });
});
