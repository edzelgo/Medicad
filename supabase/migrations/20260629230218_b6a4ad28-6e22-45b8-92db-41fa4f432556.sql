-- Store the cron auth secret in Vault and update the status-change trigger
-- to authenticate against the edge function using a private header secret
-- instead of the public anon key.
DO $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM vault.secrets WHERE name = 'cron_secret';
  IF v_id IS NULL THEN
    PERFORM vault.create_secret(
      '2y8QdX1DnWmEdkuopuQKfb0TXgdjHn6dts5ikXyKZTsrJghXPFbKKc7wLmBGZ2Yg',
      'cron_secret',
      'Shared bearer used to authenticate internal callers of email notification edge functions.'
    );
  ELSE
    UPDATE vault.secrets
      SET secret = '2y8QdX1DnWmEdkuopuQKfb0TXgdjHn6dts5ikXyKZTsrJghXPFbKKc7wLmBGZ2Yg'
      WHERE id = v_id;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.on_application_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_url text := 'https://zggucwzagnuxbnyxmciz.supabase.co/functions/v1/notify-status-change';
  v_secret text;
  ALLOWED text[] := ARRAY['new_lead','documents_pending','under_review','submitted_to_medicaid','approved','denied'];
BEGIN
  IF NEW.application_status IS DISTINCT FROM OLD.application_status THEN
    NEW.application_status_updated_at := now();

    -- Only fire the notification for known statuses; ignore anything outside
    -- the allow-list so unvalidated values can never be rendered in emails.
    IF NEW.application_status = ANY(ALLOWED)
       AND (OLD.application_status IS NULL OR OLD.application_status = ANY(ALLOWED)) THEN
      SELECT decrypted_secret INTO v_secret
        FROM vault.decrypted_secrets
        WHERE name = 'cron_secret'
        LIMIT 1;

      IF v_secret IS NOT NULL THEN
        PERFORM extensions.http_post(
          url := v_url,
          headers := jsonb_build_object(
            'Content-Type','application/json',
            'Authorization','Bearer '||v_secret
          ),
          body := jsonb_build_object(
            'user_id', NEW.id,
            'old_status', OLD.application_status,
            'new_status', NEW.application_status
          )
        );
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;