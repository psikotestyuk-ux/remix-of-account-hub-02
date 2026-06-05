import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StarRating } from "./StarRating";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  productId: string;
}

export function ReviewList({ productId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["product-reviews", productId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_product_reviews_public", {
        _product_id: productId,
      });
      if (error) throw error;
      return (data || []) as Array<{
        id: string;
        product_id: string;
        rating: number;
        comment: string | null;
        created_at: string;
        display_name: string;
      }>;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        Belum ada ulasan untuk produk ini.
      </p>
    );
  }

  const avg = data.reduce((a, r) => a + r.rating, 0) / data.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 rounded-xl bg-muted/50 p-3">
        <div className="text-2xl font-bold">{avg.toFixed(1)}</div>
        <div>
          <StarRating value={Math.round(avg)} readOnly size={16} />
          <p className="text-xs text-muted-foreground">{data.length} ulasan</p>
        </div>
      </div>
      {data.map((r) => (
        <div key={r.id} className="rounded-xl border p-4">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-sm font-medium">{r.display_name}</span>
            <span className="text-xs text-muted-foreground">
              {new Date(r.created_at).toLocaleDateString("id-ID", { dateStyle: "medium" })}
            </span>
          </div>
          <StarRating value={r.rating} readOnly size={14} />
          {r.comment && <p className="mt-2 text-sm text-foreground/80">{r.comment}</p>}
        </div>
      ))}
    </div>
  );
}