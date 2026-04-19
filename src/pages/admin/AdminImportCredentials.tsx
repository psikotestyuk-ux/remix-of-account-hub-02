import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Product = { id: string; name: string };
type Grade = { id: string; grade: string; product_id: string; stock: number };

export default function AdminImportCredentials() {
  const [products, setProducts] = useState<Product[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [productId, setProductId] = useState("");
  const [gradeId, setGradeId] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{ valid: number; invalid: number; samples: string[] }>({ valid: 0, invalid: 0, samples: [] });

  useEffect(() => {
    supabase.from("products").select("id, name").order("name").then(({ data }) => setProducts(data || []));
  }, []);

  useEffect(() => {
    if (!productId) { setGrades([]); setGradeId(""); return; }
    supabase.from("account_grades").select("id, grade, product_id, stock").eq("product_id", productId).eq("is_active", true).order("grade")
      .then(({ data }) => { setGrades((data as any) || []); setGradeId(""); });
  }, [productId]);

  // Parse format email:password (1 per line)
  const parsed = (() => {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const valid: { email: string; password: string }[] = [];
    const invalid: string[] = [];
    for (const line of lines) {
      const idx = line.indexOf(":");
      if (idx <= 0 || idx === line.length - 1) { invalid.push(line); continue; }
      const email = line.slice(0, idx).trim();
      const password = line.slice(idx + 1).trim();
      if (!email || !password || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { invalid.push(line); continue; }
      valid.push({ email, password });
    }
    return { valid, invalid };
  })();

  useEffect(() => {
    setPreview({
      valid: parsed.valid.length,
      invalid: parsed.invalid.length,
      samples: parsed.valid.slice(0, 3).map((v) => `${v.email}:${"•".repeat(8)}`),
    });
  }, [text]);

  const handleFile = async (f: File) => {
    if (f.size > 5 * 1024 * 1024) { toast.error("File maks 5MB"); return; }
    const t = await f.text();
    setText(t);
  };

  const handleImport = async () => {
    if (!productId) { toast.error("Pilih produk"); return; }
    if (parsed.valid.length === 0) { toast.error("Tidak ada baris valid"); return; }
    setLoading(true);
    try {
      // Encode credentials as JSON string per row (simple base64 wrap; admin-only RLS)
      const rows = parsed.valid.map((v) => ({
        product_id: productId,
        grade_id: gradeId || null,
        credentials_encrypted: btoa(JSON.stringify(v)),
      }));
      const { error } = await supabase.from("account_credentials").insert(rows);
      if (error) throw error;

      // Update grade stock
      if (gradeId) {
        const grade = grades.find((g) => g.id === gradeId);
        if (grade) {
          await supabase.from("account_grades").update({ stock: grade.stock + parsed.valid.length }).eq("id", gradeId);
        }
      }

      toast.success(`${parsed.valid.length} akun berhasil diimport`);
      setText("");
    } catch (err: any) {
      toast.error("Gagal: " + err.message);
    } finally { setLoading(false); }
  };

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Import Akun (TXT)</h1>
        <p className="text-sm text-muted-foreground">Upload file <code>.txt</code> atau paste daftar akun. Format: <code className="rounded bg-muted px-1">email:password</code> (1 per baris).</p>
      </div>

      <Card className="mb-4 border-0 shadow-lg">
        <CardContent className="space-y-4 p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Produk</Label>
              <select value={productId} onChange={(e) => setProductId(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">— Pilih produk —</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Grade (opsional)</Label>
              <select value={gradeId} onChange={(e) => setGradeId(e.target.value)} disabled={!productId || grades.length === 0} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50">
                <option value="">— Tanpa grade —</option>
                {grades.map((g) => <option key={g.id} value={g.id}>Grade {g.grade} (stok {g.stock})</option>)}
              </select>
            </div>
          </div>

          <div>
            <Label>Upload file .txt</Label>
            <input type="file" accept=".txt,text/plain" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary-foreground" />
          </div>

          <div>
            <Label htmlFor="paste">Atau paste manual</Label>
            <Textarea id="paste" rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder="user1@gmail.com:passw0rd&#10;user2@gmail.com:secret123" className="font-mono text-sm" />
          </div>

          <div className="flex items-center gap-3 rounded-xl bg-muted/50 p-3 text-sm">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1">
              <span className="mr-2"><Badge>{preview.valid} valid</Badge></span>
              {preview.invalid > 0 && <Badge variant="destructive">{preview.invalid} invalid</Badge>}
              {preview.samples.length > 0 && <p className="mt-1 text-xs text-muted-foreground">Contoh: {preview.samples.join(" • ")}</p>}
            </div>
          </div>

          <Button onClick={handleImport} disabled={loading || parsed.valid.length === 0 || !productId} className="w-full gap-2 rounded-xl" size="lg">
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Mengimport...</> : <><Upload className="h-4 w-4" /> Import {parsed.valid.length} akun</>}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-0 bg-muted/30 shadow-sm">
        <CardContent className="p-4 text-sm text-muted-foreground">
          <p className="mb-1 font-semibold text-foreground">Format yang didukung</p>
          <pre className="rounded bg-background p-3 text-xs">{`user1@gmail.com:passw0rd
user2@gmail.com:secret!23
user3@yahoo.com:another-pass`}</pre>
          <p className="mt-2">Setiap baris akan disimpan sebagai 1 akun yang siap dijual. Stok grade otomatis bertambah.</p>
        </CardContent>
      </Card>
    </div>
  );
}
