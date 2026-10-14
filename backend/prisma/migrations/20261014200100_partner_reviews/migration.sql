-- Avaliações dos parceiros (só de quem foi atendido), denúncias e pedidos de avaliação.
-- O módulo backend/api/lib/reviews.ts também cria estas tabelas sozinho.

CREATE TABLE IF NOT EXISTS partner_reviews (
    id TEXT PRIMARY KEY,
    "partnerId" TEXT NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    tags TEXT[] NOT NULL DEFAULT '{}',
    source TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'VISIBLE' CHECK (status IN ('VISIBLE','HIDDEN')),
    "hiddenReason" TEXT,
    reply TEXT,
    "replyAt" TIMESTAMP(3),
    "replyByAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    UNIQUE ("partnerId", "userId")
  );

CREATE INDEX IF NOT EXISTS partner_reviews_partner_idx ON partner_reviews("partnerId", status, "createdAt" DESC);

CREATE TABLE IF NOT EXISTS partner_review_reports (
    id TEXT PRIMARY KEY,
    "reviewId" TEXT NOT NULL REFERENCES partner_reviews(id) ON DELETE CASCADE,
    "accountId" TEXT,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','RESOLVED')),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
  );

CREATE TABLE IF NOT EXISTS partner_review_prompts (
    "userId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "promptedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    PRIMARY KEY ("userId", "partnerId")
  );
