import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatRupiah } from "@/lib/constants";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Receipt } from "lucide-react";
import { toast } from "sonner";

export default function OrdersLookup() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [orderNum, setOrderNum] = useState("");
  const [myOrders, setMyOrders] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("orders").select("id, order_number, total_price, payment_status, created_at")
      .eq("user_id", user.id).order("created_at", { ascending: false }).limit(20)
      .then(({ data }) => setMyOrders(data || []));
  }, [user]);

  const handleCheck = (e: React.FormEvent) => {
    e.preventDefault();
    const t = orderNum.trim();
    if (!t) { toast.error("Masukkan nomor pesanan"); return; }
    navigate(`/order/${encodeURIComponent(t)}`);
  };

  return (
    <div className="container mx-auto max-w-2xl px-4 py-6 pb-24">
      <h1 className="mb-2 flex items-center gap-2 text-2xl font-bold"><Receipt className="h-6 w-6" /> Cek Pesanan</h1>
      <p className="mb-6 text-sm text-muted-foreground">Masukkan nomor pesanan untuk melihat status & bukti pembayaran.</p>

      <Card className="mb-8 border-0 shadow-lg">
        <CardContent className="p-6">
          <form onSubmit={handleCheck} className="flex gap-2">
            <Input value={orderNum} onChange={(e) => setOrderNum(e.target.value)} placeholder="BA-XXXXXX" className="rounded-xl" />
            <Button type="submit" className="gap-2 rounded-xl"><Search className="h-4 w-4" /> Cek</Button>
          </form>
        </CardContent>
      </Card>

      {user && (
        <>
          <h2 className="mb-3 font-bold">Pesanan kamu</h2>
          {myOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada pesanan.</p>
          ) : (
            <div className="space-y-2">
              {myOrders.map((o) => (
                <Link key={o.id} to={`/order/${o.order_number}`}>
                  <Card className="border-0 shadow-sm hover:shadow-md">
                    <CardContent className="flex items-center justify-between p-4">
                      <div>
                        <p className="text-sm font-semibold">{o.order_number}</p>
                        <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString("id-ID")}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-primary">{formatRupiah(Number(o.total_price))}</p>
                        <Badge variant="secondary" className="mt-1 text-[10px]">{o.payment_status}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      {!user && (
        <Card className="border-0 bg-muted/30 shadow-sm">
          <CardContent className="p-6 text-center">
            <p className="mb-3 text-sm text-muted-foreground">Login untuk melihat semua pesanan kamu di satu tempat.</p>
            <Link to="/auth?redirect=/orders-lookup"><Button variant="outline" className="rounded-xl">Login / Daftar</Button></Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
