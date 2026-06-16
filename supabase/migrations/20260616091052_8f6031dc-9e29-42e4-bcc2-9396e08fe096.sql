
-- Roles
CREATE TYPE public.portal_role AS ENUM ('agent', 'referral', 'client');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- User roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.portal_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.portal_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Documents
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "documents_select_own" ON public.documents FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "documents_insert_own" ON public.documents FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "documents_delete_own" ON public.documents FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX documents_user_idx ON public.documents (user_id, created_at DESC);

-- Check-ins (status timeline)
CREATE TABLE public.check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'info',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.check_ins TO authenticated;
GRANT ALL ON public.check_ins TO service_role;
ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "check_ins_select_own" ON public.check_ins FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "check_ins_insert_own" ON public.check_ins FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE INDEX check_ins_user_idx ON public.check_ins (user_id, created_at DESC);

-- Tasks (company action checklist)
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  sort_order INT NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks_select_own" ON public.tasks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "tasks_update_own" ON public.tasks FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tasks_insert_own" ON public.tasks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Auto-create profile, role, starter tasks, and welcome check-in on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role public.portal_role;
  v_role_text TEXT;
BEGIN
  v_role_text := COALESCE(NEW.raw_user_meta_data->>'role', 'client');
  IF v_role_text NOT IN ('agent','referral','client') THEN
    v_role_text := 'client';
  END IF;
  v_role := v_role_text::public.portal_role;

  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NULL),
    NEW.raw_user_meta_data->>'phone'
  );

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role);

  INSERT INTO public.check_ins (user_id, title, body, status)
  VALUES (NEW.id, 'Welcome to Medicaid Success', 'Your portal is ready. Upload your documents to begin onboarding.', 'info');

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
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
