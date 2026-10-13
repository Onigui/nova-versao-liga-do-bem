-- Tipos de promoção (% OFF, R$ OFF, preço final, outro benefício) e tentativa de geolocalização.
-- O código também cria estas colunas sozinho (ensurePartnerPortalSchema).
ALTER TABLE partner_discounts ADD COLUMN IF NOT EXISTS kind TEXT;
ALTER TABLE partner_discounts ADD COLUMN IF NOT EXISTS "promoPrice" DECIMAL(10,2);
ALTER TABLE partner_discounts ADD COLUMN IF NOT EXISTS "originalPrice" DECIMAL(10,2);
ALTER TABLE partner_discounts ADD COLUMN IF NOT EXISTS "benefitText" TEXT;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS "geocodeTriedAt" TIMESTAMP(3);
