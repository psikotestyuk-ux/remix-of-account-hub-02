import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function AdminCredentials() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState("");
  const [gradeId, setGradeId] = useState("");
  const [form, setForm] = useState({ email: "", password: "", twofa_secret: "", recovery_email: "", cookies: "", notes: "" });

  const { data: creds, isLoading } = useQuery({
    queryKey: ["admin-credentials"],
    queryFn: async () => {
      const { data, error } = await supabase.from("account_credentials").select("*, products(name)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: products } = useQuery({
    queryKey: ["admin-products-select"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, name").order("name");
      return data || [];
    },
  });

  const { data: grades } = useQuery({
    queryKey: ["admin-grades-for-cred", productId],
    enabled: !!productId,
    queryFn: async () => {
      const { data } = await supabase.from("account_grades").select("id, grade").eq("product_id", productId).eq("is_active", true).order("grade");
      return data || [];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!form.email.trim()) throw new Error("Email wajib diisi");
      const { error } = await supabase.from("account_credentials").insert({
        product_id: productId,
        grade_id: gradeId || null,
        email: form.email.trim(),
        password: form.password.trim() || null,
        twofa_secret: form.twofa_secret.trim() || null,
        recovery_email: form.recovery_email.trim() || null,
        cookies: form.cookies.trim() || null,
        notes: form.notes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Credentials ditambahkan!");
      queryClient.invalidateQueries({ queryKey: ["admin-credentials"] });
      setOpen(false);
      setForm({ email: "", password: "", twofa_secret: "", recovery_email: "", cookies: "", notes: "" });
      setGradeId("");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("account_credentials").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Credential dihapus!");
      queryClient.invalidateQueries({ queryKey: ["admin-credentials"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Account Credentials</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Tambah</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Tambah Credentials</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); addMutation.mutate(); }} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Produk *</Label>
                  <Select value={productId} onValueChange={(v) => { setProductId(v); setGradeId(""); }}>
                    <SelectTrigger><SelectValue placeholder="Pilih produk" /></SelectTrigger>
                    <SelectContent>
                      {products?.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Grade</Label>
                  <Select value={gradeId} onValueChange={setGradeId} disabled={!productId || !grades?.length}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {grades?.map((g: any) => (
                        <SelectItem key={g.id} value={g.id}>Grade {g.grade}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Email *</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="user@example.com" required /></div>
              <div><Label>Password</Label><Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Pass123!" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>2FA Key</Label><Input value={form.twofa_secret} onChange={(e) => setForm({ ...form, twofa_secret: e.target.value })} placeholder="JBSWY3DPEHPK..." className="font-mono text-xs" /></div>
                <div><Label>Recovery email</Label><Input value={form.recovery_email} onChange={(e) => setForm({ ...form, recovery_email: e.target.value })} placeholder="backup@gmail.com" /></div>
              </div>
              <div><Label>Cookies (opsional)</Label><Textarea value={form.cookies} onChange={(e) => setForm({ ...form, cookies: e.target.value })} rows={2} className="font-mono text-xs" /></div>
              <div><Label>Catatan (opsional)</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Mis: umur 2 tahun, aktif" /></div>
              <Button type="submit" disabled={addMutation.isPending || !productId} className="w-full">
                {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Simpan"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Memuat...</p>
      ) : creds?.length === 0 ? (
        <p className="text-muted-foreground">Belum ada credentials</p>
      ) : (
        <div className="space-y-2">
          {creds?.map((c) => (
            <Card key={c.id} className="border-0 shadow-sm">
              <CardContent className="flex items-center justify-between p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-mono">{c.credentials_encrypted}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{(c.products as any)?.name}</span>
                    <Badge variant={c.is_sold ? "destructive" : "default"} className="text-xs">
                      {c.is_sold ? "Terjual" : "Tersedia"}
                    </Badge>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { if (confirm("Hapus?")) deleteMutation.mutate(c.id); }}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
