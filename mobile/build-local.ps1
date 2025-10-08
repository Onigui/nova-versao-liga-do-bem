# Script para build local do APK
# Execute como Administrador

Write-Host "=== Liga do Bem - Build Local APK ===" -ForegroundColor Cyan
Write-Host ""

# 1. Limpar completamente o projeto
Write-Host "Limpando arquivos antigos..." -ForegroundColor Yellow
if (Test-Path "android") {
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue android
}
if (Test-Path "node_modules") {
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue node_modules
}

# 2. Instalar dependências
Write-Host "Instalando dependências..." -ForegroundColor Yellow
npm install --legacy-peer-deps

# 3. Verificar se expo está instalado
Write-Host "Verificando Expo..." -ForegroundColor Yellow
if (!(Get-Command "npx" -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: npm/npx não encontrado!" -ForegroundColor Red
    exit 1
}

# 4. Fazer prebuild
Write-Host "Gerando projeto Android nativo..." -ForegroundColor Yellow
npx expo prebuild --platform android --clean

# 5. Verificar se gradlew foi criado
if (!(Test-Path "android\gradlew.bat")) {
    Write-Host "ERROR: gradlew não foi criado!" -ForegroundColor Red
    exit 1
}

# 6. Navegar para android e fazer build
Write-Host "Compilando APK..." -ForegroundColor Yellow
Set-Location android
.\gradlew clean
.\gradlew assembleRelease

# 7. Verificar se APK foi gerado
$apkPath = "app\build\outputs\apk\release\app-release.apk"
if (Test-Path $apkPath) {
    Write-Host ""
    Write-Host "=== BUILD CONCLUÍDO COM SUCESSO! ===" -ForegroundColor Green
    Write-Host "APK gerado em: android\$apkPath" -ForegroundColor Green
    
    # Copiar para pasta de downloads do site
    Write-Host "Copiando APK para web/downloads..." -ForegroundColor Yellow
    Set-Location ..
    Copy-Item "android\$apkPath" "..\web\downloads\liga-do-bem-botucatu.apk" -Force
    Write-Host "APK copiado com sucesso!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "ERROR: APK não foi gerado!" -ForegroundColor Red
    Write-Host "Verifique os logs acima para detalhes do erro." -ForegroundColor Red
    Set-Location ..
    exit 1
}

Write-Host ""
Write-Host "=== PROCESSO FINALIZADO ===" -ForegroundColor Cyan

