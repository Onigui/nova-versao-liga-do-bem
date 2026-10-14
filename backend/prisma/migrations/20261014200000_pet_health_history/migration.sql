-- Histórico de saúde do pet (registros do veterinário e do tutor, foto anexa).
-- O módulo backend/api/lib/health.ts também cria estas tabelas sozinho.

CREATE TABLE IF NOT EXISTS pet_health_entries (
    id TEXT PRIMARY KEY,
    "petId" TEXT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    date TIMESTAMP(3) NOT NULL,
    title TEXT NOT NULL,
    details TEXT,
    guidance TEXT,
    weight DOUBLE PRECISION,
    "returnDate" TIMESTAMP(3),
    source TEXT NOT NULL CHECK (source IN ('TUTOR','VET')),
    "partnerId" TEXT,
    "accountId" TEXT,
    "authorUserId" TEXT,
    "vetName" TEXT,
    "vetCrmv" TEXT,
    "clinicName" TEXT,
    "visitId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
  );

CREATE INDEX IF NOT EXISTS pet_health_entries_pet_idx ON pet_health_entries("petId", date DESC);

CREATE TABLE IF NOT EXISTS pet_health_photos (
    "entryId" TEXT PRIMARY KEY REFERENCES pet_health_entries(id) ON DELETE CASCADE,
    mime TEXT NOT NULL,
    data BYTEA NOT NULL
  );
