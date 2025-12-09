# 🚀 Como Executar a Migration do CPF

A coluna `cpf` ainda não existe no banco de dados. Use este endpoint para criá-la.

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

### Opções de Ferramentas:

#### Opção 1: cURL (Terminal)
```bash
curl -X POST https://nova-versao-liga-do-bem.vercel.app/api/admin/migrate \
  -H "Content-Type: application/json" \
  -H "x-admin-token: demo-token-admin"
```

#### Opção 2: Postman / Insomnia
1. Criar nova requisição POST
2. URL: `https://nova-versao-liga-do-bem.vercel.app/api/admin/migrate`
3. Headers:
   - `Content-Type: application/json`
   - `x-admin-token: demo-token-admin`
4. Enviar requisição

#### Opção 3: Navegador (via Console)
Abra o console do navegador (F12) e execute:

```javascript
fetch('https://nova-versao-liga-do-bem.vercel.app/api/admin/migrate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-admin-token': 'demo-token-admin'
  }
})
.then(res => res.json())
.then(data => console.log('✅ Resultado:', data))
.catch(err => console.error('❌ Erro:', err));
```

### Resposta Esperada:

**Sucesso (coluna criada):**
```json
{
  "success": true,
  "message": "Migration executada com sucesso - Coluna CPF adicionada ao banco de dados",
  "alreadyExists": false
}
```

**Sucesso (coluna já existe):**
```json
{
  "success": true,
  "message": "Coluna CPF já existe no banco de dados",
  "alreadyExists": true
}
```

**Erro:**
```json
{
  "error": "Token administrativo inválido"
}
```

## Verificação

Após executar a migration, você pode verificar se funcionou:

1. **Via logs do Vercel:** Os logs devem parar de mostrar `⚠️ Coluna cpf não existe ainda`
2. **Via aplicativo:** Tente fazer um novo cadastro - o CPF deve ser salvo corretamente
3. **Via endpoint de perfil:** O CPF deve aparecer corretamente (não mais como zeros)

## Segurança

Este endpoint está protegido por token administrativo. Os tokens válidos são:
- `demo-token-admin`
- `liga-do-bem-admin-2024`
- Token definido na variável de ambiente `ADMIN_TOKEN`

## Próximos Passos

Após executar a migration:
1. ✅ A coluna `cpf` estará disponível no banco de dados
2. ✅ Novos cadastros exigirão CPF
3. ✅ CPF será validado e armazenado corretamente
4. ✅ CPF não poderá ser alterado após o cadastro
5. ✅ O problema do CPF aparecendo como zeros será resolvido

