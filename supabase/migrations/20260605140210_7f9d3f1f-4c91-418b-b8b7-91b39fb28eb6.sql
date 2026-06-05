
-- Remove overly permissive public SELECT
DROP POLICY IF EXISTS "public read reviews" ON public.product_reviews;

-- Owners can read their own review (needed by ReviewForm)
CREATE POLICY "users read own review"
ON public.product_reviews
FOR SELECT
USING (auth.uid() = user_id);

-- Safe public function: returns reviews for a product with masked names, no user_id
CREATE OR REPLACE FUNCTION public.get_product_reviews_public(_product_id uuid)
RETURNS TABLE (
  id uuid,
  product_id uuid,
  rating int,
  comment text,
  created_at timestamptz,
  display_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id,
    r.product_id,
    r.rating,
    r.comment,
    r.created_at,
    CASE
      WHEN p.full_name IS NULL OR length(trim(p.full_name)) = 0 THEN 'Pengguna'
      WHEN length(trim(p.full_name)) <= 2 THEN substr(trim(p.full_name),1,1) || '***'
      ELSE substr(trim(p.full_name),1,2) || '***'
    END AS display_name
  FROM public.product_reviews r
  LEFT JOIN public.profiles p ON p.user_id = r.user_id
  WHERE r.product_id = _product_id
  ORDER BY r.created_at DESC
  LIMIT 100;
$$;

GRANT EXECUTE ON FUNCTION public.get_product_reviews_public(uuid) TO anon, authenticated;
