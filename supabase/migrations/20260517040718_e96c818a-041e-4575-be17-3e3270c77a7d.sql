GRANT EXECUTE ON FUNCTION public.purchase_with_wallet_internal(uuid, integer, uuid, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.topup_wallet_internal(bigint, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_order_by_number_internal(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.validate_promo_code_internal(text, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_fulfill_order_internal(uuid, uuid[], text) TO authenticated;