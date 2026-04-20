
-- Drop existing triggers
DROP TRIGGER IF EXISTS trg_auto_assign_credentials_insert ON public.orders;
DROP TRIGGER IF EXISTS trg_auto_assign_credentials ON public.orders;

-- Recreate INSERT function as AFTER trigger (FK on credentials needs order row to exist)
CREATE OR REPLACE FUNCTION public.auto_assign_credentials_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assigned int := 0;
  v_needed int;
BEGIN
  IF NEW.payment_status = 'paid' THEN
    v_needed := NEW.quantity;

    WITH avail AS (
      SELECT id FROM public.account_credentials
      WHERE product_id = NEW.product_id
        AND is_sold = false
        AND (NEW.grade_id IS NULL OR grade_id = NEW.grade_id)
      ORDER BY created_at ASC
      LIMIT v_needed
      FOR UPDATE SKIP LOCKED
    )
    UPDATE public.account_credentials c
    SET is_sold = true, sold_to_order = NEW.id, updated_at = now()
    FROM avail
    WHERE c.id = avail.id;

    GET DIAGNOSTICS v_assigned = ROW_COUNT;

    IF NEW.grade_id IS NOT NULL AND v_assigned > 0 THEN
      UPDATE public.account_grades
      SET stock = GREATEST(0, stock - v_assigned), updated_at = now()
      WHERE id = NEW.grade_id;
    END IF;

    -- Mark order completed if fully fulfilled (UPDATE since we are AFTER)
    IF v_assigned >= v_needed THEN
      UPDATE public.orders SET order_status = 'completed', updated_at = now() WHERE id = NEW.id;
    END IF;
  END IF;

  IF NEW.promo_code IS NOT NULL AND length(NEW.promo_code) > 0 THEN
    UPDATE public.promos
    SET used_count = used_count + 1, updated_at = now()
    WHERE code = NEW.promo_code;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_assign_credentials_insert
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.auto_assign_credentials_on_insert();

-- Recreate UPDATE trigger as AFTER too
CREATE OR REPLACE FUNCTION public.auto_assign_credentials()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assigned int := 0;
  v_needed int;
BEGIN
  IF NEW.payment_status = 'paid' AND (OLD.payment_status IS DISTINCT FROM 'paid') THEN
    v_needed := NEW.quantity;

    WITH avail AS (
      SELECT id FROM public.account_credentials
      WHERE product_id = NEW.product_id
        AND is_sold = false
        AND (NEW.grade_id IS NULL OR grade_id = NEW.grade_id)
      ORDER BY created_at ASC
      LIMIT v_needed
      FOR UPDATE SKIP LOCKED
    )
    UPDATE public.account_credentials c
    SET is_sold = true, sold_to_order = NEW.id, updated_at = now()
    FROM avail
    WHERE c.id = avail.id;

    GET DIAGNOSTICS v_assigned = ROW_COUNT;

    IF NEW.grade_id IS NOT NULL AND v_assigned > 0 THEN
      UPDATE public.account_grades
      SET stock = GREATEST(0, stock - v_assigned), updated_at = now()
      WHERE id = NEW.grade_id;
    END IF;

    IF v_assigned >= v_needed THEN
      UPDATE public.orders SET order_status = 'completed', updated_at = now() WHERE id = NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_assign_credentials
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.auto_assign_credentials();
