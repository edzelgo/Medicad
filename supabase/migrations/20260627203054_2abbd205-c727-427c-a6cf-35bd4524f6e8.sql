INSERT INTO public.user_roles (user_id, role, status) VALUES
  ('6fccf24f-09e6-4d5e-ba7a-c5ba68bb6537', 'admin', 'approved'),
  ('0fd51f48-8945-4a86-986e-c441e7c4aade', 'admin', 'approved')
ON CONFLICT (user_id, role) DO UPDATE SET status = 'approved';