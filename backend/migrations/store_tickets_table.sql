-- ============================================================
-- SmartBuild — store_tickets table migration
-- Run this in your Supabase SQL Editor
-- ============================================================
-- Supports SDG 12 Responsible Consumption (Hardware Upcycling):
-- `build_data` jsonb stores both store components (with inventory id and price)
-- and customer-reused components (with `id: null`, `price: 0`, and `is_user_provided: true`).
-- When tickets transition status, stock deduction ignores customer-provided components.


CREATE TABLE IF NOT EXISTS store_tickets (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_code         text        UNIQUE NOT NULL,
  total_price         numeric     NOT NULL,
  build_data          jsonb       NOT NULL,
  status              text        NOT NULL DEFAULT 'Pending',
  is_stock_deducted   boolean     NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  expires_at          timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Configure Row Level Security (RLS) policies
ALTER TABLE store_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow full access on store_tickets" ON store_tickets;
CREATE POLICY "Allow full access on store_tickets"
  ON store_tickets
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Helpful indexes for rapid query and expiry lookups
CREATE INDEX IF NOT EXISTS idx_store_tickets_code ON store_tickets(ticket_code);
CREATE INDEX IF NOT EXISTS idx_store_tickets_status ON store_tickets(status);
CREATE INDEX IF NOT EXISTS idx_store_tickets_expires_at ON store_tickets(expires_at);
