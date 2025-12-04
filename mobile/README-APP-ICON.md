# Atualização do Ícone do App

## Como Funciona

O ícone do aplicativo (que aparece na tela inicial do celular) é definido durante o **build do APK**. Ele não pode ser alterado dinamicamente após a instalação.

## Processo de Atualização

### 1. Configurar o Ícone no Admin

1. Acesse o painel admin
2. Vá em "Configurações do App"
3. Na seção "Configurações da Tela de Login", configure:
   - **Ícone da Tela de Login** → Selecione "Usar Imagem"
   - Escolha uma imagem (URL ou Upload)
   - Salve as configurações

### 2. Atualizar o Ícone Durante o Build

O ícone configurado no admin será usado automaticamente quando você:

1. **Fazer um novo build do APK:**
   ```bash
   cd mobile
   npm run build:android
   ```

2. O script `scripts/update-app-icon.js` será executado automaticamente e:
   - Buscará o ícone configurado no admin
   - Atualizará os arquivos `ic_launcher.png` em todas as densidades
   - O novo APK terá o ícone atualizado

### 3. Distribuir o Novo APK

Após o build, o novo APK terá o ícone atualizado. Os usuários precisarão:
- Desinstalar a versão antiga (ou atualizar)
- Instalar a nova versão com o ícone atualizado

## Nota Importante

⚠️ **O ícone do app só muda quando um novo APK é gerado e instalado.** 

As configurações de logo/nome dentro do app (na tela inicial e login) são atualizadas automaticamente quando o app é aberto, mas o ícone do app na tela inicial do celular requer um novo build.

## Troubleshooting

Se o ícone não atualizar:
1. Verifique se a imagem foi configurada corretamente no admin
2. Verifique os logs do build para ver se o script foi executado
3. Certifique-se de que o novo APK foi instalado completamente

