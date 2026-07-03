-- Normalize intake_cases (one row per case+workflow) into:
--   cases        - one row per person, full demographics (matches Bolt's "Main Info" panel)
--   case_tracks  - one row per workflow enrollment on a case (matches Bolt's per-track
--                  timeline), many-to-one to cases
-- intake_case_events keeps logging changes, just repointed at case_tracks.
-- A view (intake_case_view) reproduces the old flat intake_cases shape for read paths
-- that don't need the new structure yet.

CREATE TABLE public.cases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_number TEXT NOT NULL UNIQUE,
  case_type TEXT NOT NULL DEFAULT 'medicaid' CHECK (case_type IN ('medicaid', 'caregiver')),
  first_name TEXT,
  middle_name TEXT,
  last_name TEXT,
  dob DATE,
  ssn TEXT,
  phone_cell TEXT,
  phone_home TEXT,
  phone_other TEXT,
  address1 TEXT,
  apartment TEXT,
  city TEXT,
  county TEXT,
  state TEXT,
  zip TEXT,
  veteran_status TEXT,
  marital_status TEXT,
  spouse_first_name TEXT,
  spouse_last_name TEXT,
  spouse_dob DATE,
  spouse_ssn TEXT,
  responsible_party_name TEXT,
  responsible_party_phone TEXT,
  responsible_party_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cases TO authenticated;
GRANT ALL ON public.cases TO service_role;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view cases" ON public.cases FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'agent'));
CREATE POLICY "Staff can insert cases" ON public.cases FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'agent'));
CREATE POLICY "Staff can update cases" ON public.cases FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'agent'));
CREATE POLICY "Admins can delete cases" ON public.cases FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER cases_touch BEFORE UPDATE ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.case_tracks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  workflow TEXT,
  status TEXT,
  status_date DATE,
  agent TEXT,
  marketer TEXT,
  ref_source TEXT,
  date_received DATE,
  follow_up_date DATE,
  follow_count INTEGER NOT NULL DEFAULT 0,
  notes_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_tracks TO authenticated;
GRANT ALL ON public.case_tracks TO service_role;
ALTER TABLE public.case_tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view case tracks" ON public.case_tracks FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'agent'));
CREATE POLICY "Staff can insert case tracks" ON public.case_tracks FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'agent'));
CREATE POLICY "Staff can update case tracks" ON public.case_tracks FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'agent'));
CREATE POLICY "Admins can delete case tracks" ON public.case_tracks FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER case_tracks_touch BEFORE UPDATE ON public.case_tracks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_case_tracks_case_id ON public.case_tracks(case_id);
CREATE INDEX idx_case_tracks_workflow ON public.case_tracks(workflow);
CREATE INDEX idx_case_tracks_status ON public.case_tracks(status);
CREATE INDEX idx_case_tracks_agent ON public.case_tracks(agent);

-- Migrate existing data. case_tracks rows keep the same id as the intake_cases row they
-- came from, so intake_case_events (which references that id) needs no data rewrite.
INSERT INTO public.cases (case_number, first_name, last_name, phone_cell, created_at, updated_at)
SELECT case_id, first_name, last_name, phone, created_at, updated_at
FROM public.intake_cases;

INSERT INTO public.case_tracks (
  id, case_id, workflow, status, status_date, agent, marketer, ref_source,
  date_received, follow_up_date, follow_count, notes_count, created_at, updated_at
)
SELECT
  ic.id, c.id, ic.workflow, ic.status, ic.status_date, ic.agent, ic.marketer, ic.ref_source,
  ic.date_received, ic.follow_up_date, ic.follow_count, ic.notes_count, ic.created_at, ic.updated_at
FROM public.intake_cases ic
JOIN public.cases c ON c.case_number = ic.case_id;

-- Repoint intake_case_events at case_tracks (same ids, so no row data changes needed).
ALTER TABLE public.intake_case_events
  DROP CONSTRAINT intake_case_events_case_id_fkey;
ALTER TABLE public.intake_case_events
  ADD CONSTRAINT intake_case_events_case_id_fkey
  FOREIGN KEY (case_id) REFERENCES public.case_tracks(id) ON DELETE CASCADE;

-- Re-attach the change-log trigger to case_tracks (function body already only reads
-- workflow/status/agent/follow_up_date, all present on case_tracks).
CREATE TRIGGER trg_log_case_track_change
  AFTER UPDATE ON public.case_tracks
  FOR EACH ROW EXECUTE FUNCTION public.log_intake_case_change();

-- Old flat table is fully superseded now; its trigger/indexes go with it.
DROP TABLE public.intake_cases;

-- Read-shaped view so existing dashboard queries keep working against the same columns,
-- with RLS from the underlying tables enforced per-caller (not the view owner).
CREATE VIEW public.intake_case_view
WITH (security_invoker = on) AS
SELECT
  ct.id,
  c.case_number AS case_id,
  ct.date_received,
  c.first_name,
  c.last_name,
  c.phone_cell AS phone,
  ct.ref_source,
  ct.marketer,
  ct.notes_count,
  ct.follow_up_date,
  ct.follow_count,
  ct.workflow,
  ct.status,
  ct.status_date,
  (SELECT count(*) FROM public.case_tracks t2 WHERE t2.case_id = c.id) AS track_count,
  ct.agent,
  c.id AS case_pk
FROM public.case_tracks ct
JOIN public.cases c ON c.id = ct.case_id;

GRANT SELECT ON public.intake_case_view TO authenticated;
