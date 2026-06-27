
-- Stage enum
DO $$ BEGIN
  CREATE TYPE public.lead_stage AS ENUM ('new','intake','screening','application','submitted','approved','denied','closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Extend leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS middle_initial text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS zip text,
  ADD COLUMN IF NOT EXISTS dob date,
  ADD COLUMN IF NOT EXISTS ssn text,
  ADD COLUMN IF NOT EXISTS stage public.lead_stage NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referral_status text,
  ADD COLUMN IF NOT EXISTS veteran_status text,
  ADD COLUMN IF NOT EXISTS marital_status text,
  ADD COLUMN IF NOT EXISTS spouse_first_name text,
  ADD COLUMN IF NOT EXISTS spouse_last_name text,
  ADD COLUMN IF NOT EXISTS spouse_dob date,
  ADD COLUMN IF NOT EXISTS spouse_ssn text,
  ADD COLUMN IF NOT EXISTS has_lri boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lri_first_name text,
  ADD COLUMN IF NOT EXISTS lri_last_name text,
  ADD COLUMN IF NOT EXISTS lri_phone text,
  ADD COLUMN IF NOT EXISTS lri_email text,
  ADD COLUMN IF NOT EXISTS lri_status text,
  ADD COLUMN IF NOT EXISTS spend_down_completed boolean,
  ADD COLUMN IF NOT EXISTS transferred_resources_60mo boolean,
  ADD COLUMN IF NOT EXISTS transfer_amount numeric,
  ADD COLUMN IF NOT EXISTS retroactive_required boolean,
  ADD COLUMN IF NOT EXISTS date_first_coverage date,
  ADD COLUMN IF NOT EXISTS estimated_spend_down_remaining numeric,
  ADD COLUMN IF NOT EXISTS brochure_provided text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS household_size int,
  ADD COLUMN IF NOT EXISTS monthly_income numeric,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Make first/last not enforced as strictly (allow marketing form fallback); keep email required.
ALTER TABLE public.leads ALTER COLUMN first_name DROP NOT NULL;
ALTER TABLE public.leads ALTER COLUMN last_name DROP NOT NULL;
ALTER TABLE public.leads ALTER COLUMN email DROP NOT NULL;

-- Drop the strict public insert policy so the public endpoint can insert flexible records (server route uses service_role anyway, but keep an anon-safe policy too).
DROP POLICY IF EXISTS "leads_insert_public" ON public.leads;
CREATE POLICY "leads_insert_public" ON public.leads
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    (first_name IS NULL OR length(first_name) <= 100)
    AND (last_name IS NULL OR length(last_name) <= 100)
    AND (full_name IS NULL OR length(full_name) <= 200)
    AND (email IS NULL OR (length(email) BETWEEN 3 AND 255 AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'))
    AND (phone IS NULL OR length(phone) <= 40)
    AND (message IS NULL OR length(message) <= 5000)
    AND (notes IS NULL OR length(notes) <= 10000)
  );

-- CRM staff visibility
CREATE POLICY "leads_select_staff" ON public.leads
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (public.has_role(auth.uid(), 'agent')
        AND (created_by = auth.uid() OR assigned_to = auth.uid()))
  );

CREATE POLICY "leads_update_staff" ON public.leads
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (public.has_role(auth.uid(), 'agent')
        AND (created_by = auth.uid() OR assigned_to = auth.uid()))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR (public.has_role(auth.uid(), 'agent')
        AND (created_by = auth.uid() OR assigned_to = auth.uid()))
  );

CREATE POLICY "leads_delete_admin" ON public.leads
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS leads_touch_updated_at ON public.leads;
CREATE TRIGGER leads_touch_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Activities
CREATE TABLE IF NOT EXISTS public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'note',
  content text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.activities TO authenticated;
GRANT ALL ON public.activities TO service_role;

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activities_select" ON public.activities
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = activities.lead_id
        AND (l.created_by = auth.uid() OR l.assigned_to = auth.uid())
    )
  );

CREATE POLICY "activities_insert" ON public.activities
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      public.has_role(auth.uid(), 'admin')
      OR EXISTS (
        SELECT 1 FROM public.leads l
        WHERE l.id = activities.lead_id
          AND (l.created_by = auth.uid() OR l.assigned_to = auth.uid())
      )
    )
  );

CREATE POLICY "activities_delete_admin_or_author" ON public.activities
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Ensure user_roles INSERT/DELETE admin-only (replace if existing permissive policies)
DROP POLICY IF EXISTS "user_roles_insert_admin" ON public.user_roles;
CREATE POLICY "user_roles_insert_admin" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "user_roles_delete_admin" ON public.user_roles;
CREATE POLICY "user_roles_delete_admin" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
