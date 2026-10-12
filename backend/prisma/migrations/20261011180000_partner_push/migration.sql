-- Notificação paga do parceiro. (O backend também aplica isto sozinho em ensurePartnerPushSchema.)
ALTER TYPE "PaymentType" ADD VALUE IF NOT EXISTS 'PARTNER_PUSH';

CREATE TABLE IF NOT EXISTS partner_push_campaigns (
  id TEXT PRIMARY KEY,
  "partnerId" TEXT NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  "createdById" TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  "discountId" TEXT,
  "priceCents" INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'AWAITING_PAYMENT',
  "paymentId" TEXT,
  "paidAt" TIMESTAMP(3),
  "reviewedById" TEXT,
  "reviewNote" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  recipients INTEGER,
  "pushSuccess" INTEGER,
  "refundStatus" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS partner_push_campaigns_partner_idx ON partner_push_campaigns("partnerId", "createdAt");
CREATE INDEX IF NOT EXISTS partner_push_campaigns_status_idx ON partner_push_campaigns(status);
