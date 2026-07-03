
UPDATE auth.users
SET encrypted_password = crypt('MedicaidAdmin!2026', gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
WHERE email IN ('edzelgo112@gmail.com','dean@medicaidsuccess.com','mike@medicaidsuccess.com');

INSERT INTO public.user_roles (user_id, role, status)
SELECT u.id, 'admin'::public.portal_role, 'approved'
FROM auth.users u
WHERE u.email IN ('edzelgo112@gmail.com','dean@medicaidsuccess.com','mike@medicaidsuccess.com')
ON CONFLICT (user_id, role) DO UPDATE SET status = 'approved';

INSERT INTO public.profiles (id, full_name)
SELECT u.id, split_part(u.email,'@',1)
FROM auth.users u
WHERE u.email IN ('edzelgo112@gmail.com','dean@medicaidsuccess.com','mike@medicaidsuccess.com')
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE
  new_id uuid;
  rec record;
BEGIN
  FOR rec IN
    SELECT * FROM (VALUES
      ('client.test@medicaidsuccess.com',  'client',   'Test Client'),
      ('referral.test@medicaidsuccess.com','referral', 'Test Referral'),
      ('agent.test@medicaidsuccess.com',   'agent',    'Test Agent')
    ) AS t(email, role_text, full_name)
  LOOP
    SELECT id INTO new_id FROM auth.users WHERE email = rec.email;
    IF new_id IS NULL THEN
      new_id := gen_random_uuid();
      INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, confirmation_token, email_change,
        email_change_token_new, recovery_token
      ) VALUES (
        new_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        rec.email, crypt('Portal!2026', gen_salt('bf')),
        now(), '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', rec.full_name, 'role', rec.role_text),
        now(), now(), '', '', '', ''
      );
    ELSE
      UPDATE auth.users
      SET encrypted_password = crypt('Portal!2026', gen_salt('bf')),
          email_confirmed_at = COALESCE(email_confirmed_at, now()),
          updated_at = now()
      WHERE id = new_id;
    END IF;

    INSERT INTO public.profiles (id, full_name)
    VALUES (new_id, rec.full_name)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.user_roles (user_id, role, status)
    VALUES (new_id, rec.role_text::public.portal_role, 'approved')
    ON CONFLICT (user_id, role) DO UPDATE SET status = 'approved';
  END LOOP;
END $$;
