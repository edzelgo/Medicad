-- Group C (communication history) + Group D (priority) + Group B (status reason).
-- All additive; server code degrades gracefully until this is applied via Lovable.

-- 1. Communications log — every email/SMS the system sends, for audit + history.
CREATE TABLE IF NOT EXISTS public.communications_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  channel text NOT NULL,                    -- 'email' | 'sms'
  kind text NOT NULL,                       -- 'stage_change' | 'assignment' | 'doc_reminder' | 'followup_digest' | 'manual'
  recipient text NOT NULL,
  subject text,
  body_preview text,
  success boolean NOT NULL DEFAULT false,
  error text,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  created_by uuid
);

CREATE INDEX IF NOT EXISTS communications_log_lead_idx ON public.communications_log (lead_id, created_at DESC);

ALTER TABLE public.communications_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read communications" ON public.communications_log;
CREATE POLICY "Staff read communications"
  ON public.communications_log FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'agent')
    OR public.has_role(auth.uid(), 'marketer')
  );
-- Inserts happen through the service role (server), which bypasses RLS.

-- 2. Lead priority (Group D #44).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'priority'
  ) THEN
    ALTER TABLE public.leads ADD COLUMN priority text NOT NULL DEFAULT 'normal';
  END IF;
END $$;

-- 3. Case-track status change reason (Group B #23).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'case_tracks' AND column_name = 'status_reason'
  ) THEN
    ALTER TABLE public.case_tracks ADD COLUMN status_reason text;
  END IF;
END $$;
