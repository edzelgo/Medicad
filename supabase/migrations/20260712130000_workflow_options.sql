-- Self-service dropdown options (Bolt parity: "Fully Customizable Workflows").
-- Replaces the hardcoded option constants with an admin-editable table.
-- Server code falls back to the in-code constants until this migration is applied.

CREATE TABLE IF NOT EXISTS public.workflow_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category, label)
);

ALTER TABLE public.workflow_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read options" ON public.workflow_options;
CREATE POLICY "Staff can read options"
  ON public.workflow_options FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'agent')
    OR public.has_role(auth.uid(), 'marketer')
    OR public.has_role(auth.uid(), 'referral')
  );

DROP POLICY IF EXISTS "Admins manage options" ON public.workflow_options;
CREATE POLICY "Admins manage options"
  ON public.workflow_options FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed from the current in-code constants (idempotent).
INSERT INTO public.workflow_options (category, label, sort_order) VALUES
  ('medicaid_workflow', 'OLD Medicaid Application', 0),
  ('medicaid_workflow', 'New Medicaid Application', 1),
  ('medicaid_workflow', 'Texas Application', 2),
  ('medicaid_workflow', 'Pennsylvania Application', 3),
  ('medicaid_workflow', 'CommCare', 4),
  ('medicaid_status', 'Workflow Created', 0),
  ('medicaid_status', 'Intake Interview', 1),
  ('medicaid_status', 'Gathering Documents', 2),
  ('medicaid_status', 'Verifications Pending', 3),
  ('medicaid_status', 'Application Pending', 4),
  ('medicaid_status', 'Application Filed', 5),
  ('medicaid_status', 'Minor Corrective Action', 6),
  ('medicaid_status', 'Major Corrective Action', 7),
  ('medicaid_status', 'Fair Hearing', 8),
  ('medicaid_status', 'Application Approved', 9),
  ('medicaid_status', 'Application Denied', 10),
  ('medicaid_status', 'Pending', 11),
  ('cg_workflow', 'Caregiver Intake', 0),
  ('cg_workflow', 'Caregiver Services Active', 1),
  ('cg_workflow', 'Caregiver Services On Hold', 2),
  ('cg_workflow', 'Caregiver Services Closed', 3),
  ('cg_status', 'Referral Received', 0),
  ('cg_status', 'Assessment Scheduled', 1),
  ('cg_status', 'Assessment Complete', 2),
  ('cg_status', 'Care Plan Active', 3),
  ('cg_status', 'Care Plan Paused', 4),
  ('cg_status', 'Discharged', 5),
  ('referral_type', 'Agent', 0),
  ('referral_type', 'Attorney', 1),
  ('referral_type', 'Discharge Planner', 2),
  ('referral_type', 'Facility', 3),
  ('referral_type', 'Family Member', 4),
  ('referral_type', 'Hospital', 5),
  ('referral_type', 'Marketer', 6),
  ('referral_type', 'Self', 7),
  ('referral_type', 'Other', 8),
  ('referral_source_type', 'Marketer', 0),
  ('referral_source_type', 'Facility', 1),
  ('referral_source_type', 'Referral Partner', 2),
  ('referral_source_type', 'Web', 3),
  ('referral_source_type', 'Other', 4),
  ('veteran_status', 'Not a veteran', 0),
  ('veteran_status', 'Veteran', 1),
  ('veteran_status', 'Spouse of veteran', 2),
  ('veteran_status', 'Unknown', 3),
  ('marital_status', 'Single', 0),
  ('marital_status', 'Married', 1),
  ('marital_status', 'Divorced', 2),
  ('marital_status', 'Widowed', 3),
  ('marital_status', 'Separated', 4),
  ('brochure_provided', 'Mailed', 0),
  ('brochure_provided', 'Emailed', 1),
  ('brochure_provided', 'Handed in person', 2),
  ('brochure_provided', 'Not yet provided', 3),
  ('asset_requirement', 'Yes', 0),
  ('asset_requirement', 'No', 1),
  ('asset_requirement', 'Unknown', 2)
ON CONFLICT (category, label) DO NOTHING;
