CREATE POLICY "Anyone can simulate payment on pending orders"
ON public.orders FOR UPDATE
TO public
USING (payment_status = 'pending')
WITH CHECK (payment_status = 'paid' AND order_status = 'completed');