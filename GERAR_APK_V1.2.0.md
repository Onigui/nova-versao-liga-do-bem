# 📱 Gerar APK v1.2.0 - Liga do Bem

## ✅ Correções Aplicadas

- ✅ Corrigido crash na tela "Meu Cartão"  
- ✅ Corrigido carregamento de parceiros do banco de dados
- ✅ Integração completa com Supabase PostgreSQL
- ✅ Todas as telas funcionando corretamente

## 🚀 Opções para Gerar o APK

### Opção 1: Android Studio (RECOMENDADO)

**Pré-requisitos:**
- Android Studio instalado
- JDK 17 instalado
- Gradle configurado

**Passos:**

1. **Abra o Android Studio**
   ```
   File > Open > C:\Users\Onigu\OneDrive\Desktop\nova-versao-liga-do-bem\mobile
   ```

2. **Aguarde sincronização**
   - O Android Studio vai sincronizar o projeto automaticamente
   - Aguarde todos os downloads terminarem

3. **Build > Generate Signed Bundle / APK**
   - Clique em "APK"
   - Clique em "Create new..."
   - Preencha os dados do keystore

4. **Assine o APK**
   - Use o keystore: `mobile/android/app/debug.keystore`
   - Ou crie um novo para produção

5. **Aguarde o build**
   - O APK será gerado em: `mobile/android/app/build/outputs/apk/release/app-release.apk`

6. **Copie para o site**
   ```bash
   # Renomear
   mv app-release.apk liga-do-bem-botucatu-v1.2.0.apk
   
   # Copiar para downloads
   cp liga-do-bem-botucatu-v1.2.0.apk ../../../web/downloads/
   ```

### Opção 2: Linha de Comando (Funcionando agora!)

**Pré-requisitos:**
- PowerShell ou CMD
- Java JDK 17

**Comandos:**

```powershell
# 1. Navegar para o projeto
cd C:\Users\Onigu\OneDrive\Desktop\nova-versao-liga-do-bem\mobile\android

# 2. Gerar APK
.\gradlew.bat assembleRelease

# 3. Localizar o APK
ls app/build/outputs/apk/release/

# 4. Copiar para downloads
Copy-Item app/build/outputs/apk/release/app-release.apk ..\..\..\web\downloads\liga-do-bem-botucatu-v1.2.0.apk
```

### Opção 3: Expo Build Service (Aguardar reset)

O plano gratuito do Expo resetou no dia **1º de Novembro**. Após essa data:

```bash
cd mobile
eas build --platform android --profile preview
```

## 📦 Informações do APK

- **Versão:** 1.2.0
- **Package:** com.ligadobem.botucatu
- **Backend:** https://nova-versao-liga-do-bem.onrender.com
- **Database:** Supabase PostgreSQL
- **Build:** Release (assinado)

## 🧪 O que foi testado

- ✅ Login/Registro de usuários
- ✅ Carregamento de parceiros da API
- ✅ Aba "Meu Cartão" não fecha mais
- ✅ Navegação entre telas
- ✅ Integração com banco de dados online

## 📝 Changelog v1.2.0

- 🔧 Corrigido crash na tela "Meu Cartão" (QRCode)
- 🔧 Corrigido carregamento de parceiros (formato da API)
- 🔧 Adicionado suporte completo ao banco de dados Supabase
- 🔧 Melhorias de performance e estabilidade



