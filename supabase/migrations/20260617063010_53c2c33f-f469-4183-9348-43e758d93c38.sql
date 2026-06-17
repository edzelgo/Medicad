REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.portal_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.portal_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.admin_set_user_role(uuid, public.portal_role, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, public.portal_role, text) TO authenticated, service_role;
