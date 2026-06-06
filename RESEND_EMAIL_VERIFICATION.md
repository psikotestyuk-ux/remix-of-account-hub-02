# Verify Sender Email di Resend

Sebelum bisa kirim email via Resend, **sender email harus di-verify**.

## Pilihan Verifikasi

### ✅ Opsi 1: Verify Email (Cepat, untuk Testing)
**Waktu**: ~1 menit  
**Cara**: Klik link di email

**Steps:**
1. Buka https://resend.com/dashboard
2. Login dengan akun Anda
3. Pergi ke **Domains** atau **Email** section
4. Click **Add Email** atau **+ New Email**
5. Masukkan email: `noreply@buyingaccount.local` (atau email apapun)
6. Resend akan kirim email verification link
7. Buka email, click link untuk verify
8. ✅ Email sudah verified, bisa dipakai sebagai sender

**Gunakan email ini di function:**
```typescript
// Update di supabase/functions/send-email/index.ts
from: "noreply@buyingaccount.local", // atau email yang di-verify
```

### 🚀 Opsi 2: Verify Domain (Professional, untuk Production)
**Waktu**: ~10 menit  
**Cara**: Setup DNS records (lebih kompleks tapi lebih professional)

**Steps:**
1. Di Resend Dashboard → **Domains**
2. Click **+ Add Domain**
3. Masukkan domain (e.g., `buyingaccount.local` atau custom domain)
4. Resend akan kasih DNS records (CNAME, MX, TXT)
5. Setup records di registrar domain Anda
6. Resend akan verify otomatis setelah DNS propagate
7. ✅ Domain verified

**Keuntungan Domain Verification:**
- Email from `noreply@yourdomain.com` (lebih professional)
- Better deliverability (tidak masuk spam)
- SPF/DKIM setup lebih baik
- Receiver percaya lebih ke domain Anda

---

## For Now: Gunakan Opsi 1 (Cepat)

Untuk testing lokal & awal production, gunakan **Email Verification** (Opsi 1):

1. Verify email di Resend (any email)
2. Update `supabase/functions/send-email/index.ts` dengan email yang verified
3. Test flow lokal
4. Production deploy

---

## Update Code dengan Sender Email

Setelah email di-verify, update function:

**File:** `supabase/functions/send-email/index.ts`

```typescript
// Cari line ini (around line 48):
from: "noreply@buyingaccount.local",

// Ganti dengan email yang sudah di-verify di Resend:
from: "noreply@yourdomain.com", // atau "yourname@gmail.com" if verified
```

Setelah update, push ke GitHub (Vercel auto-redeploy) atau run:
```bash
supabase functions deploy send-email --project-ref jkfyrdqhuwudegxjapqi
```

---

## Troubleshooting

**Error: "invalid_from_address" atau "not verified"**
- Pastikan email sudah di-verify di Resend dashboard
- Pastikan di-verify dengan account/API key yang sama

**Email masuk spam:**
- Gunakan domain verification (Opsi 2) untuk better reputation
- Pastikan SPF/DKIM correct jika pakai domain

**Mana email yang sudah verified di Resend?**
1. Dashboard → **Domains** atau **Email** section
2. Lihat list yang sudah "verified" (ada checkmark)

---

## Next: Test Lokal

Setelah email verified dan code updated:

```bash
npm run dev
# Test di http://localhost:8080
# Try topup → check email / Resend testing console
```

