-- Fix get_order_by_number: case-insensitive + trim whitespace so "ba-abc123 " finds "BA-ABC123"
CREATE OR REPLACE FUNCTION public.get_order_by_number(_order_number text)
RETURNS TABLE (
  id uuid,
  order_number text,
  payment_status payment_status,
  order_status order_status,
  total_price bigint,
  quantity integer,
  created_at timestamptz,
  product_id uuid,
  grade_id uuid,
  package_id uuid,
  admin_notes text,
  payment_proof_url text,
  customer_name text,
  customer_email text,
  customer_phone text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.id, o.order_number, o.payment_status, o.order_status,
    o.total_price, o.quantity, o.created_at, o.product_id,
    o.grade_id, o.package_id, o.admin_notes, o.payment_proof_url,
    CASE WHEN auth.uid() = o.user_id OR has_role(auth.uid(), 'admin')
         THEN o.customer_name ELSE substr(o.customer_name, 1, 1) || '***' END,
    CASE WHEN auth.uid() = o.user_id OR has_role(auth.uid(), 'admin')
         THEN o.customer_email ELSE substr(o.customer_email, 1, 2) || '***@***' END,
    CASE WHEN auth.uid() = o.user_id OR has_role(auth.uid(), 'admin')
         THEN o.customer_phone ELSE '***' END
  FROM public.orders o
  WHERE UPPER(TRIM(o.order_number)) = UPPER(TRIM(_order_number))
  LIMIT 1;
$$;
