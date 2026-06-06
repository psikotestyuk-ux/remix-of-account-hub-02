# Setup Supabase Secrets untuk Resend API Key

## Step 1: Buka Supabase Dashboard
1. Pergi ke https://supabase.com/dashboard
2. Pilih project `jkfyrdqhuwudegxjapqi`
3. Dari sidebar, cari **Settings** → **Secrets** (atau **Functions** → **Secrets**)

## Step 2: Tambah Secret Baru

Lokasi bisa berbeda tergantung versi Supabase:

### Opsi A: Via Settings → Secrets
1. Click **+ New Secret**
2. Name: `RESEND_API_KEY`
3. Value: `re_8257M3WK_P2cHVDhGCWTP73cVYYtmbuGZ`
4. Click **Save Secret**

### Opsi B: Via Functions Dashboard
1. Buka **Edge Functions** dari sidebar
2. Click `send-email` function
3. Lihat "Secrets" section
4. Click **Add Secret** / **+ New Secret**
5. Name: `RESEND_API_KEY`
6. Value: `re_8257M3WK_P2cHVDhGCWTP73cVYYtmbuGZ`

## Step 3: Verify - Secret Sudah Set?

Setelah save, secret akan terlihat di list (tapi value hidden untuk security).

Jika sudah ada, maka edge function `send-email` bisa akses `Deno.env.get("RESEND_API_KEY")` dan akan dapat value dari secret yang baru di-set.

## Step 4: Deploy Edge Function

Setelah secret tersave, deploy function ke production:

```bash
# Login ke Supabase CLI (jika belum)
supabase login

# Deploy send-email function
supabase functions deploy send-email --project-ref jkfyrdqhuwudegxjapqi
```

Sekarang edge function akan bisa akses RESEND_API_KEY dari secrets.

## Troubleshooting

**Secret tidak bisa di-akses di function:**
- Pastikan nama secret EXACT sama: `RESEND_API_KEY` (case-sensitive)
- Redeploy function setelah set secret
- Check function logs untuk error details

**Di mana lihat logs?**
- Dashboard → **Functions** → Click `send-email` → Scroll ke **Recent Invocations**
- Lihat output/errors dari function execution

