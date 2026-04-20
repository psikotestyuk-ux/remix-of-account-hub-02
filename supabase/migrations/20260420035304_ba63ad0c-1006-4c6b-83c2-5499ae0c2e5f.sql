-- Backfill wallets for any existing users that don't have one yet
INSERT INTO public.wallets (user_id, balance)
SELECT u.id, 0
FROM auth.users u
LEFT JOIN public.wallets w ON w.user_id = u.id
WHERE w.id IS NULL
ON CONFLICT DO NOTHING;

-- Allow authenticated users to insert their own wallet (safety net for missing rows)
CREATE POLICY "Users can insert own wallet"
ON public.wallets
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow authenticated users to update their own wallet balance (needed for mock topup)
CREATE POLICY "Users can update own wallet"
ON public.wallets
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);