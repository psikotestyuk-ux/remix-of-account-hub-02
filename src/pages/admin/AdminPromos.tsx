import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Tag, Upload, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatRupiah } from "@/lib/constants";

type Promo = {
  id: string; code: string; title: string; description: string | null; banner_url: string | null;
  discount_type: "percent" | "fixed"; discount_value: number; min_purchase: number;
  max_uses: number | null; used_count: number; starts_at: string | null; ends_at: string | null; is_active: boolean;
};

const empty: Partial<Promo> = { code: "", title: "", description: "", discount_type: "percent", discount_value: 10, min_purchase: 0, is_active: true };

export default function AdminPromos() {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Promo>>(empty);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      toast.error("Format tidak didukung. Gunakan JPG, PNG, WEBP, atau GIF."); return;
    }
    if (file.size > 3 * 1024 * 1024) { toast.error("Maksimal 3 MB."); return; }
    const ext = file.name.split(".").pop();
    const path = `banners/${Date.now()}.${ext}`;
    setUploading(true);
    try {
      // Buat bucket otomatis jika belum ada
      await supabase.storage.createBucket("promo-banners", { public: true }).catch(() => {});
      const { error } = await supabase.storage.from("promo-banners").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("promo-banners").getPublicUrl(path);
      setEditing((prev) => ({ ...prev, banner_url: data.publicUrl }));
      toast.success("Banner diupload!");
    } catch (err: any) {
      toast.error("Upload gagal: " + err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("promos").select("*").order("created_at", { ascending: false });
    setPromos((data as any) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!editing.code?.trim() || !editing.title?.trim()) { toast.error("Code & judul wajib diisi"); return; }
    const payload = {
      code: editing.code!.trim().toUpperCase(),
      title: editing.title!.trim(),
      description: editing.description || null,
      banner_url: editing.banner_url || null,
      discount_type: editing.discount_type || "percent",
      discount_value: Number(editing.discount_value) || 0,
      min_purchase: Number(editing.min_purchase) || 0,
      max_uses: editing.max_uses ? Number(editing.max_uses) : null,
      starts_at: editing.starts_at || null,
      ends_at: editing.ends_at || null,
      is_active: editing.is_active ?? true,
    };
    const { error } = editing.id
      ? await supabase.from("promos").update(payload).eq("id", editing.id)
      : await supabase.from("promos").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(editing.id ? "Promo diupdate" : "Promo dibuat");
    setOpen(false); setEditing(empty); load();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("promos").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Promo dihapus"); load(); }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Kelola Promo</h1>
          <p className="text-sm text-muted-foreground">CRUD kode promo & diskon</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(empty); }}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Tambah Promo</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing.id ? "Edit Promo" : "Promo Baru"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Kode promo</Label><Input value={editing.code || ""} onChange={(e) => setEditing({ ...editing, code: e.target.value })} placeholder="DISKON10" /></div>
              <div><Label>Judul</Label><Input value={editing.title || ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="Diskon Lebaran" /></div>
              <div><Label>Deskripsi</Label><Textarea value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
              <div>
                <Label>Banner (opsional)</Label>
                <div className="mt-1 space-y-2">
                  {editing.banner_url && (
                    <div className="relative">
                      <img src={editing.banner_url} alt="Banner preview" className="h-28 w-full rounded-lg object-cover border" />
                      <Button type="button" size="icon" variant="destructive" className="absolute right-1 top-1 h-6 w-6"
                        onClick={() => setEditing({ ...editing, banner_url: "" })}><X className="h-3 w-3" /></Button>
                    </div>
                  )}
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleBannerUpload} />
                  <Button type="button" variant="outline" size="sm" className="gap-2 w-full" onClick={() => fileRef.current?.click()} disabled={uploading}>
                    {uploading ? <><Loader2 className="h-3 w-3 animate-spin" /> Mengupload...</> : <><Upload className="h-3 w-3" /> Upload Gambar Banner</>}
                  </Button>
                  <Input value={editing.banner_url || ""} onChange={(e) => setEditing({ ...editing, banner_url: e.target.value })} placeholder="atau paste URL gambar..." />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tipe diskon</Label>
                  <select value={editing.discount_type || "percent"} onChange={(e) => setEditing({ ...editing, discount_type: e.target.value as any })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    <option value="percent">Persen (%)</option>
                    <option value="fixed">Nominal (Rp)</option>
                  </select>
                </div>
                <div><Label>Nilai</Label><Input type="number" value={editing.discount_value ?? 0} onChange={(e) => setEditing({ ...editing, discount_value: Number(e.target.value) })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Min belanja (Rp)</Label><Input type="number" value={editing.min_purchase ?? 0} onChange={(e) => setEditing({ ...editing, min_purchase: Number(e.target.value) })} /></div>
                <div><Label>Maks pemakaian (kosongkan = unlimited)</Label><Input type="number" value={editing.max_uses ?? ""} onChange={(e) => setEditing({ ...editing, max_uses: e.target.value ? Number(e.target.value) : null })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Mulai</Label><Input type="datetime-local" value={editing.starts_at?.slice(0, 16) || ""} onChange={(e) => setEditing({ ...editing, starts_at: e.target.value || null })} /></div>
                <div><Label>Berakhir</Label><Input type="datetime-local" value={editing.ends_at?.slice(0, 16) || ""} onChange={(e) => setEditing({ ...editing, ends_at: e.target.value || null })} /></div>
              </div>
              <div className="flex items-center gap-2"><Switch checked={editing.is_active ?? true} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} /><Label>Aktif</Label></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
              <Button onClick={handleSave}>Simpan</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? <p>Memuat...</p> : promos.length === 0 ? (
        <Card className="border-0 shadow-sm"><CardContent className="p-12 text-center text-muted-foreground"><Tag className="mx-auto mb-2 h-8 w-8" /> Belum ada promo</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {promos.map((p) => (
            <Card key={p.id} className="border-0 shadow-sm">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <code className="rounded bg-muted px-2 py-1 text-sm font-bold">{p.code}</code>
                    <Badge variant={p.is_active ? "default" : "secondary"}>{p.is_active ? "Aktif" : "Nonaktif"}</Badge>
                  </div>
                  <p className="mt-2 font-semibold">{p.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {p.discount_type === "percent" ? `${p.discount_value}%` : formatRupiah(p.discount_value)} • Min {formatRupiah(p.min_purchase)} • Dipakai {p.used_count}{p.max_uses ? `/${p.max_uses}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="icon" variant="ghost" onClick={() => { setEditing(p); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild><Button size="icon" variant="ghost"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader><AlertDialogTitle>Hapus promo {p.code}?</AlertDialogTitle><AlertDialogDescription>Tindakan ini permanen.</AlertDialogDescription></AlertDialogHeader>
                      <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(p.id)}>Hapus</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
