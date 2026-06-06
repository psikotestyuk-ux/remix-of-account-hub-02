# Quick Start: Email Setup & Testing

Panduan cepat untuk setup Resend email dan test lokal dalam 15 menit.

## ✅ Checklist

- [x] API key dari Resend: `re_8257M3WK_P2cHVDhGCWTP73cVYYtmbuGZ`
- [x] `.env.local` sudah di-update dengan RESEND_API_KEY
- [ ] Email verified di Resend (choose one: `noreply@buyingaccount.local` atau email lain)
- [ ] Code updated dengan verified email
- [ ] Supabase secrets di-set
- [ ] Edge function di-deploy
- [ ] Test lokal berhasil
- [ ] Push ke production

---

## 🚀 Step-by-Step

### 1. Verify Sender Email di Resend (3 min)

1. Buka https://resend.com/dashboard
2. Login (gunakan akun yang make API key tadi)
3. Ke **Domains** → Click **+ Add Email** (atau **Add Domain**)
4. Pilih email untuk verify:
   - **Option A (recommended)**: `noreply@buyingaccount.local`
   - **Option B**: Existing email Anda (e.g., `yourname@gmail.com`)
5. Confirm email verification link
6. ✅ Email sudah verified

### 2. Update Code dengan Verified Email (1 min)

```bash
# Edit file:
nano supabase/functions/send-email/index.ts

# Cari line dengan "noreply@buyingaccount.local"
# Ganti dengan email yang di-verify di Resend
# Contoh:
from: "noreply@buyingaccount.local", // ganti jika perlu
```

Atau edit via text editor, cari line ~48:
```typescript
from: "noreply@buyingaccount.local", // <- update ke email verified
```

### 3. Set Secret di Supabase (2 min)

**Via Supabase Dashboard:**

1. Buka https://supabase.com/dashboard
2. Pilih project `jkfyrdqhuwudegxjapqi`
3. Ke **Settings** → **Secrets** (atau **Functions** → **Secrets**)
4. Click **+ New Secret** atau **Add Secret**
5. **Name**: `RESEND_API_KEY`
6. **Value**: `re_8257M3WK_P2cHVDhGCWTP73cVYYtmbuGZ`
7. Click **Save**
8. ✅ Secret saved

### 4. Deploy Edge Function (2 min)

```bash
# Terminal, di project root
supabase login  # jika belum login

supabase functions deploy send-email --project-ref jkfyrdqhuwudegxjapqi
```

Wait untuk complete. Output harusnya:
```
✓ Function(s) uploaded
✓ Deployed send-email
```

### 5. Test Lokal (5 min)

```bash
# Terminal 1: Start dev server
npm run dev

# Tunggu sampai:
# VITE v5.x.x ready in XXX ms
# ➜ Local: http://localhost:8080/
```

**Test di browser:**

#### Test 1: Topup Email
1. Buka http://localhost:8080
2. Login dengan akun test
3. Pergi ke `/topup`
4. Pilih nominal, click "Top Up"
5. Lihat success toast
6. **Check email masuk** (check inbox email yang di-verify di Resend, atau check Resend dashboard → Activity)

#### Test 2: Order Email  
1. Pergi ke `/products` → pilih produk
2. Click "Add to Cart" → `/checkout`
3. Pilih grade & package → click "Beli"
4. Lihat success toast
5. **Check email masuk**

#### Test 3: Shipment Email (Admin Only)
1. Login sebagai admin: `/admin/login`
2. Pergi ke `/admin/orders`
3. Cari order dengan `payment_status = "paid"`
4. Click **Kirim Manual** → input notes → click **Kirim & Simpan Catatan**
5. **Check email masuk** (email customer)

**Tidak ada email yang masuk?**
- Check browser console (DevTools) → ada error?
- Check Supabase function logs:
  - Dashboard → **Functions** → `send-email` → **Recent Invocations**
  - Lihat error trace
- Pastikan:
  - ✅ Email verified di Resend
  - ✅ RESEND_API_KEY di Supabase secrets
  - ✅ Function sudah di-deploy

### 6. Deploy ke Production (Automatic)

```bash
# Commit changes
git add .
git commit -m "Update Resend sender email configuration"
git push origin main
```

Vercel otomatis deploy. Tunggu ~2-5 menit.

**Setup Vercel Environment Variable:**
1. Buka https://vercel.com/dashboard
2. Pilih project
3. **Settings** → **Environment Variables**
4. Tambah:
   - **Name**: `RESEND_API_KEY`
   - **Value**: `re_8257M3WK_P2cHVDhGCWTP73cVYYtmbuGZ`
   - **Environments**: Production, Preview, Development
5. Click **Save**

**Deploy Function ke Production:**
```bash
supabase functions deploy send-email --project-ref jkfyrdqhuwudegxjapqi
```

### 7. Test Production (2 min)

1. Buka app di production URL
2. Repeat test scenarios (topup, order, shipment)
3. Check email masuk ke real inbox

---

## 🔧 Troubleshooting

| Problem | Solution |
|---------|----------|
| Email tidak terkirim | Check Supabase function logs |
| "invalid_from_address" | Email belum di-verify di Resend |
| Email masuk spam | Verify domain di Resend (bukan hanya email) |
| "RESEND_API_KEY not found" | Secret belum di-set di Supabase, atau function belum di-deploy ulang |
| Function error | Check Supabase logs untuk detail error |

---

## 📧 Email Address Reference

**Jika ingin change sender email:**

1. Edit `supabase/functions/send-email/index.ts` line ~48
2. Change `from:` value
3. Make sure email is verified di Resend
4. Redeploy: `supabase functions deploy send-email`

---

## 🎯 After Setup

Setelah semua working:

1. **Regenerate API Key di Resend** (karena sudah di-share)
   - Resend Dashboard → **API Keys** → Regenerate
   - Update di Supabase secrets
   - Update di Vercel environment variables

2. **Monitor email** via Resend Dashboard
   - See all sent emails
   - Check delivery status
   - View logs

3. **Add more email templates** as needed
   - Edit `supabase/functions/send-email/index.ts`
   - Add new template case
   - Call from anywhere: `supabase.functions.invoke("send-email", {...})`

---

## ❓ FAQ

**Q: Bagaimana email verification & password reset?**
A: Itu handled by Supabase auth built-in, tidak perlu Resend config.

**Q: Bisa test email tanpa kirim beneran?**
A: Ya, gunakan Resend Testing Console di dashboard (untuk development).

**Q: Berapa cost?**
A: Free tier 100 emails/hari. Production: $0.20 per 1000 + $20/bulan.

**Q: Email template bisa di-customize?**
A: Ya, edit HTML di `renderTemplate()` function di edge function.

---

## 📚 More Info

- Full setup: `RESEND_SETUP.md`
- Email verification: `RESEND_EMAIL_VERIFICATION.md`
- Supabase secrets: `SUPABASE_SECRETS_SETUP.md`

Done! Questions? Check the docs atau check Resend/Supabase logs. 🚀
