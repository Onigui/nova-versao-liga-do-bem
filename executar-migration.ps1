# Script PowerShell para executar a migration do CPF
Invoke-WebRequest -Uri "https://nova-versao-liga-do-bem.vercel.app/api/admin/migrate" `
  -Method POST `
  -Headers @{
    "Content-Type" = "application/json"
    "x-admin-token" = "demo-token-admin"
  } | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json -Depth 10

