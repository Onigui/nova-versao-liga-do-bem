-- Um canal de atualização por "platform": android (app do membro) e android-partner (App Parceiros).
-- Versão e versionCode passam a ser únicos por canal. (O backend também aplica isto na publicação.)
ALTER TABLE app_versions DROP CONSTRAINT IF EXISTS "app_versions_version_key";
ALTER TABLE app_versions DROP CONSTRAINT IF EXISTS "app_versions_versionCode_key";
DROP INDEX IF EXISTS "app_versions_version_key";
DROP INDEX IF EXISTS "app_versions_versionCode_key";
CREATE UNIQUE INDEX IF NOT EXISTS "app_versions_platform_version_key" ON app_versions(platform, version);
CREATE UNIQUE INDEX IF NOT EXISTS "app_versions_platform_versionCode_key" ON app_versions(platform, "versionCode");
