-- Migration: Create ultra_ai_email_pool table for Flow Account Management
-- Date: 2025-01-XX
-- Description: Create table to store Google Flow account credentials (email, password, code, user count)

-- Create the ultra_ai_email_pool table
CREATE TABLE IF NOT EXISTS public.ultra_ai_email_pool (
    id BIGSERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    current_users_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on code for faster lookups
CREATE INDEX IF NOT EXISTS idx_ultra_ai_email_pool_code ON public.ultra_ai_email_pool(code);

-- Create index on status for filtering active accounts
CREATE INDEX IF NOT EXISTS idx_ultra_ai_email_pool_status ON public.ultra_ai_email_pool(status);

-- Create index on current_users_count for finding available accounts
CREATE INDEX IF NOT EXISTS idx_ultra_ai_email_pool_user_count ON public.ultra_ai_email_pool(current_users_count) WHERE status = 'active';

-- Create index on email for faster email lookups
CREATE INDEX IF NOT EXISTS idx_ultra_ai_email_pool_email ON public.ultra_ai_email_pool(email);

-- Add comments to the table and columns
COMMENT ON TABLE public.ultra_ai_email_pool IS 'Stores Google Flow account credentials for user assignment';
COMMENT ON COLUMN public.ultra_ai_email_pool.id IS 'Primary key, auto-incrementing';
COMMENT ON COLUMN public.ultra_ai_email_pool.email IS 'Google Flow account email address';
COMMENT ON COLUMN public.ultra_ai_email_pool.password IS 'Google Flow account password';
COMMENT ON COLUMN public.ultra_ai_email_pool.code IS 'Account code (E1, E2, E3, etc.) - unique identifier';
COMMENT ON COLUMN public.ultra_ai_email_pool.current_users_count IS 'Number of users currently assigned to this account (max 10)';
COMMENT ON COLUMN public.ultra_ai_email_pool.status IS 'Account status: active or inactive';
COMMENT ON COLUMN public.ultra_ai_email_pool.created_at IS 'Timestamp when the account was created';
COMMENT ON COLUMN public.ultra_ai_email_pool.updated_at IS 'Timestamp when the account was last updated';

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at on row update
DROP TRIGGER IF EXISTS update_ultra_ai_email_pool_updated_at ON public.ultra_ai_email_pool;
CREATE TRIGGER update_ultra_ai_email_pool_updated_at
    BEFORE UPDATE ON public.ultra_ai_email_pool
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS) if needed
ALTER TABLE public.ultra_ai_email_pool ENABLE ROW LEVEL SECURITY;

-- Note: RLS policies should be configured based on your authentication setup
-- For now, we'll create policies that allow service role (used by Supabase client with anon key)
-- and allow admin users to manage flow accounts

-- Policy 1: Allow service role to do everything (for API operations)
CREATE POLICY "Allow service role full access to flow accounts"
    ON public.ultra_ai_email_pool
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Policy 2: Allow authenticated users to read flow accounts (for viewing)
CREATE POLICY "Allow authenticated users to read flow accounts"
    ON public.ultra_ai_email_pool
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Policy 3: Allow admin users to manage flow accounts
-- This checks if the user is an admin in the users table
CREATE POLICY "Allow admin users to manage flow accounts"
    ON public.ultra_ai_email_pool
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id::text = auth.uid()::text
            AND (users.role = 'admin' OR users.status = 'admin' OR users.status = 'lifetime')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id::text = auth.uid()::text
            AND (users.role = 'admin' OR users.status = 'admin' OR users.status = 'lifetime')
        )
    );

-- Note: If you're using Supabase client with anon key (not service role),
-- you may need to disable RLS or adjust policies based on your setup.
-- To disable RLS temporarily for testing, run:
-- ALTER TABLE public.ultra_ai_email_pool DISABLE ROW LEVEL SECURITY;

-- Verify the table was created
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'ultra_ai_email_pool'
ORDER BY ordinal_position;
