# 🚀 Como Executar a Migration das Novas Funcionalidades

Esta migration cria as tabelas necessárias para as novas funcionalidades:
- **Help & Support** (help_info)
- **Cartão de Vacinas Digital** (pets, vaccinations)
- **Sistema de Atualizações OTA** (app_versions)

## Método: Endpoint Administrativo (Recomendado)

Foi criado um endpoint seguro que executa a migration diretamente no banco de dados.

### Passo 1: Fazer uma requisição POST

Use qualquer ferramenta para fazer uma requisição HTTP:

**URL:**
```
https://nova-versao-liga-do-bem.vercel.app/api/admin/migrate
```

**Método:** `POST`

**Headers:**
```
Content-Type: application/json
x-admin-token: demo-token-admin
```

**Body:**
```json
{
  "migrationType": "new-features"
}
```

### Opções de Ferramentas:

#### Opção 1: PowerShell (Windows)
```powershell
Invoke-WebRequest -Uri "https://nova-versao-liga-do-bem.vercel.app/api/admin/migrate" `
  -Method POST `
  -Headers @{
    "Content-Type" = "application/json"
    "x-admin-token" = "demo-token-admin"
  } `
  -Body '{"migrationType":"new-features"}' | Select-Object -ExpandProperty Content
```

#### Opção 2: cURL (Linux/Mac/Git Bash)
```bash
curl -X POST https://nova-versao-liga-do-bem.vercel.app/api/admin/migrate \
  -H "Content-Type: application/json" \
  -H "x-admin-token: demo-token-admin" \
  -d '{"migrationType":"new-features"}'
```

#### Opção 3: Postman / Insomnia
1. Criar nova requisição POST
2. URL: `https://nova-versao-liga-do-bem.vercel.app/api/admin/migrate`
3. Headers:
   - `Content-Type: application/json`
   - `x-admin-token: demo-token-admin`
4. Body (JSON):
   ```json
   {
     "migrationType": "new-features"
   }
   ```
5. Enviar requisição

#### Opção 4: Navegador (via Console)
Abra o console do navegador (F12) e execute:

```javascript
fetch('https://nova-versao-liga-do-bem.vercel.app/api/admin/migrate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-admin-token': 'demo-token-admin'
  },
  body: JSON.stringify({ migrationType: 'new-features' })
})
.then(res => res.json())
.then(data => console.log('✅ Resultado:', data))
.catch(err => console.error('❌ Erro:', err));
```

### Resposta Esperada:

**Sucesso:**
```json
{
  "success": true,
  "message": "Migration de novas funcionalidades executada com sucesso",
  "tablesCreated": ["help_info", "pets", "vaccinations", "app_versions"]
}
```

**Erro:**
```json
{
  "success": false,
  "error": "Erro ao executar migration",
  "message": "..."
}
```

## Verificação

Após executar a migration, você pode verificar se funcionou:

1. **Via logs do Vercel:** Os logs devem mostrar "✅ Migration de novas funcionalidades executada com sucesso"
2. **Via aplicativo:** As novas funcionalidades devem estar disponíveis
3. **Via admin:** As seções "Ajuda & Suporte" e "Versões do App" devem estar funcionais

## Tabelas Criadas

### help_info
- Armazena informações de ajuda e suporte para o app mobile
- Campos: id, category, title, description, items (JSON), order, isActive

### pets
- Armazena informações dos pets dos usuários
- Campos: id, userId, name, species, breed, birthDate, photo, gender, color, weight, microchip, notes

### vaccinations
- Armazena registros de vacinação dos pets
- Campos: id, petId, vaccineName, vaccineType, applicationDate, nextDoseDate, batchNumber, veterinarian, veterinarianCRMV, clinicName, clinicId, notes, isVerified, verifiedAt

### app_versions
- Armazena informações sobre versões do aplicativo para atualizações OTA
- Campos: id, version, versionCode, minVersion, apkUrl, apkSize, releaseNotes, isMandatory, isActive, platform

## Segurança

Este endpoint está protegido por token administrativo. Os tokens válidos são:
- `demo-token-admin`
- `liga-do-bem-admin-2024`
- Token definido na variável de ambiente `ADMIN_TOKEN`

## Próximos Passos

Após executar a migration:
1. ✅ As tabelas estarão disponíveis no banco de dados
2. ✅ As funcionalidades estarão disponíveis no app mobile
3. ✅ As interfaces admin estarão funcionais
4. ✅ O sistema de atualizações OTA estará pronto para uso

