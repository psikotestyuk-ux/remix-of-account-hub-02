-- ========================================
-- Migration: 20260416152921_72eaac37-b570-45f6-bb1a-0361b687cd6a.sql
-- ========================================


-- Create enums
CREATE TYPE public.product_category AS ENUM ('facebook', 'instagram', 'tiktok', 'gaming', 'tools', 'crypto');
CREATE TYPE public.product_status AS ENUM ('active', 'inactive');
CREATE TYPE public.payment_status AS ENUM ('pending', 'paid', 'failed', 'expired');
CREATE TYPE public.order_status AS ENUM ('processing', 'completed', 'cancelled');
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Products table
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  category product_category NOT NULL,
  price BIGINT NOT NULL,
  description TEXT,
  features JSONB DEFAULT '[]'::jsonb,
  stock INT NOT NULL DEFAULT 0,
  image_url TEXT,
  status product_status NOT NULL DEFAULT 'active',
  rating NUMERIC(2,1) NOT NULL DEFAULT 4.8,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Orders table
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  product_id UUID REFERENCES public.products(id) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  total_price BIGINT NOT NULL,
  payment_status payment_status NOT NULL DEFAULT 'pending',
  payment_method TEXT,
  order_status order_status NOT NULL DEFAULT 'processing',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Account credentials table
