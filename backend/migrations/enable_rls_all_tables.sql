-- ============================================================
-- SmartBuild — Enable RLS and CRUD Policies for All Tables
-- Run this script in your Supabase SQL Editor
-- ============================================================

-- 1. admins
ALTER TABLE IF EXISTS "admins" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow CRUD on admins" ON "admins";
CREATE POLICY "Allow CRUD on admins" ON "admins" FOR ALL USING (true) WITH CHECK (true);

-- 2. CPU
ALTER TABLE IF EXISTS "CPU" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow CRUD on CPU" ON "CPU";
CREATE POLICY "Allow CRUD on CPU" ON "CPU" FOR ALL USING (true) WITH CHECK (true);

-- 3. GPU
ALTER TABLE IF EXISTS "GPU" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow CRUD on GPU" ON "GPU";
CREATE POLICY "Allow CRUD on GPU" ON "GPU" FOR ALL USING (true) WITH CHECK (true);

-- 4. RAM
ALTER TABLE IF EXISTS "RAM" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow CRUD on RAM" ON "RAM";
CREATE POLICY "Allow CRUD on RAM" ON "RAM" FOR ALL USING (true) WITH CHECK (true);

-- 5. Storage
ALTER TABLE IF EXISTS "Storage" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow CRUD on Storage" ON "Storage";
CREATE POLICY "Allow CRUD on Storage" ON "Storage" FOR ALL USING (true) WITH CHECK (true);

-- 6. Motherboard
ALTER TABLE IF EXISTS "Motherboard" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow CRUD on Motherboard" ON "Motherboard";
CREATE POLICY "Allow CRUD on Motherboard" ON "Motherboard" FOR ALL USING (true) WITH CHECK (true);

-- 7. PSU
ALTER TABLE IF EXISTS "PSU" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow CRUD on PSU" ON "PSU";
CREATE POLICY "Allow CRUD on PSU" ON "PSU" FOR ALL USING (true) WITH CHECK (true);

-- 8. Case
ALTER TABLE IF EXISTS "Case" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow CRUD on Case" ON "Case";
CREATE POLICY "Allow CRUD on Case" ON "Case" FOR ALL USING (true) WITH CHECK (true);

-- 9. CPU Cooler
ALTER TABLE IF EXISTS "CPU Cooler" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow CRUD on CPU Cooler" ON "CPU Cooler";
CREATE POLICY "Allow CRUD on CPU Cooler" ON "CPU Cooler" FOR ALL USING (true) WITH CHECK (true);

-- 10. Case Fan
ALTER TABLE IF EXISTS "Case Fan" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow CRUD on Case Fan" ON "Case Fan";
CREATE POLICY "Allow CRUD on Case Fan" ON "Case Fan" FOR ALL USING (true) WITH CHECK (true);
