-- Membership plans + PagBank payment fields
-- Apply on Supabase/Postgres

CREATE TABLE IF NOT EXISTS subscription_plans (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  months INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

ALTER TABLE memberships ADD COLUMN IF NOT EXISTS "planCode" TEXT;
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS "planMonths" INTEGER;
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS "lastPaymentId" TEXT;

ALTER TABLE payments ADD COLUMN IF NOT EXISTS "membershipId" TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS method TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS "pixCopyPaste" TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS "boletoUrl" TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS "boletoBarcode" TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS "planCode" TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS "planMonths" INTEGER;

CREATE INDEX IF NOT EXISTS payments_gatewayId_idx ON payments ("gatewayId");
CREATE INDEX IF NOT EXISTS payments_membershipId_idx ON payments ("membershipId");

INSERT INTO subscription_plans (id, code, name, description, months, amount_cents, "isActive", "order", "createdAt", "updatedAt")
VALUES
  ('plan_monthly', 'MONTHLY', 'Mensal', 'Assinatura mensal da Liga do Bem', 1, 1990, true, 1, NOW(), NOW()),
  ('plan_quarterly', 'QUARTERLY', 'Trimestral', '3 meses com desconto mínimo', 3, 5490, true, 2, NOW(), NOW()),
  ('plan_semiannual', 'SEMIANNUAL', 'Semestral', '6 meses com desconto mínimo', 6, 10990, true, 3, NOW(), NOW()),
  ('plan_annual', 'ANNUAL', 'Anual', '12 meses com desconto mínimo', 12, 21990, true, 4, NOW(), NOW())
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  months = EXCLUDED.months,
  amount_cents = EXCLUDED.amount_cents,
  "isActive" = true,
  "order" = EXCLUDED."order",
  "updatedAt" = NOW();
