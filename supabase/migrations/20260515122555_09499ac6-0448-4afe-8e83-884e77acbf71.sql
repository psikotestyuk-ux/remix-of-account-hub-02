ALTER FUNCTION public.get_order_by_number(text)
  RENAME TO get_order_by_number_internal;

REVOKE ALL ON FUNCTION public.get_order_by_number_internal(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_order_by_number(_order_number text)
RETURNS TABLE(
  id uuid, order_number text, payment_status payment_status, order_status order_status,
  total_price bigint, quantity integer, created_at timestamp with time zone, product_id uuid,
  grade_id uuid, package_id uuid, admin_notes text, payment_proof_url text,
  customer_name text, customer_email text, customer_phone text
)
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
SET search_path TO 'public'
AS $$
BEGIN
  IF _order_number IS NULL OR length(trim(_order_number)) = 0 THEN
    RETURN;
  END IF;
  -- Validasi format (BA-XXXXXX) untuk mencegah probing acak
  IF _order_number !~ '^BA-[A-Z0-9]{4,12}$' THEN
    RETURN;
  END IF;
  RETURN QUERY SELECT * FROM public.get_order_by_number_internal(_order_number);
END;
$$;

REVOKE ALL ON FUNCTION public.get_order_by_number(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_order_by_number(text) TO anon, authenticated;