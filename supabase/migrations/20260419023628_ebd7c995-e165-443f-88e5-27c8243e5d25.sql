-- Add promo tracking columns to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS promo_code text,
  ADD COLUMN IF NOT EXISTS discount_amount bigint NOT NULL DEFAULT 0;

-- Function: auto-assign credentials when order is paid
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
  -- only act when status transitions to paid
  IF NEW.payment_status = 'paid' AND (OLD.payment_status IS DISTINCT FROM 'paid') THEN
    v_needed := NEW.quantity;

    -- Assign available credentials matching product (and grade if specified)
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

    -- Decrement grade stock if applicable
    IF NEW.grade_id IS NOT NULL AND v_assigned > 0 THEN
      UPDATE public.account_grades
      SET stock = GREATEST(0, stock - v_assigned), updated_at = now()
      WHERE id = NEW.grade_id;
    END IF;

    -- Mark order completed if fully fulfilled
    IF v_assigned >= v_needed THEN
      NEW.order_status := 'completed';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_assign_credentials ON public.orders;
CREATE TRIGGER trg_auto_assign_credentials
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.auto_assign_credentials();

-- Also handle direct insert with paid status (wallet checkout)
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

    IF v_assigned >= v_needed THEN
      NEW.order_status := 'completed';
    END IF;
  END IF;

  -- Increment promo usage if a promo code was applied
  IF NEW.promo_code IS NOT NULL AND length(NEW.promo_code) > 0 THEN
    UPDATE public.promos
    SET used_count = used_count + 1, updated_at = now()
    WHERE code = NEW.promo_code;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_assign_credentials_insert ON public.orders;
CREATE TRIGGER trg_auto_assign_credentials_insert
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.auto_assign_credentials_on_insert();