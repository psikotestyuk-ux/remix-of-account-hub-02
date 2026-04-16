import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle, Package, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function OrderSuccess() {
  const [searchParams] = useSearchParams();
  const orders = searchParams.get("orders")?.split(",") || [];

  return (
    <div className="container mx-auto flex flex-col items-center px-4 py-20">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
        <CheckCircle className="h-10 w-10 text-green-600" />
      </div>
      <h1 className="mb-2 text-2xl font-bold">Pesanan Berhasil! 🎉</h1>
      <p className="mb-8 text-center text-muted-foreground">
        Terima kasih! Pesananmu telah berhasil dibuat.
      </p>

      {orders.length > 0 && (
        <Card className="mb-8 w-full max-w-md border-0 shadow-lg">
          <CardContent className="p-6">
            <h3 className="mb-3 font-bold">Nomor Pesanan</h3>
            <div className="space-y-2">
              {orders.map((orderNum) => (
                <div key={orderNum} className="flex items-center gap-2 rounded-lg bg-muted p-3">
                  <Package className="h-4 w-4 text-primary" />
                  <code className="text-sm font-medium">{orderNum}</code>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Simpan nomor pesanan ini untuk mengecek status pesananmu.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        {orders[0] && (
          <Link to={`/order/${orders[0]}`}>
            <Button variant="outline" className="gap-2 rounded-xl">
              <Package className="h-4 w-4" /> Cek Status Pesanan
            </Button>
          </Link>
        )}
        <Link to="/products">
          <Button className="gap-2 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90">
            Belanja Lagi <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
