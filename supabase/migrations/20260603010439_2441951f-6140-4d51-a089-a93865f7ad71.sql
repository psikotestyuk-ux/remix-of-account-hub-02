-- Fix: remove public SELECT policy on warranty-proofs bucket
DROP POLICY IF EXISTS "Uploaders view warranty proofs via signed url" ON storage.objects;

-- Fix: remove products from realtime publication to prevent unrestricted channel subscriptions.
-- Products are fetched normally via PostgREST; realtime broadcast wasn't required.
ALTER PUBLICATION supabase_realtime DROP TABLE public.products;