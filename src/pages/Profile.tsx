import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatRupiah } from "@/lib/constants";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Wallet, LogOut, Plus, Receipt, ShoppingBag, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { toast } from "sonner";

type Profile = { full_name: string | null; phone: string | null; country: string | null };
type Tx = { id: string; type: string; status: string; amount: number; notes: string | null; created_at: string };

export default function Profile() {
  const navigate = useNavigate();
  const { user, balance, signOut, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<Profile>({ full_name: "", phone: "", country: "ID" });
  const [txs, setTxs] = useState<Tx[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) { navigate("/auth?redirect=/profile"); return; }
    if (!user) return;
    (async () => {
      const [{ data: p }, { data: t }, { data: o }] = await Promise.all([
        supabase.from("profiles").select("full_name, phone, country").eq("user_id", user.id).maybeSingle(),
        supabase.from("wallet_transactions").select("id, type, status, amount, notes, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
        supabase.from("orders").select("id, order_number, total_price, order_status, payment_status, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
      ]);
      if (p) setProfile({ full_name: p.full_name ?? "", phone: p.phone ?? "", country: p.country ?? "ID" });
      setTxs((t as any) || []);
      setOrders(o || []);
      setLoading(false);
    })();
  }, [user, authLoading, navigate]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      full_name: profile.full_name?.trim() || null,
      phone: profile.phone?.trim() || null,
      country: profile.country || "ID",
    }).eq("user_id", user.id);
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Profil tersimpan");
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  if (authLoading || loading) {
    return <div className="container mx-auto p-4 pb-24"><Skeleton className="h-32 w-full" /></div>;
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-6 pb-24">
      {/* Saldo Card */}
      <Card className="mb-6 border-0 bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-xl">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="flex items-center gap-2 text-sm opacity-80"><Wallet className="h-4 w-4" /> Saldo Kamu</p>
              <p className="mt-2 text-3xl font-extrabold">{formatRupiah(balance)}</p>
              <p className="mt-1 text-xs opacity-70">Saldo tidak bisa dicairkan, hanya untuk pembelian</p>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Link to="/topup" className="flex-1">
              <Button variant="secondary" className="w-full gap-2 rounded-xl"><Plus className="h-4 w-4" /> Top Up</Button>
            </Link>
            <Link to="/wallet" className="flex-1">
              <Button variant="outline" className="w-full gap-2 rounded-xl border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10">
                <Receipt className="h-4 w-4" /> Riwayat
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Profile Form */}
      <Card className="mb-6 border-0 shadow-lg">
        <CardContent className="p-6">
          <h2 className="mb-4 font-bold">Informasi Akun</h2>
          <form onSubmit={saveProfile} className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input value={user?.email || ""} disabled />
            </div>
            <div>
              <Label htmlFor="fn">Nama Lengkap</Label>
              <Input id="fn" value={profile.full_name || ""} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="ph">Nomor WhatsApp</Label>
              <Input id="ph" value={profile.phone || ""} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} placeholder="08xxx" />
            </div>
            <div>
              <Label htmlFor="ct">Negara</Label>
              <select id="ct" value={profile.country || "ID"} onChange={(e) => setProfile({ ...profile, country: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="ID">🇮🇩 Indonesia</option>
                <option value="MY">🇲🇾 Malaysia</option>
                <option value="SG">🇸🇬 Singapore</option>
                <option value="TH">🇹🇭 Thailand</option>
                <option value="PH">🇵🇭 Philippines</option>
                <option value="VN">🇻🇳 Vietnam</option>
              </select>
            </div>
            <Button type="submit" disabled={saving} className="w-full rounded-xl">{saving ? "Menyimpan..." : "Simpan Profil"}</Button>
          </form>
        </CardContent>
      </Card>

      {/* Orders */}
      <Card className="mb-6 border-0 shadow-lg">
        <CardContent className="p-6">
          <h2 className="mb-4 flex items-center gap-2 font-bold"><ShoppingBag className="h-4 w-4" /> Pesanan Terbaru</h2>
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada pesanan.</p>
          ) : (
            <div className="space-y-2">
              {orders.map((o) => (
                <Link key={o.id} to={`/order/${o.order_number}`} className="flex items-center justify-between rounded-xl border p-3 hover:bg-muted/50">
                  <div>
                    <p className="text-sm font-semibold">{o.order_number}</p>
                    <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString("id-ID")} • {o.payment_status}</p>
                  </div>
                  <span className="font-bold text-primary">{formatRupiah(Number(o.total_price))}</span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent transactions */}
      <Card className="mb-6 border-0 shadow-lg">
        <CardContent className="p-6">
          <h2 className="mb-4 flex items-center gap-2 font-bold"><Receipt className="h-4 w-4" /> Transaksi Terbaru</h2>
          {txs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada transaksi.</p>
          ) : (
            <div className="space-y-2">
                {txs.slice(0, 5).map((t) => {
                const isCredit = t.type === "topup" || t.type === "refund";
                return (
                  <div key={t.id} className="flex items-center justify-between rounded-xl border p-3">
                    <div className="flex items-center gap-3">
                      {isCredit ? <ArrowDownCircle className="h-5 w-5 text-success" /> : <ArrowUpCircle className="h-5 w-5 text-destructive" />}
                      <div>
                        <p className="text-sm font-semibold capitalize">{t.type}</p>
                        <p className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString("id-ID")} • {t.status}</p>
                      </div>
                    </div>
                    <span className={`font-bold ${isCredit ? "text-success" : "text-destructive"}`}>
                      {isCredit ? "+" : "-"}{formatRupiah(Number(t.amount))}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Button variant="outline" onClick={handleLogout} className="w-full gap-2 rounded-xl">
        <LogOut className="h-4 w-4" /> Keluar
      </Button>
    </div>
  );
}
