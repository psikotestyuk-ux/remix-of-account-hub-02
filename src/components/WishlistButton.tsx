import { Heart } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  productId: string;
  variant?: "icon" | "full";
  className?: string;
}

export function WishlistButton({ productId, variant = "icon", className }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: isFav } = useQuery({
    queryKey: ["wishlist-item", user?.id, productId],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await supabase
        .from("wishlists")
        .select("id")
        .eq("user_id", user.id)
        .eq("product_id", productId)
        .maybeSingle();
      return !!data;
    },
    enabled: !!user,
  });

  const toggle = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("login");
      if (isFav) {
        await supabase.from("wishlists").delete().eq("user_id", user.id).eq("product_id", productId);
      } else {
        await supabase.from("wishlists").insert({ user_id: user.id, product_id: productId });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wishlist-item", user?.id, productId] });
      qc.invalidateQueries({ queryKey: ["wishlist-list", user?.id] });
      toast.success(isFav ? "Dihapus dari wishlist" : "Ditambahkan ke wishlist");
    },
    onError: (e: any) => {
      if (e.message === "login") {
        toast.error("Login dulu untuk pakai wishlist");
        navigate("/auth");
      } else {
        toast.error("Gagal: " + (e.message || "unknown"));
      }
    },
  });

  const handle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      toast.error("Login dulu untuk pakai wishlist");
      navigate("/auth");
      return;
    }
    toggle.mutate();
  };

  if (variant === "full") {
    return (
      <Button onClick={handle} variant={isFav ? "default" : "outline"} className={cn("gap-2", className)}>
        <Heart className={cn("h-4 w-4", isFav && "fill-current")} />
        {isFav ? "Tersimpan" : "Tambah ke Wishlist"}
      </Button>
    );
  }

  return (
    <Button
      onClick={handle}
      size="icon"
      variant="ghost"
      className={cn(
        "h-8 w-8 rounded-full bg-white/80 backdrop-blur hover:bg-white",
        className
      )}
      aria-label="Wishlist"
    >
      <Heart className={cn("h-4 w-4", isFav ? "fill-red-500 text-red-500" : "text-foreground")} />
    </Button>
  );
}