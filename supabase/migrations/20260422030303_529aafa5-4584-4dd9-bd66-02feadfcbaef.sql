CREATE POLICY "Users can create own transactions"
ON public.wallet_transactions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);