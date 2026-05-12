import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Upload,
  X,
  ImageIcon,
} from "lucide-react";
import { toast } from "sonner";

type Placement = "home_hero" | "products_top" | "product_detail" | "cart_checkout";

const PLACEMENT_LABEL: Record<Placement, string> = {
  home_hero: "Beranda (Hero)",
  products_top: "Halaman Produk (Atas)",
  product_detail: "Detail Produk",
  cart_checkout: "Cart & Checkout",
};

type Banner = {
  id: string;
  image_url: string;
  title: string | null;
  subtitle: string | null;
  product_id: string | null;
  placement: Placement;
  display_order: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
};

type FormState = {
  image_url: string;
  title: string;
  subtitle: string;
  product_id: string;
  placement: Placement;
  display_order: number;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
};

const EMPTY_FORM: FormState = {
  image_url: "",
  title: "",
  subtitle: "",
  product_id: "",
  placement: "home_hero",
  display_order: 0,
  starts_at: "",
  ends_at: "",
  is_active: true,
};

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminBanners() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: banners, isLoading } = useQuery({
    queryKey: ["admin-banners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("promo_banners")
        .select("*")
        .order("placement")
        .order("display_order");
      if (error) throw error;
      return data as Banner[];
    },
  });

  const { data: products } = useQuery({
    queryKey: ["admin-banners-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.image_url) throw new Error("Gambar banner wajib diupload");
      const payload = {
        image_url: form.image_url,
        title: form.title || null,
        subtitle: form.subtitle || null,
        product_id: form.product_id || null,
        placement: form.placement,
        display_order: form.display_order,
        starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
        ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
        is_active: form.is_active,
      };
      if (editId) {
        const { error } = await supabase.from("promo_banners").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("promo_banners").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editId ? "Banner diupdate!" : "Banner ditambahkan!");
      qc.invalidateQueries({ queryKey: ["admin-banners"] });
      qc.invalidateQueries({ queryKey: ["promo-banners"] });
      resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("promo_banners").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Banner dihapus!");
      qc.invalidateQueries({ queryKey: ["admin-banners"] });
      qc.invalidateQueries({ queryKey: ["promo-banners"] });
      setDeleteId(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditId(null);
    setOpen(false);
  };

  const openEdit = (b: Banner) => {
    setEditId(b.id);
    setForm({
      image_url: b.image_url,
      title: b.title || "",
      subtitle: b.subtitle || "",
      product_id: b.product_id || "",
      placement: b.placement,
      display_order: b.display_order,
      starts_at: toLocalInput(b.starts_at),
      ends_at: toLocalInput(b.ends_at),
      is_active: b.is_active,
    });
    setOpen(true);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("File harus berupa gambar");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Maksimal 5 MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${form.placement}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("promo-banners")
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("promo-banners").getPublicUrl(path);
      setForm((f) => ({ ...f, image_url: data.publicUrl }));
      toast.success("Gambar berhasil diupload!");
    } catch (err: any) {
      toast.error("Upload gagal: " + err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const isExpired = (b: Banner) => b.ends_at && new Date(b.ends_at) < new Date();
  const isScheduled = (b: Banner) => b.starts_at && new Date(b.starts_at) > new Date();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Banner Promo</h1>
          <p className="text-sm text-muted-foreground">
            Kelola banner iklan & promo yang tampil di berbagai halaman.
          </p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); setOpen(v); }}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Tambah Banner</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editId ? "Edit Banner" : "Tambah Banner"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
              <div>
                <Label>Gambar Banner <span className="text-xs text-muted-foreground">(rasio 16:5 / 16:6)</span></Label>
                <div className="mt-1 space-y-2">
                  {form.image_url ? (
                    <div className="space-y-2">
                      <img src={form.image_url} alt="preview" className="aspect-[16/5] w-full rounded-xl object-cover border" />
                      <Button type="button" variant="ghost" size="sm" className="text-destructive gap-1"
                        onClick={() => setForm((f) => ({ ...f, image_url: "" }))}>
                        <X className="h-3 w-3" /> Hapus gambar
                      </Button>
                    </div>
                  ) : (
                    <div className="flex aspect-[16/5] w-full items-center justify-center rounded-xl border-2 border-dashed text-muted-foreground">
                      <ImageIcon className="h-8 w-8" />
                    </div>
                  )}
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
                  <Button type="button" variant="outline" className="w-full gap-2" onClick={() => fileRef.current?.click()} disabled={uploading}>
                    {uploading ? <><Loader2 className="h-4 w-4 animate-spin" /> Mengupload...</> : <><Upload className="h-4 w-4" /> Upload Gambar</>}
                  </Button>
                </div>
              </div>

              <div>
                <Label>Judul <span className="text-xs text-muted-foreground">(opsional)</span></Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Diskon 50% Akun FB!" />
              </div>
              <div>
                <Label>Subjudul <span className="text-xs text-muted-foreground">(opsional)</span></Label>
                <Input value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} placeholder="Berlaku sampai akhir bulan" />
              </div>

              <div>
                <Label>Produk Tujuan <span className="text-xs text-muted-foreground">(klik banner ke produk ini)</span></Label>
                <Select value={form.product_id || "none"} onValueChange={(v) => setForm({ ...form, product_id: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Pilih produk" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Tidak ada (banner saja) —</SelectItem>
                    {products?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Penempatan</Label>
                <Select value={form.placement} onValueChange={(v) => setForm({ ...form, placement: v as Placement })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PLACEMENT_LABEL) as Placement[]).map((p) => (
                      <SelectItem key={p} value={p}>{PLACEMENT_LABEL[p]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Mulai</Label>
                  <Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
                </div>
                <div>
                  <Label>Berakhir</Label>
                  <Input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
                </div>
              </div>

              <div>
                <Label>Urutan Tampil</Label>
                <Input type="number" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: Number(e.target.value) })} />
              </div>

              <div className="flex items-center gap-3">
                <Switch id="active" checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                <Label htmlFor="active">Aktif</Label>
              </div>

              <Button type="submit" disabled={saveMutation.isPending || uploading} className="w-full">
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : editId ? "Update" : "Simpan"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <p className="text-muted-foreground">Memuat...</p>
        ) : banners && banners.length > 0 ? banners.map((b) => {
          const product = products?.find((p) => p.id === b.product_id);
          return (
            <Card key={b.id} className="border-0 shadow-sm overflow-hidden">
              <CardContent className="flex items-center gap-4 p-4">
                <img src={b.image_url} alt={b.title || "banner"} className="h-16 w-28 rounded-lg object-cover border flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary">{PLACEMENT_LABEL[b.placement]}</Badge>
                    {!b.is_active && <Badge variant="outline" className="text-muted-foreground">Nonaktif</Badge>}
                    {isExpired(b) && <Badge variant="destructive">Expired</Badge>}
                    {isScheduled(b) && <Badge>Terjadwal</Badge>}
                  </div>
                  <p className="mt-1 font-medium truncate">{b.title || <span className="text-muted-foreground italic">tanpa judul</span>}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {product ? `→ ${product.name}` : "tanpa produk"} · urutan {b.display_order}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => openEdit(b)}><Pencil className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(b.id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </CardContent>
            </Card>
          );
        }) : (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center text-muted-foreground">
              Belum ada banner. Klik "Tambah Banner" untuk membuat banner pertama.
            </CardContent>
          </Card>
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus banner ini?</AlertDialogTitle>
            <AlertDialogDescription>Banner akan dihapus permanen.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
