
-- 1. Lock down `*_internal` SECURITY DEFINER functions: only callable from other DB functions, not via PostgREST.
REVOKE EXECUTE ON FUNCTION public.admin_fulfill_order_internal(uuid, uuid[], text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_order_by_number_internal(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.purchase_with_wallet_internal(uuid, integer, uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.topup_wallet_internal(bigint, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_promo_code_internal(text, bigint) FROM PUBLIC, anon, authenticated;

-- 2. product_reviews: fix policy misconfigured as `public` role; should be `authenticated`.
DROP POLICY IF EXISTS "users read own review" ON public.product_reviews;
CREATE POLICY "users read own review"
ON public.product_reviews
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 3. chat_messages: remove broad user UPDATE policy.
-- Read-receipts are handled exclusively by public.mark_chat_read() (SECURITY DEFINER).
-- Without this policy users cannot tamper with sender_id / sender_role / content of any message.
DROP POLICY IF EXISTS "users update msgs in own conv" ON public.chat_messages;
