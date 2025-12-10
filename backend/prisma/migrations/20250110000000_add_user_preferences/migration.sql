-- AlterTable: Adicionar campos de preferências do usuário
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "notificationsEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "locationEnabled" BOOLEAN NOT NULL DEFAULT true;

