## Tujuan

Tambahkan sistem **Banner Promo** yang bisa diupload admin, dijadwalkan, diatur urutan & posisi, dan tampil di slot strategis. Klik banner = langsung ke produk terkait.

## Penempatan Slot

1. **Hero Homepage** (atas, carousel besar) — slot `home_hero`
2. **Halaman Produk** (strip di atas grid) — slot `products_top`
3. **Detail Produk** (banner kecil) — slot `product_detail`
4. **Cart & Checkout** (banner promo) — slot `cart_checkout`

## Database

Tabel baru `promo_banners`:
- `image_url` (storage Lovable Cloud)
- `title`, `subtitle` (opsional, untuk alt/aksesibilitas)
- `product_id` (FK ke produk → tujuan klik)
- `placement` (enum: home_hero, products_top, product_detail, cart_checkout)
- `display_order` (urutan)
- `starts_at`, `ends_at` (jadwal aktif)
- `is_active` (toggle manual)

Bucket storage baru `promo-banners` (public). RLS:
- Public: SELECT banner aktif (sesuai jadwal)
- Admin: full CRUD

## Komponen Frontend

`<PromoBannerSlot placement="..." />` — fetch banner aktif untuk slot tsb, render carousel/strip, klik = navigate ke `/product/:slug`. Otomatis hidden jika kosong.

Dipasang di:
- `src/pages/Index.tsx` (atas hero / dibawah hero)
- `src/pages/Products.tsx` (atas grid produk)
- `src/pages/ProductDetail.tsx`
- `src/pages/Cart.tsx` & `src/pages/Checkout.tsx`

## Admin Panel

Halaman baru `/admin/banners` (`AdminBanners.tsx`):
- List semua banner (preview gambar, status aktif/expired, slot, produk tujuan)
- Form: upload gambar, pilih produk, pilih slot, urutan, tanggal mulai/akhir, toggle aktif
- Aksi: edit, hapus, drag-to-reorder
- Link ditambahkan di `AdminLayout.tsx` sidebar

## File yang Dibuat / Diubah

**Baru**
- `supabase/migrations/<timestamp>_promo_banners.sql` — tabel, enum, RLS, bucket
- `src/components/PromoBannerSlot.tsx`
- `src/pages/admin/AdminBanners.tsx`

**Diedit**
- `src/pages/Index.tsx`, `Products.tsx`, `ProductDetail.tsx`, `Cart.tsx`, `Checkout.tsx` — pasang slot
- `src/pages/admin/AdminLayout.tsx` — menu Banner
- `src/App.tsx` — route admin baru

## Catatan

- Banner hanya tampil jika `is_active=true` AND `now()` di antara `starts_at`/`ends_at` (NULL = tidak dibatasi).
- Carousel pakai `embla-carousel-react` (sudah ada via shadcn).
- Tidak menyentuh sistem promo code (`promos`) yang sudah ada — ini fitur banner terpisah.