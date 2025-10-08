# Monitor EAS Build
param(
    [Parameter(Mandatory=$true)]
    [string]$BuildId
)

Write-Host "=== Monitorando Build $BuildId ===" -ForegroundColor Cyan
Write-Host ""

$maxAttempts = 60  # 30 minutos (60 x 30 segundos)
$attempt = 0

while ($attempt -lt $maxAttempts) {
    $attempt++
    
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Tentativa $attempt de $maxAttempts..." -ForegroundColor Yellow
    
    $output = eas build:view $BuildId 2>&1 | Out-String
    
    if ($output -match "Status\s+([^\r\n]+)") {
        $status = $matches[1].Trim()
        Write-Host "Status: $status" -ForegroundColor Cyan
        
        if ($status -eq "finished") {
            Write-Host ""
            Write-Host "=== BUILD CONCLUÍDO COM SUCESSO! ===" -ForegroundColor Green
            Write-Host ""
            
            # Extrair URL do APK
            if ($output -match "Build Artifacts URL\s+([^\r\n]+)") {
                $apkUrl = $matches[1].Trim()
                if ($apkUrl -ne "null" -and $apkUrl -ne "") {
                    Write-Host "URL do APK: $apkUrl" -ForegroundColor Green
                    Write-Host ""
                    Write-Host "Baixando APK..." -ForegroundColor Yellow
                    
                    $apkPath = "..\web\downloads\liga-do-bem-botucatu.apk"
                    Invoke-WebRequest -Uri $apkUrl -OutFile $apkPath
                    
                    Write-Host "APK baixado com sucesso para: $apkPath" -ForegroundColor Green
                }
            }
            
            exit 0
        }
        
        if ($status -match "failed") {
            Write-Host ""
            Write-Host "=== BUILD FALHOU ===" -ForegroundColor Red
            Write-Host "Verifique os logs em: https://expo.dev/accounts/onigui/projects/liga-do-bem-botucatu/builds/$BuildId" -ForegroundColor Red
            exit 1
        }
    }
    
    Start-Sleep -Seconds 30
}

Write-Host ""
Write-Host "=== TIMEOUT ===" -ForegroundColor Red
Write-Host "Build ainda não finalizou após 30 minutos." -ForegroundColor Red
exit 1

