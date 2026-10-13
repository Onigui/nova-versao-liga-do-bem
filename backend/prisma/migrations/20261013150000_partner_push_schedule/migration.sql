-- Notificação paga com horário marcado (uma empresa por horário). O código também cria sozinho.
ALTER TABLE partner_push_campaigns ADD COLUMN IF NOT EXISTS "scheduledFor" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS partner_push_campaigns_sched_idx ON partner_push_campaigns("scheduledFor");
