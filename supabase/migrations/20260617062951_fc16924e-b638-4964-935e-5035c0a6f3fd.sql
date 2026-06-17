-- Add an 'admin' value to the portal_role enum (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'portal_role' AND e.enumlabel = 'admin'
  ) THEN
    ALTER TYPE public.portal_role ADD VALUE 'admin';
  END IF;
END $$;

-- Add approval status to user_roles
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved'
    CHECK (status IN ('pending','approved'));

-- Harden signup trigger: agent/referral start pending; client auto-approved
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    CASE WHEN v_status = 'pending'
      THEN 'Account pending review'
      ELSE 'Welcome to Medicaid Success' END,
    CASE WHEN v_status = 'pending'
      THEN 'Thanks for signing up. Our team will verify your ' || v_role_text || ' status and activate your portal shortly.'
      ELSE 'Your portal is ready. Upload your documents to begin onboarding.' END,
    CASE WHEN v_status = 'pending' THEN 'info' ELSE 'info' END
  );

  IF v_role = 'client' THEN
    INSERT INTO public.tasks (user_id, title, description, sort_order) VALUES
      (NEW.id, 'Verify your identity', 'We will confirm your identity using a government-issued ID.', 1),
      (NEW.id, 'Collect required documents', 'Upload proof of income, residency, and medical records.', 2),
      (NEW.id, 'Eligibility review', 'Our specialists review your Medicaid eligibility.', 3),
      (NEW.id, 'File your application', 'We submit your Medicaid application to the state agency.', 4),
      (NEW.id, 'Follow-up & approval', 'We track your case until final approval.', 5);
  ELSIF v_role = 'agent' THEN
    INSERT INTO public.tasks (user_id, title, description, sort_order) VALUES
      (NEW.id, 'Complete agent profile', 'Add your NPN, agency, and contact details.', 1),
      (NEW.id, 'Upload licensing documents', 'State licenses and E&O certificate.', 2),
      (NEW.id, 'Sign producer agreement', 'Review and sign the Medicaid Success producer contract.', 3),
      (NEW.id, 'Onboarding training', 'Schedule your onboarding training call.', 4),
      (NEW.id, 'Activate referral pipeline', 'We enable your portal for new client submissions.', 5);
  ELSE
    INSERT INTO public.tasks (user_id, title, description, sort_order) VALUES
      (NEW.id, 'Confirm referral source', 'Tell us about your organization and patient population.', 1),
      (NEW.id, 'Upload partnership documents', 'NDA, BAA, and any partnership agreements.', 2),
      (NEW.id, 'Submit referral packet', 'Provide the first patient packet for review.', 3),
      (NEW.id, 'Case assignment', 'We assign a Medicaid specialist to the referral.', 4),
      (NEW.id, 'Ongoing case updates', 'Receive weekly status updates on referred cases.', 5);
  END IF;

  RETURN NEW;
END;
$function$;

-- Admin-only function to approve or change another user's role
CREATE OR REPLACE FUNCTION public.admin_set_user_role(_user_id uuid, _role public.portal_role, _status text DEFAULT 'approved')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can change roles';
  END IF;
  IF _status NOT IN ('pending','approved') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;
  UPDATE public.user_roles
    SET role = _role, status = _status
    WHERE user_id = _user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_user_role(uuid, public.portal_role, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, public.portal_role, text) TO authenticated;
