# Liga do Bem Botucatu - Frontend Web

## Configuração no Render

Para configurar este static site no Render:

### 1. Criar Static Site
- Acesse o dashboard do Render
- Clique em "New" → "Static Site"
- Conecte ao repositório GitHub

### 2. Configurações
- **Name**: `nova-versao-liga-do-bem-web`
- **Branch**: `master`
- **Root Directory**: `web`
- **Build Command**: (deixar vazio)
- **Publish Directory**: `web`

### 3. Environment Variables
Nenhuma variável de ambiente necessária para o static site.

### 4. Deploy
- Clique em "Create Static Site"
- O Render irá fazer o deploy automaticamente

## Estrutura
- `index.html` - Página principal
- `_redirects` - Configuração de redirects
- `env.production` - Configurações (não usado no static site)

## URLs
- **Frontend**: https://nova-versao-liga-do-bem-web.onrender.com
- **Backend API**: https://nova-versao-liga-do-bem.onrender.com
