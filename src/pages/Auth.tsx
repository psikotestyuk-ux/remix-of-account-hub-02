import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

const loginSchema = z.object({
  email: z.string().trim().email("Email tidak valid").max(255),
  password: z.string().min(6, "Min 6 karakter").max(72),
});
const signupSchema = loginSchema.extend({
  full_name: z.string().trim().min(1, "Nama wajib diisi").max(100),
});

export default function Auth() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirect = params.get("redirect") || "/profile";
  const { session, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", full_name: "" });

  useEffect(() => {
    if (!authLoading && session) navigate(redirect, { replace: true });
  }, [session, authLoading, navigate, redirect]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = loginSchema.safeParse({ email: form.email, password: form.password });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword(parsed.data);
      if (error) throw error;
      toast.success("Selamat datang!");
      navigate(redirect, { replace: true });
    } catch (err: any) {
      toast.error(err.message?.includes("Invalid") ? "Email/password salah atau email belum diverifikasi" : err.message);
    } finally { setLoading(false); }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = signupSchema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          emailRedirectTo: `${window.location.origin}${redirect}`,
          data: { full_name: parsed.data.full_name },
        },
      });
      if (error) throw error;
      setEmailSent(true);
      toast.success("Cek email untuk verifikasi akun");
    } catch (err: any) {
      toast.error(err.message);
    } finally { setLoading(false); }
  };

  if (emailSent) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center px-4">
        <Card className="w-full max-w-md border-0 shadow-xl">
          <CardContent className="p-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-primary-foreground">
              <Mail className="h-7 w-7" />
            </div>
            <h1 className="mb-2 text-xl font-bold">Cek inbox kamu</h1>
            <p className="mb-6 text-sm text-muted-foreground">
              Kami sudah mengirim link verifikasi ke <span className="font-semibold text-foreground">{form.email}</span>. Klik link di email untuk mengaktifkan akun, lalu kembali ke sini untuk login.
            </p>
            <Button variant="outline" className="w-full" onClick={() => { setEmailSent(false); setTab("login"); }}>
              Kembali ke Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md border-0 shadow-xl">
        <CardContent className="p-8">
          <div className="mb-6 text-center">
            <Link to="/" className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-lg font-bold text-primary-foreground">B</Link>
            <h1 className="mt-3 text-xl font-bold">Selamat datang</h1>
            <p className="text-sm text-muted-foreground">Login atau buat akun untuk topup & belanja</p>
          </div>

          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Daftar</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <Label htmlFor="lemail">Email</Label>
                  <Input id="lemail" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                </div>
                <div>
                  <Label htmlFor="lpass">Password</Label>
                  <Input id="lpass" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
                </div>
                <Button type="submit" disabled={loading} className="w-full gap-2 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90">
                  {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Masuk...</> : "Masuk"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div>
                  <Label htmlFor="sname">Nama Lengkap</Label>
                  <Input id="sname" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
                </div>
                <div>
                  <Label htmlFor="semail">Email</Label>
                  <Input id="semail" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                </div>
                <div>
                  <Label htmlFor="spass">Password (min 6)</Label>
                  <Input id="spass" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
                </div>
                <Button type="submit" disabled={loading} className="w-full gap-2 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90">
                  {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Mendaftar...</> : "Buat Akun"}
                </Button>
                <p className="text-center text-xs text-muted-foreground">Kamu akan menerima email verifikasi sebelum bisa login.</p>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
