
CREATE OR REPLACE FUNCTION public.user_owns_order(_order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.orders
    WHERE id = _order_id AND user_id = auth.uid()
  )
$$;

DROP POLICY IF EXISTS "Authenticated upload own payment proofs" ON storage.objects;

CREATE POLICY "Authenticated upload own payment proofs"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'payment-proofs'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND (storage.foldername(name))[2] IS NOT NULL
  AND public.user_owns_order(((storage.foldername(name))[2])::uuid)
);

DROP POLICY IF EXISTS "Owners update own payment proofs" ON storage.objects;
CREATE POLICY "Owners update own payment proofs"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'payment-proofs'
  AND (auth.uid())::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'payment-proofs'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND (storage.foldername(name))[2] IS NOT NULL
  AND public.user_owns_order(((storage.foldername(name))[2])::uuid)
);

DROP POLICY IF EXISTS "Owners delete own payment proofs" ON storage.objects;
CREATE POLICY "Owners delete own payment proofs"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'payment-proofs'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);
