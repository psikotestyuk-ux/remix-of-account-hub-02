import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";

/**
 * Integration tests for the `warranty-proofs` storage bucket policies.
 *
 * Two complementary layers are checked:
 *
 *  1. **Policy contract** — assert that the expected RLS policies exist on
 *     storage.objects with the correct ownership predicates. Guards against
 *     accidental drops / loosening of policies in future migrations.
 *
 *  2. **Behavioral simulation** — evaluate the policy USING/WITH CHECK
 *     expressions directly using a synthetic `auth.uid()` and a sample
 *     object name, asserting that only the owner (folder == uid) and admins
 *     are accepted.
 *
 * Requires Supabase PG* env vars (auto-set in the Lovable dev sandbox).
 */

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

// Evaluate any boolean SQL expression with a chosen auth.uid() value by
// overriding the auth.uid() function inside a single-statement scope.
function evalAs(uid: string | null, expr: string): boolean {
  const uidLiteral = uid === null ? "NULL::uuid" : `'${uid}'::uuid`;
  const sql = `
    WITH ctx AS (SELECT ${uidLiteral} AS uid)
    SELECT COALESCE((
      SELECT (${expr.replace(/auth\.uid\(\)/g, "ctx.uid")})
      FROM ctx
    ), false)::text;
  `;
  const r = psql(sql);
  if (r.code !== 0) throw new Error(r.err);
  return r.out === "t" || r.out === "true";
}

describe.skipIf(!HAS_PG)("warranty-proofs storage policies — contract", () => {
  const policies = HAS_PG
    ? (() => {
        const r = psql(`
          SELECT policyname || '|' || cmd || '|' ||
                 COALESCE(qual, '') || '|' || COALESCE(with_check, '')
          FROM pg_policies
          WHERE schemaname = 'storage'
            AND tablename = 'objects'
            AND (
              qual ILIKE '%warranty-proofs%'
              OR with_check ILIKE '%warranty-proofs%'
            )
          ORDER BY policyname;
        `);
        return r.out.split("\n").filter(Boolean).map((line) => {
          const [name, cmd, qual, withCheck] = line.split("|");
          return { name, cmd, qual, withCheck };
        });
      })()
    : [];

  it("only authenticated users can INSERT, and only into their own folder", () => {
    const insert = policies.find((p) => p.cmd === "INSERT");
    expect(insert, "expected an INSERT policy on warranty-proofs").toBeDefined();
    expect(insert!.withCheck).toMatch(/auth\.uid\(\)/);
    expect(insert!.withCheck).toMatch(/storage\.foldername/);
    // The dropped public policy must no longer exist
    const anonUploadPolicyExists = policies.some(
      (p) => p.name === "Anyone can upload warranty proofs"
    );
    expect(anonUploadPolicyExists).toBe(false);
  });

  it("has owner-scoped SELECT / UPDATE / DELETE policies", () => {
    for (const cmd of ["SELECT", "UPDATE", "DELETE"]) {
      const owned = policies.find(
        (p) => p.cmd === cmd && /auth\.uid\(\)/.test(p.qual) && /foldername/.test(p.qual)
      );
      expect(owned, `expected an owner-scoped ${cmd} policy`).toBeDefined();
    }
  });

  it("admin has an ALL/manage policy via has_role", () => {
    const admin = policies.find((p) => /has_role/.test(p.qual) || /has_role/.test(p.withCheck));
    expect(admin, "expected an admin policy using has_role").toBeDefined();
  });
});

describe.skipIf(!HAS_PG)("warranty-proofs storage policies — behavior", () => {
  const owner = randomUUID();
  const stranger = randomUUID();
  const ownPath = `${owner}/file-${randomUUID()}.jpg`;

  // Re-derive the policy expressions from the live database so the test
  // exercises whatever predicate is currently deployed.
  function policyExpr(cmd: "INSERT" | "SELECT" | "UPDATE" | "DELETE"): string {
    const r = psql(`
      SELECT COALESCE(with_check, qual)
      FROM pg_policies
      WHERE schemaname='storage' AND tablename='objects'
        AND cmd='${cmd}'
        AND COALESCE(qual,'') || COALESCE(with_check,'') ILIKE '%warranty-proofs%'
        AND COALESCE(qual,'') || COALESCE(with_check,'') ILIKE '%foldername%'
      LIMIT 1;
    `);
    if (r.code !== 0 || !r.out) throw new Error(`no owner ${cmd} policy: ${r.err}`);
    // Replace the literal `name` reference with our test object name.
    return r.out.replace(/\bname\b/g, `'${ownPath}'`).replace(/\bbucket_id\b/g, "'warranty-proofs'");
  }

  it("INSERT: owner ✓, stranger ✗, anon ✗", () => {
    const expr = policyExpr("INSERT");
    expect(evalAs(owner, expr)).toBe(true);
    expect(evalAs(stranger, expr)).toBe(false);
    expect(evalAs(null, expr)).toBe(false);
  });

  it("SELECT (download): owner ✓, stranger ✗, anon ✗", () => {
    const expr = policyExpr("SELECT");
    expect(evalAs(owner, expr)).toBe(true);
    expect(evalAs(stranger, expr)).toBe(false);
    expect(evalAs(null, expr)).toBe(false);
  });

  it("DELETE: owner ✓, stranger ✗", () => {
    const expr = policyExpr("DELETE");
    expect(evalAs(owner, expr)).toBe(true);
    expect(evalAs(stranger, expr)).toBe(false);
  });

  it("UPDATE: owner ✓, stranger ✗", () => {
    const expr = policyExpr("UPDATE");
    expect(evalAs(owner, expr)).toBe(true);
    expect(evalAs(stranger, expr)).toBe(false);
  });
});