## Tombol WA + Form Garansi di Halaman Order

Menambahkan fitur pengaduan garansi via WhatsApp di halaman detail order. Customer isi form singkat → buka WhatsApp admin dengan template pesan otomatis terisi data order.

### Alur
1. Di `OrderDetail.tsx`, tambah card "Garansi & Bantuan" (muncul kalau `payment_status = paid`).
2. Tombol **"Ajukan Klaim Garansi"** → buka dialog form.
3. Form berisi:
   - Jenis masalah (select): Akun tidak bisa login / Password berubah / Akun ter-banned / Lainnya
   - Deskripsi masalah (textarea, max 500 char)
   - Upload bukti opsional (screenshot, ke Supabase Storage bucket `warranty-proofs`)
4. Tombol **"Kirim via WhatsApp"** → generate URL `https://wa.me/{nomor_admin}?text={template}` dan buka di tab baru.
5. Template pesan otomatis (Bahasa Indonesia):
   ```
   Halo Admin BuyingAccount, saya ingin ajukan klaim garansi:

   No. Order: #ORD-12345
   Produk: Netflix Premium
   Tanggal Order: 16 Mei 2026
   Email: customer@email.com

   Jenis Masalah: Akun tidak bisa login
   Deskripsi: [isi user]

   Bukti: [URL screenshot kalau ada]

   Mohon bantuannya, terima kasih.
   ```

### Tombol kontak umum
Tambah tombol kecil **"Hubungi Admin via WA"** (icon WhatsApp) di:
- `OrderDetail.tsx` (header) — untuk tanya order
- `Footer.tsx` — untuk pertanyaan umum

### Konfigurasi nomor admin
Nomor WA admin disimpan di tabel baru `app_settings` (key/value) supaya bisa diedit dari admin panel tanpa redeploy. Default: kosong (admin perlu set dulu).

Tambah halaman `/admin/settings` sederhana berisi:
- Input "Nomor WhatsApp Admin" (format: `628xxx`, tanpa `+`)
- Input "Jam Operasional" (opsional, ditampilkan di footer)

### File yang berubah
- **Baru**: `src/pages/admin/AdminSettings.tsx`, `src/components/WarrantyClaimDialog.tsx`, `src/components/WhatsAppButton.tsx`, `src/hooks/use-app-settings.tsx`
- **Edit**: `src/pages/OrderDetail.tsx`, `src/components/Footer.tsx`, `src/App.tsx` (route `/admin/settings`), `src/pages/admin/AdminLayout.tsx` (menu sidebar)

### Database
Tabel baru `app_settings` (key text PK, value text, updated_at). RLS: public read, admin write.

### Validasi (zod)
- `phone`: regex `^[0-9]{10,15}$`
- `description`: trim, 10–500 char
- `issue_type`: enum

### Catatan
- **Tidak** menyimpan klaim ke DB (sesuai pilihan opsi 2). Kalau nanti mau tracking klaim di admin panel, tinggal upgrade ke opsi 3.
- Encoding pesan pakai `encodeURIComponent` untuk mencegah injection di URL.
- Jika nomor admin belum di-set, tombol WA disembunyikan + tampilkan toast "Fitur belum aktif, hubungi admin".

Mohon konfirmasi nomor WA admin (atau saya skip dulu dan admin set sendiri dari `/admin/settings` setelah fitur deploy).