import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatRupiah } from "@/lib/constants";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Wallet, Loader2, CreditCard } from "lucide-react";
import { toast } from "sonner";

const PRESETS = [50000, 100000, 250000, 500000, 1000000, 2000000];

export default function TopUp() {
  const navigate = useNavigate();
  const { user, balance, refreshBalance, loading: authLoading } = useAuth();
  const [amount, setAmount] = useState<number>(100000);
  const [loading, setLoading] = useState(false);

  if (!authLoading && !user) { navigate("/auth?redirect=/topup"); return null; }

  const handleTopup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (amount < 10000) { toast.error("Minimal topup Rp 10.000"); return; }
    if (amount > 50_000_000) { toast.error("Maksimal topup Rp 50.000.000"); return; }
    setLoading(true);
    try {
      // MOCK Xendit flow - langsung credit saldo (production: panggil edge function create-invoice)
      const newBalance = balance + amount;
      const { error: txErr } = await supabase.from("wallet_transactions").insert({
        user_id: user.id,
        type: "topup",
        status: "completed",
        amount: amount,
        balance_after: newBalance,
        payment_method: "xendit_mock",
        notes: "Top up via Xendit (mock - menunggu integrasi production)",
      });
      if (txErr) throw txErr;
      const { error: wErr } = await supabase.from("wallets").update({ balance: newBalance }).eq("user_id", user.id);
      if (wErr) throw wErr;
      await refreshBalance();
      toast.success(`Saldo +${formatRupiah(amount)} berhasil ditambahkan`);
      navigate("/profile");
    } catch (err: any) {
      toast.error("Gagal topup: " + err.message);
    } finally { setLoading(false); }
  };

  return (
    <div className="container mx-auto max-w-xl px-4 py-6 pb-24">
      <Link to="/profile" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Kembali
      </Link>

      <Card className="mb-6 border-0 bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-xl">
        <CardContent className="p-6">
          <p className="flex items-center gap-2 text-sm opacity-80"><Wallet className="h-4 w-4" /> Saldo saat ini</p>
          <p className="mt-2 text-3xl font-extrabold">{formatRupiah(balance)}</p>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-lg">
        <CardContent className="p-6">
          <h1 className="mb-4 flex items-center gap-2 text-xl font-bold"><CreditCard className="h-5 w-5" /> Top Up Saldo</h1>

          <form onSubmit={handleTopup} className="space-y-5">
            <div>
              <Label className="mb-2 block">Pilih nominal cepat</Label>
              <div className="grid grid-cols-3 gap-2">
                {PRESETS.map((v) => (
                  <button
                    type="button"
                    key={v}
                    onClick={() => setAmount(v)}
                    className={`rounded-xl border p-3 text-sm font-semibold transition-colors ${
                      amount === v ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"
                    }`}
                  >
                    {formatRupiah(v)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="amt">Atau masukkan nominal</Label>
              <Input id="amt" type="number" min={10000} max={50000000} step={1000} value={amount} onChange={(e) => setAmount(Number(e.target.value) || 0)} />
              <p className="mt-1 text-xs text-muted-foreground">Min Rp 10.000 — Max Rp 50.000.000</p>
            </div>

            <div className="rounded-xl bg-muted/50 p-4 text-sm">
              <p className="mb-1 font-semibold">⚠️ Mode Pengembangan</p>
              <p className="text-muted-foreground">
                Integrasi Xendit belum aktif. Topup akan langsung mengkredit saldo (mock) untuk pengujian. Saat Xendit aktif, kamu akan diarahkan ke halaman pembayaran (VA / QRIS / e-wallet).
              </p>
            </div>

            <Button type="submit" disabled={loading || amount < 10000} className="w-full gap-2 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90" size="lg">
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Memproses...</> : <>Top Up {formatRupiah(amount)}</>}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
