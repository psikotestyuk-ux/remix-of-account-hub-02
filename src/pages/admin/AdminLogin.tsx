import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Eye, EyeOff, ShieldCheck, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const LOCKOUT_KEY = "admin_login_attempts";
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000; // 5 minutes

const schema = z.object({
  username: z
    .string()
    .trim()
    .min(2, "Username minimal 2 karakter")
    .max(120, "Terlalu panjang"),
  password: z.string().min(6, "Password minimal 6 karakter").max(200),
});

type Attempts = { count: number; lockedUntil: number | null };

function readAttempts(): Attempts {
  try {
    const raw = localStorage.getItem(LOCKOUT_KEY);
    if (!raw) return { count: 0, lockedUntil: null };
    return JSON.parse(raw);
  } catch {
    return { count: 0, lockedUntil: null };
  }
}

function writeAttempts(a: Attempts) {
  localStorage.setItem(LOCKOUT_KEY, JSON.stringify(a));
}

function clearAttempts() {
  localStorage.removeItem(LOCKOUT_KEY);
}

export default function AdminLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loading: authLoading, session, isAdmin } = useAdminAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ username?: string; password?: string }>({});
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  const from = (location.state as any)?.from || "/admin";

  // Hydrate lockout state on mount
  useEffect(() => {
    const a = readAttempts();
    if (a.lockedUntil && a.lockedUntil > Date.now()) {
      setLockedUntil(a.lockedUntil);
    } else if (a.lockedUntil) {
      clearAttempts();
    }
  }, []);

  // Countdown tick while locked
  useEffect(() => {
    if (!lockedUntil) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= lockedUntil) {
        setLockedUntil(null);
        clearAttempts();
        clearInterval(id);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [lockedUntil]);

  // Already authenticated as admin → bounce to dashboard
  if (!authLoading && session && isAdmin) {
    return <Navigate to={from} replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});

    if (lockedUntil && lockedUntil > Date.now()) return;

    const parsed = schema.safeParse({ username, password });
    if (!parsed.success) {
      const errs: typeof fieldErrors = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as keyof typeof errs;
        if (k && !errs[k]) errs[k] = issue.message;
      }
      setFieldErrors(errs);
      return;
    }

    const input = parsed.data.username.toLowerCase();
    const email = input.includes("@") ? input : `${input}@buyingaccount.local`;

    setSubmitting(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: parsed.data.password,
      });
      if (error) throw error;

      const { data: roleOk } = await supabase.rpc("has_role", {
        _user_id: data.user.id,
        _role: "admin",
      });

      if (!roleOk) {
        await supabase.auth.signOut();
        throw new Error("Akun ini bukan admin.");
      }

      clearAttempts();
      toast.success("Login berhasil — selamat datang, Admin!");
      navigate(from, { replace: true });
    } catch (err: any) {
      const a = readAttempts();
      const next = a.count + 1;
      const locked = next >= MAX_ATTEMPTS;
      const lockTs = locked ? Date.now() + LOCKOUT_MS : null;
      writeAttempts({ count: next, lockedUntil: lockTs });
      if (locked) {
        setLockedUntil(lockTs);
        toast.error("Terlalu banyak percobaan. Coba lagi dalam 5 menit.");
      } else {
        const remaining = MAX_ATTEMPTS - next;
        toast.error(`${err.message || "Login gagal"} (${remaining} percobaan tersisa)`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const lockedSecondsLeft = lockedUntil ? Math.max(0, Math.ceil((lockedUntil - now) / 1000)) : 0;
  const lockedMin = Math.floor(lockedSecondsLeft / 60);
  const lockedSec = lockedSecondsLeft % 60;

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <Card className="w-full max-w-md border-0 shadow-xl">
        <CardContent className="p-8">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-bold">Admin Login</h1>
            <p className="text-sm text-muted-foreground">Akses panel admin BuyingAccount</p>
          </div>

          {lockedUntil && lockedSecondsLeft > 0 && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Login dikunci. Coba lagi dalam{" "}
                <span className="font-mono font-semibold">
                  {lockedMin.toString().padStart(2, "0")}:{lockedSec.toString().padStart(2, "0")}
                </span>
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                autoComplete="username"
                disabled={submitting || !!lockedUntil}
                aria-invalid={!!fieldErrors.username}
                required
              />
              {fieldErrors.username && (
                <p className="mt-1 text-xs text-destructive">{fieldErrors.username}</p>
              )}
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={submitting || !!lockedUntil}
                  aria-invalid={!!fieldErrors.password}
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="mt-1 text-xs text-destructive">{fieldErrors.password}</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={submitting || !!lockedUntil}
              className="w-full gap-2 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Memvalidasi...
                </>
              ) : (
                "Masuk"
              )}
            </Button>
          </form>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Sesi diamankan dengan cek role server-side & proteksi password bocor.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}