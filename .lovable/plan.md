# Rencana: Wishlist, Rating, Live Chat, Laporan Penjualan

Empat fitur ditambahkan ke BuyingAccount. Setiap fitur punya database, UI customer, dan (bila relevan) panel admin.

---

## 1. Wishlist (Favorit Produk)

**Customer:**
- Tombol hati di kartu produk & halaman detail produk (toggle add/remove)
- Halaman `/wishlist` menampilkan semua produk favorit user
- Link "Wishlist" di header/menu user
- Indikator jumlah wishlist di header

**Database:**
- Tabel `wishlists` (user_id, product_id, created_at) dengan unique constraint
- RLS: user hanya bisa CRUD wishlist miliknya
- GRANT untuk authenticated + service_role

**Catatan:** Wajib login untuk add ke wishlist; jika belum login, redirect ke `/auth`.

---

## 2. Rating & Ulasan Produk

**Customer:**
- Form ulasan di halaman order yang sudah `completed` (rating 1–5 bintang + komentar)
- Tampilkan rata-rata rating & daftar ulasan di halaman detail produk
- Satu user = satu ulasan per produk (bisa edit)

**Database:**
- Tabel `product_reviews` (user_id, product_id, order_id, rating 1–5, comment, created_at)
- Validasi via trigger: user hanya bisa review produk yang sudah dia beli & order completed
- RLS: public SELECT, user CUD miliknya, admin bisa hapus
- Trigger update kolom `rating` di tabel `products` otomatis (rata-rata)

**Admin:**
- Halaman `/admin/reviews` untuk moderasi (lihat/hapus ulasan tidak pantas)

---

## 3. Live Chat (Customer ↔ Admin)

**Customer:**
- Widget chat melayang di pojok kanan bawah (semua halaman, kecuali admin)
- Wajib login untuk buka chat
- Realtime menggunakan Supabase Realtime
- Indikator unread message

**Admin:**
- Halaman `/admin/chat` dengan daftar percakapan di sidebar + panel pesan
- Realtime sync; tandai sudah dibaca

**Database:**
- Tabel `chat_conversations` (user_id, last_message_at, unread_user, unread_admin)
- Tabel `chat_messages` (conversation_id, sender_id, sender_role, content, read_at, created_at)
- RLS: user akses percakapan miliknya, admin akses semua
- Aktifkan publication realtime untuk `chat_messages`
- GRANT lengkap

**Catatan:** Tetap pertahankan tombol WhatsApp yang ada sebagai fallback.

---

## 4. Laporan Penjualan (Admin)

Halaman `/admin/reports` dengan visualisasi:

- **KPI cards:** total revenue, total order, average order value, jumlah customer aktif (filter range tanggal)
- **Chart penjualan harian** (line/bar chart, 30 hari terakhir, pakai Recharts)
- **Top produk terlaris** (tabel: produk, qty terjual, revenue)
- **Top kategori** (pie chart)
- **Breakdown payment method** (wallet vs xendit_mock)
- **Export CSV** untuk range tanggal terpilih

**Database:**
- Tidak perlu tabel baru — pakai agregasi dari `orders` (status `paid`/`completed`)
- Buat RPC `get_sales_report(start_date, end_date)` SECURITY DEFINER yang cek `has_role(admin)` untuk efisiensi query

---

## Urutan Implementasi

1. Migration database untuk keempat fitur (1 file gabungan atau terpisah)
2. Wishlist (paling sederhana, dasar pattern)
3. Rating & ulasan
4. Live chat (paling kompleks, butuh realtime)
5. Laporan penjualan admin

## Detail Teknis

- **Realtime:** `ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;`
- **Chart:** library `recharts` (kemungkinan sudah ada via shadcn)
- **State management:** React Query untuk caching wishlist count, reviews, dll
- **Routing:** tambah route di `App.tsx` untuk `/wishlist`, `/admin/reviews`, `/admin/chat`, `/admin/reports`
- **Komponen baru:** `WishlistButton`, `ReviewForm`, `ReviewList`, `ChatWidget`, `ChatAdminPanel`, `SalesChart`, `TopProductsTable`

## Konfirmasi

Apakah Anda ingin semua 4 fitur sekaligus, atau bertahap (misal Wishlist + Rating dulu, baru Chat + Laporan)? Implementasi sekaligus akan menghasilkan beberapa migration + ±15 file baru.