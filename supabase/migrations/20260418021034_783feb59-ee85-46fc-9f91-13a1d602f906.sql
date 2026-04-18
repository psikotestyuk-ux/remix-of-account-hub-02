
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
