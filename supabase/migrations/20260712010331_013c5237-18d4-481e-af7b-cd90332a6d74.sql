DO $$
DECLARE
  v_admin uuid;
BEGIN
  UPDATE auth.users
    SET email_confirmed_at = now()
    WHERE email IN (
      'edzelgo112+admin@gmail.com',
      'edzelgo112+agent@gmail.com',
      'edzelgo112+referral@gmail.com',
      'edzelgo112+client@gmail.com'
    )
    AND email_confirmed_at IS NULL;

  SELECT id INTO v_admin FROM auth.users WHERE email = 'edzelgo112+admin@gmail.com';
  IF v_admin IS NOT NULL THEN
    DELETE FROM public.user_roles WHERE user_id = v_admin AND role <> 'admin';
    INSERT INTO public.user_roles (user_id, role, status)
    VALUES (v_admin, 'admin', 'approved')
    ON CONFLICT (user_id, role) DO UPDATE SET status = 'approved';
  END IF;

  UPDATE public.user_roles ur
    SET status = 'approved'
    FROM auth.users u
    WHERE ur.user_id = u.id
      AND u.email IN ('edzelgo112+agent@gmail.com', 'edzelgo112+referral@gmail.com');
END $$;