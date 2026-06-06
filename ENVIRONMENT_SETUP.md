# Environment Variables Setup Guide

Panduan lengkap dimana dan apa environment variables yang perlu di-set.

## 🗂️ Environment Variables di Berbagai Tempat

```
┌─────────────────────────────────────────────────────┐
│              ENVIRONMENT VARIABLES                   │
├─────────────────────────────────────────────────────┤
│                                                     │
│ 1. LOCAL DEVELOPMENT                                │
│    ↓                                                │
│    .env.local (di .gitignore, JANGAN commit)        │
│    ├── RESEND_API_KEY                              │
│    └── (Supabase vars auto from code)              │
│                                                     │
│ 2. SUPABASE EDGE FUNCTIONS (Server)                 │
│    ↓                                                │
│    Supabase Dashboard → Settings → Secrets          │
│    ├── RESEND_API_KEY ← diakses oleh edge functions │
│    └── (digunakan di: supabase/functions/*)        │
│                                                     │
│ 3. VERCEL PRODUCTION (Frontend + Deployment)       │
│    ↓                                                │
│    Vercel Dashboard → Settings → Environment Vars   │
│    ├── RESEND_API_KEY                              │
│    └── (auto redeploy when changed)                │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 📝 Checklist: Environment Variables di Setiap Tempat

### 1️⃣ LOCAL DEVELOPMENT (.env.local)

**File**: `.env.local` (di root project)

**Content:**
```env
VITE_SUPABASE_PROJECT_ID="jkfyrdqhuwudegxjapqi"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
VITE_SUPABASE_URL="https://jkfyrdqhuwudegxjapqi.supabase.co"
RESEND_API_KEY="re_8257M3WK_P2cHVDhGCWTP73cVYYtmbuGZ"
```

**Catatan:**
- ✅ `VITE_*` variables PUBLIC (aman di git, di-expose ke browser)
- ❌ `RESEND_API_KEY` PRIVATE (jangan commit!)
- File ini sudah di `.gitignore` via `*.local` rule
- Hanya untuk local `npm run dev`

---

### 2️⃣ SUPABASE SECRETS (Edge Functions)

**Location**: https://supabase.com/dashboard
→ Project: `jkfyrdqhuwudegxjapqi`
→ **Settings** → **Secrets** (atau Functions → Secrets)

**Variables yang perlu di-set:**

| Name | Value | Used By |
|------|-------|---------|
| `RESEND_API_KEY` | `re_8257M3WK_...` | `supabase/functions/send-email/` |

**How:**
1. Click **+ New Secret**
2. Name: `RESEND_API_KEY`
3. Value: `re_8257M3WK_P2cHVDhGCWTP73cVYYtmbuGZ`
4. Click **Save**

**Accessing in Edge Function:**
```typescript
// Di supabase/functions/send-email/index.ts
const resendApiKey = Deno.env.get("RESEND_API_KEY");
```

**Important:**
- ✅ Auto-available ke edge functions yang di-deploy
- ✅ Hidden dari git, aman
- ⚠️ Need to redeploy function setelah update secret

---

### 3️⃣ VERCEL PRODUCTION (Frontend)

**Location**: https://vercel.com/dashboard
→ Select project
→ **Settings** → **Environment Variables**

**Variables yang perlu di-set:**

| Name | Value | Environment |
|------|-------|-------------|
| `RESEND_API_KEY` | `re_8257M3WK_...` | Production, Preview, Development |

**How:**
1. Click **Add New**
2. Name: `RESEND_API_KEY`
3. Value: `re_8257M3WK_P2cHVDhGCWTP73cVYYtmbuGZ`
4. Environments: Check `Production`, `Preview`, `Development`
5. Click **Save**

**Catatan:**
- ✅ Auto-available ke deployed app & edge functions
- ✅ Vercel otomatis trigger redeploy saat ditambah
- ✅ Hidden dari public, secure
- Untuk **edge functions di Vercel**: Gunakan `process.env.RESEND_API_KEY` (atau bisa access via Supabase secrets juga)

---

## 🔄 Environment Variable Flow

### Lokal Development (npm run dev):
```
.env.local
    ↓
    ├→ Vite reads VITE_* variables → browser
    ├→ Supabase client reads VITE_SUPABASE_*
    └→ Local edge functions (jika run locally) read RESEND_API_KEY
