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
