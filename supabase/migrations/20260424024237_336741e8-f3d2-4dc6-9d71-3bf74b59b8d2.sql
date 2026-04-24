
-- Payment proofs: hanya authenticated, dan file harus di folder user_id miliknya
DROP POLICY IF EXISTS "Authenticated upload payment proofs" ON storage.objects;
CREATE POLICY "Authenticated upload own payment proofs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'payment-proofs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Orders INSERT: user_id harus NULL (guest) atau matching auth.uid()
DROP POLICY IF EXISTS "Anyone can create orders with valid data" ON public.orders;
CREATE POLICY "Anyone can create orders with valid data"
ON public.orders FOR INSERT
TO public
WITH CHECK (
  (customer_name IS NOT NULL) AND (length(customer_name) > 0)
  AND (customer_email IS NOT NULL) AND (customer_email ~ '^[^@]+@[^@]+\.[^@]+$')
  AND (customer_phone IS NOT NULL) AND (length(customer_phone) > 0)
  AND (product_id IS NOT NULL)
  AND (quantity > 0)
  AND (total_price > 0)
  AND (user_id IS NULL OR user_id = auth.uid())
);
