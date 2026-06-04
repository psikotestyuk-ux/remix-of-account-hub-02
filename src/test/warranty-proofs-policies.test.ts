import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";

// Integration test: validates RLS on storage.objects for the
// 'warranty-proofs' bucket. Simulates two authenticated users via
// PostgREST-style JWT claims and asserts ownership-only access.
// Requires Supabase PG* env vars (auto-set in Lovable dev sandbox).

const HAS_PG = !!process.env.PGHOST;

function psql(sql: string): { code: number; out: string; err: string } {
  try {
    const out = execSync(`psql -X -A -t -v ON_ERROR_STOP=1`, {
      input: sql,
      stdio: ["pipe", "pipe", "pipe"],
      encoding: "utf8",
    });
    return { code: 0, out: out.trim(), err: "" };
  } catch (e: any) {
    return {
      code: e.status ?? 1,
      out: (e.stdout?.toString?.() ?? "").trim(),
      err: (e.stderr?.toString?.() ?? "").trim(),
    };
  }
}

function asUser(userId: string, body: string) {
  // Wrap in a transaction + savepoint so any insert is rolled back.
  // SET LOCAL ROLE authenticated activates RLS like a real PostgREST request.
  return `
    BEGIN;
    SELECT set_config('role', 'authenticated', true);
    SELECT set_config('request.jwt.claims', '${JSON.stringify({ sub: userId, role: "authenticated" })}', true);
    SET LOCAL ROLE authenticated;
    ${body}
    ROLLBACK;
  `;
}

describe.skipIf(!HAS_PG)("warranty-proofs storage policies", () => {
  const owner = randomUUID();
  const stranger = randomUUID();

  it("owner can INSERT a file inside their own folder", () => {
    const r = psql(asUser(owner, `
      INSERT INTO storage.objects (bucket_id, name, owner)
      VALUES ('warranty-proofs', '${owner}/test-${randomUUID()}.jpg', auth.uid())
      RETURNING id;
    `));
    expect(r.code, r.err).toBe(0);
    expect(r.out.length).toBeGreaterThan(0);
  });

  it("stranger CANNOT upload into another user's folder", () => {
    const r = psql(asUser(stranger, `
      INSERT INTO storage.objects (bucket_id, name, owner)
      VALUES ('warranty-proofs', '${owner}/evil-${randomUUID()}.jpg', auth.uid());
    `));
    expect(r.code).not.toBe(0);
    expect(r.err.toLowerCase()).toMatch(/row-level security|policy/);
  });

  it("anonymous user CANNOT upload to warranty-proofs", () => {
    const r = psql(`
      BEGIN;
      SET LOCAL ROLE anon;
      INSERT INTO storage.objects (bucket_id, name)
      VALUES ('warranty-proofs', '${owner}/anon-${randomUUID()}.jpg');
      ROLLBACK;
    `);
    expect(r.code).not.toBe(0);
    expect(r.err.toLowerCase()).toMatch(/row-level security|permission|policy/);
  });

  it("owner can SELECT (download) their own files; stranger cannot", () => {
    const path = `${owner}/visible-${randomUUID()}.jpg`;
    // Seed as service_role outside the transaction, then read as each user, then cleanup.
    const seed = psql(`INSERT INTO storage.objects (bucket_id, name) VALUES ('warranty-proofs','${path}') RETURNING id;`);
    expect(seed.code, seed.err).toBe(0);
    try {
      const asOwner = psql(asUser(owner, `
        SELECT count(*) FROM storage.objects
        WHERE bucket_id = 'warranty-proofs' AND name = '${path}';
      `));
      expect(asOwner.code, asOwner.err).toBe(0);
      expect(asOwner.out).toBe("1");

      const asStranger = psql(asUser(stranger, `
        SELECT count(*) FROM storage.objects
        WHERE bucket_id = 'warranty-proofs' AND name = '${path}';
      `));
      expect(asStranger.code, asStranger.err).toBe(0);
      expect(asStranger.out).toBe("0");
    } finally {
      psql(`DELETE FROM storage.objects WHERE bucket_id='warranty-proofs' AND name='${path}';`);
    }
  });

  it("owner can DELETE their own file; stranger cannot", () => {
    const path = `${owner}/del-${randomUUID()}.jpg`;
    const seed = psql(`INSERT INTO storage.objects (bucket_id, name) VALUES ('warranty-proofs','${path}') RETURNING id;`);
    expect(seed.code, seed.err).toBe(0);
    try {
      const strangerDel = psql(asUser(stranger, `
        DELETE FROM storage.objects
         WHERE bucket_id='warranty-proofs' AND name='${path}'
         RETURNING id;
      `));
      expect(strangerDel.code, strangerDel.err).toBe(0);
      expect(strangerDel.out).toBe(""); // RLS hid the row -> 0 deletes

      // Confirm row still exists
      const still = psql(`SELECT count(*) FROM storage.objects WHERE bucket_id='warranty-proofs' AND name='${path}';`);
      expect(still.out).toBe("1");

      // Owner delete via savepoint (rolled back so cleanup below still finds the row)
      const ownerDel = psql(asUser(owner, `
        DELETE FROM storage.objects
         WHERE bucket_id='warranty-proofs' AND name='${path}'
         RETURNING id;
      `));
      expect(ownerDel.code, ownerDel.err).toBe(0);
      expect(ownerDel.out.length).toBeGreaterThan(0);
    } finally {
      psql(`DELETE FROM storage.objects WHERE bucket_id='warranty-proofs' AND name='${path}';`);
    }
  });
});