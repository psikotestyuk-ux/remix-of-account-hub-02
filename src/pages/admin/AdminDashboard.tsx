import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatRupiah } from "@/lib/constants";
import { Card, CardContent } from "@/components/ui/card";
import { Package, ShoppingCart, DollarSign, Users } from "lucide-react";

export default function AdminDashboard() {
  const { data: products } = useQuery({
    queryKey: ["admin-products-count"],
    queryFn: async () => {
      const { count } = await supabase.from("products").select("*", { count: "exact", head: true });
      return count || 0;
    },
  });

  const { data: orders } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const { data } = await supabase.from("orders").select("total_price, payment_status");
      return data || [];
    },
  });

  const totalOrders = orders?.length || 0;
  const paidOrders = orders?.filter((o) => o.payment_status === "paid") || [];
  const revenue = paidOrders.reduce((sum, o) => sum + o.total_price, 0);

  const stats = [
    { label: "Total Produk", value: products ?? 0, icon: Package, color: "text-blue-600" },
    { label: "Total Orders", value: totalOrders, icon: ShoppingCart, color: "text-purple-600" },
    { label: "Pendapatan", value: formatRupiah(revenue), icon: DollarSign, color: "text-green-600" },
    { label: "Orders Sukses", value: paidOrders.length, icon: Users, color: "text-orange-600" },
  ];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-0 shadow-md">
            <CardContent className="flex items-center gap-4 p-6">
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-muted ${stat.color}`}>
                <stat.icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-bold">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
