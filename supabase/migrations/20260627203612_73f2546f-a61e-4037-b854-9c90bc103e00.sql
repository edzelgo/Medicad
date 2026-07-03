-- Add application status and assigned agent to profiles for the client application pipeline.
CREATE TYPE public.application_status AS ENUM (
  'new_lead', 'documents_pending', 'under_review', 'submitted_to_medicaid', 'approved', 'denied'
);

ALTER TABLE public.profiles
  ADD COLUMN application_status public.application_status NOT NULL DEFAULT 'new_lead',
  ADD COLUMN assigned_agent_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN application_status_updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX profiles_application_status_idx ON public.profiles(application_status);
CREATE INDEX profiles_assigned_agent_idx ON public.profiles(assigned_agent_id);

-- Allow admins and agents to read and update application_status / assigned_agent on any profile.
CREATE POLICY "Staff can view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'agent'));

CREATE POLICY "Staff can update application status"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'agent'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'agent'));