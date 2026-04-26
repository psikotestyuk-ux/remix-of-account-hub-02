import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: caller, error: callerErr } = await userClient.auth.getUser();
    if (callerErr || !caller.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const userId = url.searchParams.get("id");
    if (!userId) {
      return new Response(JSON.stringify({ error: "Missing id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: u, error: uErr } = await admin.auth.admin.getUserById(userId);
    if (uErr || !u.user) {
      return new Response(JSON.stringify({ error: uErr?.message ?? "Not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = u.user as any;

    const [{ data: profile }, { data: orders }, { data: roles }, { data: wallet }] = await Promise.all([
      admin.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
      admin.from("orders").select("id, order_number, total_price, payment_status, order_status, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
      admin.from("user_roles").select("role").eq("user_id", userId),
      admin.from("wallets").select("balance, currency").eq("user_id", userId).maybeSingle(),
    ]);

    const result = {
      id: user.id,
      email: user.email,
      phone: user.phone,
      created_at: user.created_at,
      updated_at: user.updated_at,
      email_confirmed_at: user.email_confirmed_at,
      phone_confirmed_at: user.phone_confirmed_at,
      last_sign_in_at: user.last_sign_in_at,
      confirmation_sent_at: user.confirmation_sent_at,
      recovery_sent_at: user.recovery_sent_at,
      email_change_sent_at: user.email_change_sent_at,
      new_email: user.new_email,
      banned_until: user.banned_until,
      is_anonymous: user.is_anonymous,
      provider: user.app_metadata?.provider ?? null,
      providers: user.app_metadata?.providers ?? [],
      app_metadata: user.app_metadata ?? {},
      user_metadata: user.user_metadata ?? {},
      identities: (user.identities ?? []).map((i: any) => ({
        provider: i.provider,
        created_at: i.created_at,
        updated_at: i.updated_at,
        last_sign_in_at: i.last_sign_in_at,
        email: i.identity_data?.email ?? null,
      })),
      profile,
      orders: orders ?? [],
      roles: (roles ?? []).map((r: any) => r.role),
      wallet,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("admin-get-user error", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});