import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatRupiah } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Loader2, Layers, Package as PackageIcon } from "lucide-react";
import { toast } from "sonner";

type GradeForm = { product_id: string; grade: string; description: string; base_price: number; stock: number; is_active: boolean };
type PkgForm = { grade_id: string; name: string; quantity: number; price: number; is_active: boolean };

export default function AdminGrades() {
  const qc = useQueryClient();
  const [gOpen, setGOpen] = useState(false);
  const [gEditId, setGEditId] = useState<string | null>(null);
  const [gForm, setGForm] = useState<GradeForm>({ product_id: "", grade: "", description: "", base_price: 0, stock: 0, is_active: true });
  const [gDelId, setGDelId] = useState<string | null>(null);

  const [pOpen, setPOpen] = useState(false);
  const [pEditId, setPEditId] = useState<string | null>(null);
  const [pForm, setPForm] = useState<PkgForm>({ grade_id: "", name: "", quantity: 1, price: 0, is_active: true });
  const [pDelId, setPDelId] = useState<string | null>(null);

  const { data: products } = useQuery({
    queryKey: ["products-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: grades, isLoading: gLoading } = useQuery({
    queryKey: ["admin-grades"],
    queryFn: async () => {
      const { data, error } = await supabase.from("account_grades").select("*, products(name)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: packages, isLoading: pLoading } = useQuery({
    queryKey: ["admin-packages"],
    queryFn: async () => {
      const { data, error } = await supabase.from("packages").select("*, account_grades(grade, products(name))").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const saveGrade = useMutation({
    mutationFn: async () => {
      if (gEditId) {
        const { error } = await supabase.from("account_grades").update(gForm).eq("id", gEditId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("account_grades").insert(gForm);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Grade tersimpan!"); qc.invalidateQueries({ queryKey: ["admin-grades"] }); resetGrade(); },
    onError: (e: any) => toast.error(e.message),
  });

  const delGrade = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("account_grades").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Grade dihapus"); qc.invalidateQueries({ queryKey: ["admin-grades"] }); qc.invalidateQueries({ queryKey: ["admin-packages"] }); setGDelId(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const savePkg = useMutation({
    mutationFn: async () => {
      if (pEditId) {
        const { error } = await supabase.from("packages").update(pForm).eq("id", pEditId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("packages").insert(pForm);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Paket tersimpan!"); qc.invalidateQueries({ queryKey: ["admin-packages"] }); resetPkg(); },
    onError: (e: any) => toast.error(e.message),
  });

  const delPkg = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("packages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Paket dihapus"); qc.invalidateQueries({ queryKey: ["admin-packages"] }); setPDelId(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const resetGrade = () => {
    setGForm({ product_id: "", grade: "", description: "", base_price: 0, stock: 0, is_active: true });
    setGEditId(null); setGOpen(false);
  };
  const resetPkg = () => {
    setPForm({ grade_id: "", name: "", quantity: 1, price: 0, is_active: true });
    setPEditId(null); setPOpen(false);
  };

  return (
    <div className="space-y-8">
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold">Grade Akun</h1>
          </div>
          <Dialog open={gOpen} onOpenChange={(v) => { if (!v) resetGrade(); setGOpen(v); }}>
            <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> Tambah Grade</Button></DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>{gEditId ? "Edit Grade" : "Tambah Grade"}</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); saveGrade.mutate(); }} className="space-y-4">
                <div>
                  <Label>Produk</Label>
                  <Select value={gForm.product_id} onValueChange={(v) => setGForm({ ...gForm, product_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Pilih produk" /></SelectTrigger>
                    <SelectContent>
                      {products?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Grade (A/B/C/...)</Label><Input value={gForm.grade} onChange={(e) => setGForm({ ...gForm, grade: e.target.value.toUpperCase() })} required maxLength={5} /></div>
                <div><Label>Deskripsi</Label><Textarea value={gForm.description} onChange={(e) => setGForm({ ...gForm, description: e.target.value })} placeholder="Mis: Akun premium, umur 1+ tahun" rows={2} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Harga dasar (Rp)</Label><Input type="number" value={gForm.base_price} onChange={(e) => setGForm({ ...gForm, base_price: Number(e.target.value) })} required /></div>
                  <div><Label>Stok</Label><Input type="number" value={gForm.stock} onChange={(e) => setGForm({ ...gForm, stock: Number(e.target.value) })} required /></div>
                </div>
                <div className="flex items-center gap-2"><Switch checked={gForm.is_active} onCheckedChange={(v) => setGForm({ ...gForm, is_active: v })} /><Label>Aktif</Label></div>
                <Button type="submit" disabled={saveGrade.isPending} className="w-full">
                  {saveGrade.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Simpan"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        <div className="space-y-2">
          {gLoading ? <p className="text-muted-foreground">Memuat...</p> : grades?.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada grade. Tambahkan dulu.</p>
          ) : grades?.map((g: any) => (
            <Card key={g.id} className="border-0 shadow-sm">
              <CardContent className="flex items-center justify-between p-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge>Grade {g.grade}</Badge>
                    <span className="text-sm text-muted-foreground truncate">{g.products?.name}</span>
                    {!g.is_active && <Badge variant="secondary">Nonaktif</Badge>}
                  </div>
                  {g.description && <p className="text-xs text-muted-foreground">{g.description}</p>}
                  <p className="text-sm">{formatRupiah(g.base_price)} • Stok: {g.stock}</p>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => {
                    setGEditId(g.id);
                    setGForm({ product_id: g.product_id, grade: g.grade, description: g.description || "", base_price: g.base_price, stock: g.stock, is_active: g.is_active });
                    setGOpen(true);
                  }}><Pencil className="h-3 w-3" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setGDelId(g.id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PackageIcon className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold">Paket</h1>
          </div>
          <Dialog open={pOpen} onOpenChange={(v) => { if (!v) resetPkg(); setPOpen(v); }}>
            <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> Tambah Paket</Button></DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>{pEditId ? "Edit Paket" : "Tambah Paket"}</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); savePkg.mutate(); }} className="space-y-4">
                <div>
                  <Label>Grade</Label>
                  <Select value={pForm.grade_id} onValueChange={(v) => setPForm({ ...pForm, grade_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Pilih grade" /></SelectTrigger>
                    <SelectContent>
                      {grades?.map((g: any) => (
                        <SelectItem key={g.id} value={g.id}>{g.products?.name} - Grade {g.grade}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Nama Paket</Label><Input value={pForm.name} onChange={(e) => setPForm({ ...pForm, name: e.target.value })} placeholder="Mis: Paket Starter, Paket Pro" required /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Jumlah akun</Label><Input type="number" min={1} value={pForm.quantity} onChange={(e) => setPForm({ ...pForm, quantity: Number(e.target.value) })} required /></div>
                  <div><Label>Harga (Rp)</Label><Input type="number" min={1} value={pForm.price} onChange={(e) => setPForm({ ...pForm, price: Number(e.target.value) })} required /></div>
                </div>
                <div className="flex items-center gap-2"><Switch checked={pForm.is_active} onCheckedChange={(v) => setPForm({ ...pForm, is_active: v })} /><Label>Aktif</Label></div>
                <Button type="submit" disabled={savePkg.isPending} className="w-full">
                  {savePkg.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Simpan"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        <div className="space-y-2">
          {pLoading ? <p className="text-muted-foreground">Memuat...</p> : packages?.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada paket.</p>
          ) : packages?.map((p: any) => (
            <Card key={p.id} className="border-0 shadow-sm">
              <CardContent className="flex items-center justify-between p-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{p.name}</span>
                    {!p.is_active && <Badge variant="secondary">Nonaktif</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{p.account_grades?.products?.name} • Grade {p.account_grades?.grade}</p>
                  <p className="text-sm">{p.quantity} akun • <span className="font-semibold text-primary">{formatRupiah(p.price)}</span></p>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => {
                    setPEditId(p.id);
                    setPForm({ grade_id: p.grade_id, name: p.name, quantity: p.quantity, price: p.price, is_active: p.is_active });
                    setPOpen(true);
                  }}><Pencil className="h-3 w-3" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setPDelId(p.id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <AlertDialog open={!!gDelId} onOpenChange={(v) => !v && setGDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Hapus grade ini?</AlertDialogTitle><AlertDialogDescription>Semua paket di bawah grade ini juga ikut terhapus.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={() => gDelId && delGrade.mutate(gDelId)} className="bg-destructive text-destructive-foreground">Hapus</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!pDelId} onOpenChange={(v) => !v && setPDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Hapus paket ini?</AlertDialogTitle><AlertDialogDescription>Paket akan dihapus permanen.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={() => pDelId && delPkg.mutate(pDelId)} className="bg-destructive text-destructive-foreground">Hapus</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
