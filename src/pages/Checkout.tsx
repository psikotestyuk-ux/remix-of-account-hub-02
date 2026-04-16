import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCartStore } from "@/store/cart";
import { formatRupiah, CATEGORY_EMOJI } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

export default function Checkout() {
  const navigate = useNavigate();
  const { items, getTotalPrice, clearCart } = useCartStore();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (items.length === 0) {
    return (
      <div className="container mx-auto flex flex-col items-center px-4 py-20">
        <span className="mb-4 text-5xl">🛒</span>
        <h1 className="mb-2 text-2xl font-bold">Keranjang Kosong</h1>
        <p className="mb-6 text-muted-foreground">Tambahkan produk dulu sebelum checkout</p>
        <Link to="/products"><Button>Lihat Produk</Button></Link>
      </div>
    );
  }

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Nama wajib diisi";
    if (!form.email.trim() || !/^[^@]+@[^@]+\.[^@]+$/.test(form.email)) e.email = "Email tidak valid";
    if (!form.phone.trim() || form.phone.length < 10) e.phone = "Nomor WhatsApp minimal 10 digit";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      // Create orders for each cart item
      const orderNumbers: string[] = [];
      for (const item of items) {
        const { data, error } = await supabase.from("orders").insert({
          customer_name: form.name.trim(),
          customer_email: form.email.trim(),
          customer_phone: form.phone.trim(),
          product_id: item.id,
          quantity: item.quantity,
          total_price: item.price * item.quantity,
          order_number: "placeholder", // trigger will override
        }).select("order_number").single();
        if (error) throw error;
        orderNumbers.push(data.order_number);
      }
      clearCart();
      toast.success("Order berhasil dibuat!");
      navigate(`/order-success?orders=${orderNumbers.join(",")}`);
    } catch (err: any) {
      toast.error("Gagal membuat order: " + (err.message || "Coba lagi"));
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

          <Button type="submit" disabled={loading} className="w-full gap-2 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90" size="lg">
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Memproses...</> : `Bayar ${formatRupiah(getTotalPrice())}`}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            * Saat ini menggunakan simulasi pembayaran. Integrasi Xendit akan ditambahkan nanti.
          </p>
        </form>

        <Card className="h-fit border-0 shadow-lg">
          <CardContent className="p-6">
            <h3 className="mb-4 font-bold">Pesanan Kamu</h3>
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-3">
                  <span className="text-2xl">{CATEGORY_EMOJI[item.category] || '📦'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">x{item.quantity}</p>
                  </div>
                  <p className="font-semibold">{formatRupiah(item.price * item.quantity)}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 border-t pt-4 flex justify-between">
              <span className="font-bold">Total</span>
              <span className="text-xl font-bold text-primary">{formatRupiah(getTotalPrice())}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
