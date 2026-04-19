import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatRupiah } from "@/lib/constants";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Wallet() {
  const navigate = useNavigate();
  const { user, balance, loading: authLoading } = useAuth();
  const [txs, setTxs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) { navigate("/auth?redirect=/wallet"); return; }
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("wallet_transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      setTxs(data || []);
      setLoading(false);
    })();
  }, [user, authLoading, navigate]);

  return (
    <div className="container mx-auto max-w-2xl px-4 py-6 pb-24">
      <Link to="/profile" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Kembali
      </Link>

      <Card className="mb-6 border-0 bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-xl">
        <CardContent className="p-6">
          <p className="text-sm opacity-80">Saldo</p>
          <p className="mt-1 text-3xl font-extrabold">{formatRupiah(balance)}</p>
        </CardContent>
      </Card>

      <h2 className="mb-3 font-bold">Riwayat Transaksi</h2>
      {loading ? <Skeleton className="h-24 w-full" /> : txs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada transaksi.</p>
      ) : (
        <div className="space-y-2">
          {txs.map((t) => {
            const isCredit = t.type === "topup" || t.type === "refund";
            return (
              <Card key={t.id} className="border-0 shadow-sm">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    {isCredit ? <ArrowDownCircle className="h-6 w-6 text-green-600" /> : <ArrowUpCircle className="h-6 w-6 text-red-600" />}
                    <div>
                      <p className="text-sm font-semibold capitalize">{t.type}</p>
                      <p className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString("id-ID")}</p>
                      {t.notes && <p className="mt-1 text-xs text-muted-foreground">{t.notes}</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`block font-bold ${isCredit ? "text-green-600" : "text-red-600"}`}>
                      {isCredit ? "+" : "-"}{formatRupiah(Number(t.amount))}
                    </span>
                    <Badge variant={t.status === "completed" ? "default" : "secondary"} className="mt-1 text-[10px]">{t.status}</Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
