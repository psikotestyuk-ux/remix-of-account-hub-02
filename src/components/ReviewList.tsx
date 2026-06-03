import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StarRating } from "./StarRating";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  productId: string;
}

function maskName(name: string | null | undefined) {
  if (!name) return "Pengguna";
  const trimmed = name.trim();
  if (trimmed.length <= 2) return trimmed[0] + "***";
  return trimmed.slice(0, 2) + "***";
}

export function ReviewList({ productId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["product-reviews", productId],
    queryFn: async () => {
      const { data: reviews } = await supabase
        .from("product_reviews")
        .select("id, user_id, rating, comment, created_at")
        .eq("product_id", productId)
        .order("created_at", { ascending: false })
        .limit(50);
      const ids = Array.from(new Set((reviews || []).map((r: any) => r.user_id)));
      let nameMap: Record<string, string> = {};
      if (ids.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", ids);
        nameMap = Object.fromEntries((profs || []).map((p: any) => [p.user_id, p.full_name]));
      }
      return (reviews || []).map((r: any) => ({ ...r, name: nameMap[r.user_id] }));
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
            <span className="text-sm font-medium">{maskName(r.name)}</span>
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