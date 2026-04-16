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
  const [credentials, setCredentials] = useState("");

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

  const addMutation = useMutation({
    mutationFn: async () => {
      const lines = credentials.split("\n").map((l) => l.trim()).filter(Boolean);
      const inserts = lines.map((c) => ({ product_id: productId, credentials_encrypted: c }));
      const { error } = await supabase.from("account_credentials").insert(inserts);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Credentials ditambahkan!");
      queryClient.invalidateQueries({ queryKey: ["admin-credentials"] });
      setOpen(false);
      setCredentials("");
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
              <div>
                <Label>Produk</Label>
                <Select value={productId} onValueChange={setProductId}>
                  <SelectTrigger><SelectValue placeholder="Pilih produk" /></SelectTrigger>
                  <SelectContent>
                    {products?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Credentials (satu per baris)</Label>
                <Textarea value={credentials} onChange={(e) => setCredentials(e.target.value)} rows={6} placeholder="email:password&#10;email2:password2" />
              </div>
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
