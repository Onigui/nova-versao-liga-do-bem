# 🚀 Configurar Render para Static Site

## ⚠️ IMPORTANTE: Atualizar Configurações no Render

O site está mostrando "Not Found" porque o Render ainda está configurado para a estrutura anterior.

### 🔧 **Passos para Corrigir:**

1. **Acesse o Render Dashboard:**
   - Vá para: https://dashboard.render.com
   - Entre no seu serviço "nova-versao-liga-do-bem-web"

2. **Atualize as Configurações:**
   
   **Environment:** `Static Site`
   
   **Build Command:** (deixe vazio)
   
   **Publish Directory:** (deixe vazio)
   
   **Root Directory:** (deixe vazio)
   
   **Branch:** `master`

3. **Salve e Faça Deploy:**
   - Clique em "Save Changes"
   - Clique em "Manual Deploy" → "Deploy latest commit"

### 📁 **Estrutura Atual:**
```
nova-versao-liga-do-bem/
├── index.html          ← Arquivo principal do site
├── _redirects          ← Configuração de redirecionamentos
├── package.json        ← Package.json simples
└── ...                 ← Outros arquivos
```

### ✅ **Após a Configuração:**
- O site deve carregar perfeitamente
- URL: https://nova-versao-liga-do-bem-web.onrender.com
- Sem mais erros 404

### 🆘 **Se Ainda Não Funcionar:**
1. Delete o serviço atual
2. Crie um novo "Static Site"
3. Conecte ao repositório: `Onigui/nova-versao-liga-do-bem`
4. Use as configurações acima

---
**Status:** ⏳ Aguardando atualização das configurações no Render
