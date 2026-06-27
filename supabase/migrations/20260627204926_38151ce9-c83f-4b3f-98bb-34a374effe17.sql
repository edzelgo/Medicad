
-- 1) has_role: require approved status
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role portal_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND status = 'approved'
  )
$$;

-- 2) leads INSERT: split anon vs authenticated; block sensitive fields for anon
DROP POLICY IF EXISTS leads_insert_public ON public.leads;

CREATE POLICY leads_insert_anon_contact
ON public.leads
FOR INSERT
TO anon
WITH CHECK (
  ssn IS NULL
  AND spouse_ssn IS NULL
  AND dob IS NULL
  AND monthly_income IS NULL
  AND transfer_amount IS NULL
);

CREATE POLICY leads_insert_authenticated
ON public.leads
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 3) Allow clients/referrals to SELECT leads they created
CREATE POLICY leads_select_own
ON public.leads
FOR SELECT
TO authenticated
USING (auth.uid() = created_by);
