# Scripts de Build

## update-app-icon.js

Este script atualiza o ícone do aplicativo Android (`ic_launcher.png`) com a imagem configurada no painel admin.

### Como Funciona

1. Busca as configurações do app da API (`/api/app/config`)
2. Obtém o ícone configurado (`login.iconImage` ou `app.logoUrl`)
3. Atualiza os arquivos `ic_launcher.png` em todas as densidades:
   - mipmap-mdpi (48x48)
   - mipmap-hdpi (72x72)
   - mipmap-xhdpi (96x96)
   - mipmap-xxhdpi (144x144)
   - mipmap-xxxhdpi (192x192)

### Uso

O script é executado automaticamente durante o build do APK via GitHub Actions.

Para executar manualmente:
```bash
cd mobile
node scripts/update-app-icon.js
```

### Requisitos

- Node.js instalado
- Acesso à API do backend
- Imagem configurada no admin panel

### Notas

- O script suporta imagens em Base64 ou URL
- Se nenhum ícone estiver configurado, usa o ícone padrão
- O ícone só muda quando um novo APK é gerado