CREATE TABLE public.account_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  credentials_encrypted TEXT NOT NULL,
  is_sold BOOLEAN NOT NULL DEFAULT false,
  sold_to_order UUID REFERENCES public.orders(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles table
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Enable RLS on all tables
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role check
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Products: anyone can read active products, admins can do everything
CREATE POLICY "Anyone can view active products" ON public.products
  FOR SELECT USING (status = 'active' OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert products" ON public.products
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update products" ON public.products
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete products" ON public.products
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Orders: anyone can create (guest checkout), view by order_number, admins can manage
CREATE POLICY "Anyone can create orders" ON public.orders
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can view orders by order_number" ON public.orders
  FOR SELECT USING (true);

CREATE POLICY "Admins can update orders" ON public.orders
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete orders" ON public.orders
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Account credentials: only admins
CREATE POLICY "Admins can view credentials" ON public.account_credentials
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert credentials" ON public.account_credentials
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update credentials" ON public.account_credentials
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete credentials" ON public.account_credentials
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- User roles: only admins can manage
CREATE POLICY "Admins can view roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles" ON public.user_roles
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_credentials_updated_at BEFORE UPDATE ON public.account_credentials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Generate order number function
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.order_number = 'BA-' || TO_CHAR(now(), 'YYYYMMDD') || '-' || SUBSTR(gen_random_uuid()::text, 1, 8);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER set_order_number BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.generate_order_number();


-- ========================================
-- Migration: 20260416152947_7c1c5583-93a1-4ba5-8ac5-269bb9d2f519.sql
-- ========================================


DROP POLICY "Anyone can create orders" ON public.orders;
CREATE POLICY "Anyone can create orders with valid data" ON public.orders
  FOR INSERT WITH CHECK (
    customer_name IS NOT NULL AND length(customer_name) > 0
    AND customer_email IS NOT NULL AND customer_email ~ '^[^@]+@[^@]+\.[^@]+$'
    AND customer_phone IS NOT NULL AND length(customer_phone) > 0
    AND product_id IS NOT NULL
    AND quantity > 0
    AND total_price > 0
  );


-- ========================================
-- Migration: 20260417020953_e5e4f3cb-020a-4cd9-b3e6-837c1f83a83e.sql
-- ========================================

CREATE POLICY "Anyone can simulate payment on pending orders"
ON public.orders FOR UPDATE
TO public
USING (payment_status = 'pending')
WITH CHECK (payment_status = 'paid' AND order_status = 'completed');

-- ========================================
-- Migration: 20260417021311_e78c30cd-1db2-45c1-9937-ab473af30849.sql
-- ========================================

CREATE OR REPLACE FUNCTION public.handle_new_admin_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email = 'alqordowi97@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_assign_admin ON auth.users;
CREATE TRIGGER on_auth_user_created_assign_admin
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_admin_user();

-- ========================================
-- Migration: 20260418021034_783feb59-ee85-46fc-9f91-13a1d602f906.sql
-- ========================================


-- 1. Tabel grades per produk
CREATE TABLE public.account_grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  grade TEXT NOT NULL,
  description TEXT,
  base_price BIGINT NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(product_id, grade)
);

ALTER TABLE public.account_grades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active grades" ON public.account_grades
  FOR SELECT USING (is_active = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage grades" ON public.account_grades
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_account_grades_updated_at
  BEFORE UPDATE ON public.account_grades
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Tabel packages (bundle qty + grade + harga)
CREATE TABLE public.packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grade_id UUID NOT NULL REFERENCES public.account_grades(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price BIGINT NOT NULL CHECK (price > 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active packages" ON public.packages
  FOR SELECT USING (is_active = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage packages" ON public.packages
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_packages_updated_at
  BEFORE UPDATE ON public.packages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Kolom baru di orders
ALTER TABLE public.orders
  ADD COLUMN package_id UUID REFERENCES public.packages(id),
  ADD COLUMN grade_id UUID REFERENCES public.account_grades(id),
  ADD COLUMN payment_proof_url TEXT,
  ADD COLUMN payment_proof_uploaded_at TIMESTAMPTZ,
  ADD COLUMN admin_notes TEXT;

-- 4. Storage bucket untuk bukti transfer (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', false)
ON CONFLICT (id) DO NOTHING;

-- Public bisa upload (untuk customer guest)
CREATE POLICY "Anyone can upload payment proofs" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'payment-proofs');

-- Admin bisa lihat semua proof
CREATE POLICY "Admins can view payment proofs" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'payment-proofs' AND public.has_role(auth.uid(), 'admin'));

-- Public bisa lihat proof yg dia upload (signed URL nanti, tapi RLS izinkan select by path)
CREATE POLICY "Anyone can view payment proofs by path" ON storage.objects
  FOR SELECT USING (bucket_id = 'payment-proofs');


-- ========================================
-- Migration: 20260419022221_46fae8ae-baa3-49ca-869b-d376e44ef9e3.sql
-- ========================================


-- ============= PROFILES =============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  phone text,
  country text DEFAULT 'ID',
  locale text DEFAULT 'id',
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all profiles" ON public.profiles FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= WALLETS =============
CREATE TABLE public.wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  balance bigint NOT NULL DEFAULT 0 CHECK (balance >= 0),
  currency text NOT NULL DEFAULT 'IDR',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own wallet" ON public.wallets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all wallets" ON public.wallets FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update wallets" ON public.wallets FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON public.wallets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= WALLET TRANSACTIONS =============
CREATE TYPE public.wallet_tx_type AS ENUM ('topup', 'purchase', 'refund', 'adjustment');
CREATE TYPE public.wallet_tx_status AS ENUM ('pending', 'completed', 'failed', 'cancelled');

CREATE TABLE public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type wallet_tx_type NOT NULL,
  status wallet_tx_status NOT NULL DEFAULT 'pending',
  amount bigint NOT NULL,
  balance_after bigint,
  payment_method text,
  external_ref text,
  order_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_wallet_tx_user ON public.wallet_transactions(user_id, created_at DESC);
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own transactions" ON public.wallet_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all transactions" ON public.wallet_transactions FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins manage transactions" ON public.wallet_transactions FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_wallet_tx_updated_at BEFORE UPDATE ON public.wallet_transactions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= PROMOS =============
CREATE TYPE public.discount_type AS ENUM ('percent', 'fixed');

CREATE TABLE public.promos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  banner_url text,
  discount_type discount_type NOT NULL DEFAULT 'percent',
  discount_value numeric NOT NULL DEFAULT 0,
  min_purchase bigint NOT NULL DEFAULT 0,
  max_uses integer,
  used_count integer NOT NULL DEFAULT 0,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.promos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone view active promos" ON public.promos FOR SELECT TO public
USING (is_active = true AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at >= now()));
CREATE POLICY "Admins manage promos" ON public.promos FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_promos_updated_at BEFORE UPDATE ON public.promos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= ORDERS: link to user =============
ALTER TABLE public.orders ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX idx_orders_user ON public.orders(user_id);

CREATE POLICY "Users view own orders" ON public.orders FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ============= ACCOUNT CREDENTIALS: link to grade =============
ALTER TABLE public.account_credentials ADD COLUMN grade_id uuid REFERENCES public.account_grades(id) ON DELETE SET NULL;
CREATE INDEX idx_credentials_grade ON public.account_credentials(grade_id, is_sold);

-- ============= AUTO-CREATE PROFILE + WALLET ON SIGNUP =============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.wallets (user_id, balance)
  VALUES (NEW.id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ========================================
-- Migration: 20260419023628_ebd7c995-e165-443f-88e5-27c8243e5d25.sql
-- ========================================

-- Add promo tracking columns to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS promo_code text,
  ADD COLUMN IF NOT EXISTS discount_amount bigint NOT NULL DEFAULT 0;

-- Function: auto-assign credentials when order is paid
CREATE OR REPLACE FUNCTION public.auto_assign_credentials()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assigned int := 0;
  v_needed int;
BEGIN
  -- only act when status transitions to paid
  IF NEW.payment_status = 'paid' AND (OLD.payment_status IS DISTINCT FROM 'paid') THEN
    v_needed := NEW.quantity;

    -- Assign available credentials matching product (and grade if specified)
    WITH avail AS (
      SELECT id FROM public.account_credentials
      WHERE product_id = NEW.product_id
        AND is_sold = false
        AND (NEW.grade_id IS NULL OR grade_id = NEW.grade_id)
      ORDER BY created_at ASC
      LIMIT v_needed
      FOR UPDATE SKIP LOCKED
    )
    UPDATE public.account_credentials c
    SET is_sold = true, sold_to_order = NEW.id, updated_at = now()
    FROM avail
    WHERE c.id = avail.id;

    GET DIAGNOSTICS v_assigned = ROW_COUNT;

    -- Decrement grade stock if applicable
    IF NEW.grade_id IS NOT NULL AND v_assigned > 0 THEN
      UPDATE public.account_grades
      SET stock = GREATEST(0, stock - v_assigned), updated_at = now()
      WHERE id = NEW.grade_id;
    END IF;

    -- Mark order completed if fully fulfilled
    IF v_assigned >= v_needed THEN
      NEW.order_status := 'completed';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_assign_credentials ON public.orders;
CREATE TRIGGER trg_auto_assign_credentials
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.auto_assign_credentials();

-- Also handle direct insert with paid status (wallet checkout)
CREATE OR REPLACE FUNCTION public.auto_assign_credentials_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assigned int := 0;
  v_needed int;
BEGIN
  IF NEW.payment_status = 'paid' THEN
    v_needed := NEW.quantity;

    WITH avail AS (
      SELECT id FROM public.account_credentials
      WHERE product_id = NEW.product_id
        AND is_sold = false
        AND (NEW.grade_id IS NULL OR grade_id = NEW.grade_id)
      ORDER BY created_at ASC
      LIMIT v_needed
      FOR UPDATE SKIP LOCKED
    )
    UPDATE public.account_credentials c
    SET is_sold = true, sold_to_order = NEW.id, updated_at = now()
    FROM avail
    WHERE c.id = avail.id;

    GET DIAGNOSTICS v_assigned = ROW_COUNT;

    IF NEW.grade_id IS NOT NULL AND v_assigned > 0 THEN
      UPDATE public.account_grades
      SET stock = GREATEST(0, stock - v_assigned), updated_at = now()
      WHERE id = NEW.grade_id;
    END IF;

    IF v_assigned >= v_needed THEN
      NEW.order_status := 'completed';
    END IF;
  END IF;

  -- Increment promo usage if a promo code was applied
  IF NEW.promo_code IS NOT NULL AND length(NEW.promo_code) > 0 THEN
    UPDATE public.promos
    SET used_count = used_count + 1, updated_at = now()
    WHERE code = NEW.promo_code;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_assign_credentials_insert ON public.orders;
CREATE TRIGGER trg_auto_assign_credentials_insert
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.auto_assign_credentials_on_insert();

-- ========================================
-- Migration: 20260420032723_cbc58af1-dc89-416e-ae64-c41016de733c.sql
-- ========================================


-- Drop existing triggers
DROP TRIGGER IF EXISTS trg_auto_assign_credentials_insert ON public.orders;
DROP TRIGGER IF EXISTS trg_auto_assign_credentials ON public.orders;

-- Recreate INSERT function as AFTER trigger (FK on credentials needs order row to exist)
CREATE OR REPLACE FUNCTION public.auto_assign_credentials_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assigned int := 0;
  v_needed int;
BEGIN
  IF NEW.payment_status = 'paid' THEN
    v_needed := NEW.quantity;

    WITH avail AS (
      SELECT id FROM public.account_credentials
      WHERE product_id = NEW.product_id
        AND is_sold = false
        AND (NEW.grade_id IS NULL OR grade_id = NEW.grade_id)
      ORDER BY created_at ASC
      LIMIT v_needed
      FOR UPDATE SKIP LOCKED
    )
    UPDATE public.account_credentials c
    SET is_sold = true, sold_to_order = NEW.id, updated_at = now()
    FROM avail
    WHERE c.id = avail.id;

    GET DIAGNOSTICS v_assigned = ROW_COUNT;

    IF NEW.grade_id IS NOT NULL AND v_assigned > 0 THEN
      UPDATE public.account_grades
      SET stock = GREATEST(0, stock - v_assigned), updated_at = now()
      WHERE id = NEW.grade_id;
    END IF;

    -- Mark order completed if fully fulfilled (UPDATE since we are AFTER)
    IF v_assigned >= v_needed THEN
      UPDATE public.orders SET order_status = 'completed', updated_at = now() WHERE id = NEW.id;
    END IF;
  END IF;

  IF NEW.promo_code IS NOT NULL AND length(NEW.promo_code) > 0 THEN
    UPDATE public.promos
    SET used_count = used_count + 1, updated_at = now()
    WHERE code = NEW.promo_code;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_assign_credentials_insert
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.auto_assign_credentials_on_insert();

-- Recreate UPDATE trigger as AFTER too
CREATE OR REPLACE FUNCTION public.auto_assign_credentials()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assigned int := 0;
  v_needed int;
BEGIN
  IF NEW.payment_status = 'paid' AND (OLD.payment_status IS DISTINCT FROM 'paid') THEN
    v_needed := NEW.quantity;

    WITH avail AS (
      SELECT id FROM public.account_credentials
      WHERE product_id = NEW.product_id
        AND is_sold = false
        AND (NEW.grade_id IS NULL OR grade_id = NEW.grade_id)
      ORDER BY created_at ASC
      LIMIT v_needed
      FOR UPDATE SKIP LOCKED
    )
    UPDATE public.account_credentials c
    SET is_sold = true, sold_to_order = NEW.id, updated_at = now()
    FROM avail
    WHERE c.id = avail.id;

    GET DIAGNOSTICS v_assigned = ROW_COUNT;

    IF NEW.grade_id IS NOT NULL AND v_assigned > 0 THEN
      UPDATE public.account_grades
      SET stock = GREATEST(0, stock - v_assigned), updated_at = now()
      WHERE id = NEW.grade_id;
    END IF;

    IF v_assigned >= v_needed THEN
      UPDATE public.orders SET order_status = 'completed', updated_at = now() WHERE id = NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_assign_credentials
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.auto_assign_credentials();


-- ========================================
-- Migration: 20260420033715_495b0ffb-24ff-4646-9aef-9dfd14b1c955.sql
-- ========================================


-- Allow public to view credentials that have been sold to a specific order
-- (so the order's customer can retrieve their account after payment)
CREATE POLICY "Buyers view credentials for their order"
ON public.account_credentials
FOR SELECT
TO public
USING (
  is_sold = true
  AND sold_to_order IS NOT NULL
);


-- ========================================
-- Migration: 20260420035304_ba63ad0c-1006-4c6b-83c2-5499ae0c2e5f.sql
-- ========================================

-- Backfill wallets for any existing users that don't have one yet
INSERT INTO public.wallets (user_id, balance)
SELECT u.id, 0
FROM auth.users u
LEFT JOIN public.wallets w ON w.user_id = u.id
WHERE w.id IS NULL
ON CONFLICT DO NOTHING;

-- Allow authenticated users to insert their own wallet (safety net for missing rows)
CREATE POLICY "Users can insert own wallet"
ON public.wallets
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow authenticated users to update their own wallet balance (needed for mock topup)
CREATE POLICY "Users can update own wallet"
ON public.wallets
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ========================================
-- Migration: 20260422030303_529aafa5-4584-4dd9-bd66-02feadfcbaef.sql
-- ========================================

CREATE POLICY "Users can create own transactions"
ON public.wallet_transactions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- ========================================
-- Migration: 20260422031649_de1095cc-6293-4103-afbb-15afc7d5904b.sql
-- ========================================


ALTER TABLE public.account_credentials
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS password text,
  ADD COLUMN IF NOT EXISTS twofa_secret text,
  ADD COLUMN IF NOT EXISTS recovery_email text,
  ADD COLUMN IF NOT EXISTS cookies text,
  ADD COLUMN IF NOT EXISTS notes text;

-- credentials_encrypted jadi opsional (fallback untuk data lama)
ALTER TABLE public.account_credentials
  ALTER COLUMN credentials_encrypted DROP NOT NULL;


-- ========================================
-- Migration: 20260424023928_da07f486-0a9b-4b39-8751-2119973112fe.sql
-- ========================================


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


-- ========================================
-- Migration: 20260424024022_08f26294-24bb-442f-ba08-dd83a7704ae3.sql
-- ========================================


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


-- ========================================
-- Migration: 20260424024237_336741e8-f3d2-4dc6-9d71-3bf74b59b8d2.sql
-- ========================================


-- Payment proofs: hanya authenticated, dan file harus di folder user_id miliknya
DROP POLICY IF EXISTS "Authenticated upload payment proofs" ON storage.objects;
CREATE POLICY "Authenticated upload own payment proofs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'payment-proofs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Orders INSERT: user_id harus NULL (guest) atau matching auth.uid()
DROP POLICY IF EXISTS "Anyone can create orders with valid data" ON public.orders;
CREATE POLICY "Anyone can create orders with valid data"
ON public.orders FOR INSERT
TO public
WITH CHECK (
  (customer_name IS NOT NULL) AND (length(customer_name) > 0)
  AND (customer_email IS NOT NULL) AND (customer_email ~ '^[^@]+@[^@]+\.[^@]+$')
  AND (customer_phone IS NOT NULL) AND (length(customer_phone) > 0)
  AND (product_id IS NOT NULL)
  AND (quantity > 0)
  AND (total_price > 0)
  AND (user_id IS NULL OR user_id = auth.uid())
);


-- ========================================
-- Migration: 20260424024333_9c389d50-1efa-4028-9bc2-dac215ec0abe.sql
-- ========================================


DROP POLICY IF EXISTS "Anyone can upload payment proofs" ON storage.objects;
DROP POLICY IF EXISTS "Public upload payment proofs" ON storage.objects;
DROP POLICY IF EXISTS "Public can upload payment proofs" ON storage.objects;


-- ========================================
-- Migration: 20260425025811_2f954e23-2fb7-4294-ab24-c924355379f0.sql
-- ========================================

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

-- ========================================
-- Migration: 20260426001222_c281686e-ec16-4ed0-858e-929a13e34e09.sql
-- ========================================

-- Replace public INSERT policy on orders with authenticated-only policy
DROP POLICY IF EXISTS "Anyone can create orders with valid data" ON public.orders;

CREATE POLICY "Authenticated users can create their own orders"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (
  customer_name IS NOT NULL
  AND length(customer_name) > 0
  AND customer_email IS NOT NULL
  AND customer_email ~ '^[^@]+@[^@]+\.[^@]+$'
  AND customer_phone IS NOT NULL
  AND length(customer_phone) > 0
  AND product_id IS NOT NULL
  AND quantity > 0
  AND total_price > 0
  AND user_id = auth.uid()
);

-- ========================================
-- Migration: 20260427024719_2218f672-7d1d-4d91-bacb-91c60becacfe.sql
-- ========================================

-- Shorter order number format: BA-XXXXXX (6 chars, unambiguous alphabet)
CREATE OR REPLACE FUNCTION public.generate_short_order_code()
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
  candidate text;
  exists_already boolean;
  attempts int := 0;
BEGIN
  LOOP
    result := '';
    FOR i IN 1..6 LOOP
      result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    candidate := 'BA-' || result;
    SELECT EXISTS(SELECT 1 FROM public.orders WHERE order_number = candidate) INTO exists_already;
    EXIT WHEN NOT exists_already OR attempts > 20;
    attempts := attempts + 1;
  END LOOP;
  RETURN candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.order_number := public.generate_short_order_code();
  RETURN NEW;
END;
$$;

-- Update purchase_with_wallet to use the new short code
CREATE OR REPLACE FUNCTION public.purchase_with_wallet(_product_id uuid, _quantity integer, _grade_id uuid DEFAULT NULL::uuid, _package_id uuid DEFAULT NULL::uuid, _customer_name text DEFAULT NULL::text, _customer_phone text DEFAULT NULL::text)
RETURNS TABLE(success boolean, order_id uuid, order_number text, new_balance bigint, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

  SELECT email INTO v_email FROM auth.users WHERE id = v_user;
  IF v_email IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, 0::bigint, 'User tidak ditemukan'::text;
    RETURN;
  END IF;

  SELECT
    COALESCE(NULLIF(trim(_customer_name), ''), p.full_name, split_part(v_email, '@', 1)),
    COALESCE(NULLIF(trim(_customer_phone), ''), p.phone, '-')
  INTO v_name, v_phone
  FROM public.profiles p WHERE p.user_id = v_user;
  IF v_name IS NULL THEN
    v_name := COALESCE(NULLIF(trim(_customer_name), ''), split_part(v_email, '@', 1));
    v_phone := COALESCE(NULLIF(trim(_customer_phone), ''), '-');
  END IF;

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

  SELECT balance INTO v_current FROM public.wallets WHERE user_id = v_user FOR UPDATE;
  IF v_current IS NULL OR v_current < v_total THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, COALESCE(v_current,0), 'Saldo tidak cukup'::text;
    RETURN;
  END IF;

  v_order_num := public.generate_short_order_code();
  INSERT INTO public.orders (
    user_id, customer_name, customer_email, customer_phone,
    product_id, quantity, total_price, order_number,
    package_id, grade_id, payment_method, payment_status, order_status
  ) VALUES (
    v_user, v_name, v_email, v_phone,
    _product_id, v_qty, v_total, v_order_num,
    _package_id, _grade_id, 'wallet', 'paid', 'processing'
  ) RETURNING id INTO v_order_id;

  UPDATE public.wallets SET balance = v_current - v_total, updated_at = now() WHERE user_id = v_user;

  INSERT INTO public.wallet_transactions (user_id, type, status, amount, balance_after, order_id, notes)
  VALUES (v_user, 'purchase', 'completed', v_total, v_current - v_total, v_order_id, 'Pembelian order ' || v_order_num);

  RETURN QUERY SELECT true, v_order_id, v_order_num, v_current - v_total, 'OK'::text;
END;
$$;

-- ========================================
-- Migration: 20260428100000_category_settings.sql
-- ========================================

-- Category settings table: admin-managed display metadata per category slug
CREATE TABLE public.category_settings (
  slug TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '',
  logo_url TEXT,
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed from existing hardcoded categories
INSERT INTO public.category_settings (slug, label, emoji, display_order) VALUES
  ('facebook',  'Facebook',  '📘', 1),
  ('instagram', 'Instagram', '📸', 2),
  ('tiktok',    'TikTok',    '🎵', 3),
  ('gaming',    'Gaming',    '🎮', 4),
  ('tools',     'Tools',     '🛠️', 5),
  ('crypto',    'Crypto',    '₿',  6);

ALTER TABLE public.category_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read category settings"
ON public.category_settings FOR SELECT TO public USING (true);

CREATE POLICY "Admin manage category settings"
ON public.category_settings FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));


-- ========================================
-- Migration: 20260428100001_fix_order_lookup.sql
-- ========================================

-- Fix get_order_by_number: case-insensitive + trim whitespace so "ba-abc123 " finds "BA-ABC123"
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
    CASE WHEN auth.uid() = o.user_id OR has_role(auth.uid(), 'admin')
         THEN o.customer_name ELSE substr(o.customer_name, 1, 1) || '***' END,
    CASE WHEN auth.uid() = o.user_id OR has_role(auth.uid(), 'admin')
         THEN o.customer_email ELSE substr(o.customer_email, 1, 2) || '***@***' END,
    CASE WHEN auth.uid() = o.user_id OR has_role(auth.uid(), 'admin')
         THEN o.customer_phone ELSE '***' END
  FROM public.orders o
  WHERE UPPER(TRIM(o.order_number)) = UPPER(TRIM(_order_number))
  LIMIT 1;
$$;


-- ========================================
-- Migration: 20260428100002_stock_check_and_autoassign.sql
-- ========================================

-- 1. Update purchase_with_wallet: block purchase when no credentials available for the grade
CREATE OR REPLACE FUNCTION public.purchase_with_wallet(
  _product_id uuid,
  _quantity integer,
  _grade_id uuid DEFAULT NULL::uuid,
  _package_id uuid DEFAULT NULL::uuid,
  _customer_name text DEFAULT NULL::text,
  _customer_phone text DEFAULT NULL::text
)
RETURNS TABLE(success boolean, order_id uuid, order_number text, new_balance bigint, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_email text;
  v_current bigint;
  v_total bigint := 0;
  v_qty integer;
  v_pkg_price bigint;
  v_pkg_qty integer;
  v_pkg_grade uuid;
  v_grade_price bigint;
  v_product_price bigint;
  v_order_id uuid;
  v_order_num text;
  v_name text;
  v_phone text;
  v_check_grade uuid;
BEGIN
  IF v_user IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, 0::bigint, 'Tidak login'::text;
    RETURN;
  END IF;
  IF _quantity <= 0 OR _quantity > 100 THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, 0::bigint, 'Kuantitas tidak valid'::text;
    RETURN;
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_user;
  IF v_email IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, 0::bigint, 'User tidak ditemukan'::text;
    RETURN;
  END IF;

  SELECT
    COALESCE(NULLIF(trim(_customer_name), ''), p.full_name, split_part(v_email, '@', 1)),
    COALESCE(NULLIF(trim(_customer_phone), ''), p.phone, '-')
  INTO v_name, v_phone
  FROM public.profiles p WHERE p.user_id = v_user;
  IF v_name IS NULL THEN
    v_name := COALESCE(NULLIF(trim(_customer_name), ''), split_part(v_email, '@', 1));
    v_phone := COALESCE(NULLIF(trim(_customer_phone), ''), '-');
  END IF;

  IF _package_id IS NOT NULL THEN
    SELECT price, quantity, grade_id INTO v_pkg_price, v_pkg_qty, v_pkg_grade
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

  -- Block purchase if no available credentials for the resolved grade
  v_check_grade := COALESCE(_grade_id, v_pkg_grade);
  IF v_check_grade IS NOT NULL THEN
    PERFORM 1 FROM public.account_credentials
    WHERE product_id = _product_id
      AND grade_id = v_check_grade
      AND is_sold = false
    LIMIT 1;
    IF NOT FOUND THEN
      RETURN QUERY SELECT false, NULL::uuid, NULL::text, 0::bigint, 'Stok akun habis. Silakan coba lagi nanti.'::text;
      RETURN;
    END IF;
  END IF;

  SELECT balance INTO v_current FROM public.wallets WHERE user_id = v_user FOR UPDATE;
  IF v_current IS NULL OR v_current < v_total THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, COALESCE(v_current, 0::bigint), 'Saldo tidak cukup'::text;
    RETURN;
  END IF;

  v_order_num := public.generate_short_order_code();
  INSERT INTO public.orders (
    user_id, customer_name, customer_email, customer_phone,
    product_id, quantity, total_price, order_number,
    package_id, grade_id, payment_method, payment_status, order_status
  ) VALUES (
    v_user, v_name, v_email, v_phone,
    _product_id, v_qty, v_total, v_order_num,
    _package_id, _grade_id, 'wallet', 'paid', 'processing'
  ) RETURNING id INTO v_order_id;

  UPDATE public.wallets SET balance = v_current - v_total, updated_at = now() WHERE user_id = v_user;

  INSERT INTO public.wallet_transactions (user_id, type, status, amount, balance_after, order_id, notes)
  VALUES (v_user, 'purchase', 'completed', v_total, v_current - v_total, v_order_id, 'Pembelian order ' || v_order_num);

  RETURN QUERY SELECT true, v_order_id, v_order_num, v_current - v_total, 'OK'::text;
END;
$$;


-- 2. Auto-assign credentials to processing orders when new credential is added
CREATE OR REPLACE FUNCTION public.auto_assign_on_credential_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_order_qty integer;
  v_assigned_count bigint;
BEGIN
  -- Only act on unsold credentials being added fresh
  IF NEW.is_sold THEN
    RETURN NEW;
  END IF;

  -- Find the oldest paid+processing order for this product+grade combo
  SELECT id, quantity INTO v_order_id, v_order_qty
  FROM public.orders
  WHERE product_id = NEW.product_id
    AND grade_id IS NOT DISTINCT FROM NEW.grade_id
    AND payment_status = 'paid'
    AND order_status = 'processing'
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_order_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Assign this credential to that order
  UPDATE public.account_credentials
  SET is_sold = true, sold_to_order = v_order_id, updated_at = now()
  WHERE id = NEW.id;

  -- Decrement grade stock if applicable
  IF NEW.grade_id IS NOT NULL THEN
    UPDATE public.account_grades
    SET stock = GREATEST(0, stock - 1), updated_at = now()
    WHERE id = NEW.grade_id;
  END IF;

  -- Check if the order is now fully fulfilled
  SELECT COUNT(*) INTO v_assigned_count
  FROM public.account_credentials
  WHERE sold_to_order = v_order_id;

  IF v_assigned_count >= v_order_qty THEN
    UPDATE public.orders
    SET order_status = 'completed', updated_at = now()
    WHERE id = v_order_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_assign_on_credential_insert ON public.account_credentials;
CREATE TRIGGER trg_auto_assign_on_credential_insert
AFTER INSERT ON public.account_credentials
FOR EACH ROW
EXECUTE FUNCTION public.auto_assign_on_credential_insert();


-- ========================================
-- Migration: 20260429000000_category_logos_bucket.sql
-- ========================================

-- Storage bucket for category logos: public read, admin write
INSERT INTO storage.buckets (id, name, public)
VALUES ('category-logos', 'category-logos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read category logos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'category-logos');

CREATE POLICY "Admin upload category logos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'category-logos' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin update category logos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'category-logos' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin delete category logos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'category-logos' AND public.has_role(auth.uid(), 'admin'));


-- ========================================
-- Migration: 20260429000001_promo_banners_bucket.sql
-- ========================================

-- Storage bucket for promo banner images: public read, admin write
INSERT INTO storage.buckets (id, name, public)
VALUES ('promo-banners', 'promo-banners', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read promo banners"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'promo-banners');

CREATE POLICY "Admin upload promo banners"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'promo-banners' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin update promo banners"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'promo-banners' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin delete promo banners"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'promo-banners' AND public.has_role(auth.uid(), 'admin'));


