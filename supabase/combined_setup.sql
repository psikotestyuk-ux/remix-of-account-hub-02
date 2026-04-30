-- ==============================================
-- COMBINED SETUP SQL — idempotent (safe to re-run)
-- ==============================================

-- ENUMS (safe wrapper untuk hindari error "already exists")
DO $$ BEGIN CREATE TYPE public.product_category AS ENUM ('facebook','instagram','tiktok','gaming','tools','crypto'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.product_status AS ENUM ('active','inactive'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.payment_status AS ENUM ('pending','paid','failed','expired'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.order_status AS ENUM ('processing','completed','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.app_role AS ENUM ('admin','user'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.wallet_tx_type AS ENUM ('topup','purchase','refund','adjustment'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.wallet_tx_status AS ENUM ('pending','completed','failed','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.discount_type AS ENUM ('percent','fixed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- TABLES
CREATE TABLE IF NOT EXISTS public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, category product_category NOT NULL,
  price BIGINT NOT NULL, description TEXT, features JSONB DEFAULT '[]'::jsonb,
  stock INT NOT NULL DEFAULT 0, image_url TEXT, status product_status NOT NULL DEFAULT 'active',
  rating NUMERIC(2,1) NOT NULL DEFAULT 4.8,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE, customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL, customer_phone TEXT NOT NULL,
  product_id UUID REFERENCES public.products(id) NOT NULL,
  quantity INT NOT NULL DEFAULT 1, total_price BIGINT NOT NULL,
  payment_status payment_status NOT NULL DEFAULT 'pending', payment_method TEXT,
  order_status order_status NOT NULL DEFAULT 'processing', notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.account_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  credentials_encrypted TEXT, is_sold BOOLEAN NOT NULL DEFAULT false,
  sold_to_order UUID REFERENCES public.orders(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL, UNIQUE (user_id, role)
);
CREATE TABLE IF NOT EXISTS public.account_grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  grade TEXT NOT NULL, description TEXT, base_price BIGINT NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0, is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(product_id, grade)
);
CREATE TABLE IF NOT EXISTS public.packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grade_id UUID NOT NULL REFERENCES public.account_grades(id) ON DELETE CASCADE,
  name TEXT NOT NULL, quantity INTEGER NOT NULL CHECK (quantity > 0),
  price BIGINT NOT NULL CHECK (price > 0), is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text, phone text, country text DEFAULT 'ID', locale text DEFAULT 'id',
  avatar_url text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  balance bigint NOT NULL DEFAULT 0 CHECK (balance >= 0), currency text NOT NULL DEFAULT 'IDR',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type wallet_tx_type NOT NULL, status wallet_tx_status NOT NULL DEFAULT 'pending',
  amount bigint NOT NULL, balance_after bigint, payment_method text, external_ref text,
  order_id uuid, notes text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.promos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE, title text NOT NULL, description text, banner_url text,
  discount_type discount_type NOT NULL DEFAULT 'percent', discount_value numeric NOT NULL DEFAULT 0,
  min_purchase bigint NOT NULL DEFAULT 0, max_uses integer, used_count integer NOT NULL DEFAULT 0,
  starts_at timestamptz, ends_at timestamptz, is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.category_settings (
  slug TEXT PRIMARY KEY, label TEXT NOT NULL, emoji TEXT NOT NULL DEFAULT '',
  logo_url TEXT, display_order INT DEFAULT 0, is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ADD COLUMNS IF MISSING
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS package_id UUID REFERENCES public.packages(id);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS grade_id UUID REFERENCES public.account_grades(id);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_proof_url TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_proof_uploaded_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS admin_notes TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS promo_code text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_amount bigint NOT NULL DEFAULT 0;
ALTER TABLE public.account_credentials ADD COLUMN IF NOT EXISTS grade_id uuid REFERENCES public.account_grades(id) ON DELETE SET NULL;
ALTER TABLE public.account_credentials ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.account_credentials ADD COLUMN IF NOT EXISTS password text;
ALTER TABLE public.account_credentials ADD COLUMN IF NOT EXISTS twofa_secret text;
ALTER TABLE public.account_credentials ADD COLUMN IF NOT EXISTS recovery_email text;
ALTER TABLE public.account_credentials ADD COLUMN IF NOT EXISTS cookies text;
ALTER TABLE public.account_credentials ADD COLUMN IF NOT EXISTS notes text;

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_wallet_tx_user ON public.wallet_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_user ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_credentials_grade ON public.account_credentials(grade_id, is_sold);

-- RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_settings ENABLE ROW LEVEL SECURITY;

-- FUNCTIONS
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.generate_short_order_code()
RETURNS text LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := ''; i int; candidate text; exists_already boolean; attempts int := 0;
BEGIN
  LOOP
    result := '';
    FOR i IN 1..6 LOOP result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1); END LOOP;
    candidate := 'BA-' || result;
    SELECT EXISTS(SELECT 1 FROM public.orders WHERE order_number = candidate) INTO exists_already;
    EXIT WHEN NOT exists_already OR attempts > 20;
    attempts := attempts + 1;
  END LOOP;
  RETURN candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN NEW.order_number := public.generate_short_order_code(); RETURN NEW; END;
$$;

CREATE OR REPLACE FUNCTION public.get_order_by_number(_order_number text)
RETURNS TABLE (id uuid, order_number text, payment_status payment_status, order_status order_status,
  total_price bigint, quantity integer, created_at timestamptz, product_id uuid, grade_id uuid,
  package_id uuid, admin_notes text, payment_proof_url text, customer_name text, customer_email text, customer_phone text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.id, o.order_number, o.payment_status, o.order_status, o.total_price, o.quantity, o.created_at,
    o.product_id, o.grade_id, o.package_id, o.admin_notes, o.payment_proof_url,
    CASE WHEN auth.uid()=o.user_id OR has_role(auth.uid(),'admin') THEN o.customer_name ELSE substr(o.customer_name,1,1)||'***' END,
    CASE WHEN auth.uid()=o.user_id OR has_role(auth.uid(),'admin') THEN o.customer_email ELSE substr(o.customer_email,1,2)||'***@***' END,
    CASE WHEN auth.uid()=o.user_id OR has_role(auth.uid(),'admin') THEN o.customer_phone ELSE '***' END
  FROM public.orders o WHERE UPPER(TRIM(o.order_number))=UPPER(TRIM(_order_number)) LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.validate_promo_code(_code text, _purchase_amount bigint)
RETURNS TABLE (valid boolean, code text, title text, discount_type discount_type, discount_value numeric, min_purchase bigint, message text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE p record;
BEGIN
  SELECT * INTO p FROM public.promos WHERE upper(promos.code)=upper(_code) AND is_active=true AND (starts_at IS NULL OR starts_at<=now()) AND (ends_at IS NULL OR ends_at>=now()) LIMIT 1;
  IF p IS NULL THEN RETURN QUERY SELECT false,_code,NULL::text,NULL::discount_type,NULL::numeric,NULL::bigint,'Kode promo tidak valid atau kedaluwarsa'::text; RETURN; END IF;
  IF p.max_uses IS NOT NULL AND p.used_count>=p.max_uses THEN RETURN QUERY SELECT false,p.code,p.title,NULL::discount_type,NULL::numeric,NULL::bigint,'Kuota promo sudah habis'::text; RETURN; END IF;
  IF _purchase_amount<p.min_purchase THEN RETURN QUERY SELECT false,p.code,p.title,NULL::discount_type,NULL::numeric,p.min_purchase,('Minimum pembelian Rp'||p.min_purchase)::text; RETURN; END IF;
  RETURN QUERY SELECT true,p.code,p.title,p.discount_type,p.discount_value,p.min_purchase,'OK'::text;
END;
$$;

CREATE OR REPLACE FUNCTION public.topup_wallet(_amount bigint, _payment_method text DEFAULT 'xendit_mock', _notes text DEFAULT NULL)
RETURNS TABLE (success boolean, new_balance bigint, transaction_id uuid, message text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_current bigint; v_new bigint; v_tx uuid;
BEGIN
  IF v_user IS NULL THEN RETURN QUERY SELECT false,0::bigint,NULL::uuid,'Tidak login'::text; RETURN; END IF;
  IF _amount<10000 OR _amount>50000000 THEN RETURN QUERY SELECT false,0::bigint,NULL::uuid,'Nominal di luar batas (Rp 10rb - 50jt)'::text; RETURN; END IF;
  SELECT balance INTO v_current FROM public.wallets WHERE user_id=v_user FOR UPDATE;
  IF v_current IS NULL THEN INSERT INTO public.wallets (user_id,balance) VALUES (v_user,0); v_current:=0; END IF;
  v_new := v_current + _amount;
  UPDATE public.wallets SET balance=v_new, updated_at=now() WHERE user_id=v_user;
  INSERT INTO public.wallet_transactions (user_id,type,status,amount,balance_after,payment_method,notes)
  VALUES (v_user,'topup','completed',_amount,v_new,_payment_method,COALESCE(_notes,'Top up saldo')) RETURNING id INTO v_tx;
  RETURN QUERY SELECT true,v_new,v_tx,'OK'::text;
END;
$$;

CREATE OR REPLACE FUNCTION public.purchase_with_wallet(_product_id uuid, _quantity integer, _grade_id uuid DEFAULT NULL, _package_id uuid DEFAULT NULL, _customer_name text DEFAULT NULL, _customer_phone text DEFAULT NULL)
RETURNS TABLE(success boolean, order_id uuid, order_number text, new_balance bigint, message text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_user uuid:=auth.uid(); v_email text; v_current bigint; v_total bigint:=0;
  v_qty integer; v_pkg_price bigint; v_pkg_qty integer; v_pkg_grade uuid;
  v_grade_price bigint; v_product_price bigint; v_order_id uuid; v_order_num text;
  v_name text; v_phone text; v_check_grade uuid;
BEGIN
  IF v_user IS NULL THEN RETURN QUERY SELECT false,NULL::uuid,NULL::text,0::bigint,'Tidak login'::text; RETURN; END IF;
  IF _quantity<=0 OR _quantity>100 THEN RETURN QUERY SELECT false,NULL::uuid,NULL::text,0::bigint,'Kuantitas tidak valid'::text; RETURN; END IF;
  SELECT email INTO v_email FROM auth.users WHERE id=v_user;
  IF v_email IS NULL THEN RETURN QUERY SELECT false,NULL::uuid,NULL::text,0::bigint,'User tidak ditemukan'::text; RETURN; END IF;
  SELECT COALESCE(NULLIF(trim(_customer_name),''),p.full_name,split_part(v_email,'@',1)), COALESCE(NULLIF(trim(_customer_phone),''),p.phone,'-')
  INTO v_name,v_phone FROM public.profiles p WHERE p.user_id=v_user;
  IF v_name IS NULL THEN v_name:=COALESCE(NULLIF(trim(_customer_name),''),split_part(v_email,'@',1)); v_phone:=COALESCE(NULLIF(trim(_customer_phone),''),'-'); END IF;
  IF _package_id IS NOT NULL THEN
    SELECT price,quantity,grade_id INTO v_pkg_price,v_pkg_qty,v_pkg_grade FROM public.packages WHERE id=_package_id AND is_active=true;
    IF v_pkg_price IS NULL THEN RETURN QUERY SELECT false,NULL::uuid,NULL::text,0::bigint,'Paket tidak valid'::text; RETURN; END IF;
    v_total:=v_pkg_price; v_qty:=v_pkg_qty;
  ELSIF _grade_id IS NOT NULL THEN
    SELECT base_price INTO v_grade_price FROM public.account_grades WHERE id=_grade_id AND is_active=true;
    IF v_grade_price IS NULL THEN RETURN QUERY SELECT false,NULL::uuid,NULL::text,0::bigint,'Grade tidak valid'::text; RETURN; END IF;
    v_total:=v_grade_price*_quantity; v_qty:=_quantity;
  ELSE
    SELECT price INTO v_product_price FROM public.products WHERE id=_product_id AND status='active';
    IF v_product_price IS NULL THEN RETURN QUERY SELECT false,NULL::uuid,NULL::text,0::bigint,'Produk tidak valid'::text; RETURN; END IF;
    v_total:=v_product_price*_quantity; v_qty:=_quantity;
  END IF;
  IF v_total<=0 THEN RETURN QUERY SELECT false,NULL::uuid,NULL::text,0::bigint,'Total tidak valid'::text; RETURN; END IF;
  v_check_grade:=COALESCE(_grade_id,v_pkg_grade);
  IF v_check_grade IS NOT NULL THEN
    PERFORM 1 FROM public.account_credentials WHERE product_id=_product_id AND grade_id=v_check_grade AND is_sold=false LIMIT 1;
    IF NOT FOUND THEN RETURN QUERY SELECT false,NULL::uuid,NULL::text,0::bigint,'Stok akun habis. Silakan coba lagi nanti.'::text; RETURN; END IF;
  END IF;
  SELECT balance INTO v_current FROM public.wallets WHERE user_id=v_user FOR UPDATE;
  IF v_current IS NULL OR v_current<v_total THEN RETURN QUERY SELECT false,NULL::uuid,NULL::text,COALESCE(v_current,0::bigint),'Saldo tidak cukup'::text; RETURN; END IF;
  v_order_num:=public.generate_short_order_code();
  INSERT INTO public.orders (user_id,customer_name,customer_email,customer_phone,product_id,quantity,total_price,order_number,package_id,grade_id,payment_method,payment_status,order_status)
  VALUES (v_user,v_name,v_email,v_phone,_product_id,v_qty,v_total,v_order_num,_package_id,_grade_id,'wallet','paid','processing') RETURNING id INTO v_order_id;
  UPDATE public.wallets SET balance=v_current-v_total,updated_at=now() WHERE user_id=v_user;
  INSERT INTO public.wallet_transactions (user_id,type,status,amount,balance_after,order_id,notes)
  VALUES (v_user,'purchase','completed',v_total,v_current-v_total,v_order_id,'Pembelian order '||v_order_num);
  RETURN QUERY SELECT true,v_order_id,v_order_num,v_current-v_total,'OK'::text;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_assign_credentials()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_assigned int:=0; v_needed int;
BEGIN
  IF NEW.payment_status='paid' AND (OLD.payment_status IS DISTINCT FROM 'paid') THEN
    v_needed:=NEW.quantity;
    WITH avail AS (SELECT id FROM public.account_credentials WHERE product_id=NEW.product_id AND is_sold=false AND (NEW.grade_id IS NULL OR grade_id=NEW.grade_id) ORDER BY created_at ASC LIMIT v_needed FOR UPDATE SKIP LOCKED)
    UPDATE public.account_credentials c SET is_sold=true,sold_to_order=NEW.id,updated_at=now() FROM avail WHERE c.id=avail.id;
    GET DIAGNOSTICS v_assigned=ROW_COUNT;
    IF NEW.grade_id IS NOT NULL AND v_assigned>0 THEN UPDATE public.account_grades SET stock=GREATEST(0,stock-v_assigned),updated_at=now() WHERE id=NEW.grade_id; END IF;
    IF v_assigned>=v_needed THEN UPDATE public.orders SET order_status='completed',updated_at=now() WHERE id=NEW.id; END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_assign_credentials_on_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_assigned int:=0; v_needed int;
BEGIN
  IF NEW.payment_status='paid' THEN
    v_needed:=NEW.quantity;
    WITH avail AS (SELECT id FROM public.account_credentials WHERE product_id=NEW.product_id AND is_sold=false AND (NEW.grade_id IS NULL OR grade_id=NEW.grade_id) ORDER BY created_at ASC LIMIT v_needed FOR UPDATE SKIP LOCKED)
    UPDATE public.account_credentials c SET is_sold=true,sold_to_order=NEW.id,updated_at=now() FROM avail WHERE c.id=avail.id;
    GET DIAGNOSTICS v_assigned=ROW_COUNT;
    IF NEW.grade_id IS NOT NULL AND v_assigned>0 THEN UPDATE public.account_grades SET stock=GREATEST(0,stock-v_assigned),updated_at=now() WHERE id=NEW.grade_id; END IF;
    IF v_assigned>=v_needed THEN UPDATE public.orders SET order_status='completed',updated_at=now() WHERE id=NEW.id; END IF;
  END IF;
  IF NEW.promo_code IS NOT NULL AND length(NEW.promo_code)>0 THEN UPDATE public.promos SET used_count=used_count+1,updated_at=now() WHERE code=NEW.promo_code; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_assign_on_credential_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_order_id uuid; v_order_qty integer; v_assigned_count bigint;
BEGIN
  IF NEW.is_sold THEN RETURN NEW; END IF;
  SELECT id,quantity INTO v_order_id,v_order_qty FROM public.orders
  WHERE product_id=NEW.product_id AND grade_id IS NOT DISTINCT FROM NEW.grade_id AND payment_status='paid' AND order_status='processing'
  ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED;
  IF v_order_id IS NULL THEN RETURN NEW; END IF;
  UPDATE public.account_credentials SET is_sold=true,sold_to_order=v_order_id,updated_at=now() WHERE id=NEW.id;
  IF NEW.grade_id IS NOT NULL THEN UPDATE public.account_grades SET stock=GREATEST(0,stock-1),updated_at=now() WHERE id=NEW.grade_id; END IF;
  SELECT COUNT(*) INTO v_assigned_count FROM public.account_credentials WHERE sold_to_order=v_order_id;
  IF v_assigned_count>=v_order_qty THEN UPDATE public.orders SET order_status='completed',updated_at=now() WHERE id=v_order_id; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id,full_name) VALUES (NEW.id,COALESCE(NEW.raw_user_meta_data->>'full_name',split_part(NEW.email,'@',1))) ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.wallets (user_id,balance) VALUES (NEW.id,0) ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_admin_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.email='admin@buyingaccount.local' THEN INSERT INTO public.user_roles (user_id,role) VALUES (NEW.id,'admin') ON CONFLICT DO NOTHING; END IF;
  RETURN NEW;
END;
$$;

-- TRIGGERS
DROP TRIGGER IF EXISTS update_products_updated_at ON public.products;
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_orders_updated_at ON public.orders;
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_credentials_updated_at ON public.account_credentials;
CREATE TRIGGER update_credentials_updated_at BEFORE UPDATE ON public.account_credentials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_account_grades_updated_at ON public.account_grades;
CREATE TRIGGER update_account_grades_updated_at BEFORE UPDATE ON public.account_grades FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_packages_updated_at ON public.packages;
CREATE TRIGGER update_packages_updated_at BEFORE UPDATE ON public.packages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_wallets_updated_at ON public.wallets;
CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON public.wallets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_wallet_tx_updated_at ON public.wallet_transactions;
CREATE TRIGGER update_wallet_tx_updated_at BEFORE UPDATE ON public.wallet_transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_promos_updated_at ON public.promos;
CREATE TRIGGER update_promos_updated_at BEFORE UPDATE ON public.promos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS set_order_number ON public.orders;
CREATE TRIGGER set_order_number BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.generate_order_number();
DROP TRIGGER IF EXISTS trg_auto_assign_credentials ON public.orders;
CREATE TRIGGER trg_auto_assign_credentials AFTER UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.auto_assign_credentials();
DROP TRIGGER IF EXISTS trg_auto_assign_credentials_insert ON public.orders;
CREATE TRIGGER trg_auto_assign_credentials_insert AFTER INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.auto_assign_credentials_on_insert();
DROP TRIGGER IF EXISTS trg_auto_assign_on_credential_insert ON public.account_credentials;
CREATE TRIGGER trg_auto_assign_on_credential_insert AFTER INSERT ON public.account_credentials FOR EACH ROW EXECUTE FUNCTION public.auto_assign_on_credential_insert();
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
DROP TRIGGER IF EXISTS on_auth_user_created_assign_admin ON auth.users;
CREATE TRIGGER on_auth_user_created_assign_admin AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_admin_user();

-- RLS POLICIES
DROP POLICY IF EXISTS "Anyone can view active products" ON public.products;
CREATE POLICY "Anyone can view active products" ON public.products FOR SELECT USING (status='active' OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "Admins can insert products" ON public.products;
CREATE POLICY "Admins can insert products" ON public.products FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "Admins can update products" ON public.products;
CREATE POLICY "Admins can update products" ON public.products FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "Admins can delete products" ON public.products;
CREATE POLICY "Admins can delete products" ON public.products FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Authenticated users can create their own orders" ON public.orders;
CREATE POLICY "Authenticated users can create their own orders" ON public.orders FOR INSERT TO authenticated
WITH CHECK (customer_name IS NOT NULL AND length(customer_name)>0 AND customer_email IS NOT NULL AND customer_email~'^[^@]+@[^@]+\.[^@]+$' AND customer_phone IS NOT NULL AND length(customer_phone)>0 AND product_id IS NOT NULL AND quantity>0 AND total_price>0 AND user_id=auth.uid());
DROP POLICY IF EXISTS "Admins view all orders" ON public.orders;
CREATE POLICY "Admins view all orders" ON public.orders FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "Users view own orders" ON public.orders;
CREATE POLICY "Users view own orders" ON public.orders FOR SELECT TO authenticated USING (auth.uid()=user_id);
DROP POLICY IF EXISTS "Admins can update orders" ON public.orders;
CREATE POLICY "Admins can update orders" ON public.orders FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "Admins can delete orders" ON public.orders;
CREATE POLICY "Admins can delete orders" ON public.orders FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Admins can view credentials" ON public.account_credentials;
CREATE POLICY "Admins can view credentials" ON public.account_credentials FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "Admins can insert credentials" ON public.account_credentials;
CREATE POLICY "Admins can insert credentials" ON public.account_credentials FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "Admins can update credentials" ON public.account_credentials;
CREATE POLICY "Admins can update credentials" ON public.account_credentials FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "Admins can delete credentials" ON public.account_credentials;
CREATE POLICY "Admins can delete credentials" ON public.account_credentials FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "Buyers view their own purchased credentials" ON public.account_credentials;
CREATE POLICY "Buyers view their own purchased credentials" ON public.account_credentials FOR SELECT TO authenticated
USING (is_sold=true AND sold_to_order IS NOT NULL AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id=account_credentials.sold_to_order AND o.user_id=auth.uid()));

DROP POLICY IF EXISTS "Admins can view roles" ON public.user_roles;
CREATE POLICY "Admins can view roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Anyone can view active grades" ON public.account_grades;
CREATE POLICY "Anyone can view active grades" ON public.account_grades FOR SELECT USING (is_active=true OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "Admins manage grades" ON public.account_grades;
CREATE POLICY "Admins manage grades" ON public.account_grades FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Anyone can view active packages" ON public.packages;
CREATE POLICY "Anyone can view active packages" ON public.packages FOR SELECT USING (is_active=true OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "Admins manage packages" ON public.packages;
CREATE POLICY "Admins manage packages" ON public.packages FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid()=user_id);
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid()=user_id);
DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid()=user_id);
DROP POLICY IF EXISTS "Admins view all profiles" ON public.profiles;
CREATE POLICY "Admins view all profiles" ON public.profiles FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Users view own wallet" ON public.wallets;
CREATE POLICY "Users view own wallet" ON public.wallets FOR SELECT TO authenticated USING (auth.uid()=user_id);
DROP POLICY IF EXISTS "Admins view all wallets" ON public.wallets;
CREATE POLICY "Admins view all wallets" ON public.wallets FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "Admins update wallets" ON public.wallets;
CREATE POLICY "Admins update wallets" ON public.wallets FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Users view own transactions" ON public.wallet_transactions;
CREATE POLICY "Users view own transactions" ON public.wallet_transactions FOR SELECT TO authenticated USING (auth.uid()=user_id);
DROP POLICY IF EXISTS "Admins view all transactions" ON public.wallet_transactions;
CREATE POLICY "Admins view all transactions" ON public.wallet_transactions FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "Admins manage transactions" ON public.wallet_transactions;
CREATE POLICY "Admins manage transactions" ON public.wallet_transactions FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Admins manage promos" ON public.promos;
CREATE POLICY "Admins manage promos" ON public.promos FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Public read category settings" ON public.category_settings;
CREATE POLICY "Public read category settings" ON public.category_settings FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Admin manage category settings" ON public.category_settings;
CREATE POLICY "Admin manage category settings" ON public.category_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- STORAGE
INSERT INTO storage.buckets (id,name,public) VALUES ('payment-proofs','payment-proofs',false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id,name,public) VALUES ('category-logos','category-logos',true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id,name,public) VALUES ('promo-banners','promo-banners',true) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Admins view payment proofs" ON storage.objects;
CREATE POLICY "Admins view payment proofs" ON storage.objects FOR SELECT TO authenticated USING (bucket_id='payment-proofs' AND has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "Authenticated upload own payment proofs" ON storage.objects;
CREATE POLICY "Authenticated upload own payment proofs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='payment-proofs' AND auth.uid()::text=(storage.foldername(name))[1]);
DROP POLICY IF EXISTS "Public read category logos" ON storage.objects;
CREATE POLICY "Public read category logos" ON storage.objects FOR SELECT TO public USING (bucket_id='category-logos');
DROP POLICY IF EXISTS "Admin upload category logos" ON storage.objects;
CREATE POLICY "Admin upload category logos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='category-logos');
DROP POLICY IF EXISTS "Admin update category logos" ON storage.objects;
CREATE POLICY "Admin update category logos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id='category-logos');
DROP POLICY IF EXISTS "Admin delete category logos" ON storage.objects;
CREATE POLICY "Admin delete category logos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id='category-logos');
DROP POLICY IF EXISTS "Public read promo banners" ON storage.objects;
CREATE POLICY "Public read promo banners" ON storage.objects FOR SELECT TO public USING (bucket_id='promo-banners');
DROP POLICY IF EXISTS "Admin upload promo banners" ON storage.objects;
CREATE POLICY "Admin upload promo banners" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='promo-banners');
DROP POLICY IF EXISTS "Admin update promo banners" ON storage.objects;
CREATE POLICY "Admin update promo banners" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id='promo-banners');
DROP POLICY IF EXISTS "Admin delete promo banners" ON storage.objects;
CREATE POLICY "Admin delete promo banners" ON storage.objects FOR DELETE TO authenticated USING (bucket_id='promo-banners');

-- SEED
INSERT INTO public.category_settings (slug,label,emoji,display_order) VALUES
  ('facebook','Facebook','📘',1),('instagram','Instagram','📸',2),
  ('tiktok','TikTok','🎵',3),('gaming','Gaming','🎮',4),
  ('tools','Tools','🛠️',5),('crypto','Crypto','₿',6)
ON CONFLICT (slug) DO NOTHING;

-- ADMIN USER
DO $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM auth.users WHERE email='admin@buyingaccount.local' LIMIT 1;
  IF v_id IS NULL THEN
    v_id := gen_random_uuid();
    INSERT INTO auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_app_meta_data,raw_user_meta_data,is_super_admin,confirmation_token,email_change,email_change_token_new,recovery_token)
    VALUES ('00000000-0000-0000-0000-000000000000',v_id,'authenticated','authenticated','admin@buyingaccount.local',crypt('admin123',gen_salt('bf')),now(),now(),now(),'{"provider":"email","providers":["email"]}'::jsonb,'{"full_name":"Super Admin"}'::jsonb,false,'','','','');
    INSERT INTO auth.identities (id,user_id,identity_data,provider,provider_id,last_sign_in_at,created_at,updated_at)
    VALUES (gen_random_uuid(),v_id,jsonb_build_object('sub',v_id::text,'email','admin@buyingaccount.local','email_verified',true),'email',v_id::text,now(),now(),now());
  END IF;
  INSERT INTO public.user_roles (user_id,role) VALUES (v_id,'admin') ON CONFLICT DO NOTHING;
END $$;

-- Backfill wallets
INSERT INTO public.wallets (user_id,balance) SELECT u.id,0 FROM auth.users u LEFT JOIN public.wallets w ON w.user_id=u.id WHERE w.id IS NULL ON CONFLICT DO NOTHING;

-- Reload schema cache
SELECT pg_notify('pgrst','reload schema');
