
-- 1. Add address column to profiles (used by abandoned-application check)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address text;

-- 2. Email send log (idempotency)
CREATE TABLE IF NOT EXISTS public.email_notifications_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  context text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, context)
);
GRANT SELECT ON public.email_notifications_log TO authenticated;
GRANT ALL ON public.email_notifications_log TO service_role;
ALTER TABLE public.email_notifications_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins_read_email_log" ON public.email_notifications_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. Enable required extensions for trigger -> edge function
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 4. Trigger function: invoke status-change edge function on application_status change
CREATE OR REPLACE FUNCTION public.on_application_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_url text := 'https://zggucwzagnuxbnyxmciz.supabase.co/functions/v1/notify-status-change';
  v_anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpnZ3Vjd3phZ251eGJueXhtY2l6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1ODMzODgsImV4cCI6MjA5NzE1OTM4OH0.Se3_UzOKEN8lg--DHnkq_X0SO-C7ujE-7ykpVcS77eQ';
BEGIN
  IF NEW.application_status IS DISTINCT FROM OLD.application_status THEN
    NEW.application_status_updated_at := now();
    PERFORM extensions.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'Authorization','Bearer '||v_anon
      ),
      body := jsonb_build_object(
        'user_id', NEW.id,
        'old_status', OLD.application_status,
        'new_status', NEW.application_status
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_application_status_change ON public.profiles;
CREATE TRIGGER trg_application_status_change
BEFORE UPDATE OF application_status ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.on_application_status_change();

-- 5. Schedule cron jobs for abandoned + missing-docs checks (hourly)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

SELECT cron.unschedule('email-abandoned-applications') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='email-abandoned-applications');
SELECT cron.unschedule('email-missing-documents') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='email-missing-documents');

SELECT cron.schedule(
  'email-abandoned-applications',
  '0 * * * *',
  $cron$
  SELECT extensions.http_post(
    url:='https://zggucwzagnuxbnyxmciz.supabase.co/functions/v1/send-abandoned-reminder',
    headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpnZ3Vjd3phZ251eGJueXhtY2l6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1ODMzODgsImV4cCI6MjA5NzE1OTM4OH0.Se3_UzOKEN8lg--DHnkq_X0SO-C7ujE-7ykpVcS77eQ'),
    body:='{}'::jsonb
  );
  $cron$
);

SELECT cron.schedule(
  'email-missing-documents',
  '15 * * * *',
  $cron$
  SELECT extensions.http_post(
    url:='https://zggucwzagnuxbnyxmciz.supabase.co/functions/v1/send-missing-documents-reminder',
    headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpnZ3Vjd3phZ251eGJueXhtY2l6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1ODMzODgsImV4cCI6MjA5NzE1OTM4OH0.Se3_UzOKEN8lg--DHnkq_X0SO-C7ujE-7ykpVcS77eQ'),
    body:='{}'::jsonb
  );
  $cron$
);
