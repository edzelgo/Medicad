-- Group B #19 — stage entry/exit validation rules. Each rule gates entry into a
-- target status of a workflow. Enforced server-side in updateIntakeCase.
-- Additive; if the table is absent no rules apply (fail-open).
--
-- rule_type:
--   reason_required     — a status_reason must be supplied to enter target_status
--   checklist_complete  — the workflow's document checklist must be 100% first
--   no_skip             — cannot jump forward more than one step (target_status = '*')

CREATE TABLE IF NOT EXISTS public.workflow_transition_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow text NOT NULL,
  target_status text NOT NULL DEFAULT '*',
  rule_type text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workflow, target_status, rule_type)
);

ALTER TABLE public.workflow_transition_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read transition rules" ON public.workflow_transition_rules;
CREATE POLICY "Staff read transition rules"
  ON public.workflow_transition_rules FOR SELECT
  USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'agent') OR public.has_role(auth.uid(),'marketer')
  );

DROP POLICY IF EXISTS "Admins manage transition rules" ON public.workflow_transition_rules;
CREATE POLICY "Admins manage transition rules"
  ON public.workflow_transition_rules FOR ALL
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
