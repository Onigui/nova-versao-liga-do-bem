-- AlterTable: Adicionar campo CPF único ao modelo User
-- Primeiro, adicionar a coluna como opcional
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "cpf" TEXT;

-- Criar índice único para CPF (apenas se não existir)
-- O índice único permite NULL, mas não permite valores duplicados
CREATE UNIQUE INDEX IF NOT EXISTS "users_cpf_key" ON "users"("cpf") WHERE "cpf" IS NOT NULL;

-- NOTA: CPF será obrigatório apenas para novos cadastros via aplicativo
-- Usuários existentes podem ter CPF NULL temporariamente

