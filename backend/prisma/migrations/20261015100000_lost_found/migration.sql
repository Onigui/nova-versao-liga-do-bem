-- Achados e perdidos: avisos com foto e local, alertas por perto, denúncias.
-- O módulo backend/api/lib/lostfound.ts também cria estas tabelas sozinho.

CREATE TABLE IF NOT EXISTS lf_reports (
    id TEXT PRIMARY KEY,
    "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('LOST','FOUND','SIGHTED')),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','RESOLVED','EXPIRED','REMOVED')),
    hidden BOOLEAN NOT NULL DEFAULT false,
    "hiddenReason" TEXT,
    species TEXT NOT NULL,
    "petName" TEXT,
    sex TEXT,
    size TEXT,
    colors TEXT,
    breed TEXT,
    "hasCollar" BOOLEAN,
    description TEXT,
    "currentlyWith" TEXT,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    "publicLat" DOUBLE PRECISION NOT NULL,
    "publicLng" DOUBLE PRECISION NOT NULL,
    "approximate" BOOLEAN NOT NULL DEFAULT false,
    "locationNote" TEXT,
    district TEXT,
    city TEXT,
    "happenedAt" TIMESTAMP(3) NOT NULL,
    whatsapp TEXT,
    "petId" TEXT,
    photos INTEGER NOT NULL DEFAULT 0,
    views INTEGER NOT NULL DEFAULT 0,
    "resolvedAt" TIMESTAMP(3),
    "resolvedNote" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
  );

CREATE INDEX IF NOT EXISTS lf_reports_active_idx ON lf_reports(status, hidden, "createdAt" DESC);

CREATE INDEX IF NOT EXISTS lf_reports_geo_idx ON lf_reports("publicLat", "publicLng");

CREATE INDEX IF NOT EXISTS lf_reports_user_idx ON lf_reports("userId", "createdAt" DESC);

CREATE TABLE IF NOT EXISTS lf_photos (
    "reportId" TEXT NOT NULL REFERENCES lf_reports(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    mime TEXT NOT NULL,
    data BYTEA NOT NULL,
    PRIMARY KEY ("reportId", position)
  );

CREATE TABLE IF NOT EXISTS lf_alert_prefs (
    "userId" TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT true,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    "radiusKm" INTEGER NOT NULL DEFAULT 3,
    species TEXT NOT NULL DEFAULT 'ALL',
    "notifyFound" BOOLEAN NOT NULL DEFAULT true,
    "notifyLost" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
  );

CREATE TABLE IF NOT EXISTS lf_alerts_sent (
    "reportId" TEXT NOT NULL REFERENCES lf_reports(id) ON DELETE CASCADE,
    "userId" TEXT NOT NULL,
    reason TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    PRIMARY KEY ("reportId", "userId")
  );

CREATE TABLE IF NOT EXISTS lf_flags (
    "reportId" TEXT NOT NULL REFERENCES lf_reports(id) ON DELETE CASCADE,
    "userId" TEXT NOT NULL,
    reason TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
    PRIMARY KEY ("reportId", "userId")
  );
