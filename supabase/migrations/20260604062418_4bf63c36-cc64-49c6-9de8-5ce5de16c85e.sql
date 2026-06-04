CREATE POLICY "Users view own warranty proofs"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'warranty-proofs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users update own warranty proofs"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'warranty-proofs'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'warranty-proofs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users delete own warranty proofs"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'warranty-proofs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Admins manage warranty proofs"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'warranty-proofs' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'warranty-proofs' AND public.has_role(auth.uid(), 'admin'));