import { Link } from "react-router-dom";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useCartStore } from "@/store/cart";
import { formatRupiah, CATEGORY_EMOJI } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { SheetClose } from "@/components/ui/sheet";

export function CartDrawer() {
  const { items, removeItem, updateQuantity, getTotalPrice } = useCartStore();

  if (items.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-12">
        <span className="text-5xl">🛒</span>
        <p className="text-muted-foreground">Keranjang kosong</p>
        <SheetClose asChild>
          <Link to="/products">
            <Button>Lihat Produk</Button>
          </Link>
        </SheetClose>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 pt-4">
      <div className="flex-1 space-y-3 overflow-y-auto">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-2xl">
              {CATEGORY_EMOJI[item.category] || '📦'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium">{item.name}</p>
              <p className="text-sm font-semibold text-primary">{formatRupiah(item.price)}</p>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.id, item.quantity - 1)}>
                <Minus className="h-3 w-3" />
              </Button>
              <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.id, item.quantity + 1)}>
                <Plus className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeItem(item.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>
      <div className="border-t pt-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-medium">Total</span>
          <span className="text-lg font-bold text-primary">{formatRupiah(getTotalPrice())}</span>
        </div>
        <SheetClose asChild>
          <Link to="/checkout" className="block">
            <Button className="w-full bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90" size="lg">
              Checkout
            </Button>
          </Link>
        </SheetClose>
      </div>
    </div>
  );
}
