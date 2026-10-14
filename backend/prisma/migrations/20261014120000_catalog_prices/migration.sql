-- Catálogo padrão da Liga e tabela de preços dos parceiros (o código também cria e semeia sozinho).
CREATE TABLE IF NOT EXISTS catalog_items (
  id TEXT PRIMARY KEY, category TEXT NOT NULL, name TEXT NOT NULL, variant TEXT,
  species TEXT NOT NULL DEFAULT 'ALL', "partnerId" TEXT REFERENCES partners(id) ON DELETE CASCADE,
  "isActive" BOOLEAN NOT NULL DEFAULT true, "seedKey" TEXT UNIQUE, "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS catalog_items_cat_idx ON catalog_items(category);
CREATE INDEX IF NOT EXISTS catalog_items_partner_idx ON catalog_items("partnerId");
CREATE TABLE IF NOT EXISTS partner_prices (
  "partnerId" TEXT NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  "itemId" TEXT NOT NULL REFERENCES catalog_items(id) ON DELETE CASCADE,
  price DECIMAL(10,2), "memberPrice" DECIMAL(10,2) NOT NULL, available BOOLEAN NOT NULL DEFAULT true,
  note TEXT, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(), PRIMARY KEY ("partnerId", "itemId"));
CREATE INDEX IF NOT EXISTS partner_prices_item_idx ON partner_prices("itemId");
