# `public.get_order_product_info(_order_number text)` — Access Control Audit

Audited: 2026-06-01

## Purpose
RPC dipakai oleh halaman `OrderDetail` (`src/pages/OrderDetail.tsx`) untuk
mengambil info produk/grade/paket dari sebuah pesanan, **melewati RLS** di
tabel `products`/`account_grades`/`packages` agar pesanan tetap bisa
menampilkan produk yang sudah `inactive`/`draft`.

Karena `SECURITY DEFINER` mem-bypass RLS, otorisasi harus dilakukan
manual di dalam fungsi. Dokumen ini memverifikasi bahwa hanya role yang
dimaksud yang dapat memanggilnya dan hanya pemilik order atau admin yang
menerima data.

## Properti fungsi

| Properti | Nilai |
|---|---|
| Schema | `public` |
| Language | `plpgsql` |
| Volatility | `STABLE` |
| Security | `SECURITY DEFINER` |
| `search_path` | `public` (di-pin, aman dari hijack) |
| Owner | `postgres` |

## EXECUTE privileges (live DB)

Diverifikasi via `pg_proc.proacl` + `has_function_privilege`:

```
postgres       = EXECUTE   (owner)
sandbox_exec   = EXECUTE   (internal Supabase role)
authenticated  = EXECUTE   ✅
service_role   = EXECUTE   ✅
anon           = (tidak ada) ✅ ditolak
PUBLIC         = (tidak ada) ✅ ditolak
```

Hasil: hanya request yang membawa JWT user (role `authenticated`) atau
yang dipanggil dari backend dengan service key (`service_role`) yang
bisa menjalankan RPC ini. Anonymous client (anon key tanpa session)
akan ditolak Postgres sebelum body fungsi dieksekusi.

## Otorisasi di dalam fungsi (RBAC)

Body fungsi melakukan tiga lapis pemeriksaan:

1. **Validasi input.** `_order_number` wajib match regex
   `^BA-[A-Z0-9]{4,12}$`. Format lain → `RETURN` kosong (anti probing).
2. **Order lookup.** Ambil `user_id`, `product_id`, `grade_id`,
   `package_id` dari `public.orders`. Jika tidak ada → `RETURN` kosong
   (tidak membocorkan apakah order ada).
3. **Cek kepemilikan.** `RETURN` kosong kecuali:
   - `auth.uid() IS NOT NULL`, **dan**
   - `auth.uid() = orders.user_id` **atau** `has_role(auth.uid(),'admin')`.

Efek bersihnya:

| Pemanggil | Hasil |
|---|---|
| Tidak login (anon) | Ditolak di GRANT layer |
| Authenticated, bukan owner & bukan admin | Fungsi return 0 baris |
| Authenticated, owner order | Return 1 baris detail produk |
| Authenticated, admin (`user_roles.role='admin'`) | Return 1 baris untuk order apapun |
| Edge function pakai service key | Return 1 baris (audit/admin tooling) |

Karena fungsi tidak pernah meng-`RAISE` error untuk akses ditolak,
pemanggil yang tidak berhak tidak bisa membedakan "order tidak ada" vs
"order ada tapi bukan punya saya" — ini disengaja untuk privacy.

## Ketergantungan

- `public.has_role(uuid, app_role)` — `SECURITY DEFINER`. EXECUTE
  di-grant ke `authenticated, service_role` saja (anon & PUBLIC sudah
  di-revoke pada migrasi sebelumnya). Karena `get_order_product_info`
  dijalankan sebagai owner (`postgres`), pemanggilan internal
  `has_role` tetap sukses terlepas dari ACL caller.
- `public.user_roles` — sumber kebenaran role admin. Hanya diakses
  lewat `has_role`.

## Cara re-verifikasi

```sql
-- Siapa yang boleh EXECUTE
SELECT r.rolname,
       has_function_privilege(r.oid,
         'public.get_order_product_info(text)', 'EXECUTE') AS can_execute
FROM pg_roles r
WHERE r.rolname IN ('anon','authenticated','service_role')
ORDER BY r.rolname;

-- ACL mentah
SELECT proacl
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname='get_order_product_info';
```

## Kesimpulan

RLS/RBAC untuk `get_order_product_info` sudah sesuai desain:
anon ditolak di level GRANT, dan di level body hanya owner order atau
admin yang menerima data. Tidak ditemukan jalur eskalasi.