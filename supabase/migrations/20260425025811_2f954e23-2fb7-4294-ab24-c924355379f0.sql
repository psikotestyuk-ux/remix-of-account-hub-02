-- Buat user admin baru dengan email internal jika belum ada, dan assign role admin
DO $$
DECLARE
  v_new_id uuid;
  v_old_id uuid;
BEGIN
  -- Cari user lama
  SELECT id INTO v_old_id FROM auth.users WHERE email = 'admin@jualakunfb.com' LIMIT 1;

  -- Cek apakah user baru sudah ada
  SELECT id INTO v_new_id FROM auth.users WHERE email = 'admin@buyingaccount.local' LIMIT 1;

  IF v_new_id IS NULL THEN
    -- Buat user baru dengan email_confirmed
    v_new_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin, confirmation_token,
      email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_new_id,
      'authenticated',
      'authenticated',
      'admin@buyingaccount.local',
      crypt('admin123', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Super Admin"}'::jsonb,
      false, '', '', '', ''
    );

    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (
      gen_random_uuid(),
      v_new_id,
      jsonb_build_object('sub', v_new_id::text, 'email', 'admin@buyingaccount.local', 'email_verified', true),
      'email',
      v_new_id::text,
      now(), now(), now()
    );
  END IF;

  -- Pastikan role admin
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_new_id, 'admin')
  ON CONFLICT DO NOTHING;

  -- Hapus user admin lama jika ada
  IF v_old_id IS NOT NULL THEN
    DELETE FROM public.user_roles WHERE user_id = v_old_id;
    DELETE FROM auth.identities WHERE user_id = v_old_id;
    DELETE FROM auth.users WHERE id = v_old_id;
  END IF;
END $$;

-- Update trigger admin auto-assign agar pakai email baru
CREATE OR REPLACE FUNCTION public.handle_new_admin_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.email = 'admin@buyingaccount.local' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;