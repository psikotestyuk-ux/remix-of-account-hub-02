-- ============================================================
-- Rename SECURITY DEFINER functions to *_internal and revoke
-- ============================================================
ALTER FUNCTION public.topup_wallet(bigint, text, text)
  RENAME TO topup_wallet_internal;

ALTER FUNCTION public.purchase_with_wallet(uuid, integer, uuid, uuid, text, text)
  RENAME TO purchase_with_wallet_internal;

ALTER FUNCTION public.validate_promo_code(text, bigint)
  RENAME TO validate_promo_code_internal;

ALTER FUNCTION public.admin_fulfill_order(uuid, uuid[], text)
  RENAME TO admin_fulfill_order_internal;

REVOKE ALL ON FUNCTION public.topup_wallet_internal(bigint, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.purchase_with_wallet_internal(uuid, integer, uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_promo_code_internal(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_fulfill_order_internal(uuid, uuid[], text) FROM PUBLIC, anon, authenticated;

-- ============================================================
-- SECURITY INVOKER wrappers (auth checks + delegate)
-- ============================================================

-- topup_wallet wrapper
CREATE OR REPLACE FUNCTION public.topup_wallet(
  _amount bigint,
  _payment_method text DEFAULT 'xendit_mock'::text,
  _notes text DEFAULT NULL::text
)
RETURNS TABLE(success boolean, new_balance bigint, transaction_id uuid, message text)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN QUERY SELECT false, 0::bigint, NULL::uuid, 'Tidak login'::text;
    RETURN;
  END IF;
  RETURN QUERY SELECT * FROM public.topup_wallet_internal(_amount, _payment_method, _notes);
END;
$$;

REVOKE ALL ON FUNCTION public.topup_wallet(bigint, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.topup_wallet(bigint, text, text) TO authenticated;

-- purchase_with_wallet wrapper
CREATE OR REPLACE FUNCTION public.purchase_with_wallet(
  _product_id uuid,
  _quantity integer,
  _grade_id uuid DEFAULT NULL::uuid,
  _package_id uuid DEFAULT NULL::uuid,
  _customer_name text DEFAULT NULL::text,
  _customer_phone text DEFAULT NULL::text
)
RETURNS TABLE(success boolean, order_id uuid, order_number text, new_balance bigint, message text)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::text, 0::bigint, 'Tidak login'::text;
    RETURN;
  END IF;
  RETURN QUERY SELECT * FROM public.purchase_with_wallet_internal(
    _product_id, _quantity, _grade_id, _package_id, _customer_name, _customer_phone
  );
END;
$$;

REVOKE ALL ON FUNCTION public.purchase_with_wallet(uuid, integer, uuid, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purchase_with_wallet(uuid, integer, uuid, uuid, text, text) TO authenticated;

-- validate_promo_code wrapper
CREATE OR REPLACE FUNCTION public.validate_promo_code(_code text, _purchase_amount bigint)
RETURNS TABLE(valid boolean, code text, title text, discount_type discount_type, discount_value numeric, min_purchase bigint, message text)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN QUERY SELECT false, _code, NULL::text, NULL::discount_type, NULL::numeric, NULL::bigint, 'Tidak login'::text;
    RETURN;
  END IF;
  RETURN QUERY SELECT * FROM public.validate_promo_code_internal(_code, _purchase_amount);
END;
$$;

REVOKE ALL ON FUNCTION public.validate_promo_code(text, bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_promo_code(text, bigint) TO authenticated;

-- admin_fulfill_order wrapper (admin-only)
CREATE OR REPLACE FUNCTION public.admin_fulfill_order(
  _order_id uuid,
  _credential_ids uuid[] DEFAULT NULL::uuid[],
  _notes text DEFAULT NULL::text
)
RETURNS TABLE(success boolean, assigned_count integer, total_assigned integer, needed integer, message text)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN QUERY SELECT false, 0, 0, 0, 'Tidak login'::text;
    RETURN;
  END IF;
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN QUERY SELECT false, 0, 0, 0, 'Tidak diizinkan'::text;
    RETURN;
  END IF;
  RETURN QUERY SELECT * FROM public.admin_fulfill_order_internal(_order_id, _credential_ids, _notes);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_fulfill_order(uuid, uuid[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_fulfill_order(uuid, uuid[], text) TO authenticated;