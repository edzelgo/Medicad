-- Add a 'marketer' value to the portal_role enum (idempotent), matching Bolt's User Type list
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'portal_role' AND e.enumlabel = 'marketer'
  ) THEN
    ALTER TYPE public.portal_role ADD VALUE 'marketer';
  END IF;
END $$;
