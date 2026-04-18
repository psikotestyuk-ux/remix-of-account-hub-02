import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatRupiah } from "@/lib/constants";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function AdminOrders() {
  const queryClient = useQueryClient();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<any | null>(null);
  const [adminNotes, setAdminNotes] = useState("");

  const { data: orders, isLoading } = useQuery({
    queryKey: ["admin-orders-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, products(name, category), account_grades(grade), packages(name, quantity)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: "payment_status" | "order_status"; value: string }) => {
      const payload: any = { [field]: value };
      const { error } = await supabase.from("orders").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Status diupdate!"); queryClient.invalidateQueries({ queryKey: ["admin-orders-list"] }); },
    onError: (err: any) => toast.error(err.message),
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, approve, notes }: { id: string; approve: boolean; notes: string }) => {
      const { error } = await supabase.from("orders").update({
        payment_status: approve ? "paid" : "failed",
        order_status: approve ? "completed" : "cancelled",
        admin_notes: notes || null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      toast.success(vars.approve ? "Pembayaran disetujui!" : "Pembayaran ditolak");
      queryClient.invalidateQueries({ queryKey: ["admin-orders-list"] });
      setReviewing(null);
      setAdminNotes("");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const viewProof = async (path: string) => {
    const { data, error } = await supabase.storage.from("payment-proofs").createSignedUrl(path, 60 * 10);
    if (error) { toast.error("Gagal buka bukti: " + error.message); return; }
    setPreviewUrl(data.signedUrl);
  };

  const payColors: Record<string, string> = {
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
          {orders?.map((order: any) => (
            <Card key={order.id} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="text-sm font-bold">{order.order_number}</code>
                      <Badge className={payColors[order.payment_status]}>{order.payment_status}</Badge>
                      {order.account_grades && <Badge variant="outline">Grade {order.account_grades.grade}</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">{order.customer_name} — {order.customer_email} — {order.customer_phone}</p>
                    <p className="text-sm">{order.products?.name} {order.packages && `• ${order.packages.name} (${order.packages.quantity} akun)`}</p>
                    <p className="font-semibold text-primary">{formatRupiah(order.total_price)}</p>
                    {order.admin_notes && <p className="mt-1 text-xs italic text-muted-foreground">📝 {order.admin_notes}</p>}
                  </div>
                  <div className="flex flex-col gap-2">
                    {order.payment_proof_url && (
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => viewProof(order.payment_proof_url)}>
                        <Eye className="h-3 w-3" /> Lihat Bukti
                      </Button>
                    )}
                    {order.payment_status === "pending" && order.payment_proof_url && (
                      <Button size="sm" className="gap-1" onClick={() => { setReviewing(order); setAdminNotes(""); }}>
                        Review
                      </Button>
                    )}
                    <Select value={order.payment_status} onValueChange={(v) => updateStatus.mutate({ id: order.id, field: "payment_status", value: v })}>
                      <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                        <SelectItem value="expired">Expired</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={order.order_status} onValueChange={(v) => updateStatus.mutate({ id: order.id, field: "order_status", value: v })}>
                      <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
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

      {/* Preview bukti transfer */}
      <Dialog open={!!previewUrl} onOpenChange={(v) => !v && setPreviewUrl(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Bukti Transfer</DialogTitle></DialogHeader>
          {previewUrl && <img src={previewUrl} alt="Bukti transfer" className="w-full rounded-lg" />}
        </DialogContent>
      </Dialog>

      {/* Review modal */}
      <Dialog open={!!reviewing} onOpenChange={(v) => !v && setReviewing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Review Pembayaran</DialogTitle></DialogHeader>
          {reviewing && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-3 text-sm">
                <p><strong>{reviewing.order_number}</strong></p>
                <p>{reviewing.customer_name} — {formatRupiah(reviewing.total_price)}</p>
              </div>
              <Button variant="outline" className="w-full gap-2" onClick={() => viewProof(reviewing.payment_proof_url)}>
                <Eye className="h-4 w-4" /> Lihat Bukti Transfer
              </Button>
              <div>
                <Label>Catatan admin (opsional)</Label>
                <Textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} placeholder="Mis: Bukti tidak jelas, mohon upload ulang" rows={3} />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 gap-2 text-destructive" disabled={reviewMutation.isPending} onClick={() => reviewMutation.mutate({ id: reviewing.id, approve: false, notes: adminNotes })}>
                  {reviewMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><X className="h-4 w-4" /> Tolak</>}
                </Button>
                <Button className="flex-1 gap-2 bg-green-600 hover:bg-green-700" disabled={reviewMutation.isPending} onClick={() => reviewMutation.mutate({ id: reviewing.id, approve: true, notes: adminNotes })}>
                  {reviewMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4" /> Setujui</>}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
