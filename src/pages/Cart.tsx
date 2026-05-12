import { Link } from "react-router-dom";
import { Minus, Plus, Trash2, ArrowLeft, ShoppingCart } from "lucide-react";
import { useCartStore } from "@/store/cart";
import { formatRupiah, CATEGORY_EMOJI } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PromoBannerSlot } from "@/components/PromoBannerSlot";

export default function Cart() {
  const { items, removeItem, updateQuantity, getTotalPrice, clearCart } = useCartStore();

  if (items.length === 0) {
    return (
      <div className="container mx-auto flex flex-col items-center px-4 py-20">
        <span className="mb-4 text-6xl">🛒</span>
        <h1 className="mb-2 text-2xl font-bold">Keranjang Kosong</h1>
        <p className="mb-6 text-muted-foreground">Belum ada produk di keranjang kamu</p>
        <Link to="/products">
          <Button className="gap-2 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground">
            <ShoppingCart className="h-4 w-4" /> Mulai Belanja
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Link to="/products" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Lanjut Belanja
      </Link>
      <h1 className="mb-6 text-2xl font-bold">Keranjang Belanja</h1>

      <PromoBannerSlot placement="cart_checkout" className="mb-6" />

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {items.map((item) => (
            <Card key={item.id} className="border-0 shadow-md">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-muted text-3xl">
                  {CATEGORY_EMOJI[item.category] || '📦'}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="truncate font-semibold">{item.name}</h3>
                  <p className="text-sm font-medium text-primary">{formatRupiah(item.price)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.id, item.quantity - 1)}>
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-8 text-center font-medium">{item.quantity}</span>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.id, item.quantity + 1)}>
                    <Plus className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeItem(item.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <p className="w-28 text-right font-bold">{formatRupiah(item.price * item.quantity)}</p>
              </CardContent>
            </Card>
          ))}
          <Button variant="ghost" size="sm" className="text-destructive" onClick={clearCart}>
            Kosongkan Keranjang
          </Button>
        </div>

        <Card className="h-fit border-0 shadow-lg">
          <CardContent className="p-6">
            <h3 className="mb-4 text-lg font-bold">Ringkasan</h3>
            <div className="mb-2 flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatRupiah(getTotalPrice())}</span>
            </div>
            <div className="mb-4 flex justify-between text-sm">
              <span className="text-muted-foreground">Biaya layanan</span>
              <span className="text-green-600">Gratis</span>
            </div>
            <div className="mb-6 border-t pt-3 flex justify-between">
              <span className="font-bold">Total</span>
              <span className="text-xl font-bold text-primary">{formatRupiah(getTotalPrice())}</span>
            </div>
            <Link to="/checkout">
              <Button className="w-full gap-2 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90" size="lg">
                Checkout
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
