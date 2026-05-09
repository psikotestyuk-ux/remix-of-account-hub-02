CREATE TABLE IF NOT EXISTS public.category_settings (
  slug TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '',
  logo_url TEXT,
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.category_settings (slug, label, emoji, display_order) VALUES
  ('facebook',  'Facebook',  '📘', 1),
  ('instagram', 'Instagram', '📸', 2),
  ('tiktok',    'TikTok',    '🎵', 3),
  ('gaming',    'Gaming',    '🎮', 4),
  ('tools',     'Tools',     '🛠️', 5),
  ('crypto',    'Crypto',    '₿',  6)
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE public.category_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read category settings" ON public.category_settings;
CREATE POLICY "Public read category settings"
ON public.category_settings FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Admin manage category settings" ON public.category_settings;
CREATE POLICY "Admin manage category settings"
ON public.category_settings FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO storage.buckets (id, name, public)
VALUES ('category-logos', 'category-logos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read category logos" ON storage.objects;
CREATE POLICY "Public read category logos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'category-logos');

DROP POLICY IF EXISTS "Admin upload category logos" ON storage.objects;
CREATE POLICY "Admin upload category logos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'category-logos' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admin update category logos" ON storage.objects;
CREATE POLICY "Admin update category logos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'category-logos' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admin delete category logos" ON storage.objects;
CREATE POLICY "Admin delete category logos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'category-logos' AND public.has_role(auth.uid(), 'admin'));