-- Migration: Update users table structure
-- Date: 2025-01-XX
-- Description: Add email_code column and ensure all columns exist

-- ============================================
-- 1. Add email_code column if it doesn't exist
-- ============================================
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS email_code TEXT NULL;

-- Add comment to the column
COMMENT ON COLUMN public.users.email_code IS 'Email code associated with the user account';

-- ============================================
-- 2. Ensure all other columns exist
-- ============================================

-- Ensure batch_02 column exists
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS batch_02 TEXT NULL;

-- Ensure last_device column exists
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS last_device TEXT NULL;

-- Ensure telegram_id column exists
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS telegram_id TEXT NULL;

-- Ensure recaptcha_token column exists
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS recaptcha_token TEXT NULL;

-- Ensure personal_auth_token column exists
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS personal_auth_token TEXT NULL;

-- Ensure proxy_server column exists
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS proxy_server TEXT NULL;

-- Ensure app_version column exists
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS app_version TEXT NULL;

-- Ensure force_logout_at column exists
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS force_logout_at TIMESTAMPTZ NULL;

-- Ensure last_seen_at column exists
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NULL;

-- Ensure total_video column exists
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS total_video INTEGER NULL;

-- Ensure total_image column exists
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS total_image INTEGER NULL;

-- Ensure subscription_expiry column exists
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS subscription_expiry TIMESTAMPTZ NULL;

-- Ensure avatar_url column exists
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS avatar_url TEXT NULL;

-- Ensure api_key column exists
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS api_key TEXT NULL;

-- Ensure status column exists (with proper type)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'status'
    ) THEN
        ALTER TABLE public.users ADD COLUMN status TEXT NULL;
    END IF;
END $$;

-- Ensure role column exists (with proper type)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'role'
    ) THEN
        ALTER TABLE public.users ADD COLUMN role TEXT NULL;
    END IF;
END $$;

-- ============================================
-- 3. Create indexes for better performance
-- ============================================

-- Index for email_code (if you need to search by email_code)
CREATE INDEX IF NOT EXISTS idx_users_email_code ON public.users(email_code) WHERE email_code IS NOT NULL;

-- Index for last_seen_at (for active user queries)
CREATE INDEX IF NOT EXISTS idx_users_last_seen_at ON public.users(last_seen_at) WHERE last_seen_at IS NOT NULL;

-- Index for status (for filtering by status)
CREATE INDEX IF NOT EXISTS idx_users_status ON public.users(status) WHERE status IS NOT NULL;

-- Index for role (for filtering by role)
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role) WHERE role IS NOT NULL;

-- ============================================
-- 4. Verify the migration
-- ============================================

-- Check if email_code column exists
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users'
  AND column_name = 'email_code';

-- List all columns in users table
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users'
ORDER BY ordinal_position;
