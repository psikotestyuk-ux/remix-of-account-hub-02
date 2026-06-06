# Rencana: Audit & Hardening Keamanan Menyeluruh

Menjalankan semua opsi yang ditawarkan sebelumnya secara berurutan.

## 1. Fresh Security Scan
- Jalankan `security--run_security_scan` + `supabase--linter` untuk dapatkan temuan terbaru.
- Perbaiki setiap temuan baru (migration / kode) lalu tandai `mark_as_fixed`.

## 2. Audit RLS Chat
- Periksa policy `chat_conversations` & `chat_messages`:
  - User hanya bisa baca/tulis percakapan miliknya.
  - Admin punya akses via `has_role('admin')`.
  - Tidak ada policy `anon` yang bocor.
- Periksa GRANT (authenticated + service_role saja, no anon).
- Periksa RPC `send_chat_message` & `mark_chat_read` (SECURITY DEFINER, search_path, validasi kepemilikan).
- Tambah migration perbaikan jika ada celah.

## 3. Audit Edge Functions Admin
File: `admin-get-user`, `admin-list-users`, `admin-manage-user`.
- Pastikan setiap function memvalidasi JWT pemanggil dan cek `has_role(uid, 'admin')` di awal — bukan hanya mengandalkan service-role key.
- Pastikan tidak mengembalikan data sensitif berlebih (password hash, tokens).
- Tambah rate-limit sederhana (in-memory per-IP) atau minimal logging penolakan.
- Patch jika ditemukan masalah.

## 4. Validasi Input & Form Hardening
- Tinjau form publik: `Auth`, `ReviewForm`, `WarrantyClaimDialog`, `ChatWidget`, `OrdersLookup`, `Checkout`.
- Pastikan validasi panjang/format (zod) di client, dan di server (RPC/trigger).
- Cek max-length pada kolom DB untuk hindari payload besar.

## 5. E2E Tests untuk `payment-proofs`
- Duplikasi pola `warranty-proofs-e2e.test.ts` untuk bucket `payment-proofs`.
- 11 kasus serupa: owner upload/download/delete, stranger & anon ditolak.

## 6. Hardening Header (CSP & friends)
File: `index.html` + `vercel.json`.
- Tambah meta/HTTP header:
  - `Content-Security-Policy` (allow self + Supabase URL + img/style inline yang diperlukan)
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy` minimal
  - `X-Content-Type-Options: nosniff`
- Verifikasi preview masih berjalan (Supabase realtime, images, fonts tidak ke-block).

## 7. Update Security Memory
- Catat ringkasan posture terbaru + apa yang sengaja public (mis. katalog produk).
- Hapus catatan usang.

## Deliverables
- 0–N migration baru (tergantung temuan)
- Patch kode untuk edge functions / validasi (jika perlu)
- File test baru: `src/test/payment-proofs-e2e.test.ts`
- Update `vercel.json` + `index.html` untuk header
- Update security memory

## Catatan
Implementasi berurutan; jika langkah 1–4 menemukan masalah besar, fix dulu sebelum lanjut. Total estimasi: 4–7 migration/file diubah, ~1 file test baru.
