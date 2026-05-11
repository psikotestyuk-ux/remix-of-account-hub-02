-- Function to recompute product stock from unsold credentials
CREATE OR REPLACE FUNCTION public.recompute_product_stock(_product_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  IF _product_id IS NULL THEN RETURN; END IF;
  SELECT COUNT(*)::int INTO v_count
  FROM public.account_credentials
  WHERE product_id = _product_id AND is_sold = false;

  UPDATE public.products
  SET stock = v_count, updated_at = now()
  WHERE id = _product_id AND stock IS DISTINCT FROM v_count;
END;
$$;

-- Trigger function
CREATE OR REPLACE FUNCTION public.sync_product_stock_from_credentials()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.recompute_product_stock(NEW.product_id);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_product_stock(OLD.product_id);
  ELSE
    IF NEW.product_id IS DISTINCT FROM OLD.product_id THEN
      PERFORM public.recompute_product_stock(OLD.product_id);
      PERFORM public.recompute_product_stock(NEW.product_id);
    ELSIF NEW.is_sold IS DISTINCT FROM OLD.is_sold THEN
      PERFORM public.recompute_product_stock(NEW.product_id);
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_product_stock ON public.account_credentials;
CREATE TRIGGER trg_sync_product_stock
AFTER INSERT OR UPDATE OR DELETE ON public.account_credentials
FOR EACH ROW EXECUTE FUNCTION public.sync_product_stock_from_credentials();

-- One-time backfill
UPDATE public.products p
SET stock = COALESCE(c.cnt, 0), updated_at = now()
FROM (
  SELECT product_id, COUNT(*)::int AS cnt
  FROM public.account_credentials
  WHERE is_sold = false
  GROUP BY product_id
) c
WHERE p.id = c.product_id AND p.stock IS DISTINCT FROM c.cnt;

UPDATE public.products
SET stock = 0, updated_at = now()
WHERE stock <> 0
  AND id NOT IN (SELECT DISTINCT product_id FROM public.account_credentials WHERE is_sold = false);