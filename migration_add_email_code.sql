-- Migration: Add email_code column to users table
-- Date: 2025-01-XX
-- Description: Add email_code column to track user email codes

-- Add email_code column to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS email_code TEXT NULL;

-- Add comment to the column
COMMENT ON COLUMN public.users.email_code IS 'Email code associated with the user account';

-- Create index for faster lookups (optional, if you need to search by email_code frequently)
CREATE INDEX IF NOT EXISTS idx_users_email_code ON public.users(email_code) WHERE email_code IS NOT NULL;

-- Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users'
  AND column_name = 'email_code';
