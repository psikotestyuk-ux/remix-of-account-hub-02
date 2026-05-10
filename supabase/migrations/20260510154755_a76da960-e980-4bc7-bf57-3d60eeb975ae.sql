CREATE OR REPLACE FUNCTION public.auto_fulfill_pending_orders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order record;
  v_assigned_count int;
BEGIN
  -- Hanya proses kredensial yang masih tersedia
  IF NEW.is_sold = true OR NEW.sold_to_order IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Cari pesanan paling lama yang sudah dibayar tapi belum lengkap
  -- Match grade persis (NULL = NULL juga match)
  FOR v_order IN
    SELECT o.id, o.quantity, o.grade_id
    FROM public.orders o
    WHERE o.product_id = NEW.product_id
      AND o.payment_status = 'paid'
      AND o.order_status <> 'completed'
      AND o.grade_id IS NOT DISTINCT FROM NEW.grade_id
    ORDER BY o.created_at ASC
    FOR UPDATE
  LOOP
    SELECT COUNT(*) INTO v_assigned_count
    FROM public.account_credentials
    WHERE sold_to_order = v_order.id;

    IF v_assigned_count < v_order.quantity THEN
      UPDATE public.account_credentials
      SET is_sold = true,
          sold_to_order = v_order.id,
          updated_at = now()
      WHERE id = NEW.id;

      IF v_order.grade_id IS NOT NULL THEN
        UPDATE public.account_grades
        SET stock = GREATEST(0, stock - 1), updated_at = now()
        WHERE id = v_order.grade_id;
      END IF;

      IF v_assigned_count + 1 >= v_order.quantity THEN
        UPDATE public.orders
        SET order_status = 'completed', updated_at = now()
        WHERE id = v_order.id;
      END IF;

      RETURN NEW;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_fulfill_on_credential_insert ON public.account_credentials;
CREATE TRIGGER trg_auto_fulfill_on_credential_insert
AFTER INSERT ON public.account_credentials
FOR EACH ROW
EXECUTE FUNCTION public.auto_fulfill_pending_orders();