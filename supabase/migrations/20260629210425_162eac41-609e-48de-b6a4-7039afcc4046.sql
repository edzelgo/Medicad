
-- Revoke anon EXECUTE on internal trigger-only SECURITY DEFINER function
REVOKE EXECUTE ON FUNCTION public.on_application_status_change() FROM anon, authenticated, PUBLIC;

-- Tighten authenticated leads INSERT policy (was WITH CHECK (true))
DROP POLICY IF EXISTS leads_insert_authenticated ON public.leads;
CREATE POLICY leads_insert_authenticated ON public.leads
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'agent'));
