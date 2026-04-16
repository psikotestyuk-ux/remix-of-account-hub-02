
# BuyingAccount — Digital Account Marketplace

## Overview
Marketplace jual-beli akun digital (Facebook, Instagram, TikTok, Gaming, Tools, Crypto) dengan UI Bahasa Indonesia, payment mock (Xendit nanti), admin panel, dan email otomatis via SendGrid (nanti).

## Design
- **Warna utama**: Gradient Indigo-600 (#4F46E5) → Blue-600 (#2563EB)
- **Background**: Gray-50 (#F9FAFB), Card: white, shadow-lg, rounded-2xl
- **Button**: gradient indigo-to-blue, rounded-xl, hover scale
- **Badge stok**: Green (ready), Orange pulse (terbatas), Red (habis)
- **Rating**: bintang kuning 4.8 hardcoded

## Database (Supabase)
1. **products** — name, slug, category (facebook/instagram/tiktok/gaming/tools/crypto), price, description, features (jsonb), stock, image_url, status (active/inactive), rating (default 4.8)
2. **account_credentials** — product_id (FK), credentials_encrypted, is_sold, sold_to_order
3. **orders** — order_number, customer_name, customer_email, customer_phone, product_id, quantity, total_price, payment_status (pending/paid/failed/expired), payment_method, order_status (processing/completed/cancelled), notes
4. **Admin role** via user_roles table with RLS

## Pages

### Public Pages
1. **`/`** — Landing page: hero with gradient, fitur highlights, kategori grid, CTA
2. **`/products`** — Product listing with kategori filter tabs, search, grid of ProductCards
3. **`/products/:id`** — Detail produk: gambar, nama, kategori, rating, deskripsi, fitur list, stok badge, harga Rupiah, tombol Beli & Tambah Keranjang
4. **`/cart`** — Keranjang: list items dari Zustand store, ubah qty, hapus, total, tombol Checkout
5. **`/checkout`** — Form (nama, email, WA), submit → create order → mock payment → redirect success
6. **`/order/:orderNumber`** — Status order: nomor, status bayar, status kirim, detail produk
7. **`/order-success`** — Animasi checkmark, nomor order, tombol Cek Status & Belanja Lagi

### Admin Pages (protected, requires admin role)
8. **`/admin`** — Dashboard: total orders, revenue, produk count
9. **`/admin/products`** — CRUD produk (add/edit/delete), manage stok
10. **`/admin/orders`** — List orders, update status
11. **`/admin/credentials`** — Manage account credentials per produk

## Components
- **Navbar** — Logo, nav links (Beranda, Produk, Kategori), cart badge with count, cart drawer side panel
- **Footer** — Links, copyright
- **ProductCard** — Image/emoji fallback, name, category, rating stars, price, stock badge, favorite button
- **CartDrawer** — Slide-in panel showing cart items, total, checkout button
- **CheckoutForm** — Validated form (nama, email, WA number)

## State Management
- **Zustand** cart store: add, remove, update quantity, clear, persist to localStorage

## Auth & Admin
- Supabase Auth (email/password) for admin login
- user_roles table for admin role check
- Protected admin routes

## Payment Flow (Mock for now)
- Checkout creates order with status "pending"
- Mock payment simulation (tombol "Simulasi Bayar") updates to "paid"
- Placeholder for Xendit integration later (edge function ready)

## Fase Implementation Order
1. Database schema + seed sample products
2. Landing page + Navbar + Footer
3. Products listing + ProductCard + filter
4. Product detail page
5. Cart (Zustand store + cart page + drawer)
6. Checkout + Order creation
7. Order status + success page
8. Admin auth + admin panel (dashboard, products CRUD, orders, credentials)
