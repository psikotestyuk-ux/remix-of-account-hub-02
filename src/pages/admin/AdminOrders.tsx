import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatRupiah } from "@/lib/constants";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function AdminOrders() {
  const queryClient = useQueryClient();

  const { data: orders, isLoading } = useQuery({
    queryKey: ["admin-orders-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*, products(name, category)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: "payment_status" | "order_status"; value: string }) => {
      if (field === "payment_status") {
        const { error } = await supabase.from("orders").update({ payment_status: value as any }).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("orders").update({ order_status: value as any }).eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Status diupdate!");
      queryClient.invalidateQueries({ queryKey: ["admin-orders-list"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const paymentColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    paid: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",
    expired: "bg-muted text-muted-foreground",
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Orders</h1>
      {isLoading ? (
        <p className="text-muted-foreground">Memuat...</p>
      ) : orders?.length === 0 ? (
        <p className="text-muted-foreground">Belum ada order</p>
      ) : (
        <div className="space-y-3">
          {orders?.map((order) => (
            <Card key={order.id} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <code className="text-sm font-bold">{order.order_number}</code>
                    <p className="text-sm text-muted-foreground">{order.customer_name} — {order.customer_email}</p>
                    <p className="text-sm">{(order.products as any)?.name}</p>
                    <p className="font-semibold text-primary">{formatRupiah(order.total_price)}</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Select
                      value={order.payment_status}
                      onValueChange={(v) => updateStatus.mutate({ id: order.id, field: "payment_status", value: v })}
                    >
                      <SelectTrigger className="h-8 w-36 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                        <SelectItem value="expired">Expired</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={order.order_status}
                      onValueChange={(v) => updateStatus.mutate({ id: order.id, field: "order_status", value: v })}
                    >
                      <SelectTrigger className="h-8 w-36 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="processing">Processing</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
