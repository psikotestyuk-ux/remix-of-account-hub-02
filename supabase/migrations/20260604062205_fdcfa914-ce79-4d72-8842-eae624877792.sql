DROP POLICY IF EXISTS "Anyone can upload warranty proofs" ON storage.objects;

CREATE POLICY "Users upload own warranty proofs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'warranty-proofs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);