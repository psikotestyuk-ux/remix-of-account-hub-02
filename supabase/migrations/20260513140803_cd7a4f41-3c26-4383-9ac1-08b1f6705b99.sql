CREATE OR REPLACE FUNCTION public.admin_fulfill_order(
  _order_id uuid,
  _credential_ids uuid[] DEFAULT NULL::uuid[],
  _notes text DEFAULT NULL::text
)
RETURNS TABLE(success boolean, assigned_count integer, total_assigned integer, needed integer, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order record;
  v_assigned int := 0;
  v_already int;
  v_remaining int;
  v_requested int := 0;
  v_skipped int := 0;
  v_msg text := 'OK';
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN QUERY SELECT false, 0, 0, 0, 'Tidak diizinkan'::text;
    RETURN;
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF v_order IS NULL THEN
    RETURN QUERY SELECT false, 0, 0, 0, 'Order tidak ditemukan'::text;
    RETURN;
  END IF;

  SELECT COUNT(*)::int INTO v_already
  FROM public.account_credentials WHERE sold_to_order = _order_id;

  v_remaining := GREATEST(0, v_order.quantity - v_already);

  IF v_remaining > 0 THEN
    IF _credential_ids IS NOT NULL AND array_length(_credential_ids, 1) > 0 THEN
      v_requested := array_length(_credential_ids, 1);

      WITH locked AS (
        SELECT id, product_id, is_sold, sold_to_order
        FROM public.account_credentials
        WHERE id = ANY(_credential_ids)
        FOR UPDATE
      ),
      picked AS (
        SELECT id FROM locked
        WHERE is_sold = false
          AND sold_to_order IS NULL
          AND product_id = v_order.product_id
        LIMIT v_remaining
      )
      UPDATE public.account_credentials c
      SET is_sold = true,
          sold_to_order = _order_id,
          updated_at = now()
      FROM picked
      WHERE c.id = picked.id
        AND c.is_sold = false
        AND c.sold_to_order IS NULL;
      GET DIAGNOSTICS v_assigned = ROW_COUNT;

      v_skipped := GREATEST(0, LEAST(v_requested, v_remaining) - v_assigned);
      IF v_skipped > 0 THEN
        v_msg := format('%s kredensial dilewati karena sudah terjual / dipakai order lain', v_skipped);
      END IF;
    ELSE
      WITH avail AS (
        SELECT id FROM public.account_credentials
        WHERE product_id = v_order.product_id
          AND is_sold = false
          AND sold_to_order IS NULL
          AND (v_order.grade_id IS NULL OR grade_id = v_order.grade_id)
        ORDER BY created_at ASC
        LIMIT v_remaining
        FOR UPDATE SKIP LOCKED
      )
      UPDATE public.account_credentials c
      SET is_sold = true,
          sold_to_order = _order_id,
          updated_at = now()
      FROM avail
      WHERE c.id = avail.id
        AND c.is_sold = false
        AND c.sold_to_order IS NULL;
      GET DIAGNOSTICS v_assigned = ROW_COUNT;
    END IF;

    IF v_order.grade_id IS NOT NULL AND v_assigned > 0 THEN
      UPDATE public.account_grades
      SET stock = GREATEST(0, stock - v_assigned), updated_at = now()
      WHERE id = v_order.grade_id;
    END IF;
  END IF;

  UPDATE public.orders
  SET admin_notes = CASE
        WHEN _notes IS NULL OR length(trim(_notes)) = 0 THEN admin_notes
        WHEN admin_notes IS NULL OR length(admin_notes) = 0 THEN _notes
        ELSE admin_notes || E'\n---\n' || _notes
      END,
      order_status = CASE
        WHEN (v_already + v_assigned) >= quantity THEN 'completed'::order_status
        ELSE order_status
      END,
      updated_at = now()
  WHERE id = _order_id;

  RETURN QUERY SELECT true, v_assigned, v_already + v_assigned, v_order.quantity, v_msg;
END;
$function$;