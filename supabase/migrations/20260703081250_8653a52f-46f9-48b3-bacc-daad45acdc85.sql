
-- Role-aware "Company action" check-ins: things the company owes each account.
CREATE TABLE public.account_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.portal_role NOT NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending',
  owner text NOT NULL DEFAULT 'company',           -- 'company' | 'client' | 'agent'
  sort_order integer NOT NULL DEFAULT 0,
  due_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT account_actions_status_check
    CHECK (status IN ('pending','in_progress','waiting_on_client','complete','blocked'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_actions TO authenticated;
GRANT ALL ON public.account_actions TO service_role;

ALTER TABLE public.account_actions ENABLE ROW LEVEL SECURITY;

-- Owners see their own actions.
CREATE POLICY "own_actions_select" ON public.account_actions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Only admins/staff can insert/update/delete; users cannot self-edit status.
CREATE POLICY "admin_actions_insert" ON public.account_actions
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_actions_update" ON public.account_actions
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_actions_delete" ON public.account_actions
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_account_actions_user ON public.account_actions(user_id, sort_order);

CREATE TRIGGER trg_account_actions_updated
  BEFORE UPDATE ON public.account_actions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Auto-stamp completed_at.
CREATE OR REPLACE FUNCTION public.account_actions_stamp_complete()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'complete' AND (OLD.status IS DISTINCT FROM 'complete') THEN
    NEW.completed_at := now();
  ELSIF NEW.status <> 'complete' THEN
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_account_actions_stamp_complete
  BEFORE INSERT OR UPDATE ON public.account_actions
  FOR EACH ROW EXECUTE FUNCTION public.account_actions_stamp_complete();

-- Extend new-user handler to seed role-specific company actions.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role public.portal_role;
  v_role_text TEXT;
  v_status TEXT;
BEGIN
  v_role_text := COALESCE(NEW.raw_user_meta_data->>'role', 'client');
  IF v_role_text NOT IN ('agent','referral','client') THEN
    v_role_text := 'client';
  END IF;
  v_role := v_role_text::public.portal_role;
  v_status := CASE WHEN v_role = 'client' THEN 'approved' ELSE 'pending' END;

  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NULL),
    NEW.raw_user_meta_data->>'phone'
  );

  INSERT INTO public.user_roles (user_id, role, status) VALUES (NEW.id, v_role, v_status);

  INSERT INTO public.check_ins (user_id, title, body, status)
  VALUES (
    NEW.id,
    CASE WHEN v_status = 'pending' THEN 'Account pending review' ELSE 'Welcome to Medicaid Success' END,
    CASE WHEN v_status = 'pending'
      THEN 'Thanks for signing up. Our team will verify your ' || v_role_text || ' status and activate your portal shortly.'
      ELSE 'Your portal is ready. Upload your documents to begin onboarding.' END,
    'info'
  );

  IF v_role = 'client' THEN
    INSERT INTO public.tasks (user_id, title, description, sort_order) VALUES
      (NEW.id, 'Verify your identity', 'We will confirm your identity using a government-issued ID.', 1),
      (NEW.id, 'Collect required documents', 'Upload proof of income, residency, and medical records.', 2),
      (NEW.id, 'Eligibility review', 'Our specialists review your Medicaid eligibility.', 3),
      (NEW.id, 'File your application', 'We submit your Medicaid application to the state agency.', 4),
      (NEW.id, 'Follow-up & approval', 'We track your case until final approval.', 5);

    INSERT INTO public.account_actions (user_id, role, title, description, owner, sort_order, status) VALUES
      (NEW.id, v_role, 'Assign a Medicaid specialist', 'A Certified Medicaid Planner will be assigned to your case within 1 business day.', 'company', 1, 'pending'),
      (NEW.id, v_role, 'Initial intake call',           'Schedule a 20-minute intake call to review your situation.', 'company', 2, 'pending'),
      (NEW.id, v_role, 'Document completeness review',  'We audit your uploads against the state checklist.', 'company', 3, 'waiting_on_client'),
      (NEW.id, v_role, 'Asset-protection strategy',     'We build a plan to preserve assets while qualifying for LTC Medicaid.', 'company', 4, 'pending'),
      (NEW.id, v_role, 'Prepare & submit application',  'We prepare and file the Medicaid application with the state.', 'company', 5, 'pending'),
      (NEW.id, v_role, 'Caseworker liaison',            'We handle every state caseworker request until approval.', 'company', 6, 'pending'),
      (NEW.id, v_role, 'Annual recertification',        'We manage recertifications so coverage never lapses.', 'company', 7, 'pending');

  ELSIF v_role = 'agent' THEN
    INSERT INTO public.tasks (user_id, title, description, sort_order) VALUES
      (NEW.id, 'Complete agent profile', 'Add your NPN, agency, and contact details.', 1),
      (NEW.id, 'Upload licensing documents', 'State licenses and E&O certificate.', 2),
      (NEW.id, 'Sign producer agreement', 'Review and sign the Medicaid Success producer contract.', 3),
      (NEW.id, 'Onboarding training', 'Schedule your onboarding training call.', 4),
      (NEW.id, 'Activate referral pipeline', 'We enable your portal for new client submissions.', 5);

    INSERT INTO public.account_actions (user_id, role, title, description, owner, sort_order, status) VALUES
      (NEW.id, v_role, 'Verify agent credentials',   'Confirm NPN and state licensing.', 'company', 1, 'pending'),
      (NEW.id, v_role, 'Countersign producer agreement', 'Compliance countersigns and returns the executed agreement.', 'company', 2, 'waiting_on_client'),
      (NEW.id, v_role, 'Provision portal & training', 'Grant portal access and schedule onboarding training.', 'company', 3, 'pending'),
      (NEW.id, v_role, 'Assign account manager',     'A dedicated account manager is assigned to your book.', 'company', 4, 'pending'),
      (NEW.id, v_role, 'Enable commissions payout',  'Set up ACH and 1099 details for commissions.', 'company', 5, 'pending'),
      (NEW.id, v_role, 'Quarterly business review',  'Recurring QBR to track pipeline and approvals.', 'company', 6, 'pending');

  ELSE
    INSERT INTO public.tasks (user_id, title, description, sort_order) VALUES
      (NEW.id, 'Confirm referral source', 'Tell us about your organization and patient population.', 1),
      (NEW.id, 'Upload partnership documents', 'NDA, BAA, and any partnership agreements.', 2),
      (NEW.id, 'Submit referral packet', 'Provide the first patient packet for review.', 3),
      (NEW.id, 'Case assignment', 'We assign a Medicaid specialist to the referral.', 4),
      (NEW.id, 'Ongoing case updates', 'Receive weekly status updates on referred cases.', 5);

    INSERT INTO public.account_actions (user_id, role, title, description, owner, sort_order, status) VALUES
      (NEW.id, v_role, 'Verify referral partner',   'Confirm organization details and points of contact.', 'company', 1, 'pending'),
      (NEW.id, v_role, 'Execute NDA & BAA',         'Legal countersigns partnership and privacy agreements.', 'company', 2, 'waiting_on_client'),
      (NEW.id, v_role, 'Assign intake coordinator', 'A coordinator triages every referred case within 24h.', 'company', 3, 'pending'),
      (NEW.id, v_role, 'Configure referral pipeline','Enable secure packet submission for your team.', 'company', 4, 'pending'),
      (NEW.id, v_role, 'Weekly status reporting',   'Automated weekly status reports on all referred cases.', 'company', 5, 'pending'),
      (NEW.id, v_role, 'Quarterly partnership review','QBR to review outcomes and expand the partnership.', 'company', 6, 'pending');
  END IF;

  RETURN NEW;
