-- Portal do parceiro: acessos ligados à empresa, rastreio das validações e promoções arquiváveis.
-- (O backend também aplica isto sozinho em ensurePartnerPortalSchema; tudo é idempotente.)
CREATE TABLE IF NOT EXISTS partner_accounts (
  id TEXT PRIMARY KEY,
  "partnerId" TEXT NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  "userId" TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'OWNER' CHECK (role IN ('OWNER','STAFF')),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS partner_accounts_partner_idx ON partner_accounts("partnerId");

CREATE TABLE IF NOT EXISTS partner_lookup_attempts (
  id TEXT PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  method TEXT NOT NULL,
  ok BOOLEAN NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS partner_lookup_attempts_idx ON partner_lookup_attempts("accountId", "createdAt");

ALTER TABLE partner_validations ADD COLUMN IF NOT EXISTS "validatedById" TEXT;
ALTER TABLE partner_validations ADD COLUMN IF NOT EXISTS method TEXT;
ALTER TABLE partner_validations ADD COLUMN IF NOT EXISTS "memberId" TEXT;
ALTER TABLE partner_validations ADD COLUMN IF NOT EXISTS "membershipActive" BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS partner_validations_partner_idx ON partner_validations("partnerId", "validatedAt");

ALTER TABLE partner_discounts ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
ALTER TABLE partner_discounts ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3);
