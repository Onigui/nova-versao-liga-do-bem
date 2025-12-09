# Migration: Adicionar Coluna CPF

Esta migration adiciona a coluna `cpf` à tabela `users` no banco de dados.

## Status da Migration

- ✅ Migration criada: `20250101000000_add_cpf_to_user`
- ✅ Schema do Prisma atualizado com `cpf String? @unique`
- ⚠️ **Migration precisa ser executada no banco de dados**

## Como Executar a Migration

### Opção 1: Automático (Vercel/Render)

A migration será executada automaticamente no próximo deploy se:
- O `postinstall` script estiver configurado (já está)
- O `vercel-build` script estiver configurado (já está)

**Para forçar um novo deploy:**
1. Faça um commit vazio ou pequena alteração
2. Faça push para o repositório
3. O Vercel/Render executará as migrations automaticamente

### Opção 2: Manual (Local ou via Script)

Execute manualmente usando o script:

```bash
cd backend
node scripts/run-migration.js
```

Ou diretamente com Prisma:

```bash
cd backend
npx prisma migrate deploy
```

### Opção 3: Via Vercel CLI (Recomendado)

Se você tem acesso ao Vercel CLI:

```bash
cd backend
vercel --prod
```

Isso fará o deploy e executará as migrations automaticamente.

## Verificar se a Migration Foi Executada

Após executar a migration, você pode verificar se a coluna foi criada:

```sql
-- Conectar ao banco de dados e executar:
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'cpf';
```

Se a coluna existir, você verá:
- `column_name`: `cpf`
- `data_type`: `text`
- `is_nullable`: `YES`

## Estrutura da Migration

A migration `20250101000000_add_cpf_to_user/migration.sql` contém:

```sql
-- Adiciona a coluna CPF como opcional
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "cpf" TEXT;

-- Cria índice único para CPF (permite NULL, mas não duplicados)
CREATE UNIQUE INDEX IF NOT EXISTS "users_cpf_key" 
ON "users"("cpf") WHERE "cpf" IS NOT NULL;
```

## Notas Importantes

1. **CPF é opcional**: A coluna permite `NULL` para usuários existentes
2. **CPF é único**: Não pode haver dois usuários com o mesmo CPF
3. **CPF é obrigatório no cadastro**: O aplicativo exige CPF para novos cadastros
4. **CPF não pode ser alterado**: Após o cadastro, o CPF não pode ser modificado (prevenção de fraudes)

## Troubleshooting

### Erro: "Migration already applied"
Isso significa que a migration já foi executada. Tudo certo! ✅

### Erro: "Column already exists"
A coluna já existe no banco. Você pode ignorar este erro ou verificar se está tudo correto.

### Erro: "Connection refused" ou "Database not found"
Verifique se as variáveis de ambiente `DATABASE_URL` e `DIRECT_URL` estão configuradas corretamente.

## Próximos Passos

Após executar a migration:

1. ✅ A coluna `cpf` estará disponível no banco de dados
2. ✅ Novos cadastros exigirão CPF
3. ✅ CPF será validado e armazenado corretamente
4. ✅ CPF não poderá ser alterado após o cadastro

