-- Replace public INSERT policy on orders with authenticated-only policy
DROP POLICY IF EXISTS "Anyone can create orders with valid data" ON public.orders;

CREATE POLICY "Authenticated users can create their own orders"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (
  customer_name IS NOT NULL
  AND length(customer_name) > 0
  AND customer_email IS NOT NULL
  AND customer_email ~ '^[^@]+@[^@]+\.[^@]+$'
  AND customer_phone IS NOT NULL
  AND length(customer_phone) > 0
  AND product_id IS NOT NULL
  AND quantity > 0
  AND total_price > 0
  AND user_id = auth.uid()
);