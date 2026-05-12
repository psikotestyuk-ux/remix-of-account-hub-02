-- Promo banners table
CREATE TYPE public.banner_placement AS ENUM ('home_hero', 'products_top', 'product_detail', 'cart_checkout');

CREATE TABLE public.promo_banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url TEXT NOT NULL,
  title TEXT,
  subtitle TEXT,
  product_id UUID,
  placement public.banner_placement NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.promo_banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active banners"
ON public.promo_banners FOR SELECT
USING (
  is_active = true
  AND (starts_at IS NULL OR starts_at <= now())
  AND (ends_at IS NULL OR ends_at >= now())
);

CREATE POLICY "Admins manage banners"
ON public.promo_banners FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_promo_banners_updated_at
BEFORE UPDATE ON public.promo_banners
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_promo_banners_placement ON public.promo_banners(placement, display_order);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('promo-banners', 'promo-banners', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read promo banner images"
ON storage.objects FOR SELECT
USING (bucket_id = 'promo-banners');

CREATE POLICY "Admins upload promo banners"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'promo-banners' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update promo banners"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'promo-banners' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete promo banners"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'promo-banners' AND has_role(auth.uid(), 'admin'::app_role));