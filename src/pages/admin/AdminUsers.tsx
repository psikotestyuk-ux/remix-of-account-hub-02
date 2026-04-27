import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2,
  XCircle,
  RefreshCw,
  Search,
  Mail,
  ExternalLink,
  UserPlus,
  Trash2,
  Ban,
  ShieldCheck,
  MoreHorizontal,
  Loader2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";

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
  banned_until: string | null;
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

function isSuspended(u: AdminUser) {
  if (!u.banned_until) return false;
  const t = new Date(u.banned_until).getTime();
  return !Number.isNaN(t) && t > Date.now();
}

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "verified" | "unverified" | "suspended">("all");

  // Add user dialog state
  const [addOpen, setAddOpen] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const [addForm, setAddForm] = useState({ email: "", password: "", full_name: "" });

  // Delete confirmation state
  const [deleting, setDeleting] = useState<AdminUser | null>(null);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

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
      if (filter === "suspended" && !isSuspended(u)) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (u.email ?? "").toLowerCase().includes(q) || (u.full_name ?? "").toLowerCase().includes(q);
    });
  }, [users, search, filter]);

  const stats = useMemo(() => {
    const total = users.length;
    const verified = users.filter((u) => u.email_confirmed_at).length;
    const unverified = total - verified;
    const suspended = users.filter((u) => isSuspended(u)).length;
    return { total, verified, unverified, suspended };
  }, [users]);

  const handleAdd = async () => {
    const email = addForm.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      toast.error("Email tidak valid");
      return;
    }
    if (addForm.password.length < 8) {
      toast.error("Password minimal 8 karakter");
      return;
    }
    setAddBusy(true);
    const { data, error } = await supabase.functions.invoke("admin-manage-user", {
      body: {
        action: "create",
        email,
        password: addForm.password,
        full_name: addForm.full_name.trim() || null,
      },
    });
    setAddBusy(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || "Gagal menambah user");
      return;
    }
    toast.success("User berhasil ditambahkan");
    setAddOpen(false);
    setAddForm({ email: "", password: "", full_name: "" });
    load();
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setActionBusyId(deleting.id);
    const { data, error } = await supabase.functions.invoke("admin-manage-user", {
      body: { action: "delete", user_id: deleting.id },
    });
    setActionBusyId(null);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || "Gagal menghapus user");
      return;
    }
    toast.success("User dihapus");
    setDeleting(null);
    load();
  };

  const handleToggleSuspend = async (u: AdminUser) => {
    const suspended = isSuspended(u);
    setActionBusyId(u.id);
    const { data, error } = await supabase.functions.invoke("admin-manage-user", {
      body: { action: suspended ? "unsuspend" : "suspend", user_id: u.id },
    });
    setActionBusyId(null);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || "Gagal memproses");
      return;
    }
    toast.success(suspended ? "User diaktifkan kembali" : "User di-suspend");
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Manajemen User</h1>
          <p className="text-sm text-muted-foreground">
            Tambah, hapus, atau suspend user. Akun admin lain tidak dapat dimodifikasi.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={load} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5">
            <UserPlus className="h-4 w-4" /> Tambah User
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
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
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Suspended</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-destructive">{stats.suspended}</div></CardContent>
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
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>Semua</Button>
              <Button size="sm" variant={filter === "verified" ? "default" : "outline"} onClick={() => setFilter("verified")}>Verified</Button>
              <Button size="sm" variant={filter === "unverified" ? "default" : "outline"} onClick={() => setFilter("unverified")}>Unverified</Button>
              <Button size="sm" variant={filter === "suspended" ? "default" : "outline"} onClick={() => setFilter("suspended")}>Suspended</Button>
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
                  <TableHead className="w-20 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Tidak ada user.</TableCell></TableRow>
                )}
                {filtered.map((u) => {
                  const verified = !!u.email_confirmed_at;
                  const resend = lastResend(u);
                  const suspended = isSuspended(u);
                  const busy = actionBusyId === u.id;
                  return (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="font-medium">{u.full_name || "—"}</div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {suspended && (
                            <Badge variant="destructive" className="gap-1"><Ban className="h-3 w-3" /> Suspended</Badge>
                          )}
                          {verified ? (
                            <Badge className="gap-1"><CheckCircle2 className="h-3 w-3" /> Verified</Badge>
                          ) : (
                            <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Pending</Badge>
                          )}
                        </div>
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
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost" disabled={busy}>
                              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem asChild>
                              <Link to={`/admin/users/${u.id}`}>
                                <ExternalLink className="mr-2 h-4 w-4" /> Lihat detail
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {suspended ? (
                              <DropdownMenuItem onClick={() => handleToggleSuspend(u)}>
                                <ShieldCheck className="mr-2 h-4 w-4" /> Aktifkan kembali
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => handleToggleSuspend(u)}>
                                <Ban className="mr-2 h-4 w-4" /> Suspend
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => setDeleting(u)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Hapus
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add user dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah User Baru</DialogTitle>
            <DialogDescription>
              User akan dibuat dengan email otomatis terverifikasi.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="add-email">Email</Label>
              <Input
                id="add-email"
                type="email"
                value={addForm.email}
                onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="user@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-name">Nama Lengkap (opsional)</Label>
              <Input
                id="add-name"
                value={addForm.full_name}
                onChange={(e) => setAddForm((f) => ({ ...f, full_name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-pass">Password (min. 8 karakter)</Label>
              <Input
                id="add-pass"
                type="password"
                value={addForm.password}
                onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={addBusy}>
              Batal
            </Button>
            <Button onClick={handleAdd} disabled={addBusy} className="gap-1.5">
              {addBusy && <Loader2 className="h-4 w-4 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus user ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini permanen. User <strong>{deleting?.email}</strong> akan dihapus
              dari sistem auth. Data pesanan & wallet yang sudah ada tetap tersimpan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!actionBusyId}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionBusyId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}