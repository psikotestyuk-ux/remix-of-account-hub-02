// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

/**
 * End-to-end tests for the `payment-proofs` bucket exercised through the
 * real Storage HTTP API with authenticated JWTs.
 *
 * Path convention enforced by RLS:  `{user_id}/{order_id}/<filename>`
 *  - INSERT requires folder[0] == auth.uid() AND user_owns_order(folder[1])
 *  - SELECT requires either admin role, OR an order owned by the user whose
 *    `payment_proof_url` equals the object name.
 *  - DELETE/UPDATE require folder[0] == auth.uid().
 *
 * Skips automatically when SUPABASE_URL / keys aren't set.
 */

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const ANON =
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RUN = !!(URL && ANON && SERVICE);

const BUCKET = "payment-proofs";

let admin: SupabaseClient;
let ownerClient: SupabaseClient;
let strangerClient: SupabaseClient;
let anonClient: SupabaseClient;

let ownerId = "";
let strangerId = "";
let ownerOrderId = "";
let strangerOrderId = "";
let productId = "";

const ownerEmail = `owner+${randomUUID()}@e2e.local`;
const strangerEmail = `stranger+${randomUUID()}@e2e.local`;
const password = `Pwd_${randomUUID()}`;

const fileBytes = new Uint8Array([9, 8, 7, 6, 5]);

function ownerObjectPath() {
  return `${ownerId}/${ownerOrderId}/proof-${randomUUID()}.txt`;
}
function strangerObjectPath() {
  return `${strangerId}/${strangerOrderId}/proof-${randomUUID()}.txt`;
}
// Stranger tries to upload INTO owner's folder using owner's order id.
function ownerObjectPathFromStranger() {
  return `${ownerId}/${ownerOrderId}/intruder-${randomUUID()}.txt`;
}

async function provisionUser(email: string) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  return data.user!.id;
}

