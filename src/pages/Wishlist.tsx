import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ProductCard } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function Wishlist() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate("/auth?redirect=/wishlist");
  }, [loading, user, navigate]);

  const { data, isLoading } = useQuery({
    queryKey: ["wishlist-list", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: wl } = await supabase
        .from("wishlists")
        .select("product_id, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      const ids = (wl || []).map((w: any) => w.product_id);
      if (ids.length === 0) return [];
      const { data: products } = await supabase
        .from("products")
        .select("id, name, slug, category, price, stock, rating, image_url")
        .in("id", ids);
      return products || [];
    },
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <Heart className="h-6 w-6 text-red-500" />
        <h1 className="text-2xl font-bold">Wishlist Saya</h1>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-2xl" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed p-12 text-center">
          <Heart className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="mb-2 text-lg font-semibold">Wishlist kamu masih kosong</p>
          <p className="mb-6 text-sm text-muted-foreground">Tekan ❤️ di produk untuk menyimpannya di sini.</p>
          <Link to="/products"><Button>Jelajahi Produk</Button></Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {data.map((p: any) => (
            <ProductCard key={p.id} {...p} />
          ))}
        </div>
      )}
    </div>
  );
}