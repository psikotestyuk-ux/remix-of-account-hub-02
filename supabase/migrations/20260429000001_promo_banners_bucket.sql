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
