-- Orçamento em tempo real (lista do membro/veterinário, propostas às cegas, reservas).
-- O módulo backend/api/lib/quotes.ts também cria estas tabelas sozinho (ensureQuoteSchema).

CREATE TABLE IF NOT EXISTS quote_requests (
    id TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "petId" TEXT,
    "createdByPartnerId" TEXT,
    "createdByUserId" TEXT,
    species TEXT,
    "petWeight" DOUBLE PRECISION,
    district TEXT,
    city TEXT,
    notes TEXT,
    "hasPrescription" BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','CANCELLED','CLOSED')),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
  );

CREATE INDEX IF NOT EXISTS quote_requests_user_idx ON quote_requests("userId", "createdAt");

CREATE TABLE IF NOT EXISTS quote_request_items (
    id TEXT PRIMARY KEY,
    "requestId" TEXT NOT NULL REFERENCES quote_requests(id) ON DELETE CASCADE,
    "itemId" TEXT REFERENCES catalog_items(id) ON DELETE SET NULL,
    label TEXT NOT NULL,
    category TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    note TEXT,
    position INTEGER NOT NULL DEFAULT 0
  );

CREATE INDEX IF NOT EXISTS quote_request_items_req_idx ON quote_request_items("requestId");

CREATE TABLE IF NOT EXISTS quote_prescriptions (
    "requestId" TEXT PRIMARY KEY REFERENCES quote_requests(id) ON DELETE CASCADE,
    mime TEXT NOT NULL,
    data BYTEA NOT NULL
  );

CREATE TABLE IF NOT EXISTS quote_targets (
    "requestId" TEXT NOT NULL REFERENCES quote_requests(id) ON DELETE CASCADE,
    "partnerId" TEXT NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    "seenAt" TIMESTAMP(3),
    PRIMARY KEY ("requestId", "partnerId")
  );

CREATE INDEX IF NOT EXISTS quote_targets_partner_idx ON quote_targets("partnerId");

CREATE TABLE IF NOT EXISTS quote_responses (
    id TEXT PRIMARY KEY,
    "requestId" TEXT NOT NULL REFERENCES quote_requests(id) ON DELETE CASCADE,
    "partnerId" TEXT NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    "accountId" TEXT,
    note TEXT,
    "validUntil" TIMESTAMP(3) NOT NULL,
    status TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED','WITHDRAWN')),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    UNIQUE ("requestId", "partnerId")
  );

CREATE TABLE IF NOT EXISTS quote_response_lines (
    "responseId" TEXT NOT NULL REFERENCES quote_responses(id) ON DELETE CASCADE,
    "requestItemId" TEXT NOT NULL REFERENCES quote_request_items(id) ON DELETE CASCADE,
    "unitPrice" DECIMAL(10,2),
    available BOOLEAN NOT NULL DEFAULT true,
    note TEXT,
    PRIMARY KEY ("responseId", "requestItemId")
  );

CREATE TABLE IF NOT EXISTS quote_reservations (
    id TEXT PRIMARY KEY,
    "requestId" TEXT NOT NULL REFERENCES quote_requests(id) ON DELETE CASCADE,
    "partnerId" TEXT NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    "userId" TEXT NOT NULL,
    code TEXT NOT NULL,
    lines JSONB NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    "validUntil" TIMESTAMP(3),
    status TEXT NOT NULL DEFAULT 'RESERVED' CHECK (status IN ('RESERVED','DONE','CANCELLED')),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "doneAt" TIMESTAMP(3),
    UNIQUE ("requestId", "partnerId")
  );

CREATE INDEX IF NOT EXISTS quote_reservations_partner_idx ON quote_reservations("partnerId", "createdAt");
