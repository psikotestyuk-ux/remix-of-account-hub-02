import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

/**
 * End-to-end tests for the `warranty-proofs` bucket exercised through the
 * real Storage HTTP API (PostgREST + Storage) with authenticated JWTs.
 *
 * Flow:
 *  - Use the service-role key to provision two confirmed users (owner, stranger).
 *  - Sign each user in via the anon client to obtain a real session JWT.
 *  - Verify only the owner can upload / download / delete files inside their
 *    own `{user_id}/...` folder; the stranger and the anon client are blocked.
 *
 * Skips automatically when SUPABASE_URL / keys aren't set (e.g. CI without secrets).
 */

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const ANON =
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RUN = !!(URL && ANON && SERVICE);

const BUCKET = "warranty-proofs";

let admin: SupabaseClient;
let ownerClient: SupabaseClient;
let strangerClient: SupabaseClient;
let anonClient: SupabaseClient;

let ownerId = "";
let strangerId = "";
const ownerEmail = `owner+${randomUUID()}@e2e.local`;
const strangerEmail = `stranger+${randomUUID()}@e2e.local`;
const password = `Pwd_${randomUUID()}`;

const ownerPath = `__e2e__/owner-${randomUUID()}.txt`; // joined to ownerId below
const strangerPath = `__e2e__/stranger-${randomUUID()}.txt`;

function fullOwnerPath() {
  return `${ownerId}/${ownerPath}`;
}
function fullOwnerPathFromStranger() {
  // stranger tries to write into owner's folder
  return `${ownerId}/${strangerPath}`;
}

const fileBytes = new Blob([new Uint8Array([1, 2, 3, 4, 5])], {
  type: "application/octet-stream",
});

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

describe.skipIf(!RUN)("warranty-proofs storage — end-to-end", () => {
  beforeAll(async () => {
    admin = createClient(URL!, SERVICE!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    anonClient = createClient(URL!, ANON!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    ownerId = await provisionUser(ownerEmail);
    strangerId = await provisionUser(strangerEmail);
    ownerClient = await signedIn(ownerEmail);
    strangerClient = await signedIn(strangerEmail);
  }, 60_000);

  afterAll(async () => {
    try {
      await admin.storage.from(BUCKET).remove([fullOwnerPath(), fullOwnerPathFromStranger()]);
    } catch {/* ignore */}
    if (ownerId) await admin.auth.admin.deleteUser(ownerId).catch(() => {});
    if (strangerId) await admin.auth.admin.deleteUser(strangerId).catch(() => {});
  }, 60_000);

  it("owner can upload into their own folder", async () => {
    const { error } = await ownerClient.storage
      .from(BUCKET)
      .upload(fullOwnerPath(), fileBytes, { upsert: false });
    expect(error, error?.message).toBeNull();
  }, 30_000);

  it("anon cannot upload", async () => {
    const { error } = await anonClient.storage
      .from(BUCKET)
      .upload(`${ownerId}/anon-${randomUUID()}.txt`, fileBytes);
    expect(error).not.toBeNull();
  }, 30_000);

  it("stranger cannot upload into owner's folder", async () => {
    const { error } = await strangerClient.storage
      .from(BUCKET)
      .upload(fullOwnerPathFromStranger(), fileBytes);
    expect(error).not.toBeNull();
  }, 30_000);

  it("stranger cannot upload into their OWN folder for someone else's path either (sanity)", async () => {
    // Strangers are allowed to upload into their own folder — that's expected.
    const path = `${strangerId}/__e2e__/own-${randomUUID()}.txt`;
    const { error } = await strangerClient.storage.from(BUCKET).upload(path, fileBytes);
    expect(error, error?.message).toBeNull();
    await admin.storage.from(BUCKET).remove([path]);
  }, 30_000);

  it("owner can create a signed URL for their file", async () => {
    const { data, error } = await ownerClient.storage
      .from(BUCKET)
      .createSignedUrl(fullOwnerPath(), 60);
    expect(error).toBeNull();
    expect(data?.signedUrl).toMatch(/^https?:\/\//);
  }, 30_000);

  it("owner can download their own file", async () => {
    const { data, error } = await ownerClient.storage.from(BUCKET).download(fullOwnerPath());
    expect(error).toBeNull();
    expect(data).toBeTruthy();
  }, 30_000);

  it("stranger cannot download owner's file", async () => {
    const { data, error } = await strangerClient.storage.from(BUCKET).download(fullOwnerPath());
    expect(data).toBeFalsy();
    expect(error).not.toBeNull();
  }, 30_000);

  it("stranger cannot create a signed URL for owner's file", async () => {
    const { data, error } = await strangerClient.storage
      .from(BUCKET)
      .createSignedUrl(fullOwnerPath(), 60);
    expect(data?.signedUrl).toBeFalsy();
    expect(error).not.toBeNull();
  }, 30_000);

  it("anon cannot download owner's file", async () => {
    const { data, error } = await anonClient.storage.from(BUCKET).download(fullOwnerPath());
    expect(data).toBeFalsy();
    expect(error).not.toBeNull();
  }, 30_000);

  it("stranger cannot delete owner's file", async () => {
    const { data, error } = await strangerClient.storage.from(BUCKET).remove([fullOwnerPath()]);
    // Storage returns success with empty array when nothing matched the policy.
    const removedNothing = !data || data.length === 0;
    expect(error !== null || removedNothing).toBe(true);

    // File must still exist for the owner.
    const { data: stillThere } = await ownerClient.storage.from(BUCKET).download(fullOwnerPath());
    expect(stillThere).toBeTruthy();
  }, 30_000);

  it("owner can delete their own file", async () => {
    const { error } = await ownerClient.storage.from(BUCKET).remove([fullOwnerPath()]);
    expect(error).toBeNull();

    const { data, error: dlErr } = await ownerClient.storage
      .from(BUCKET)
      .download(fullOwnerPath());
    expect(data).toBeFalsy();
    expect(dlErr).not.toBeNull();
  }, 30_000);
});