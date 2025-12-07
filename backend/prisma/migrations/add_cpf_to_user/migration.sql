-- AlterTable: Adicionar campo CPF único ao modelo User
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "cpf" TEXT;

-- Criar índice único para CPF (apenas se não existir)
CREATE UNIQUE INDEX IF NOT EXISTS "users_cpf_key" ON "users"("cpf") WHERE "cpf" IS NOT NULL;

