# 🎯 GERAR APK AGORA - Passo a Passo

## 📱 Método Escolhido: EAS Build (Nuvem)

### ✅ **Vantagens:**
- Não precisa mexer no Java
- Build profissional na nuvem
- APK pronto em 25 minutos
- 100% confiável

---

## 🚀 PASSO A PASSO

### **1️⃣ Abrir Terminal no Projeto**
```bash
cd C:\Users\Onigu\OneDrive\Desktop\nova-versao-liga-do-bem\mobile
```

### **2️⃣ Verificar Login no Expo**
```bash
npx expo whoami
```
- Se mostrar "Onigui" ✅ Está logado
- Se não, executar: `npx expo login`

### **3️⃣ Criar ID do Projeto EAS**
```bash
eas init --id
```
- Vai perguntar: "Would you like to create a project?"
- Digite: **Y** (Yes)
- Aguarde criar o projeto

### **4️⃣ Iniciar o Build**
```bash
eas build --platform android --profile preview
```
- Vai perguntar algumas coisas:
  - "Generate a new Android Keystore?" → **Y** (Yes)
  - Aguarde o upload do código (2-3 min)
  - Aguarde o build na nuvem (20-25 min)

### **5️⃣ Aguardar Build**
Você verá algo assim:
```
✔ Build started, it may take a few minutes to complete.
  You can monitor the build at:
  https://expo.dev/accounts/onigui/projects/liga-do-bem-botucatu/builds/...
```

### **6️⃣ Baixar o APK**
Quando terminar:
```
✔ Build completed!
  Download: https://expo.dev/artifacts/...
```
- Clique no link
- Baixe o arquivo `.apk`

---

## 📦 TESTAR O APK

### **No seu celular Android:**

1. **Transferir APK:**
   - Conecte celular via USB
   - Copie o APK para Download/
   - Ou envie por WhatsApp/Drive

2. **Instalar:**
   - Abra o arquivo
   - Clique em "Instalar"
   - Se pedir, autorize "Fontes desconhecidas"

3. **Testar:**
   - Abra o app "Liga do Bem Botucatu"
   - Teste login
   - Teste cartão de membro
   - Teste mapa de parceiros

---

## 🌐 DISPONIBILIZAR NO SITE

### **Depois de testar:**

1. **Renomear APK:**
```bash
# Renomeie para algo simples
liga-do-bem-v1.0.0.apk
```

2. **Copiar para pasta web:**
```bash
cp liga-do-bem-v1.0.0.apk ../web/downloads/
```

3. **Atualizar link no site:**
   - Abra `web/index.html`
   - Procure por "Download App"
   - Atualize href para: `downloads/liga-do-bem-v1.0.0.apk`

4. **Commit e push:**
```bash
git add .
git commit -m "Feat: Adicionar APK v1.0.0 para download"
git push origin master
```

5. **Pronto! 🎉**
   - Site: https://liga-do-bem-web.onrender.com
   - Download direto do APK

---

## ⏱️ CRONOGRAMA

- **Agora:** Executar comandos (5 min)
- **Aguardar:** Build na nuvem (25 min)
- **Testar:** APK no celular (5 min)
- **Publicar:** Subir para o site (5 min)
- **TOTAL: ~40 minutos**

---

## 🐛 SE DER ERRO

### **Erro: "eas command not found"**
```bash
npm install -g eas-cli
```

### **Erro: "Not logged in"**
```bash
npx expo login
# Usuário: Onigui
# Senha: buseta30
```

### **Erro: "Invalid UUID"**
É normal na primeira vez. O `eas init --id` vai resolver.

### **Erro durante build:**
- Não se preocupe
- O EAS vai mostrar o log detalhado
- Geralmente é problema de configuração que podemos ajustar

---

## 💪 VOCÊ ESTÁ QUASE LÁ!

**95% do trabalho já está feito:**
- ✅ Código completo
- ✅ Backend funcionando
- ✅ Firebase configurado
- ✅ Estrutura Android criada

**Falta só:**
- ⏳ Executar 2 comandos
- ⏳ Aguardar 25 minutos
- ⏳ Baixar APK

**VAMOS FAZER ISSO AGORA?** 🚀

---

## 📝 COMANDOS RESUMIDOS

```bash
# 1. Ir para pasta mobile
cd mobile

# 2. Verificar login
npx expo whoami

# 3. Criar projeto EAS
eas init --id

# 4. Fazer build
eas build --platform android --profile preview

# 5. Aguardar link de download
# (copie e cole no navegador quando aparecer)
```

---

**Pronto para começar?** Digite "continue" e vou te guiar! 💪

