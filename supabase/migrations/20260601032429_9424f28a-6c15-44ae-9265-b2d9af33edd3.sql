
CREATE OR REPLACE FUNCTION public.get_order_product_info(_order_number text)
RETURNS TABLE(
  product_id uuid,
  product_name text,
  product_category text,
  product_image_url text,
  product_slug text,
  product_status text,
  grade_label text,
  package_name text,
  package_quantity integer
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order record;
BEGIN
  IF _order_number IS NULL OR _order_number !~ '^BA-[A-Z0-9]{4,12}$' THEN
    RETURN;
  END IF;

  SELECT o.user_id, o.product_id, o.grade_id, o.package_id
    INTO v_order
    FROM public.orders o
   WHERE o.order_number = _order_number
   LIMIT 1;

  IF v_order IS NULL THEN
    RETURN;
  END IF;

  -- Hanya owner atau admin yang boleh dapat detail
  IF auth.uid() IS NULL OR (auth.uid() <> v_order.user_id AND NOT public.has_role(auth.uid(), 'admin')) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.category::text,
    p.image_url,
    p.slug,
    p.status::text,
    g.grade,
    pk.name,
    pk.quantity
  FROM public.products p
  LEFT JOIN public.account_grades g ON g.id = v_order.grade_id
  LEFT JOIN public.packages pk ON pk.id = v_order.package_id
  WHERE p.id = v_order.product_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_order_product_info(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_order_product_info(text) TO authenticated, service_role;
