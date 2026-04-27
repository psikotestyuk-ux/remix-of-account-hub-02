import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Action = "create" | "delete" | "suspend" | "unsuspend";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Missing authorization" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey =
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: caller, error: callerErr } = await userClient.auth.getUser();
    if (callerErr || !caller.user) return jsonResponse({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) return jsonResponse({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = body?.action as Action | undefined;
    if (!action) return jsonResponse({ error: "Missing action" }, 400);

    // CREATE — admin-provisioned user (auto confirmed)
    if (action === "create") {
      const email = String(body?.email ?? "").trim().toLowerCase();
      const password = String(body?.password ?? "");
      const fullName = body?.full_name ? String(body.full_name).trim() : null;
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return jsonResponse({ error: "Email tidak valid" }, 400);
      }
      if (password.length < 8) {
        return jsonResponse({ error: "Password minimal 8 karakter" }, 400);
      }
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: fullName ? { full_name: fullName } : {},
      });
      if (error) return jsonResponse({ error: error.message }, 400);
      return jsonResponse({ ok: true, user_id: data.user?.id });
    }

    // For the rest we need a target user id
    const targetId = body?.user_id ? String(body.user_id) : null;
    if (!targetId) return jsonResponse({ error: "Missing user_id" }, 400);
    if (targetId === caller.user.id) {
      return jsonResponse({ error: "Tidak dapat memodifikasi akun sendiri" }, 400);
    }

    // Block actions against other admins
    const { data: targetIsAdmin } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", targetId)
      .eq("role", "admin")
      .maybeSingle();
    if (targetIsAdmin) {
      return jsonResponse({ error: "Tidak dapat memodifikasi akun admin lain" }, 403);
    }

    if (action === "delete") {
      const { error } = await admin.auth.admin.deleteUser(targetId);
      if (error) return jsonResponse({ error: error.message }, 400);
      return jsonResponse({ ok: true });
    }

    if (action === "suspend") {
      // 100 years ban — effectively permanent until lifted
      const { error } = await admin.auth.admin.updateUserById(targetId, {
        ban_duration: "876000h",
      });
      if (error) return jsonResponse({ error: error.message }, 400);
      return jsonResponse({ ok: true });
    }

    if (action === "unsuspend") {
      const { error } = await admin.auth.admin.updateUserById(targetId, {
        ban_duration: "none",
      });
      if (error) return jsonResponse({ error: error.message }, 400);
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("admin-manage-user error", err);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});