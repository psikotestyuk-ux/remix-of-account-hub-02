import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatRupiah } from "@/lib/constants";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Receipt, Loader2, ArrowRight, CheckCircle, Clock, XCircle } from "lucide-react";
import { toast } from "sonner";

const PAY_STATUS: Record<string, { label: string; cls: string; icon: any }> = {
  pending: { label: "Menunggu Verifikasi", cls: "bg-yellow-100 text-yellow-800", icon: Clock },
  paid: { label: "Pembayaran Disetujui", cls: "bg-green-100 text-green-800", icon: CheckCircle },
  failed: { label: "Pembayaran Ditolak", cls: "bg-red-100 text-red-800", icon: XCircle },
  expired: { label: "Kedaluwarsa", cls: "bg-muted text-muted-foreground", icon: XCircle },
};
const ORD_STATUS: Record<string, { label: string; cls: string }> = {
  processing: { label: "Diproses", cls: "bg-blue-100 text-blue-800" },
  completed: { label: "Selesai", cls: "bg-green-100 text-green-800" },
  cancelled: { label: "Dibatalkan", cls: "bg-red-100 text-red-800" },
};

export default function OrdersLookup() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [orderNum, setOrderNum] = useState("");
  const [myOrders, setMyOrders] = useState<any[]>([]);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("orders").select("id, order_number, total_price, payment_status, created_at")
      .eq("user_id", user.id).order("created_at", { ascending: false }).limit(20)
      .then(({ data }) => setMyOrders(data || []));
  }, [user]);

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = orderNum.trim().toUpperCase();
    if (!t) { toast.error("Masukkan nomor pesanan"); return; }
    if (!/^BA-[A-Z0-9]{4,12}$/.test(t)) {
      toast.error("Format salah. Contoh: BA-ABC123");
      return;
    }
    setChecking(true);
    setResult(null);
    setNotFound(false);
    try {
      const { data, error } = await supabase.rpc("get_order_by_number", { _order_number: t });
      if (error) throw error;
      const o = Array.isArray(data) ? data[0] : data;
      if (!o) { setNotFound(true); return; }
      setResult(o);
    } catch (err: any) {
      toast.error("Gagal mengambil pesanan: " + (err.message || "unknown"));
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="container mx-auto max-w-2xl px-4 py-6 pb-24">
      <h1 className="mb-2 flex items-center gap-2 text-2xl font-bold"><Receipt className="h-6 w-6" /> Cek Pesanan</h1>
      <p className="mb-6 text-sm text-muted-foreground">Masukkan nomor pesanan untuk melihat status & bukti pembayaran.</p>

      <Card className="mb-8 border-0 shadow-lg">
        <CardContent className="p-6">
          <form onSubmit={handleCheck} className="flex gap-2">
            <Input
              value={orderNum}
              onChange={(e) => setOrderNum(e.target.value.toUpperCase())}
              placeholder="BA-XXXXXX"
              className="rounded-xl font-mono uppercase"
              autoComplete="off"
            />
            <Button type="submit" className="gap-2 rounded-xl" disabled={checking}>
              {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Cek
            </Button>
          </form>

          {notFound && (
            <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
              ❌ Pesanan tidak ditemukan. Periksa kembali nomor pesanannya.
            </p>
          )}

          {result && (() => {
            const pay = PAY_STATUS[result.payment_status] ?? PAY_STATUS.pending;
            const ord = ORD_STATUS[result.order_status] ?? ORD_STATUS.processing;
            const PayIcon = pay.icon;
            return (
              <div className="mt-4 space-y-3 rounded-xl border bg-background p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Nomor pesanan</p>
                    <code className="text-base font-bold">{result.order_number}</code>
                  </div>
                  <p className="text-right text-lg font-bold text-primary">
                    {formatRupiah(Number(result.total_price))}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${pay.cls}`}>
                    <PayIcon className="h-3 w-3" /> {pay.label}
                  </span>
                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${ord.cls}`}>
                    {ord.label}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div>Nama: <span className="text-foreground">{result.customer_name}</span></div>
                  <div>Jumlah: <span className="text-foreground">{result.quantity}</span></div>
                  <div className="col-span-2">
                    Tanggal: <span className="text-foreground">
                      {new Date(result.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                    </span>
                  </div>
                </div>
                <Button
                  className="w-full gap-2 rounded-xl"
                  onClick={() => navigate(`/order/${encodeURIComponent(result.order_number)}`)}
                >
                  Lihat detail lengkap <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            );
          })()}
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
