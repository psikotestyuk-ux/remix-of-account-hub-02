
-- ============================================
-- FUNGSI TOPUP YANG AMAN (server-side)
-- ============================================
CREATE OR REPLACE FUNCTION public.topup_wallet(_amount bigint, _payment_method text DEFAULT 'xendit_mock', _notes text DEFAULT NULL)
RETURNS TABLE (success boolean, new_balance bigint, transaction_id uuid, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_current bigint;
  v_new bigint;
  v_tx uuid;
BEGIN
  IF v_user IS NULL THEN
    RETURN QUERY SELECT false, 0::bigint, NULL::uuid, 'Tidak login'::text;
    RETURN;
  END IF;
  IF _amount < 10000 OR _amount > 50000000 THEN
    RETURN QUERY SELECT false, 0::bigint, NULL::uuid, 'Nominal di luar batas (Rp 10rb - 50jt)'::text;
    RETURN;
  END IF;

  -- Lock wallet
  SELECT balance INTO v_current FROM public.wallets WHERE user_id = v_user FOR UPDATE;
  IF v_current IS NULL THEN
    INSERT INTO public.wallets (user_id, balance) VALUES (v_user, 0);
    v_current := 0;
  END IF;
  v_new := v_current + _amount;

  UPDATE public.wallets SET balance = v_new, updated_at = now() WHERE user_id = v_user;

  INSERT INTO public.wallet_transactions (user_id, type, status, amount, balance_after, payment_method, notes)
  VALUES (v_user, 'topup', 'completed', _amount, v_new, _payment_method, COALESCE(_notes, 'Top up saldo'))
  RETURNING id INTO v_tx;

  RETURN QUERY SELECT true, v_new, v_tx, 'OK'::text;
END;
$$;

-- ============================================
-- FUNGSI PURCHASE YANG AMAN (server-side)
-- ============================================
CREATE OR REPLACE FUNCTION public.purchase_with_wallet(
  _product_id uuid,
  _quantity integer,
  _grade_id uuid DEFAULT NULL,
  _package_id uuid DEFAULT NULL,
  _customer_name text DEFAULT NULL,
  _customer_phone text DEFAULT NULL
)
RETURNS TABLE (success boolean, order_id uuid, order_number text, new_balance bigint, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_email text;
  v_current bigint;
  v_total bigint := 0;
  v_qty integer;
  v_pkg_price bigint;
  v_pkg_qty integer;
  v_grade_price bigint;
  v_product_price bigint;
  v_order_id uuid;
  v_order_num text;
  v_name text;
  v_phone text;
BEGIN
  IF v_user IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, 0::bigint, 'Tidak login'::text;
    RETURN;
  END IF;
  IF _quantity <= 0 OR _quantity > 100 THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, 0::bigint, 'Kuantitas tidak valid'::text;
    RETURN;
  END IF;

  -- Ambil email dari auth.users
  SELECT email INTO v_email FROM auth.users WHERE id = v_user;
  IF v_email IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, 0::bigint, 'User tidak ditemukan'::text;
    RETURN;
  END IF;

  -- Ambil profile sebagai default
  SELECT
    COALESCE(NULLIF(trim(_customer_name), ''), p.full_name, split_part(v_email, '@', 1)),
    COALESCE(NULLIF(trim(_customer_phone), ''), p.phone, '-')
  INTO v_name, v_phone
  FROM public.profiles p WHERE p.user_id = v_user;
  IF v_name IS NULL THEN
    v_name := COALESCE(NULLIF(trim(_customer_name), ''), split_part(v_email, '@', 1));
    v_phone := COALESCE(NULLIF(trim(_customer_phone), ''), '-');
  END IF;

  -- Hitung harga di server (cegah price tampering)
  IF _package_id IS NOT NULL THEN
    SELECT price, quantity INTO v_pkg_price, v_pkg_qty
    FROM public.packages WHERE id = _package_id AND is_active = true;
    IF v_pkg_price IS NULL THEN
      RETURN QUERY SELECT false, NULL::uuid, NULL::text, 0::bigint, 'Paket tidak valid'::text;
      RETURN;
    END IF;
    v_total := v_pkg_price;
    v_qty := v_pkg_qty;
  ELSIF _grade_id IS NOT NULL THEN
    SELECT base_price INTO v_grade_price
    FROM public.account_grades WHERE id = _grade_id AND is_active = true;
    IF v_grade_price IS NULL THEN
      RETURN QUERY SELECT false, NULL::uuid, NULL::text, 0::bigint, 'Grade tidak valid'::text;
      RETURN;
    END IF;
    v_total := v_grade_price * _quantity;
    v_qty := _quantity;
  ELSE
    SELECT price INTO v_product_price
    FROM public.products WHERE id = _product_id AND status = 'active';
    IF v_product_price IS NULL THEN
      RETURN QUERY SELECT false, NULL::uuid, NULL::text, 0::bigint, 'Produk tidak valid'::text;
      RETURN;
    END IF;
    v_total := v_product_price * _quantity;
    v_qty := _quantity;
  END IF;

  IF v_total <= 0 THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, 0::bigint, 'Total tidak valid'::text;
    RETURN;
  END IF;

  -- Cek saldo (lock)
  SELECT balance INTO v_current FROM public.wallets WHERE user_id = v_user FOR UPDATE;
  IF v_current IS NULL OR v_current < v_total THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, COALESCE(v_current,0), 'Saldo tidak cukup'::text;
    RETURN;
  END IF;

  -- Buat order
  v_order_num := 'BA-' || TO_CHAR(now(), 'YYYYMMDD') || '-' || SUBSTR(gen_random_uuid()::text, 1, 8);
  INSERT INTO public.orders (
    user_id, customer_name, customer_email, customer_phone,
    product_id, quantity, total_price, order_number,
    package_id, grade_id, payment_method, payment_status, order_status
  ) VALUES (
    v_user, v_name, v_email, v_phone,
    _product_id, v_qty, v_total, v_order_num,
    _package_id, _grade_id, 'wallet', 'paid', 'processing'
  ) RETURNING id INTO v_order_id;

  -- Potong saldo
  UPDATE public.wallets SET balance = v_current - v_total, updated_at = now() WHERE user_id = v_user;

  -- Catat transaksi
  INSERT INTO public.wallet_transactions (user_id, type, status, amount, balance_after, order_id, notes)
  VALUES (v_user, 'purchase', 'completed', v_total, v_current - v_total, v_order_id, 'Pembelian order ' || v_order_num);

  RETURN QUERY SELECT true, v_order_id, v_order_num, v_current - v_total, 'OK'::text;
END;
$$;
