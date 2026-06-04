import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";

/**
 * Integration tests for the `warranty-proofs` storage bucket policies.
 *
 * Two layers:
 *  1. Policy contract — assert expected RLS policies exist on storage.objects
 *     with ownership predicates (guards against regressions in future migrations).
 *  2. Behavioral simulation — evaluate the live policy USING/WITH CHECK
 *     expressions against synthetic auth.uid() values to confirm only the
 *     owner (folder == uid) — and never strangers or anon — passes.
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

// Evaluate the boolean expression for many uids in a single round-trip.
function evalMany(expr: string, uids: Array<string | null>): boolean[] {
  const projections = uids.map((uid, i) => {
    const lit = uid === null ? "NULL::uuid" : `'${uid}'::uuid`;
    const e = expr.replace(/auth\.uid\(\)/g, lit);
    return `COALESCE((${e})::text, 'f') AS r${i}`;
  }).join(", ");
  const r = psql(`SELECT ${projections};`);
  if (r.code !== 0) throw new Error(r.err);
  return r.out.split("|").map((v) => v === "t" || v === "true");
}

interface Policy { name: string; cmd: string; qual: string; withCheck: string; }

let policies: Policy[] = [];

describe.skipIf(!HAS_PG)("warranty-proofs storage policies — contract", () => {
  beforeAll(() => {
    const r = psql(`
      SELECT policyname || '|' || cmd || '|' ||
             COALESCE(qual, '') || '|' || COALESCE(with_check, '')
      FROM pg_policies
      WHERE schemaname='storage' AND tablename='objects'
        AND (qual ILIKE '%warranty-proofs%' OR with_check ILIKE '%warranty-proofs%')
      ORDER BY policyname;
    `);
    if (r.code !== 0) throw new Error(r.err);
    policies = r.out.split("\n").filter(Boolean).map((line) => {
      const [name, cmd, qual, withCheck] = line.split("|");
      return { name, cmd, qual, withCheck };
    });
  }, 30_000);

  it("dropped the public 'Anyone can upload warranty proofs' policy", () => {
    expect(policies.some((p) => p.name === "Anyone can upload warranty proofs")).toBe(false);
  });

  it("INSERT policy requires authenticated user + own-folder WITH CHECK", () => {
    const ins = policies.find((p) => p.cmd === "INSERT");
    expect(ins, "expected an INSERT policy on warranty-proofs").toBeDefined();
    expect(ins!.withCheck).toMatch(/auth\.uid\(\)/);
    expect(ins!.withCheck).toMatch(/storage\.foldername/);
  });

  it("has owner-scoped SELECT / UPDATE / DELETE policies", () => {
    for (const cmd of ["SELECT", "UPDATE", "DELETE"]) {
      const owned = policies.find(
        (p) => p.cmd === cmd && /auth\.uid\(\)/.test(p.qual) && /foldername/.test(p.qual)
      );
      expect(owned, `expected an owner-scoped ${cmd} policy`).toBeDefined();
    }
  });

  it("admin has a management policy via has_role", () => {
    const admin = policies.find((p) => /has_role/.test(p.qual) || /has_role/.test(p.withCheck));
    expect(admin, "expected an admin policy using has_role").toBeDefined();
  });
});

describe.skipIf(!HAS_PG)("warranty-proofs storage policies — behavior", () => {
  const owner = randomUUID();
  const stranger = randomUUID();
  const ownPath = `${owner}/file-${randomUUID()}.jpg`;
  const exprs: Record<string, string> = {};

  beforeAll(() => {
    const r = psql(`
      SELECT cmd || '::' || COALESCE(with_check, qual)
      FROM pg_policies
      WHERE schemaname='storage' AND tablename='objects'
        AND COALESCE(qual,'') || COALESCE(with_check,'') ILIKE '%warranty-proofs%'
        AND COALESCE(qual,'') || COALESCE(with_check,'') ILIKE '%foldername%';
    `);
    if (r.code !== 0) throw new Error(r.err);
    for (const line of r.out.split("\n").filter(Boolean)) {
      const idx = line.indexOf("::");
      const cmd = line.slice(0, idx);
      const raw = line.slice(idx + 2);
      exprs[cmd] = raw
        .replace(/\bname\b/g, `'${ownPath}'`)
        .replace(/\bbucket_id\b/g, "'warranty-proofs'");
    }
  }, 30_000);

  it("INSERT (upload): owner OK, stranger blocked, anon blocked", () => {
    const [o, s, a] = evalMany(exprs.INSERT, [owner, stranger, null]);
    expect({ owner: o, stranger: s, anon: a }).toEqual({ owner: true, stranger: false, anon: false });
  }, 30_000);

  it("SELECT (download): owner OK, stranger blocked, anon blocked", () => {
    const [o, s, a] = evalMany(exprs.SELECT, [owner, stranger, null]);
    expect({ owner: o, stranger: s, anon: a }).toEqual({ owner: true, stranger: false, anon: false });
  }, 30_000);

  it("DELETE: owner OK, stranger blocked", () => {
    const [o, s] = evalMany(exprs.DELETE, [owner, stranger]);
    expect({ owner: o, stranger: s }).toEqual({ owner: true, stranger: false });
  }, 30_000);

  it("UPDATE: owner OK, stranger blocked", () => {
    const [o, s] = evalMany(exprs.UPDATE, [owner, stranger]);
    expect({ owner: o, stranger: s }).toEqual({ owner: true, stranger: false });
  }, 30_000);
});
