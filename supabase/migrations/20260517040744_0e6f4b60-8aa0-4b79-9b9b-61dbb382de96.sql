-- Revoke direct execute on internal functions
REVOKE EXECUTE ON FUNCTION public.purchase_with_wallet_internal(uuid, integer, uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.topup_wallet_internal(bigint, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_order_by_number_internal(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_promo_code_internal(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_fulfill_order_internal(uuid, uuid[], text) FROM PUBLIC, anon, authenticated;

-- Make public wrappers SECURITY DEFINER so they can invoke internals
ALTER FUNCTION public.purchase_with_wallet(uuid, integer, uuid, uuid, text, text) SECURITY DEFINER;
ALTER FUNCTION public.topup_wallet(bigint, text, text) SECURITY DEFINER;
ALTER FUNCTION public.get_order_by_number(text) SECURITY DEFINER;
ALTER FUNCTION public.validate_promo_code(text, bigint) SECURITY DEFINER;
ALTER FUNCTION public.admin_fulfill_order(uuid, uuid[], text) SECURITY DEFINER;