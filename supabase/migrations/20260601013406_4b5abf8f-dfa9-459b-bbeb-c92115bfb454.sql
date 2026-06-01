DROP POLICY IF EXISTS "Anyone can view active products" ON public.products;
CREATE POLICY "Anyone can view active products"
ON public.products
FOR SELECT
TO public
USING (status = 'active'::product_status);

CREATE POLICY "Admins can view all products"
ON public.products
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Anyone can view active grades" ON public.account_grades;
CREATE POLICY "Anyone can view active grades"
ON public.account_grades
FOR SELECT
TO public
USING (is_active = true);

CREATE POLICY "Admins can view all grades"
ON public.account_grades
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Anyone can view active packages" ON public.packages;
CREATE POLICY "Anyone can view active packages"
ON public.packages
FOR SELECT
TO public
USING (is_active = true);

CREATE POLICY "Admins can view all packages"
ON public.packages
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;