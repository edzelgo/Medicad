
CREATE TABLE public.intake_cases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id TEXT NOT NULL UNIQUE,
  date_received DATE,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  ref_source TEXT,
  marketer TEXT,
  notes_count INTEGER NOT NULL DEFAULT 0,
  follow_up_date DATE,
  follow_count INTEGER NOT NULL DEFAULT 0,
  workflow TEXT,
  status TEXT,
  status_date DATE,
  track_count INTEGER NOT NULL DEFAULT 1,
  agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.intake_cases TO authenticated;
GRANT ALL ON public.intake_cases TO service_role;

ALTER TABLE public.intake_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view intake cases" ON public.intake_cases FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'agent'));
CREATE POLICY "Staff can insert intake cases" ON public.intake_cases FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'agent'));
CREATE POLICY "Staff can update intake cases" ON public.intake_cases FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'agent'));
CREATE POLICY "Admins can delete intake cases" ON public.intake_cases FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER intake_cases_touch BEFORE UPDATE ON public.intake_cases
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_intake_cases_workflow ON public.intake_cases(workflow);
CREATE INDEX idx_intake_cases_status ON public.intake_cases(status);
CREATE INDEX idx_intake_cases_agent ON public.intake_cases(agent);
