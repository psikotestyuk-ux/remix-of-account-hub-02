# Setup Email dengan Resend

Aplikasi ini menggunakan **Resend** untuk mengirim email transaksional (order confirmation, topup confirmation, order shipment, dll).

## 1. Get Resend API Key

1. Buka https://resend.com
2. Login/Sign up (pakai email project Anda)
3. Pergi ke **API Keys** → Copy API key
4. Simpan di tempat aman (jangan commit ke git!)

## 2. Konfigurasi Supabase Edge Functions

### A. Set Environment Variable di Supabase

1. Buka **Supabase Dashboard** → Project `jkfyrdqhuwudegxjapqi`
2. Pergi ke **Settings** → **Edge Functions** (atau **Secrets** jika ada)
3. Tambah secret baru:
   - **Name**: `RESEND_API_KEY`
   - **Value**: `<paste-resend-api-key-dari-step-1>`
4. Save

### B. Verify Sender Email di Resend

Sebelum bisa kirim email, domain/email sender harus verified di Resend:

1. Di Resend Dashboard → **Domains**
2. Pilih cara verify:
   - **Option A (Recommended)**: Verify domain (setup DNS records, lebih professional)
   - **Option B**: Verify email (kirim link verify ke email, lebih cepat untuk testing)

3. Setelah verified, gunakan email tersebut sebagai sender di `supabase/functions/send-email/index.ts`:

```typescript
// Ganti line ini:
from: "noreply@buyingaccount.local",

// Dengan email yang sudah verified:
from: "noreply@yourdomain.com", // atau "youremail@gmail.com" jika pakai Option B
```

## 3. Testing Lokal

### Setup Email Testing (Resend Console)

Resend memiliki feature testing tanpa khawatir email benar-benar terkirim:

1. Di Resend Dashboard → **Testing** section
2. Atau gunakan **inbox preview** untuk test emails

### Test di Aplikasi Lokal

```bash
# Terminal 1: Start development server
npm run dev

# Terminal 2: Start Supabase local (optional, jika pakai local Supabase)
supabase start
```

**Test Scenarios:**

1. **Topup Email**:
   - Login ke app
   - Pergi ke `/topup`
   - Input nominal, klik "Top Up"
   - Cek email (atau Resend Testing console)

2. **Order Confirmation Email**:
   - Login ke app
   - Pergi ke `/products` → pilih product
   - Klik "Add to Cart" → pergi ke `/checkout`
   - Pilih grade & package → klik "Beli"
   - Email confirmation harusnya terkirim

3. **Order Shipment Email** (admin):
   - Login dengan admin account ke `/admin/login`
   - Pergi ke `/admin/orders`
   - Cari order dengan payment_status = "paid"
   - Klik "Kirim Manual" → input notes → klik "Kirim & Simpan Catatan"
   - Email shipment harusnya terkirim ke customer

### Troubleshooting

**Email tidak terkirim:**
- Cek console (browser DevTools) untuk error messages
- Cek Supabase function logs: Dashboard → Functions → `send-email` → Logs
- Pastikan `RESEND_API_KEY` sudah di-set di Supabase
- Pastikan sender email sudah di-verify di Resend

**Email masuk spam:**
- SPF/DKIM records belum di-setup (jika pakai custom domain)
- Gunakan verified email dari Resend terlebih dahulu
- Setelah domain verified, email reputation akan lebih bagus

## 4. Deploy ke Vercel (Production)

### Step 1: Push ke GitHub
```bash
git add .
git commit -m "Setup Resend email system"
git push origin main
```

### Step 2: Setup Vercel Environment Variables

Vercel akan otomatis deploy aplikasi ketika ada push ke `main` branch.

Untuk edge functions, perlu setup di Vercel:

1. Buka **Vercel Dashboard** → Project Settings
2. Pergi ke **Environment Variables**
3. Tambah:
   - **Name**: `RESEND_API_KEY`
   - **Value**: `<your-resend-api-key>`
   - **Environments**: Production, Preview, Development (centang semua)
4. Save

### Step 3: Deploy Supabase Functions ke Production

Edge functions `send-email` harus di-deploy ke production Supabase:

```bash
# Login ke Supabase CLI
supabase login

# Deploy functions ke production
supabase functions deploy send-email --project-ref jkfyrdqhuwudegxjapqi
```

### Step 4: Verify Production

1. Buka app di `https://yourdomain.com` (production URL)
2. Test topup/order flow
3. Verify email terkirim ke real email address

## 5. Monitoring & Debugging

### Check Email Logs di Resend
1. Resend Dashboard → **Activity**
2. Lihat history email yang terkirim/failed
3. Click email untuk lihat detail (body, headers, timestamps, dll)

### Check Function Logs di Supabase
1. Dashboard → **Functions** → `send-email`
2. Lihat logs real-time ketika email function dipanggil
3. Lihat error trace jika ada failure

### Email Templates

Semua template email di-define di `supabase/functions/send-email/index.ts` dalam `renderTemplate` function.

Untuk update template:

```typescript
const templates: Record<string, (data: Record<string, any>) => string> = {
  "topup-confirmation": (data) => `<h1>Custom HTML template</h1>...`,
  "order-confirmation": (data) => `...`,
  "order-shipped": (data) => `...`,
};
```

Setelah update, push ke GitHub (Vercel otomatis re-deploy) atau run `supabase functions deploy`.

## 6. Email Events

Aplikasi saat ini mengirim email di:

| Event | File | Trigger |
|-------|------|---------|
| Topup Confirmation | `src/pages/TopUp.tsx` | Setelah `topup_wallet` RPC berhasil |
| Order Confirmation | `src/pages/Checkout.tsx` | Setelah `purchase_with_wallet` RPC berhasil |
| Order Shipped | `src/pages/admin/AdminOrders.tsx` | Admin klik "Kirim & Simpan Catatan" |
| Email Verification* | Supabase Built-in | Automatic via Supabase Auth |
| Password Reset* | Supabase Built-in | User klik "Lupa Password" |

*Untuk email verification & password reset, Supabase auth sudah handle sendiri (tidak perlu Resend config khusus).

## Troubleshooting Google OAuth (Future)

Saat ini Google OAuth di-skip (perlu domain resmi). Untuk enable nanti:

1. Setup Google Cloud Project
2. Get OAuth Client ID & Secret
3. Di Supabase Dashboard → Authentication → Google → Enable & input credentials
4. Update redirect URI di app (Supabase akan berikan URL yang tepat)

## FAQ

**Q: Berapa cost Resend?**
A: Free tier: 100 emails/day. Production tier: $0.20 per 1000 emails + minimal $20/bulan.

**Q: Bisa pakai SMTP di Supabase auth langsung?**
A: Bisa, tapi Resend lebih reliable dan mudah untuk transactional emails.

**Q: Email test tidak terkirim, bagaimana?**
A: 
- Pastikan development mode di Resend ON (Testing tab)
- Cek function logs di Supabase
- Pastikan API key benar

**Q: Bagaimana kalau ingin custom email template (HTML/CSS)?**
A: Edit di `supabase/functions/send-email/index.ts` → `renderTemplate` function. Bisa tambah CSS dalam `<style>` tag.

---

**Next Steps:**
1. ✅ Get Resend API key
2. ✅ Set `RESEND_API_KEY` di Supabase
3. ✅ Verify sender email di Resend
4. ✅ Test lokal
5. ✅ Deploy ke Vercel (automatic)
6. ✅ Deploy edge functions: `supabase functions deploy send-email`
7. ✅ Test production flow
