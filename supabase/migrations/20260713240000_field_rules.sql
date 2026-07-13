-- Group B #18 — conditional/logic-based intake fields. Each rule shows or
-- requires a form field when a condition on another field holds. Enforced on
-- the client (visibility + submit validation). Additive; if the table is absent
-- no rules apply and the form behaves as before.

CREATE TABLE IF NOT EXISTS public.field_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form text NOT NULL DEFAULT 'intake',
  field text NOT NULL,
  condition_field text NOT NULL,
  operator text NOT NULL,                 -- equals | not_equals | contains | truthy | falsy
  condition_value text,
  action text NOT NULL,                   -- show | require
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (form, field, condition_field, operator, condition_value, action)
);

ALTER TABLE public.field_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read field rules" ON public.field_rules;
CREATE POLICY "Staff read field rules"
  ON public.field_rules FOR SELECT
  USING (
    public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'agent') OR public.has_role(auth.uid(),'marketer') OR public.has_role(auth.uid(),'referral')
  );

DROP POLICY IF EXISTS "Admins manage field rules" ON public.field_rules;
CREATE POLICY "Admins manage field rules"
  ON public.field_rules FOR ALL
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
