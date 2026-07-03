-- "Other" Medicaid-specific intake questions from Bolt's Add New Case form, missed in the
-- initial cases/case_tracks split.
ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS meets_asset_requirements TEXT,
  ADD COLUMN IF NOT EXISTS months_until_spend_down INTEGER,
  ADD COLUMN IF NOT EXISTS transferred_resources_60mo BOOLEAN,
  ADD COLUMN IF NOT EXISTS transfer_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS brochure_provided TEXT[];
