import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";

type CategorySetting = {
  slug: string;
  label: string;
  emoji: string;
  logo_url: string | null;
  display_order: number;
  is_active: boolean;
};

type FormState = {
  slug: string;
  label: string;
  emoji: string;
  logo_url: string;
  display_order: number;
  is_active: boolean;
};

const EMPTY_FORM: FormState = { slug: "", label: "", emoji: "", logo_url: "", display_order: 0, is_active: true };

export default function AdminCategories() {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [editSlug, setEditSlug] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [deleteSlug, setDeleteSlug] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: categories, isLoading } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("category_settings")
        .select("*")
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data as CategorySetting[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        label: form.label,
        emoji: form.emoji,
        logo_url: form.logo_url || null,
        display_order: form.display_order,
        is_active: form.is_active,
        updated_at: new Date().toISOString(),
      };
      if (editSlug) {
        const { error } = await supabase.from("category_settings").update(payload).eq("slug", editSlug);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("category_settings").insert({ slug: form.slug, ...payload });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editSlug ? "Kategori diupdate!" : "Kategori ditambahkan!");
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      resetForm();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (slug: string) => {
      const { error } = await supabase.from("category_settings").delete().eq("slug", slug);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Kategori dihapus!");
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      setDeleteSlug(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditSlug(null);
    setOpen(false);
  };

  const openEdit = (c: CategorySetting) => {
    setEditSlug(c.slug);
    setForm({ slug: c.slug, label: c.label, emoji: c.emoji, logo_url: c.logo_url || "", display_order: c.display_order, is_active: c.is_active });
    setOpen(true);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"].includes(file.type)) {
      toast.error("Format tidak didukung. Gunakan JPG, PNG, WEBP, GIF, atau SVG.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Ukuran file maksimal 2 MB.");
      return;
    }
    const ext = file.name.split(".").pop();
    const slug = editSlug || form.slug || `new-${Date.now()}`;
    const path = `${slug}/${Date.now()}.${ext}`;
    setUploading(true);
    try {
      const { error: uploadErr } = await supabase.storage.from("category-logos").upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;
      const { data } = supabase.storage.from("category-logos").getPublicUrl(path);
      setForm((f) => ({ ...f, logo_url: data.publicUrl }));
      toast.success("Logo berhasil diupload!");
    } catch (err: any) {
      toast.error("Upload gagal: " + err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Kategori</h1>
        <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); setOpen(v); }}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Tambah Kategori</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editSlug ? "Edit Kategori" : "Tambah Kategori"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
              {!editSlug && (
                <div>
                  <Label>Slug <span className="text-xs text-muted-foreground">(unik, huruf kecil, tanpa spasi)</span></Label>
                  <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") })} placeholder="contoh: facebook" required />
                </div>
              )}
              <div>
                <Label>Label</Label>
                <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Nama tampil" required />
              </div>
              <div>
                <Label>Emoji</Label>
                <Input value={form.emoji} onChange={(e) => setForm({ ...form, emoji: e.target.value })} placeholder="📘" maxLength={4} />
              </div>
              <div>
                <Label>Logo</Label>
                <div className="mt-1 space-y-2">
                  {form.logo_url && (
                    <div className="flex items-center gap-2">
                      <img src={form.logo_url} alt="Logo preview" className="h-12 w-12 rounded-lg object-contain border" />
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setForm((f) => ({ ...f, logo_url: "" }))}><X className="h-3 w-3" /></Button>
                    </div>
                  )}
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                  <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => fileRef.current?.click()} disabled={uploading}>
                    {uploading ? <><Loader2 className="h-3 w-3 animate-spin" /> Mengupload...</> : <><Upload className="h-3 w-3" /> Upload Logo</>}
                  </Button>
                  <p className="text-xs text-muted-foreground">Atau masukkan URL langsung:</p>
                  <Input value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} placeholder="https://..." />
                </div>
              </div>
              <div>
                <Label>Urutan Tampil</Label>
                <Input type="number" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: Number(e.target.value) })} />
              </div>
              <div className="flex items-center gap-3">
                <Switch id="is_active" checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                <Label htmlFor="is_active">Aktif</Label>
              </div>
              <Button type="submit" disabled={saveMutation.isPending || uploading} className="w-full">
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : editSlug ? "Update" : "Simpan"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <p className="text-muted-foreground">Memuat...</p>
        ) : categories?.map((c) => (
          <Card key={c.slug} className="border-0 shadow-sm">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {c.logo_url ? (
                  <img src={c.logo_url} alt={c.label} className="h-10 w-10 rounded-lg object-contain border flex-shrink-0" />
                ) : (
                  <span className="text-2xl flex-shrink-0">{c.emoji || "📦"}</span>
                )}
                <div className="min-w-0">
                  <p className="font-medium">{c.label}</p>
                  <p className="text-xs text-muted-foreground">{c.slug} · urutan {c.display_order} · {c.is_active ? "Aktif" : <span className="text-destructive">Nonaktif</span>}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}><Pencil className="h-3 w-3" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteSlug(c.slug)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={!!deleteSlug} onOpenChange={(v) => !v && setDeleteSlug(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus kategori ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Kategori akan dihapus permanen. Produk yang menggunakan kategori ini tidak ikut terhapus.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteSlug && deleteMutation.mutate(deleteSlug)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
