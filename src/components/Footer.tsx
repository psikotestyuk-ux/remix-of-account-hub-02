import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="border-t bg-card">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-sm font-bold text-primary-foreground">
              B
            </div>
            <span className="font-bold">BuyingAccount</span>
          </div>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-foreground">Beranda</Link>
            <Link to="/products" className="hover:text-foreground">Produk</Link>
          </div>
          <p className="text-sm text-muted-foreground">
            © 2026 BuyingAccount. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