async function signedIn(email: string): Promise<SupabaseClient> {
  const client = createClient(URL!, ANON!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

async function createOrder(userId: string, email: string): Promise<string> {
  // Service-role insert to bypass RLS — we only need a real row owned by `userId`
  // so user_owns_order() returns true for the storage policy.
  const { data, error } = await admin
    .from("orders")
    .insert({
      user_id: userId,
      customer_name: "E2E Test",
      customer_email: email,
      customer_phone: "08000000000",
      product_id: productId,
      quantity: 1,
      total_price: 1000,
      payment_method: "xendit_mock",
      payment_status: "pending",
      order_status: "pending",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data!.id as string;
}

let createdOwnerObject = "";

describe.skipIf(!RUN)("payment-proofs storage — end-to-end", () => {
  beforeAll(async () => {
    admin = createClient(URL!, SERVICE!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    anonClient = createClient(URL!, ANON!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Pick an active product to attach orders to.
    const { data: prod, error: prodErr } = await admin
      .from("products")
      .select("id")
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    if (prodErr || !prod) throw prodErr ?? new Error("no active product to test with");
    productId = prod.id as string;

    ownerId = await provisionUser(ownerEmail);
    strangerId = await provisionUser(strangerEmail);
    ownerOrderId = await createOrder(ownerId, ownerEmail);
    strangerOrderId = await createOrder(strangerId, strangerEmail);

    ownerClient = await signedIn(ownerEmail);
    strangerClient = await signedIn(strangerEmail);
  }, 60_000);

  afterAll(async () => {
    try {
      const list = await admin.storage.from(BUCKET).list(`${ownerId}/${ownerOrderId}`);
      const paths = (list.data ?? []).map((o) => `${ownerId}/${ownerOrderId}/${o.name}`);
      if (paths.length) await admin.storage.from(BUCKET).remove(paths);
      const list2 = await admin.storage.from(BUCKET).list(`${strangerId}/${strangerOrderId}`);
      const paths2 = (list2.data ?? []).map((o) => `${strangerId}/${strangerOrderId}/${o.name}`);
      if (paths2.length) await admin.storage.from(BUCKET).remove(paths2);
    } catch {/* ignore */}
    if (ownerOrderId) await admin.from("orders").delete().eq("id", ownerOrderId);
    if (strangerOrderId) await admin.from("orders").delete().eq("id", strangerOrderId);
    if (ownerId) await admin.auth.admin.deleteUser(ownerId).catch(() => {});
    if (strangerId) await admin.auth.admin.deleteUser(strangerId).catch(() => {});
  }, 60_000);

  it("owner can upload into their own {uid}/{orderId}/ folder", async () => {
    createdOwnerObject = ownerObjectPath();
    const { error } = await ownerClient.storage
      .from(BUCKET)
      .upload(createdOwnerObject, fileBytes, { upsert: false });
    expect(error, error?.message).toBeNull();

    // Wire the URL onto the order so the owner SELECT policy can find it.
    const { error: updErr } = await admin
      .from("orders")
      .update({ payment_proof_url: createdOwnerObject })
      .eq("id", ownerOrderId);
    expect(updErr).toBeNull();
  }, 30_000);

  it("anon cannot upload", async () => {
    const { error } = await anonClient.storage
      .from(BUCKET)
      .upload(`${ownerId}/${ownerOrderId}/anon-${randomUUID()}.txt`, fileBytes);
    expect(error).not.toBeNull();
  }, 30_000);

  it("stranger cannot upload into owner's folder", async () => {
    const { error } = await strangerClient.storage
      .from(BUCKET)
      .upload(ownerObjectPathFromStranger(), fileBytes);
    expect(error).not.toBeNull();
  }, 30_000);

  it("stranger cannot upload using owner's order id under their own uid prefix", async () => {
    // folder[0] check passes (matches stranger.uid) but user_owns_order(folder[1]) must fail.
    const path = `${strangerId}/${ownerOrderId}/spoof-${randomUUID()}.txt`;
    const { error } = await strangerClient.storage.from(BUCKET).upload(path, fileBytes);
    expect(error).not.toBeNull();
  }, 30_000);

  it("stranger can upload into their own {uid}/{orderId}/ folder (sanity)", async () => {
    const path = strangerObjectPath();
    const { error } = await strangerClient.storage.from(BUCKET).upload(path, fileBytes);
    expect(error, error?.message).toBeNull();
    await admin.storage.from(BUCKET).remove([path]);
  }, 30_000);

  it("owner can download their own file", async () => {
    const { data, error } = await ownerClient.storage.from(BUCKET).download(createdOwnerObject);
    expect(error).toBeNull();
    expect(data).toBeTruthy();
  }, 30_000);

  it("owner can create a signed URL for their file", async () => {
    const { data, error } = await ownerClient.storage
      .from(BUCKET)
      .createSignedUrl(createdOwnerObject, 60);
    expect(error).toBeNull();
    expect(data?.signedUrl).toMatch(/^https?:\/\//);
  }, 30_000);

  it("stranger cannot download owner's file", async () => {
    const { data, error } = await strangerClient.storage.from(BUCKET).download(createdOwnerObject);
    expect(data).toBeFalsy();
    expect(error).not.toBeNull();
  }, 30_000);

  it("stranger cannot create a signed URL for owner's file", async () => {
    const { data, error } = await strangerClient.storage
      .from(BUCKET)
      .createSignedUrl(createdOwnerObject, 60);
    expect(data?.signedUrl).toBeFalsy();
    expect(error).not.toBeNull();
  }, 30_000);

  it("anon cannot download owner's file", async () => {
    const { data, error } = await anonClient.storage.from(BUCKET).download(createdOwnerObject);
    expect(data).toBeFalsy();
    expect(error).not.toBeNull();
  }, 30_000);

  it("stranger cannot delete owner's file", async () => {
    const { data, error } = await strangerClient.storage.from(BUCKET).remove([createdOwnerObject]);
    const removedNothing = !data || data.length === 0;
    expect(error !== null || removedNothing).toBe(true);

    const { data: stillThere } = await ownerClient.storage.from(BUCKET).download(createdOwnerObject);
    expect(stillThere).toBeTruthy();
  }, 30_000);

  it("owner can delete their own file", async () => {
    const { error } = await ownerClient.storage.from(BUCKET).remove([createdOwnerObject]);
    expect(error).toBeNull();

    const { data, error: dlErr } = await ownerClient.storage
      .from(BUCKET)
      .download(createdOwnerObject);
    expect(data).toBeFalsy();
    expect(dlErr).not.toBeNull();
  }, 30_000);
});