-- Group D #41 (pipeline unification) — link a lead to the client portal account
-- created for it, so the lead pipeline, the client's document checklist, and any
-- case all reference one identity instead of living in disconnected silos.
-- Additive; server code degrades gracefully until applied via Lovable.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'client_user_id'
  ) THEN
    ALTER TABLE public.leads
      ADD COLUMN client_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS leads_client_user_idx ON public.leads (client_user_id);
