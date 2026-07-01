
CREATE TABLE public.intake_case_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.intake_cases(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text,
  field text NOT NULL,
  old_value text,
  new_value text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.intake_case_events TO authenticated;
GRANT ALL ON public.intake_case_events TO service_role;

ALTER TABLE public.intake_case_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view intake case events"
  ON public.intake_case_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'agent'));

CREATE POLICY "Staff can insert intake case events"
  ON public.intake_case_events FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'agent'));

CREATE INDEX idx_intake_case_events_case_created
  ON public.intake_case_events(case_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.log_intake_case_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_email text;
BEGIN
  IF v_actor IS NOT NULL THEN
    SELECT email INTO v_email FROM auth.users WHERE id = v_actor;
  END IF;

  IF NEW.workflow IS DISTINCT FROM OLD.workflow THEN
    INSERT INTO public.intake_case_events(case_id, actor_id, actor_email, field, old_value, new_value)
    VALUES (NEW.id, v_actor, v_email, 'workflow', OLD.workflow, NEW.workflow);
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.intake_case_events(case_id, actor_id, actor_email, field, old_value, new_value)
    VALUES (NEW.id, v_actor, v_email, 'status', OLD.status, NEW.status);
  END IF;
  IF NEW.agent IS DISTINCT FROM OLD.agent THEN
    INSERT INTO public.intake_case_events(case_id, actor_id, actor_email, field, old_value, new_value)
    VALUES (NEW.id, v_actor, v_email, 'agent', OLD.agent, NEW.agent);
  END IF;
  IF NEW.follow_up_date IS DISTINCT FROM OLD.follow_up_date THEN
    INSERT INTO public.intake_case_events(case_id, actor_id, actor_email, field, old_value, new_value)
    VALUES (NEW.id, v_actor, v_email, 'follow_up_date',
      OLD.follow_up_date::text, NEW.follow_up_date::text);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_intake_case_change ON public.intake_cases;
CREATE TRIGGER trg_log_intake_case_change
  AFTER UPDATE ON public.intake_cases
  FOR EACH ROW EXECUTE FUNCTION public.log_intake_case_change();