```

### Supabase Edge Functions (Production):
```
Supabase Secrets (RESEND_API_KEY)
    ↓
    └→ supabase/functions/send-email/index.ts
       └→ Deno.env.get("RESEND_API_KEY")
```

### Vercel Production:
```
Vercel Environment Variables (RESEND_API_KEY)
    ↓
    ├→ deployed app (jika perlu)
    └→ Vercel Edge Functions (jika ada)
```

---

## ✅ Setup Checklist

- [ ] `.env.local` di local machine dengan RESEND_API_KEY
- [ ] `.env.local` di `.gitignore` (tidak di-commit)
- [ ] `.env.example` tersedia untuk referensi
- [ ] Supabase Secrets: `RESEND_API_KEY` di-set
- [ ] Vercel Environment Variables: `RESEND_API_KEY` di-set
- [ ] Edge function di-deploy: `supabase functions deploy send-email`
- [ ] Test lokal: `npm run dev` → trigger email → check apakah terkirim
- [ ] Test production: push ke main → Vercel auto-deploy → test flow

---

## 🔐 Security Best Practices

1. **Jangan commit .env.local**
   ```bash
   # .gitignore sudah punya *.local
   # Tapi selalu check: git status | grep .env.local
   # Should show "untracked" atau not listed, BUKAN "modified"
   ```

2. **API Keys jangan di-share di chat/public**
   - Jika share, segera **regenerate** di provider (Resend)
   - Update di semua tempat

3. **Rotate keys secara berkala**
   - Production: regenerate setiap 3-6 bulan
   - Development: regenerate setelah ada exposure

4. **Audit trail**
   - Check git history: `git log --all -- .env.local`
   - Should be empty (tidak ada .env.local di history)

---

## 🆘 Troubleshooting

| Issue | Solution |
|-------|----------|
| Edge function error "env var not found" | Supabase secret belum di-set atau belum di-redeploy |
| Lokal test email tidak terkirim | Check .env.local, pastikan RESEND_API_KEY ada |
| Production email tidak terkirim | Vercel env var belum di-set atau belum di-redeploy |
| "invalid API key" error | API key salah/expired, regenerate di Resend |

---

## 📋 Summary: Where Everything Goes

```
┌──────────────────────────────────┬──────────────────────────┐
│ Environment Variable             │ Where to Set             │
├──────────────────────────────────┼──────────────────────────┤
│ VITE_SUPABASE_PROJECT_ID        │ .env.local (PUBLIC OK)   │
│ VITE_SUPABASE_PUBLISHABLE_KEY   │ .env.local (PUBLIC OK)   │
│ VITE_SUPABASE_URL               │ .env.local (PUBLIC OK)   │
│ RESEND_API_KEY (for local dev)  │ .env.local (PRIVATE)     │
│ RESEND_API_KEY (Supabase)        │ Supabase Secrets         │
│ RESEND_API_KEY (Vercel/Prod)     │ Vercel Env Variables     │
└──────────────────────────────────┴──────────────────────────┘
```

---

## 🎯 Next: Start Setup

1. Create `.env.local` (copy dari `.env.example`)
2. Add `RESEND_API_KEY` ke `.env.local`
3. Set `RESEND_API_KEY` di Supabase Secrets
4. Set `RESEND_API_KEY` di Vercel Env Variables
5. Test lokal + production

Ready? Check `QUICK_START_EMAIL.md` untuk step-by-step! 🚀
