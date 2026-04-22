import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Package, Clock, CheckCircle, XCircle, Copy, Check, Download, Lock, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatRupiah, CATEGORY_EMOJI } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

const STATUS_MAP = {
  pending: { label: "Menunggu Verifikasi", icon: Clock, color: "bg-yellow-100 text-yellow-800" },
  paid: { label: "Pembayaran Disetujui", icon: CheckCircle, color: "bg-green-100 text-green-800" },
  failed: { label: "Pembayaran Ditolak", icon: XCircle, color: "bg-red-100 text-red-800" },
  expired: { label: "Kedaluwarsa", icon: XCircle, color: "bg-muted text-muted-foreground" },
};

const ORDER_STATUS_MAP = {
  processing: { label: "Diproses", color: "bg-blue-100 text-blue-800" },
  completed: { label: "Selesai", color: "bg-green-100 text-green-800" },
  cancelled: { label: "Dibatalkan", color: "bg-red-100 text-red-800" },
};

export default function OrderDetail() {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const [copiedIdx, setCopiedIdx] = useState<string | null>(null);

  const { data: order, isLoading } = useQuery({
    queryKey: ["order", orderNumber],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, products(*), account_grades(grade), packages(name, quantity)")
        .eq("order_number", orderNumber!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!orderNumber,
  });

  const { data: credentials } = useQuery({
    queryKey: ["order-credentials", order?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("account_credentials")
        .select("id, credentials_encrypted, email, password, twofa_secret, recovery_email, cookies, notes, created_at")
        .eq("sold_to_order", order!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!order && order.payment_status === "paid" && order.order_status === "completed",
  });

  // Ambil field terstruktur jika ada, fallback parse dari credentials_encrypted
  const getFields = (c: any) => {
    if (c.email || c.password) {
      return {
        email: c.email || "",
        password: c.password || "",
        twofa: c.twofa_secret || "",
        recovery: c.recovery_email || "",
        cookies: c.cookies || "",
        notes: c.notes || "",
      };
    }
    // Fallback: data lama format "email:password"
    const raw = c.credentials_encrypted || "";
    const idx = raw.indexOf(":");
    if (idx < 0) return { email: raw, password: "", twofa: "", recovery: "", cookies: "", notes: "" };
    return { email: raw.slice(0, idx).trim(), password: raw.slice(idx + 1).trim(), twofa: "", recovery: "", cookies: "", notes: "" };
  };

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(key);
    toast.success("Disalin");
    setTimeout(() => setCopiedIdx(null), 1500);
  };

  const downloadAll = () => {
    if (!credentials || !order) return;
    const lines = credentials.map((c, i) => {
      const f = getFields(c);
      const parts = [
        `# Akun ${i + 1}`,
        f.email && `Email    : ${f.email}`,
        f.password && `Password : ${f.password}`,
        f.twofa && `2FA Key  : ${f.twofa}`,
        f.recovery && `Recovery : ${f.recovery}`,
        f.cookies && `Cookies  : ${f.cookies}`,
        f.notes && `Notes    : ${f.notes}`,
      ].filter(Boolean);
      return parts.join("\n");
    }).join("\n\n");
    const content = `# Order ${order.order_number}\n# Total akun: ${credentials.length}\n# Tanggal: ${new Date().toLocaleString("id-ID")}\n\n${lines}\n`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${order.order_number}-akun.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("File diunduh");
  };

  const downloadOne = (c: any, idx: number) => {
    if (!order) return;
    const f = getFields(c);
    const content = [
      f.email && `Email    : ${f.email}`,
      f.password && `Password : ${f.password}`,
      f.twofa && `2FA Key  : ${f.twofa}`,
      f.recovery && `Recovery : ${f.recovery}`,
      f.cookies && `Cookies  : ${f.cookies}`,
      f.notes && `Notes    : ${f.notes}`,
    ].filter(Boolean).join("\n") || c.credentials_encrypted || "";
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${order.order_number}-akun-${idx + 1}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="mb-4 h-8 w-48" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container mx-auto flex flex-col items-center px-4 py-20">
        <span className="mb-4 text-5xl">❌</span>
        <h1 className="mb-2 text-2xl font-bold">Pesanan Tidak Ditemukan</h1>
        <p className="mb-6 text-muted-foreground">Pastikan nomor pesanan sudah benar</p>
        <Link to="/products"><Button>Kembali ke Produk</Button></Link>
      </div>
    );
  }

  const payStatus = STATUS_MAP[order.payment_status];
  const ordStatus = ORDER_STATUS_MAP[order.order_status];
  const product = order.products as any;
  const grade = (order as any).account_grades;
  const pkg = (order as any).packages;

  return (
    <div className="container mx-auto px-4 py-8">
      <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Kembali ke Beranda
      </Link>
      <h1 className="mb-8 text-2xl font-bold">Detail Pesanan</h1>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-0 shadow-lg">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              <code className="text-lg font-bold">{order.order_number}</code>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${payStatus.color}`}>
                <payStatus.icon className="h-3 w-3" />
                {payStatus.label}
              </span>
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${ordStatus.color}`}>
                {ordStatus.label}
              </span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Nama</span><span>{order.customer_name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>{order.customer_email}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">WhatsApp</span><span>{order.customer_phone}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Jumlah</span><span>{order.quantity}</span></div>
              <div className="flex justify-between border-t pt-2">
                <span className="font-bold">Total</span>
                <span className="text-lg font-bold text-primary">{formatRupiah(order.total_price)}</span>
              </div>
            </div>

            {order.payment_status === "pending" && (
              <div className="rounded-xl bg-yellow-50 p-4 text-sm text-yellow-900">
                ⏳ Bukti transfer kamu sedang diverifikasi admin. Cek email berkala untuk update status.
              </div>
            )}
            {order.payment_status === "failed" && (
              <div className="rounded-xl bg-red-50 p-4 text-sm text-red-900">
                ❌ Pembayaran ditolak.
                {order.admin_notes && <p className="mt-1 italic">Catatan admin: {order.admin_notes}</p>}
              </div>
            )}
          </CardContent>
        </Card>

        {product && (
          <Card className="border-0 shadow-lg">
            <CardContent className="p-6">
              <h3 className="mb-4 font-bold">Produk</h3>
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-muted text-3xl">
                  {CATEGORY_EMOJI[product.category] || '📦'}
                </div>
                <div>
                  <p className="font-semibold">{product.name}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge variant="outline" className="uppercase">{product.category}</Badge>
                    {grade && <Badge>Grade {grade.grade}</Badge>}
                  </div>
                </div>
              </div>
              {pkg && (
                <p className="mt-3 text-sm text-muted-foreground">
                  Paket: <span className="font-medium text-foreground">{pkg.name}</span> ({pkg.quantity} akun)
                </p>
              )}
              {order.payment_status === "paid" && order.order_status !== "completed" && (
                <div className="mt-6 rounded-xl bg-success/10 p-4">
                  <p className="mb-1 text-sm font-medium text-success">✅ Pembayaran disetujui!</p>
                  <p className="text-xs text-muted-foreground">
                    Kredensial sedang disiapkan. Refresh halaman ini sebentar lagi.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {order.order_status === "completed" && credentials && credentials.length > 0 && (
          <Card className="border-0 shadow-lg md:col-span-2">
            <CardContent className="p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-5 w-5 text-primary" />
                  <h3 className="font-bold">Akun Kamu ({credentials.length})</h3>
                </div>
                <Button size="sm" variant="outline" className="gap-2 rounded-lg" onClick={downloadAll}>
                  <Download className="h-4 w-4" /> Download .txt
                </Button>
              </div>
              <div className="mb-3 rounded-lg border border-accent/30 bg-accent/10 p-3 text-xs text-foreground/80">
                ⚠️ Simpan kredensial ini dengan aman. Untuk keamanan, segera ganti password setelah login pertama.
              </div>
              <div className="space-y-3">
                {credentials.map((c, idx) => {
                  const f = getFields(c);
                  return (
                    <div key={c.id} className="rounded-xl border bg-muted/30 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <Badge variant="secondary" className="rounded-md">Akun #{idx + 1}</Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1 text-xs"
                          onClick={() => downloadOne(c, idx)}
                        >
                          <Download className="h-3 w-3" /> .txt
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {f.email && (
                          <FieldRow label="Email" icon="📧" value={f.email} keyId={`e${idx}`} copy={copy} copiedIdx={copiedIdx} />
                        )}
                        {f.password && (
                          <FieldRow label="Password" icon="🔑" value={f.password} keyId={`p${idx}`} copy={copy} copiedIdx={copiedIdx} />
                        )}
                        {f.twofa && (
                          <FieldRow label="2FA" icon="🔐" value={f.twofa} keyId={`t${idx}`} copy={copy} copiedIdx={copiedIdx} mono />
                        )}
                        {f.recovery && (
                          <FieldRow label="Recovery" icon="🛟" value={f.recovery} keyId={`r${idx}`} copy={copy} copiedIdx={copiedIdx} />
                        )}
                        {f.cookies && (
                          <FieldRow label="Cookies" icon="🍪" value={f.cookies} keyId={`c${idx}`} copy={copy} copiedIdx={copiedIdx} />
                        )}
                        {f.notes && (
                          <p className="rounded-md bg-background/60 p-2 text-xs italic text-muted-foreground">📝 {f.notes}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
