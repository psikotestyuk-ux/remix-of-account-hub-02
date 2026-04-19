import { NavLink, useLocation } from "react-router-dom";
import { Home, Package, ShoppingCart, User, Receipt } from "lucide-react";
import { useCartStore } from "@/store/cart";
import { cn } from "@/lib/utils";

const ITEMS = [
  { to: "/", icon: Home, label: "Home" },
  { to: "/products", icon: Package, label: "Produk" },
  { to: "/orders-lookup", icon: Receipt, label: "Pesanan" },
  { to: "/cart", icon: ShoppingCart, label: "Keranjang", showBadge: true },
  { to: "/profile", icon: User, label: "Profil" },
];

export function MobileBottomNav() {
  const location = useLocation();
  const totalItems = useCartStore((s) => s.getTotalItems());

  // Hide on admin routes
  if (location.pathname.startsWith("/admin")) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-card/95 backdrop-blur-lg md:hidden">
      <div className="grid grid-cols-5">
        {ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              cn(
                "relative flex flex-col items-center gap-1 py-2 text-[10px] font-medium transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )
            }
          >
            <div className="relative">
              <item.icon className="h-5 w-5" />
              {item.showBadge && totalItems > 0 && (
                <span className="absolute -right-2 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                  {totalItems}
                </span>
              )}
            </div>
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
