
CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read settings" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Admins insert settings" ON public.app_settings FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update settings" ON public.app_settings FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete settings" ON public.app_settings FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.app_settings (key, value) VALUES
  ('whatsapp_admin_number', ''),
  ('operational_hours', 'Senin - Minggu, 09:00 - 22:00 WIB')
ON CONFLICT (key) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) VALUES ('warranty-proofs', 'warranty-proofs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can upload warranty proofs" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'warranty-proofs');
CREATE POLICY "Admins view warranty proofs" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'warranty-proofs' AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Uploaders view warranty proofs via signed url" ON storage.objects FOR SELECT USING (bucket_id = 'warranty-proofs');
