
-- Allow public to view credentials that have been sold to a specific order
-- (so the order's customer can retrieve their account after payment)
CREATE POLICY "Buyers view credentials for their order"
ON public.account_credentials
FOR SELECT
TO public
USING (
  is_sold = true
  AND sold_to_order IS NOT NULL
);
