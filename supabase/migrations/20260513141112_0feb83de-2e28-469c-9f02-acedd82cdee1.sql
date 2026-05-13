-- 1) Storage: drop overly broad public SELECT policies on public buckets.
-- The buckets remain public, so direct file URLs still work; only API listing is removed.
DROP POLICY IF EXISTS "Public read category logos" ON storage.objects;
DROP POLICY IF EXISTS "Public read promo banner images" ON storage.objects;

-- 2) Lock down SECURITY DEFINER function execute privileges.
-- Default Postgres grants EXECUTE to PUBLIC; revoke and re-grant per role.

-- Authenticated-only RPCs
REVOKE ALL ON FUNCTION public.topup_wallet(bigint, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.topup_wallet(bigint, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.purchase_with_wallet(uuid, integer, uuid, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purchase_with_wallet(uuid, integer, uuid, uuid, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_fulfill_order(uuid, uuid[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_fulfill_order(uuid, uuid[], text) TO authenticated;

REVOKE ALL ON FUNCTION public.validate_promo_code(text, bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_promo_code(text, bigint) TO authenticated;

-- Public read RPC (used by anonymous order tracking page)
REVOKE ALL ON FUNCTION public.get_order_by_number(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_order_by_number(text) TO anon, authenticated;

-- has_role is referenced by RLS policies; authenticated only
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

-- Internal helpers — not meant to be called from the API at all
REVOKE ALL ON FUNCTION public.recompute_product_stock(uuid) FROM PUBLIC, anon, authenticated;

-- Trigger functions (run by trigger machinery, not via API)
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_admin_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_order_number() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_product_stock_from_credentials() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.auto_fulfill_pending_orders() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.auto_assign_credentials() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.auto_assign_credentials_on_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_short_order_code() FROM PUBLIC, anon, authenticated;