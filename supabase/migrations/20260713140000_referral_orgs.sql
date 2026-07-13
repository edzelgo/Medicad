-- Group D #45 — referral partner organization records. Turns the free-text
-- "source" into structured, reportable partner entities. Additive; server code
-- degrades gracefully until applied via Lovable.

CREATE TABLE IF NOT EXISTS public.referral_orgs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  org_type text,                          -- Facility | Attorney | Hospital | Agency | Other
  contact_name text,
  contact_email text,
  contact_phone text,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name)
);

ALTER TABLE public.referral_orgs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read referral orgs" ON public.referral_orgs;
CREATE POLICY "Staff read referral orgs"
  ON public.referral_orgs FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'agent')
    OR public.has_role(auth.uid(), 'marketer')
  );

DROP POLICY IF EXISTS "Admins manage referral orgs" ON public.referral_orgs;
CREATE POLICY "Admins manage referral orgs"
  ON public.referral_orgs FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Link a lead to a referral partner org.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'referral_org_id'
  ) THEN
    ALTER TABLE public.leads
      ADD COLUMN referral_org_id uuid REFERENCES public.referral_orgs(id) ON DELETE SET NULL;
  END IF;
END $$;
