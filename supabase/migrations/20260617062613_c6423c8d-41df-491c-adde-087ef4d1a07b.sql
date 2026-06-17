-- Tighten RLS policies for owner-only mutations and lock down user_roles

-- check_ins: add UPDATE and DELETE owner policies
CREATE POLICY "check_ins_update_own" ON public.check_ins
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "check_ins_delete_own" ON public.check_ins
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- documents: add UPDATE owner policy
CREATE POLICY "documents_update_own" ON public.documents
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- tasks: add DELETE owner policy
CREATE POLICY "tasks_delete_own" ON public.tasks
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- user_roles: deny all client writes (only service_role / SECURITY DEFINER triggers can mutate)
CREATE POLICY "user_roles_no_insert" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "user_roles_no_update" ON public.user_roles
  FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "user_roles_no_delete" ON public.user_roles
  FOR DELETE TO authenticated USING (false);

-- storage.objects: add UPDATE policy mirroring existing ownership check for documents bucket
CREATE POLICY "documents_storage_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'documents' AND (auth.uid())::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'documents' AND (auth.uid())::text = (storage.foldername(name))[1]);
