import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, XCircle, RefreshCw, Search, Mail } from "lucide-react";
import { toast } from "sonner";

type AdminUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  email_confirmed_at: string | null;
  last_sign_in_at: string | null;
  provider: string | null;
  providers: string[];
  recovery_sent_at: string | null;
  confirmation_sent_at: string | null;
  email_change_sent_at: string | null;
};

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" });
}

function lastResend(u: AdminUser) {
  const candidates = [u.confirmation_sent_at, u.recovery_sent_at, u.email_change_sent_at]
    .filter(Boolean) as string[];
  if (!candidates.length) return null;
  return candidates.sort().reverse()[0];
}

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "verified" | "unverified">("all");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-list-users");
    if (error) {
      toast.error("Gagal memuat data user");
      setLoading(false);
      return;
    }
    setUsers(data?.users ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (filter === "verified" && !u.email_confirmed_at) return false;
      if (filter === "unverified" && u.email_confirmed_at) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (u.email ?? "").toLowerCase().includes(q) || (u.full_name ?? "").toLowerCase().includes(q);
    });
  }, [users, search, filter]);

  const stats = useMemo(() => {
    const total = users.length;
    const verified = users.filter((u) => u.email_confirmed_at).length;
    const unverified = total - verified;
    return { total, verified, unverified };
  }, [users]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Status Verifikasi Email</h1>
          <p className="text-sm text-muted-foreground">Pantau status verifikasi email user dan log kirim ulang terakhir.</p>
        </div>
        <Button onClick={load} variant="outline" size="sm" disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total User</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.total}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Terverifikasi</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-primary">{stats.verified}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Belum Verifikasi</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-destructive">{stats.unverified}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1 md:max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari email atau nama..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>Semua</Button>
              <Button size="sm" variant={filter === "verified" ? "default" : "outline"} onClick={() => setFilter("verified")}>Verified</Button>
              <Button size="sm" variant={filter === "unverified" ? "default" : "outline"} onClick={() => setFilter("unverified")}>Unverified</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Daftar</TableHead>
                  <TableHead>Verifikasi</TableHead>
                  <TableHead>Resend Terakhir</TableHead>
                  <TableHead>Login Terakhir</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Tidak ada user.</TableCell></TableRow>
                )}
                {filtered.map((u) => {
                  const verified = !!u.email_confirmed_at;
                  const resend = lastResend(u);
                  return (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="font-medium">{u.full_name || "—"}</div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </TableCell>
                      <TableCell>
                        {verified ? (
                          <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" /> Verified</Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Pending</Badge>
                        )}
                      </TableCell>
                      <TableCell><span className="text-xs capitalize">{u.provider || "—"}</span></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{fmt(u.created_at)}</TableCell>
                      <TableCell className="text-xs">{verified ? fmt(u.email_confirmed_at) : <span className="text-destructive">Belum</span>}</TableCell>
                      <TableCell className="text-xs">
                        {resend ? (
                          <span className="inline-flex items-center gap-1 text-muted-foreground"><Mail className="h-3 w-3" /> {fmt(resend)}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{fmt(u.last_sign_in_at)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}