END $$;

-- Backfill for existing users so the section isn't empty for current accounts.
INSERT INTO public.account_actions (user_id, role, title, description, owner, sort_order, status)
SELECT ur.user_id, ur.role,
       t.title, t.description, 'company', t.sort_order, t.status
FROM public.user_roles ur
CROSS JOIN LATERAL (
  VALUES
    ('client'::public.portal_role, 1, 'Assign a Medicaid specialist', 'A Certified Medicaid Planner will be assigned to your case within 1 business day.', 'pending'),
    ('client', 2, 'Initial intake call',           'Schedule a 20-minute intake call to review your situation.', 'pending'),
    ('client', 3, 'Document completeness review',  'We audit your uploads against the state checklist.', 'waiting_on_client'),
    ('client', 4, 'Asset-protection strategy',     'We build a plan to preserve assets while qualifying for LTC Medicaid.', 'pending'),
    ('client', 5, 'Prepare & submit application',  'We prepare and file the Medicaid application with the state.', 'pending'),
    ('client', 6, 'Caseworker liaison',            'We handle every state caseworker request until approval.', 'pending'),
    ('client', 7, 'Annual recertification',        'We manage recertifications so coverage never lapses.', 'pending'),
    ('agent',  1, 'Verify agent credentials',   'Confirm NPN and state licensing.', 'pending'),
    ('agent',  2, 'Countersign producer agreement', 'Compliance countersigns and returns the executed agreement.', 'waiting_on_client'),
    ('agent',  3, 'Provision portal & training', 'Grant portal access and schedule onboarding training.', 'pending'),
    ('agent',  4, 'Assign account manager',     'A dedicated account manager is assigned to your book.', 'pending'),
    ('agent',  5, 'Enable commissions payout',  'Set up ACH and 1099 details for commissions.', 'pending'),
    ('agent',  6, 'Quarterly business review',  'Recurring QBR to track pipeline and approvals.', 'pending'),
    ('referral',1,'Verify referral partner',   'Confirm organization details and points of contact.', 'pending'),
    ('referral',2,'Execute NDA & BAA',         'Legal countersigns partnership and privacy agreements.', 'waiting_on_client'),
    ('referral',3,'Assign intake coordinator', 'A coordinator triages every referred case within 24h.', 'pending'),
    ('referral',4,'Configure referral pipeline','Enable secure packet submission for your team.', 'pending'),
    ('referral',5,'Weekly status reporting',   'Automated weekly status reports on all referred cases.', 'pending'),
    ('referral',6,'Quarterly partnership review','QBR to review outcomes and expand the partnership.', 'pending')
) AS t(role, sort_order, title, description, status)
WHERE t.role = ur.role
  AND ur.role IN ('client','agent','referral')
  AND NOT EXISTS (
    SELECT 1 FROM public.account_actions a WHERE a.user_id = ur.user_id
  );
