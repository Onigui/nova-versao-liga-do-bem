-- Idempotência da ativação de assinatura: cada pagamento credita meses no máximo uma vez.
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "membershipAppliedAt" TIMESTAMP(3);

-- Pagamentos de assinatura já aprovados antes desta migration contam como creditados,
-- para que um webhook reenviado não credite os meses de novo.
UPDATE "payments"
SET "membershipAppliedAt" = COALESCE("paidAt", "updatedAt")
WHERE type = 'MEMBERSHIP' AND status = 'APPROVED' AND "membershipAppliedAt" IS NULL;
