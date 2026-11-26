/* Cloud accounts configuration. Leave supabaseUrl/supabaseAnonKey empty to run fully on this device (no sign-in button).
   The anon key is PUBLIC by design: it only lets the browser talk to Supabase, and every table is protected by
   row-level security (see supabase/schema.sql). Never put the service_role key here. */
window.PORTAL_AUTH_CONFIG = {
  supabaseUrl: 'https://pohjziqikvzudziqomzz.supabase.co',
  supabaseAnonKey: 'sb_publishable_IJc210OOxVWAed9qcdNZHw_5JytlUdm',  // public publishable key (safe to publish; RLS protects data)
  enableEmailPassword: true,
  adminEmails: [],          // UI hint only (shows the admin link). Real admin rights come from the public.admins table.
  contactEmail: ''          // optional: shown on the privacy page for questions and deletion requests
};
