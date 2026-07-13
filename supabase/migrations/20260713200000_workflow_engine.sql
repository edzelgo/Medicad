-- Group B #15/#17 — deeper workflow engine. Separate tables (rather than
-- extending workflow_options) so the existing options system and its
-- (category,label) unique constraint are untouched. Additive; server code
-- degrades gracefully until applied via Lovable.

-- B#15 — per-workflow status sets. A workflow (e.g. "Texas Application") can
-- define its own ordered status list; UIs fall back to the shared category
-- list when a workflow has no specific statuses.
CREATE TABLE IF NOT EXISTS public.workflow_status_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow text NOT NULL,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workflow, label)
);

-- B#17 — per-workflow required-document definitions.
CREATE TABLE IF NOT EXISTS public.workflow_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow text NOT NULL,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workflow, label)
);

-- B#17 — per-case tick-off of those requirements.
CREATE TABLE IF NOT EXISTS public.case_requirement_checks (
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  requirement_label text NOT NULL,
  satisfied boolean NOT NULL DEFAULT true,
  checked_by uuid,
  checked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (case_id, requirement_label)
);

ALTER TABLE public.workflow_status_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_requirement_checks ENABLE ROW LEVEL SECURITY;

-- Config tables: staff read, admins manage.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['workflow_status_sets', 'workflow_requirements'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Staff read %1$s" ON public.%1$s', t);
    EXECUTE format($p$CREATE POLICY "Staff read %1$s" ON public.%1$s FOR SELECT
      USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'agent') OR public.has_role(auth.uid(),'marketer'))$p$, t);
    EXECUTE format('DROP POLICY IF EXISTS "Admins manage %1$s" ON public.%1$s', t);
    EXECUTE format($p$CREATE POLICY "Admins manage %1$s" ON public.%1$s FOR ALL
      USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'))$p$, t);
  END LOOP;
END $$;

-- Case checks: any staff (admin/agent) may read and write.
DROP POLICY IF EXISTS "Staff manage case checks" ON public.case_requirement_checks;
CREATE POLICY "Staff manage case checks"
  ON public.case_requirement_checks FOR ALL
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'agent'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'agent'));
