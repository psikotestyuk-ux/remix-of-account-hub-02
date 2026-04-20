import { useQuery } from "@tanstack/react-query";
import { Tag, Copy, Check } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatRupiah } from "@/lib/constants";
import { toast } from "sonner";

export function PromoBanner() {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const { data: promos } = useQuery({
    queryKey: ["promos-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("promos")
        .select("*")
        .eq("is_active", true)
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  if (!promos || promos.length === 0) return null;

  const copy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success(`Kode ${code} disalin`);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="mb-6 flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
      {promos.map((p) => (
        <Card
          key={p.id}
          className="flex min-w-[280px] shrink-0 items-center gap-3 border-0 bg-gradient-to-br from-primary to-accent p-4 text-primary-foreground shadow-lg"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
            <Tag className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{p.title}</p>
            <p className="text-xs opacity-90">
              {p.discount_type === "percent"
                ? `Diskon ${p.discount_value}%`
                : `Diskon ${formatRupiah(p.discount_value)}`}
              {p.min_purchase > 0 && ` · Min ${formatRupiah(p.min_purchase)}`}
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="h-8 shrink-0 gap-1 rounded-lg text-xs"
            onClick={() => copy(p.code)}
          >
            {copiedCode === p.code ? (
              <Check className="h-3 w-3" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
            {p.code}
          </Button>
        </Card>
      ))}
    </div>
  );
}
