
ALTER TABLE public.account_credentials
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS password text,
  ADD COLUMN IF NOT EXISTS twofa_secret text,
  ADD COLUMN IF NOT EXISTS recovery_email text,
  ADD COLUMN IF NOT EXISTS cookies text,
  ADD COLUMN IF NOT EXISTS notes text;

-- credentials_encrypted jadi opsional (fallback untuk data lama)
ALTER TABLE public.account_credentials
  ALTER COLUMN credentials_encrypted DROP NOT NULL;
