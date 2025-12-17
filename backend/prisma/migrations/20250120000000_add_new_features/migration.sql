-- Migration: Adicionar tabelas para Help & Support, Pets, Vaccinations e App Versions
-- Data: 2025-01-20

-- Criar enum PetGender se não existir
DO $$ BEGIN
    CREATE TYPE "PetGender" AS ENUM ('MALE', 'FEMALE', 'UNKNOWN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Nota: VaccinationStatus não é usado no schema atual, mas mantemos o enum caso seja necessário no futuro

-- Criar tabela help_info
CREATE TABLE IF NOT EXISTS "help_info" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "items" JSONB NOT NULL DEFAULT '[]',
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "help_info_pkey" PRIMARY KEY ("id")
);

-- Criar índice único para category em help_info
CREATE UNIQUE INDEX IF NOT EXISTS "help_info_category_key" ON "help_info"("category");

-- Criar tabela pets
CREATE TABLE IF NOT EXISTS "pets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "species" TEXT NOT NULL,
    "breed" TEXT,
    "birthDate" TIMESTAMP(3),
    "photo" TEXT,
    "gender" TEXT,
    "color" TEXT,
    "weight" DOUBLE PRECISION,
    "microchip" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pets_pkey" PRIMARY KEY ("id")
);

-- Criar foreign key para pets.userId
DO $$ BEGIN
    ALTER TABLE "pets" ADD CONSTRAINT "pets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Criar tabela vaccinations
CREATE TABLE IF NOT EXISTS "vaccinations" (
    "id" TEXT NOT NULL,
    "petId" TEXT NOT NULL,
    "vaccineName" TEXT NOT NULL,
    "vaccineType" TEXT,
    "applicationDate" TIMESTAMP(3) NOT NULL,
    "nextDoseDate" TIMESTAMP(3),
    "batchNumber" TEXT,
    "veterinarian" TEXT,
    "veterinarianCRMV" TEXT,
    "clinicName" TEXT,
    "clinicId" TEXT,
    "notes" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vaccinations_pkey" PRIMARY KEY ("id")
);

-- Criar foreign key para vaccinations.petId
DO $$ BEGIN
    ALTER TABLE "vaccinations" ADD CONSTRAINT "vaccinations_petId_fkey" FOREIGN KEY ("petId") REFERENCES "pets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Criar tabela app_versions
CREATE TABLE IF NOT EXISTS "app_versions" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "versionCode" INTEGER NOT NULL,
    "minVersion" TEXT,
    "apkUrl" TEXT,
    "apkSize" INTEGER,
    "releaseNotes" TEXT,
    "isMandatory" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "platform" TEXT NOT NULL DEFAULT 'android',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_versions_pkey" PRIMARY KEY ("id")
);

-- Criar índices únicos para app_versions
CREATE UNIQUE INDEX IF NOT EXISTS "app_versions_version_key" ON "app_versions"("version");
CREATE UNIQUE INDEX IF NOT EXISTS "app_versions_versionCode_key" ON "app_versions"("versionCode");

