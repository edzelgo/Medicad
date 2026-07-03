
-- Audit log table
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email TEXT,
  action TEXT NOT NULL,
  resource TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX audit_logs_user_id_created_at_idx ON public.audit_logs(user_id, created_at DESC);
CREATE INDEX audit_logs_action_idx ON public.audit_logs(action);

GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Users can insert their own audit rows; user_id must match auth.uid()
CREATE POLICY "Users insert own audit rows"
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can view their own audit rows
CREATE POLICY "Users view own audit rows"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Admins can view all audit rows
CREATE POLICY "Admins view all audit rows"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- Server-side upload validation on documents table
-- Blocks disallowed mime types, oversized files, dangerous
-- extensions, and path escape attempts. Runs as a trigger so
-- the rules apply even if the client is bypassed.
-- ============================================================
CREATE OR REPLACE FUNCTION public.validate_document_upload()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  allowed_mimes TEXT[] := ARRAY[
    'application/pdf',
    'image/png','image/jpeg','image/jpg','image/webp','image/heic','image/heif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain','text/csv',
    'application/octet-stream'
  ];
  blocked_ext TEXT[] := ARRAY['exe','bat','cmd','com','msi','sh','ps1','js','jse','vbs','vbe',
                              'jar','scr','apk','app','dll','so','dylib','php','py','rb','pl',
                              'html','htm','svg'];
  ext TEXT;
  max_bytes BIGINT := 26214400; -- 25 MiB
BEGIN
  -- Name required and reasonable length
  IF NEW.name IS NULL OR length(NEW.name) = 0 OR length(NEW.name) > 255 THEN
    RAISE EXCEPTION 'Invalid file name';
  END IF;

  -- Reject path traversal / absolute paths in storage_path or name
  IF NEW.name LIKE '%..%' OR NEW.name LIKE '%/%' OR NEW.name LIKE '%\%' THEN
    RAISE EXCEPTION 'Invalid file name';
  END IF;
  IF NEW.storage_path IS NULL OR NEW.storage_path LIKE '%..%' OR NEW.storage_path LIKE '/%' THEN
    RAISE EXCEPTION 'Invalid storage path';
  END IF;

  -- Storage path must be scoped to the uploading user
  IF NEW.storage_path NOT LIKE (NEW.user_id::text || '/%') THEN
    RAISE EXCEPTION 'Storage path must be scoped to the user';
  END IF;

  -- Size cap
  IF NEW.size_bytes IS NOT NULL AND NEW.size_bytes > max_bytes THEN
    RAISE EXCEPTION 'File exceeds 25MB limit';
  END IF;
  IF NEW.size_bytes IS NOT NULL AND NEW.size_bytes <= 0 THEN
    RAISE EXCEPTION 'Empty file rejected';
  END IF;

  -- Extension deny-list
  ext := lower(split_part(NEW.name, '.', array_length(string_to_array(NEW.name, '.'), 1)));
  IF ext = ANY(blocked_ext) THEN
    RAISE EXCEPTION 'File type not allowed';
  END IF;

  -- Mime allow-list (nullable ok, defaults to octet-stream)
  IF NEW.mime_type IS NOT NULL AND NOT (lower(NEW.mime_type) = ANY(allowed_mimes)) THEN
    RAISE EXCEPTION 'Mime type not allowed';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_document_upload_trg ON public.documents;
CREATE TRIGGER validate_document_upload_trg
  BEFORE INSERT ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.validate_document_upload();
