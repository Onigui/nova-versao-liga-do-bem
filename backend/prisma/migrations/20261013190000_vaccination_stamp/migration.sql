-- Carteira de vacinação carimbada (o código também cria tudo sozinho em ensurePetHealthSchema).
ALTER TABLE vaccinations ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'VACCINE';
ALTER TABLE vaccinations ADD COLUMN IF NOT EXISTS manufacturer TEXT;
ALTER TABLE vaccinations ADD COLUMN IF NOT EXISTS "petWeight" DOUBLE PRECISION;
ALTER TABLE vaccinations ADD COLUMN IF NOT EXISTS "stampedByAccountId" TEXT;
ALTER TABLE vaccinations ADD COLUMN IF NOT EXISTS "stampedByUserId" TEXT;
ALTER TABLE vaccinations ADD COLUMN IF NOT EXISTS "hasLabelPhoto" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE vaccinations ADD COLUMN IF NOT EXISTS "correctedAt" TIMESTAMP(3);
ALTER TABLE vaccinations ADD COLUMN IF NOT EXISTS "reminder7SentAt" TIMESTAMP(3);
ALTER TABLE vaccinations ADD COLUMN IF NOT EXISTS "reminderDueSentAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS vaccinations_next_dose_idx ON vaccinations("nextDoseDate");
CREATE INDEX IF NOT EXISTS vaccinations_clinic_idx ON vaccinations("clinicId", "verifiedAt");
ALTER TABLE pets ADD COLUMN IF NOT EXISTS "shareToken" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS pets_share_token_idx ON pets("shareToken");
CREATE TABLE IF NOT EXISTS vaccination_label_photos (
  "vaccinationId" TEXT PRIMARY KEY REFERENCES vaccinations(id) ON DELETE CASCADE,
  mime TEXT NOT NULL, data BYTEA NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS vaccination_audit (
  id TEXT PRIMARY KEY, "vaccinationId" TEXT NOT NULL, "petId" TEXT, action TEXT NOT NULL, "actorUserId" TEXT,
  "partnerId" TEXT, before JSONB, after JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS vaccination_audit_vacc_idx ON vaccination_audit("vaccinationId");
CREATE TABLE IF NOT EXISTS partner_vets (
  "accountId" TEXT PRIMARY KEY REFERENCES partner_accounts(id) ON DELETE CASCADE,
  "partnerId" TEXT NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  "fullName" TEXT NOT NULL, crmv TEXT NOT NULL, "crmvUf" TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  "reviewNote" TEXT, "reviewedAt" TIMESTAMP(3), "reviewedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS pet_visits (
  id TEXT PRIMARY KEY, "accountId" TEXT NOT NULL, "partnerId" TEXT NOT NULL, "petId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS pet_visits_account_idx ON pet_visits("accountId", "createdAt");
