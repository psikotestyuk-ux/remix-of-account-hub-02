import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export function AdminProtected({ children }: { children: React.ReactNode }) {
  const { loading, session, isAdmin } = useAdminAuth();
  const location = useLocation();

  useEffect(() => {
    if (!loading && session && !isAdmin) {
      toast.error("Akses ditolak. Akun ini bukan admin.");
    }
  }, [loading, session, isAdmin]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session || !isAdmin) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}