-- Internal-only secret store (no app user access; service role / postgres only)
create table if not exists public.internal_secrets (
  name text primary key,
  value text not null,
  created_at timestamptz not null default now()
);

revoke all on public.internal_secrets from anon, authenticated;
grant all on public.internal_secrets to service_role;
alter table public.internal_secrets enable row level security;
-- Intentionally no policies: unreachable from the Data API for app users.

insert into public.internal_secrets (name, value)
values ('CRON_SECRET', '8_vrHaIyNJqpfapQXBKDlLpOHVyr5JfBeJDSjXHU1q4ymKzFyJX-G8Ig4Zi1YlQ-')
on conflict (name) do nothing;

-- Recreate scheduled jobs so they authenticate with the internal cron secret
select cron.unschedule('check-document-expiry-daily');
select cron.unschedule('check-draft-movements-daily');
select cron.unschedule('check-signatory-expiry-daily');
select cron.unschedule('check-ubo-alerts-weekly');
select cron.unschedule('send-digest-weekly');

select cron.schedule('check-document-expiry-daily', '0 8 * * *', $job$
  select net.http_post(
    url := 'https://mjolamtarbqpxjheuath.supabase.co/functions/v1/check-document-expiry',
    headers := jsonb_build_object('Content-Type','application/json','x-internal-secret', (select value from public.internal_secrets where name='CRON_SECRET')),
    body := '{}'::jsonb
  );
$job$);

select cron.schedule('check-draft-movements-daily', '0 8 * * *', $job$
  select net.http_post(
    url := 'https://mjolamtarbqpxjheuath.supabase.co/functions/v1/check-draft-movements',
    headers := jsonb_build_object('Content-Type','application/json','x-internal-secret', (select value from public.internal_secrets where name='CRON_SECRET')),
    body := '{}'::jsonb
  );
$job$);

select cron.schedule('check-signatory-expiry-daily', '0 8 * * *', $job$
  select net.http_post(
    url := 'https://mjolamtarbqpxjheuath.supabase.co/functions/v1/check-signatory-expiry',
    headers := jsonb_build_object('Content-Type','application/json','x-internal-secret', (select value from public.internal_secrets where name='CRON_SECRET')),
    body := '{}'::jsonb
  );
$job$);

select cron.schedule('check-ubo-alerts-weekly', '0 8 * * 1', $job$
  select net.http_post(
    url := 'https://mjolamtarbqpxjheuath.supabase.co/functions/v1/check-ubo-alerts',
    headers := jsonb_build_object('Content-Type','application/json','x-internal-secret', (select value from public.internal_secrets where name='CRON_SECRET')),
    body := '{}'::jsonb
  );
$job$);

select cron.schedule('send-digest-weekly', '0 9 * * 1', $job$
  select net.http_post(
    url := 'https://mjolamtarbqpxjheuath.supabase.co/functions/v1/send-digest',
    headers := jsonb_build_object('Content-Type','application/json','x-internal-secret', (select value from public.internal_secrets where name='CRON_SECRET')),
    body := '{}'::jsonb
  );
$job$);