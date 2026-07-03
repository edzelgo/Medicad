-- Expose case_type on the dashboard view so the Medicaid/Caregiver (CG) tabs can filter on it.
CREATE OR REPLACE VIEW public.intake_case_view
WITH (security_invoker = on) AS
SELECT
  ct.id,
  c.case_number AS case_id,
  ct.date_received,
  c.first_name,
  c.last_name,
  c.phone_cell AS phone,
  ct.ref_source,
  ct.marketer,
  ct.notes_count,
  ct.follow_up_date,
  ct.follow_count,
  ct.workflow,
  ct.status,
  ct.status_date,
  (SELECT count(*) FROM public.case_tracks t2 WHERE t2.case_id = c.id) AS track_count,
  ct.agent,
  c.id AS case_pk,
  c.case_type
FROM public.case_tracks ct
JOIN public.cases c ON c.id = ct.case_id;

GRANT SELECT ON public.intake_case_view TO authenticated;
