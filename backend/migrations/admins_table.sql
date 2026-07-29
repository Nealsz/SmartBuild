-- ============================================================
-- SmartBuild Admin — admins table migration & setup
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Ensure table exists with expected schema
CREATE TABLE IF NOT EXISTS admins (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  username   text        UNIQUE NOT NULL,
  password   text        NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 2. Configure Row Level Security (RLS) policies for API access
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow full access on admins" ON admins;
CREATE POLICY "Allow full access on admins"
  ON admins
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 3. Insert or update the admin account: Kasukana
INSERT INTO admins (username, password)
VALUES (
  'Kasukana',
  '$2b$12$xJfuDAx4D3QKQN81p.foped.pWlZTC7iXMgn6XwD/ei/HymBAb1ii'
)
ON CONFLICT (username) DO UPDATE
SET password = EXCLUDED.password;
