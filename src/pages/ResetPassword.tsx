import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, KeyRound } from "lucide-react";
import { toast } from "sonner";

const schema = z.object({
  password: z.string().min(6, "Min 6 karakter").max(72),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, { message: "Konfirmasi password tidak cocok", path: ["confirm"] });

export default function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [valid, setValid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ password: "", confirm: "" });

  useEffect(() => {
    // Supabase auto-handles the recovery hash in URL and creates a session
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setValid(true);
      }
      setReady(true);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setValid(true);
      setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
      if (error) throw error;
      toast.success("Password berhasil diubah. Silakan login.");
      await supabase.auth.signOut();
      navigate("/auth", { replace: true });
    } catch (err: any) {
      toast.error(err.message);
    } finally { setLoading(false); }
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md border-0 shadow-xl">
        <CardContent className="p-8">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground">
              <KeyRound className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-bold">Buat Password Baru</h1>
            <p className="text-sm text-muted-foreground">Masukkan password baru untuk akunmu</p>
          </div>

          {!ready ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : !valid ? (
            <div className="text-center">
              <p className="mb-4 text-sm text-muted-foreground">Link reset tidak valid atau sudah kadaluarsa. Silakan minta link baru.</p>
              <Button onClick={() => navigate("/auth")} variant="outline" className="w-full">Kembali ke Login</Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="np">Password Baru (min 6)</Label>
                <Input id="np" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
              </div>
              <div>
                <Label htmlFor="cp">Konfirmasi Password</Label>
                <Input id="cp" type="password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} required minLength={6} />
              </div>
              <Button type="submit" disabled={loading} className="w-full gap-2 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90">
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Menyimpan...</> : "Simpan Password Baru"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}