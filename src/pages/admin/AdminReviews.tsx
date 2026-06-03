import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { StarRating } from "@/components/StarRating";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminReviews() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-reviews"],
    queryFn: async () => {
      const { data: rs } = await supabase
        .from("product_reviews")
        .select("id, product_id, user_id, rating, comment, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      const pids = Array.from(new Set((rs || []).map((r: any) => r.product_id)));
      const uids = Array.from(new Set((rs || []).map((r: any) => r.user_id)));
      const [{ data: prods }, { data: profs }] = await Promise.all([
        pids.length ? supabase.from("products").select("id, name").in("id", pids) : Promise.resolve({ data: [] as any[] }),
        uids.length ? supabase.from("profiles").select("user_id, full_name").in("user_id", uids) : Promise.resolve({ data: [] as any[] }),
      ]);
      const pm = Object.fromEntries((prods || []).map((p: any) => [p.id, p.name]));
      const um = Object.fromEntries((profs || []).map((p: any) => [p.user_id, p.full_name]));
      return (rs || []).map((r: any) => ({ ...r, product_name: pm[r.product_id], user_name: um[r.user_id] }));
    },
  });

  const remove = async (id: string) => {
    if (!confirm("Hapus ulasan ini?")) return;
    const { error } = await supabase.from("product_reviews").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Ulasan dihapus");
    qc.invalidateQueries({ queryKey: ["admin-reviews"] });
  };

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Moderasi Ulasan</h1>
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : !data || data.length === 0 ? (
        <p className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          Belum ada ulasan.
        </p>
      ) : (
        <div className="space-y-2">
          {data.map((r: any) => (
            <div key={r.id} className="rounded-xl border bg-card p-4">
              <div className="mb-1 flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{r.product_name || "Produk dihapus"}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.user_name || "Pengguna"} · {new Date(r.created_at).toLocaleString("id-ID")}
                  </p>
                </div>
                <Button size="icon" variant="ghost" onClick={() => remove(r.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              <StarRating value={r.rating} readOnly size={14} />
              {r.comment && <p className="mt-2 text-sm">{r.comment}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}