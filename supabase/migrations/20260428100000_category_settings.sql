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
