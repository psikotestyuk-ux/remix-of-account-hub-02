import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

type Product = { id: string; name: string };
type Grade = { id: string; grade: string; product_id: string; stock: number };

// Split a big pasted text into account blocks.
// Strategy: split on blank lines OR on lines starting with "Id Fb:" / "ID FB:" markers.
// Each non-empty block becomes 1 account.
function splitIntoBlocks(raw: string): string[] {
  if (!raw.trim()) return [];
  const text = raw.replace(/\r\n/g, "\n").trim();

  // If the text contains "Id Fb:" markers, split on those (keeping the marker with each block).
  const markerRe = /(^|\n)\s*(?=Id\s*Fb\s*:)/gi;
  if (/Id\s*Fb\s*:/i.test(text)) {
    const parts = text.split(markerRe).map((p) => p.trim()).filter(Boolean);
    // Filter out the leading "header" (e.g. "SPM 27/07/2025") that comes before the first "Id Fb:"
    return parts.filter((p) => /Id\s*Fb\s*:/i.test(p));
  }

  // Fallback: split on blank lines (one or more empty lines)
  return text.split(/\n\s*\n+/).map((b) => b.trim()).filter(Boolean);
}

export default function AdminImportCredentials() {
  const [params] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [productId, setProductId] = useState("");
  const [gradeId, setGradeId] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from("products").select("id, name").order("name").then(({ data }) => {
      setProducts(data || []);
      const qp = params.get("product");
      if (qp && (data || []).some((p) => p.id === qp)) setProductId(qp);
    });
  }, []);

  useEffect(() => {
    if (!productId) { setGrades([]); setGradeId(""); return; }
    supabase.from("account_grades").select("id, grade, product_id, stock").eq("product_id", productId).eq("is_active", true).order("grade")
      .then(({ data }) => {
        const list = (data as any) || [];
        setGrades(list);
        const qg = params.get("grade");
        setGradeId(qg && list.some((g: Grade) => g.id === qg) ? qg : "");
      });
  }, [productId]);

  const blocks = useMemo(() => splitIntoBlocks(text), [text]);

  const handleFile = async (f: File) => {
    if (f.size > 5 * 1024 * 1024) { toast.error("File maks 5MB"); return; }
    const t = await f.text();
    setText(t);
  };

  const handleImport = async () => {
    if (!productId) { toast.error("Pilih produk dulu"); return; }
    if (blocks.length === 0) { toast.error("Tidak ada akun untuk diimport"); return; }
    setLoading(true);
    try {
      const rows = blocks.map((b) => ({
        product_id: productId,
        grade_id: gradeId || null,
        credentials_encrypted: b, // Stored as free-text, dikirim verbatim ke buyer
      }));
      const { error } = await supabase.from("account_credentials").insert(rows);
      if (error) throw error;

      // Update grade stock
      if (gradeId) {
        const grade = grades.find((g) => g.id === gradeId);
        if (grade) {
          await supabase.from("account_grades").update({ stock: grade.stock + blocks.length }).eq("id", gradeId);
        }
      }

      toast.success(`${blocks.length} akun berhasil diimport ke stok!`);
      setText("");
    } catch (err: any) {
      toast.error("Gagal: " + err.message);
    } finally { setLoading(false); }
  };

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Import Akun (Bulk)</h1>
        <p className="text-sm text-muted-foreground">
          Paste banyak akun sekaligus, atau upload file <code>.txt</code>. Tiap akun dipisah baris kosong, atau otomatis terdeteksi dari marker <code className="rounded bg-muted px-1">Id Fb:</code>.
        </p>
      </div>

      <Card className="mb-4 border-0 shadow-lg">
        <CardContent className="space-y-4 p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Produk *</Label>
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
            <Label htmlFor="paste">Atau paste manual (banyak akun sekaligus)</Label>
            <Textarea
              id="paste"
              rows={14}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`Id Fb: 61582518594924\nEmail Fb: rd@outlook.com\nPass Fb: H4h4h4h4\n2FA: ...\n\nId Fb: 61578682753163\nEmail Fb: ...\n...`}
              className="font-mono text-xs"
            />
          </div>

          <div className="flex items-center gap-3 rounded-xl bg-muted/50 p-3 text-sm">
            <Sparkles className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <Badge className="text-sm">{blocks.length} akun terdeteksi</Badge>
              {blocks.length > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Preview akun pertama: <span className="font-mono">{blocks[0].split("\n").slice(0, 2).join(" | ").slice(0, 80)}…</span>
                </p>
              )}
            </div>
          </div>

          <Button onClick={handleImport} disabled={loading || blocks.length === 0 || !productId} className="w-full gap-2 rounded-xl" size="lg">
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Mengimport...</> : <><Upload className="h-4 w-4" /> Import {blocks.length} akun ke stok</>}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-0 bg-muted/30 shadow-sm">
        <CardContent className="space-y-2 p-4 text-sm text-muted-foreground">
          <p className="font-semibold text-foreground flex items-center gap-2"><FileText className="h-4 w-4" /> Format yang didukung</p>
          <p>Tiap akun bisa berisi data apapun (ID FB, Email, Password, 2FA, Recovery Code, link profil, dll). Pemisah antar akun:</p>
          <ul className="ml-5 list-disc space-y-1 text-xs">
            <li><b>Otomatis</b> berdasarkan marker <code className="rounded bg-background px-1">Id Fb:</code> (untuk format Facebook)</li>
            <li>Atau <b>baris kosong</b> antar akun (untuk format lain)</li>
          </ul>
          <p className="pt-2">Saat customer checkout & bayar, isi blok teks ini akan otomatis dikirim ke email mereka <b>persis seperti yang di-paste</b> (inline + attachment .txt).</p>
        </CardContent>
      </Card>
    </div>
  );
}
