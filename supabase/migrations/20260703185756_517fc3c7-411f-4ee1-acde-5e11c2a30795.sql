CREATE POLICY "Agents can view imported CRM leads"
ON public.leads
FOR SELECT
TO authenticated
USING (
  source = 'imported'
  AND public.has_role(auth.uid(), 'agent')
);