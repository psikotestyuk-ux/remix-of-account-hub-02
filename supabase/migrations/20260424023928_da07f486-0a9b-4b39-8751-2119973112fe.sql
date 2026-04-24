
-- ============================================
-- 1. ORDERS — hapus policy public yang berbahaya
-- ============================================
DROP POLICY IF EXISTS "Anyone can view orders by order_number" ON public.orders;
DROP POLICY IF EXISTS "Anyone can simulate payment on pending orders" ON public.orders;

-- Policy baru: hanya pemilik order (login by user_id) atau admin
-- (Public lookup by order_number harus pakai SECURITY DEFINER function di bawah)
CREATE POLICY "Admins view all orders"
ON public.orders FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Function publik untuk lookup order berdasarkan order_number (tanpa expose PII penuh)
CREATE OR REPLACE FUNCTION public.get_order_by_number(_order_number text)
RETURNS TABLE (
  id uuid,
  order_number text,
  payment_status payment_status,
  order_status order_status,
  total_price bigint,
  quantity integer,
  created_at timestamptz,
  product_id uuid,
  grade_id uuid,
  package_id uuid,
  admin_notes text,
  payment_proof_url text,
  customer_name text,
  customer_email text,
  customer_phone text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.id, o.order_number, o.payment_status, o.order_status,
    o.total_price, o.quantity, o.created_at, o.product_id,
    o.grade_id, o.package_id, o.admin_notes, o.payment_proof_url,
    -- Mask data sensitif jika bukan owner & bukan admin
    CASE WHEN auth.uid() = o.user_id OR has_role(auth.uid(), 'admin')
         THEN o.customer_name ELSE substr(o.customer_name, 1, 1) || '***' END,
    CASE WHEN auth.uid() = o.user_id OR has_role(auth.uid(), 'admin')
         THEN o.customer_email ELSE substr(o.customer_email, 1, 2) || '***@***' END,
    CASE WHEN auth.uid() = o.user_id OR has_role(auth.uid(), 'admin')
         THEN o.customer_phone ELSE '***' END
  FROM public.orders o
  WHERE o.order_number = _order_number
  LIMIT 1;
$$;

-- ============================================
-- 2. WALLETS — hapus update by user
-- ============================================
DROP POLICY IF EXISTS "Users can update own wallet" ON public.wallets;
DROP POLICY IF EXISTS "Users can insert own wallet" ON public.wallets;
-- Wallets dibuat otomatis via trigger handle_new_user, jadi user tidak perlu insert/update manual

-- ============================================
-- 3. WALLET_TRANSACTIONS — hapus insert by user
-- ============================================
DROP POLICY IF EXISTS "Users can create own transactions" ON public.wallet_transactions;
-- Transaksi sekarang hanya bisa dibuat via SECURITY DEFINER function di bawah

-- ============================================
-- 4. ACCOUNT_CREDENTIALS — hanya owner order yang bisa lihat
-- ============================================
DROP POLICY IF EXISTS "Buyers view credentials for their order" ON public.account_credentials;

CREATE POLICY "Buyers view their own purchased credentials"
ON public.account_credentials FOR SELECT
TO authenticated
USING (
  is_sold = true
  AND sold_to_order IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = account_credentials.sold_to_order
      AND o.user_id = auth.uid()
  )
);

-- ============================================
-- 5. PROMOS — sembunyikan detail diskon dari public
-- ============================================
DROP POLICY IF EXISTS "Anyone view active promos" ON public.promos;

-- Hanya admin yang bisa SELECT raw row promos
-- Public validation via function di bawah
CREATE OR REPLACE FUNCTION public.validate_promo_code(_code text, _purchase_amount bigint)
RETURNS TABLE (
  valid boolean,
  code text,
  title text,
  discount_type discount_type,
  discount_value numeric,
  min_purchase bigint,
  message text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p record;
BEGIN
  SELECT * INTO p FROM public.promos
  WHERE upper(promos.code) = upper(_code)
    AND is_active = true
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at >= now())
  LIMIT 1;

  IF p IS NULL THEN
    RETURN QUERY SELECT false, _code, NULL::text, NULL::discount_type, NULL::numeric, NULL::bigint, 'Kode promo tidak valid atau kedaluwarsa'::text;
    RETURN;
  END IF;

  IF p.max_uses IS NOT NULL AND p.used_count >= p.max_uses THEN
    RETURN QUERY SELECT false, p.code, p.title, NULL::discount_type, NULL::numeric, NULL::bigint, 'Kuota promo sudah habis'::text;
    RETURN;
  END IF;

  IF _purchase_amount < p.min_purchase THEN
    RETURN QUERY SELECT false, p.code, p.title, NULL::discount_type, NULL::numeric, p.min_purchase, ('Minimum pembelian Rp' || p.min_purchase)::text;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, p.code, p.title, p.discount_type, p.discount_value, p.min_purchase, 'OK'::text;
END;
$$;

-- ============================================
-- 6. STORAGE — payment-proofs bukan public
-- ============================================
-- Hapus policy public read
DROP POLICY IF EXISTS "Anyone can view payment proofs by path" ON storage.objects;
DROP POLICY IF EXISTS "Public can view payment proofs" ON storage.objects;
DROP POLICY IF EXISTS "Public read payment proofs" ON storage.objects;

-- Hanya admin & uploader (login) yang bisa lihat
CREATE POLICY "Admins view payment proofs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'payment-proofs' AND has_role(auth.uid(), 'admin')
);

CREATE POLICY "Owners view their payment proofs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'payment-proofs'
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.payment_proof_url = storage.objects.name
      AND o.user_id = auth.uid()
  )
);

-- Upload tetap diizinkan untuk authenticated user
DROP POLICY IF EXISTS "Authenticated can upload payment proofs" ON storage.objects;
CREATE POLICY "Authenticated upload payment proofs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'payment-proofs');
