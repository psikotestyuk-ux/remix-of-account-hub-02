import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Upload, Copy } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCartStore } from "@/store/cart";
import { formatRupiah, CATEGORY_EMOJI } from "@/lib/constants";
import { BANK_INFO } from "@/lib/bank";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Grade = { id: string; grade: string; description: string | null; base_price: number; product_id: string };
type Pkg = { id: string; name: string; quantity: number; price: number; grade_id: string };

export default function Checkout() {
  const navigate = useNavigate();
  const { items, clearCart } = useCartStore();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [grades, setGrades] = useState<Grade[]>([]);
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [selectedGrade, setSelectedGrade] = useState<string>("");
  const [selectedPkg, setSelectedPkg] = useState<string>("");
  const [proofFile, setProofFile] = useState<File | null>(null);

  // Single product flow: ambil produk pertama dari cart
  const item = items[0];

  useEffect(() => {
    if (!item) return;
    (async () => {
      const { data: g } = await supabase
        .from("account_grades")
        .select("*")
        .eq("product_id", item.id)
        .eq("is_active", true)
        .order("grade");
      setGrades((g as any) || []);
    })();
  }, [item?.id]);

  useEffect(() => {
    if (!selectedGrade) { setPackages([]); setSelectedPkg(""); return; }
    (async () => {
      const { data: p } = await supabase
        .from("packages")
        .select("*")
        .eq("grade_id", selectedGrade)
        .eq("is_active", true)
        .order("quantity");
      setPackages((p as any) || []);
      setSelectedPkg("");
    })();
  }, [selectedGrade]);

  if (!item) {
    return (
      <div className="container mx-auto flex flex-col items-center px-4 py-20">
        <span className="mb-4 text-5xl">🛒</span>
        <h1 className="mb-2 text-2xl font-bold">Keranjang Kosong</h1>
        <p className="mb-6 text-muted-foreground">Tambahkan produk dulu sebelum checkout</p>
        <Link to="/products"><Button>Lihat Produk</Button></Link>
      </div>
    );
  }

  const pkg = packages.find((p) => p.id === selectedPkg);
  const grade = grades.find((g) => g.id === selectedGrade);
  const totalPrice = pkg?.price ?? 0;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Nama wajib diisi";
    if (!form.email.trim() || !/^[^@]+@[^@]+\.[^@]+$/.test(form.email)) e.email = "Email tidak valid";
    if (!form.phone.trim() || form.phone.length < 10) e.phone = "Nomor WhatsApp minimal 10 digit";
    if (grades.length > 0 && !selectedGrade) e.grade = "Pilih grade";
    if (grades.length > 0 && !selectedPkg) e.pkg = "Pilih paket";
    if (!proofFile) e.proof = "Upload bukti transfer";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const copyAcc = () => {
    navigator.clipboard.writeText(BANK_INFO.accountNumber);
    toast.success("No. rekening disalin!");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      // 1. Upload bukti transfer
      const ext = proofFile!.name.split(".").pop() || "jpg";
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("payment-proofs").upload(path, proofFile!);
      if (upErr) throw upErr;

      // 2. Insert order
      const finalPrice = grades.length > 0 ? totalPrice : item.price * item.quantity;
      const finalQty = grades.length > 0 ? (pkg?.quantity ?? 1) : item.quantity;

      const { data, error } = await supabase.from("orders").insert({
        customer_name: form.name.trim(),
        customer_email: form.email.trim(),
        customer_phone: form.phone.trim(),
        product_id: item.id,
        quantity: finalQty,
        total_price: finalPrice,
        order_number: "placeholder",
        package_id: selectedPkg || null,
        grade_id: selectedGrade || null,
        payment_proof_url: path,
        payment_proof_uploaded_at: new Date().toISOString(),
      }).select("order_number").single();
      if (error) throw error;

      clearCart();
      toast.success("Order dibuat! Menunggu verifikasi admin.");
      navigate(`/order-success?orders=${data.order_number}`);
    } catch (err: any) {
      toast.error("Gagal: " + (err.message || "Coba lagi"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Link to="/cart" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Kembali ke Keranjang
      </Link>
      <h1 className="mb-8 text-2xl font-bold">Checkout</h1>

      <div className="grid gap-8 lg:grid-cols-2">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Pilih Grade & Paket */}
          {grades.length > 0 && (
            <Card className="border-0 shadow-lg">
              <CardContent className="space-y-4 p-6">
                <h3 className="font-bold">Pilih Grade & Paket</h3>
                <div>
                  <Label>Grade Akun</Label>
                  <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                    <SelectTrigger><SelectValue placeholder="Pilih grade..." /></SelectTrigger>
                    <SelectContent>
                      {grades.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          Grade {g.grade} {g.description ? `— ${g.description}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.grade && <p className="mt-1 text-sm text-destructive">{errors.grade}</p>}
                </div>
                {selectedGrade && (
                  <div>
                    <Label>Paket</Label>
                    <div className="grid gap-2">
                      {packages.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Belum ada paket untuk grade ini.</p>
                      ) : packages.map((p) => (
                        <button
                          type="button"
                          key={p.id}
                          onClick={() => setSelectedPkg(p.id)}
                          className={`flex items-center justify-between rounded-xl border p-3 text-left transition-colors ${
                            selectedPkg === p.id ? "border-primary bg-primary/5" : "hover:bg-muted"
                          }`}
                        >
                          <div>
                            <p className="font-semibold">{p.name}</p>
                            <p className="text-xs text-muted-foreground">{p.quantity} akun</p>
                          </div>
                          <span className="font-bold text-primary">{formatRupiah(p.price)}</span>
                        </button>
                      ))}
                    </div>
                    {errors.pkg && <p className="mt-1 text-sm text-destructive">{errors.pkg}</p>}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Pembeli */}
          <Card className="border-0 shadow-lg">
            <CardContent className="space-y-4 p-6">
              <h3 className="font-bold">Informasi Pembeli</h3>
              <div>
                <Label htmlFor="name">Nama Lengkap</Label>
                <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Masukkan nama lengkap" />
                {errors.name && <p className="mt-1 text-sm text-destructive">{errors.name}</p>}
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@contoh.com" />
                {errors.email && <p className="mt-1 text-sm text-destructive">{errors.email}</p>}
              </div>
              <div>
                <Label htmlFor="phone">Nomor WhatsApp</Label>
                <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="08123456789" />
                {errors.phone && <p className="mt-1 text-sm text-destructive">{errors.phone}</p>}
              </div>
            </CardContent>
          </Card>

          {/* Rekening + Upload bukti */}
          <Card className="border-0 shadow-lg">
            <CardContent className="space-y-4 p-6">
              <h3 className="font-bold">Pembayaran via Transfer</h3>
              <div className="rounded-xl bg-gradient-to-br from-primary/5 to-accent/5 p-4">
                <p className="text-xs text-muted-foreground">Transfer ke rekening:</p>
                <p className="font-bold">{BANK_INFO.bank}</p>
                <div className="flex items-center gap-2">
                  <code className="text-lg font-bold text-primary">{BANK_INFO.accountNumber}</code>
                  <Button type="button" size="sm" variant="ghost" onClick={copyAcc} className="h-7 gap-1">
                    <Copy className="h-3 w-3" /> Salin
                  </Button>
                </div>
                <p className="text-sm">a.n. <span className="font-semibold">{BANK_INFO.name}</span></p>
                {totalPrice > 0 && (
                  <p className="mt-2 text-sm">
                    Nominal: <span className="font-bold text-primary">{formatRupiah(totalPrice)}</span>
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="proof">Upload Bukti Transfer (JPG/PNG, max 5MB)</Label>
                <Input
                  id="proof"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f && f.size > 5 * 1024 * 1024) { toast.error("File maksimal 5MB"); return; }
                    setProofFile(f || null);
                  }}
                />
                {proofFile && (
                  <p className="mt-1 text-xs text-muted-foreground">📎 {proofFile.name} ({(proofFile.size / 1024).toFixed(0)} KB)</p>
                )}
                {errors.proof && <p className="mt-1 text-sm text-destructive">{errors.proof}</p>}
              </div>
            </CardContent>
          </Card>

          <Button type="submit" disabled={loading} className="w-full gap-2 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90" size="lg">
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Memproses...</> : <><Upload className="h-4 w-4" /> Submit Order & Bukti</>}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            * Order akan diverifikasi admin sebelum akun dikirim ke email kamu.
          </p>
        </form>

        <Card className="h-fit border-0 shadow-lg">
          <CardContent className="p-6">
            <h3 className="mb-4 font-bold">Ringkasan Pesanan</h3>
            <div className="flex items-center gap-3">
              <span className="text-2xl">{CATEGORY_EMOJI[item.category] || '📦'}</span>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium">{item.name}</p>
                {grade && <Badge variant="outline" className="mt-1 text-xs">Grade {grade.grade}</Badge>}
              </div>
            </div>
            {pkg && (
              <div className="mt-4 space-y-2 border-t pt-4 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Paket</span><span>{pkg.name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Jumlah akun</span><span>{pkg.quantity}</span></div>
              </div>
            )}
            <div className="mt-4 border-t pt-4 flex justify-between">
              <span className="font-bold">Total</span>
              <span className="text-xl font-bold text-primary">
                {formatRupiah(totalPrice || item.price * item.quantity)}
              </span>
            </div>
            {grades.length === 0 && (
              <p className="mt-3 text-xs text-muted-foreground">
                ℹ️ Produk ini belum punya grade/paket. Admin perlu setup di menu "Grade & Paket".
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
