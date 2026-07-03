
-- 1) Drop overly broad anon insert on leads. The public contact form
-- uses a server-side route with service-role credentials, so anon
-- direct-INSERT into leads is not required.
DROP POLICY IF EXISTS leads_insert_anon_contact ON public.leads;

-- 2) Replace permissive staff update on profiles with a tightened one:
-- admins keep full update; agents can only update profiles where they
-- are already the assigned agent, and cannot reassign to anyone else.
DROP POLICY IF EXISTS "Staff can update application status" ON public.profiles;

CREATE POLICY "Admins can update any profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Agents can update their assigned profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'agent')
  AND assigned_agent_id = auth.uid()
)
WITH CHECK (
  public.has_role(auth.uid(), 'agent')
  AND assigned_agent_id = auth.uid()
);
