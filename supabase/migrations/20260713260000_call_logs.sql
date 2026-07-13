-- Group C #38 — call logging. Records outbound/inbound calls against a lead,
-- whether dialed manually (click-to-dial) or placed via Twilio click-to-call.
-- Additive; the lead UI degrades gracefully until applied via Lovable.

CREATE TABLE IF NOT EXISTS public.call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  direction text NOT NULL DEFAULT 'outbound',   -- outbound | inbound
  outcome text,                                 -- connected | voicemail | no_answer | busy | wrong_number
  duration_seconds integer,
  notes text,
  provider text NOT NULL DEFAULT 'manual',      -- manual | twilio
  provider_sid text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS call_logs_lead_idx ON public.call_logs (lead_id, created_at DESC);

ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read call logs" ON public.call_logs;
CREATE POLICY "Staff read call logs"
  ON public.call_logs FOR SELECT
  USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'agent') OR public.has_role(auth.uid(),'marketer')
  );

DROP POLICY IF EXISTS "Staff write call logs" ON public.call_logs;
CREATE POLICY "Staff write call logs"
  ON public.call_logs FOR ALL
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'agent'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'agent'));
