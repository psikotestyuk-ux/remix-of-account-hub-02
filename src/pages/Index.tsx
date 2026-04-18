import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Shield, Zap, HeadphonesIcon, Star, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CATEGORIES, CATEGORY_EMOJI } from "@/lib/constants";
import { toast } from "sonner";

const FEATURES = [
  { icon: Shield, title: "100% Aman", desc: "Semua akun diverifikasi dan dijamin keamanannya" },
  { icon: Zap, title: "Instan", desc: "Akun langsung dikirim setelah pembayaran berhasil" },
  { icon: HeadphonesIcon, title: "Support 24/7", desc: "Tim support siap membantu kapan saja" },
  { icon: Star, title: "Garansi", desc: "Garansi penggantian jika ada masalah" },
];

export default function Index() {
  const navigate = useNavigate();
  const [orderNum, setOrderNum] = useState("");

  const handleCheckOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = orderNum.trim();
    if (!trimmed) { toast.error("Masukkan nomor pesanan"); return; }
    navigate(`/order/${encodeURIComponent(trimmed)}`);
  };

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-accent py-20 text-primary-foreground md:py-32">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.1),transparent_70%)]" />
        <div className="container relative mx-auto px-4 text-center">
          <h1 className="mb-4 text-4xl font-extrabold leading-tight md:text-6xl">
            Marketplace Akun Digital
            <br />
            <span className="text-primary-foreground/80">#1 di Indonesia</span>
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-primary-foreground/70">
            Jual beli akun Facebook, Instagram, TikTok, Gaming, Tools, dan Crypto dengan aman dan terpercaya.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/products">
              <Button size="lg" variant="secondary" className="gap-2 rounded-xl px-8 text-base font-semibold">
                Lihat Produk <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          {/* Cek pesanan */}
          <form onSubmit={handleCheckOrder} className="mx-auto mt-8 flex max-w-md flex-col gap-2 sm:flex-row">
            <Input
              value={orderNum}
              onChange={(e) => setOrderNum(e.target.value)}
              placeholder="Cek pesanan: BA-20260417-xxxxxxxx"
              className="rounded-xl bg-background text-foreground placeholder:text-muted-foreground"
            />
            <Button type="submit" variant="secondary" className="gap-2 rounded-xl">
              <Search className="h-4 w-4" /> Cek
            </Button>
          </form>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="mb-10 text-center text-2xl font-bold md:text-3xl">Kenapa Pilih BuyingAccount?</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <Card key={f.title} className="border-0 shadow-lg">
              <CardContent className="flex flex-col items-center p-6 text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground">
                  <f.icon className="h-6 w-6" />
                </div>
                <h3 className="mb-2 font-bold">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="bg-muted/50 py-16">
        <div className="container mx-auto px-4">
          <h2 className="mb-10 text-center text-2xl font-bold md:text-3xl">Kategori Akun</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {CATEGORIES.filter((c) => c.value !== 'all').map((cat) => (
              <Link to={`/products?category=${cat.value}`} key={cat.value}>
                <Card className="group border-0 shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
                  <CardContent className="flex flex-col items-center gap-2 p-6">
                    <span className="text-4xl transition-transform duration-300 group-hover:scale-110">
                      {CATEGORY_EMOJI[cat.value]}
                    </span>
                    <span className="font-semibold">{cat.label}</span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-16 text-center">
        <h2 className="mb-4 text-2xl font-bold md:text-3xl">Siap Mulai?</h2>
        <p className="mx-auto mb-8 max-w-xl text-muted-foreground">
          Temukan akun digital terbaik untuk kebutuhanmu. Proses cepat, aman, dan terpercaya.
        </p>
        <Link to="/products">
          <Button size="lg" className="gap-2 rounded-xl bg-gradient-to-r from-primary to-accent px-8 text-base font-semibold text-primary-foreground hover:opacity-90">
            Belanja Sekarang <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </section>
    </div>
  );
}
