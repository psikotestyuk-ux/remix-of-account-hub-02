import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, TrendingUp, ShoppingBag, Users, DollarSign } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRupiah } from "@/lib/constants";
import { toast } from "sonner";

const COLORS = ["#6366f1", "#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981"];

function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function AdminReports() {
  const today = new Date();
  const monthAgo = new Date(Date.now() - 29 * 86400000);
  const [start, setStart] = useState(fmtDate(monthAgo));
  const [end, setEnd] = useState(fmtDate(today));

  const { data, isLoading } = useQuery({
    queryKey: ["sales-report", start, end],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_sales_report", {
        _start_date: start,
        _end_date: end,
      });
      if (error) throw error;
      return data as any;
    },
  });

  const kpis = data?.kpis || { revenue: 0, order_count: 0, aov: 0, customers: 0 };
  const daily = (data?.daily || []) as any[];
  const topProducts = (data?.top_products || []) as any[];
  const topCats = (data?.top_categories || []) as any[];
  const payments = (data?.payments || []) as any[];

  const dailyChart = useMemo(
    () => daily.map((d) => ({ day: d.day?.slice(5), revenue: Number(d.revenue), orders: d.orders })),
    [daily]
  );

  const exportCsv = () => {
    if (!daily.length) return toast.info("Tidak ada data untuk diekspor");
    const header = "Tanggal,Pendapatan,Order\n";
    const rows = daily.map((d) => `${d.day},${d.revenue},${d.orders}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `laporan-${start}_${end}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Laporan Penjualan</h1>
          <p className="text-sm text-muted-foreground">Hanya order dengan pembayaran disetujui.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label className="text-xs">Dari</Label>
            <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="w-40" />
          </div>
          <div>
            <Label className="text-xs">Sampai</Label>
            <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="w-40" />
          </div>
          <Button variant="outline" onClick={exportCsv} className="gap-2">
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <KpiCard icon={<DollarSign className="h-5 w-5" />} label="Total Pendapatan" value={formatRupiah(kpis.revenue)} />
            <KpiCard icon={<ShoppingBag className="h-5 w-5" />} label="Total Order" value={String(kpis.order_count)} />
            <KpiCard icon={<TrendingUp className="h-5 w-5" />} label="Rata-rata Order" value={formatRupiah(kpis.aov)} />
            <KpiCard icon={<Users className="h-5 w-5" />} label="Pelanggan Unik" value={String(kpis.customers)} />
          </div>

          <Card className="border-0 shadow-md">
            <CardContent className="p-5">
              <h2 className="mb-4 font-semibold">Tren Penjualan Harian</h2>
              <div className="h-72">
                <ResponsiveContainer>
                  <LineChart data={dailyChart}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="day" fontSize={11} />
                    <YAxis fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: any, n: string) => n === "revenue" ? formatRupiah(Number(v)) : v} />
                    <Line type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} dot={false} name="Pendapatan" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-0 shadow-md">
              <CardContent className="p-5">
                <h2 className="mb-4 font-semibold">Top 10 Produk</h2>
                {topProducts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Belum ada data.</p>
                ) : (
                  <div className="space-y-2">
                    {topProducts.map((p: any, i: number) => (
                      <div key={p.product_id} className="flex items-center justify-between border-b pb-2 last:border-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-bold text-muted-foreground">#{i + 1}</span>
                          <span className="truncate text-sm">{p.product_name || "(dihapus)"}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">{formatRupiah(p.revenue)}</p>
                          <p className="text-xs text-muted-foreground">{p.qty} terjual</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md">
              <CardContent className="p-5">
                <h2 className="mb-4 font-semibold">Kategori Teratas</h2>
                {topCats.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Belum ada data.</p>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie data={topCats} dataKey="revenue" nameKey="category" outerRadius={80} label={(e: any) => e.category}>
                          {topCats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: any) => formatRupiah(Number(v))} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border-0 shadow-md">
            <CardContent className="p-5">
              <h2 className="mb-4 font-semibold">Metode Pembayaran</h2>
              {payments.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada data.</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-3">
                  {payments.map((p: any) => (
                    <div key={p.method} className="rounded-xl border p-3">
                      <p className="text-xs uppercase text-muted-foreground">{p.method}</p>
                      <p className="text-lg font-bold">{formatRupiah(p.revenue)}</p>
                      <p className="text-xs text-muted-foreground">{p.orders} order</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="border-0 shadow-md">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 text-primary">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="truncate text-lg font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}