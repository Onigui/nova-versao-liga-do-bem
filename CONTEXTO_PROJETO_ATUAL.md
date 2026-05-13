# 📋 Contexto do Projeto - Liga do Bem Botucatu

**Objetivo:** Documento para retomada do desenvolvimento com visão completa do que já foi feito.

---

## ✅ Stack atual (definido)

- **Hosting:** **Vercel** (API, admin e web). Render foi abandonado.
- **Banco de dados:** **Supabase** (PostgreSQL).
- **App mobile:** React Native; em fase de **desenvolvimento** (alterações e novas funções). Versão final/publicação só quando estiver completamente funcional.

---

## 🎯 O que é o projeto

Plataforma completa para a **ONG Liga do Bem Botucatu**: app mobile para membros, site institucional, painel administrativo e API backend. Foco em adoção de animais, doações, parceiros (descontos com carteirinha/QR Code), voluntariado, eventos e transparência financeira.

---

## 🏗️ Estrutura do repositório

```
nova-versao-liga-do-bem-1/
├── admin/           # Painel administrativo (HTML/CSS/JS estático) → Vercel
├── backend/         # API Node.js + Express + TypeScript + Prisma → Vercel
│   ├── src/         # server.ts, routes/, middleware/
│   ├── api/         # index.ts (Vercel serverless)
│   └── prisma/      # schema.prisma, migrations (Supabase)
├── mobile/          # App React Native (Android/iOS) – em desenvolvimento
├── web/             # Site institucional → Vercel
├── docker/          # Configurações Docker
├── docs/            # Documentação (alguns guias ainda citam Render – histórico)
├── render.yaml      # [Obsoleto] Não usado – migração para Vercel
├── static.yaml      # Deploy estático
└── Vários .md       # Guias (este arquivo é a referência atual)
```

---

## 🔗 URLs em uso (Vercel + Supabase)

| Serviço | URL |
|--------|-----|
| **API (produção)** | `https://nova-versao-liga-do-bem.vercel.app` |
| **Admin** | `https://nova-versao-liga-do-bem-admin.vercel.app` (ou subdomínio configurado no Vercel) |
| **Web** | `https://nova-versao-liga-do-bem-web.vercel.app` (ou subdomínio configurado no Vercel) |
| **Banco** | Supabase PostgreSQL (variáveis `DATABASE_URL` e `DIRECT_URL` no Vercel, nunca no código) |

O mobile (`apiConfig.js`), admin e web já apontam para a API na Vercel em produção.

---

## ✅ O que já está implementado

### Backend (Node.js + Express + Prisma)
- **Rotas:** `/api/admin`, `/api/partners`, `/api/auth`, `/api/users`, `/api/animals`, `/api/adoptions`, `/api/events`, `/api/donations`, `/api/volunteers`, `/api/notifications`, `/api/payments`, `/api/transparency`, `/api/app`
- **Auth:** JWT, login, registro, OAuth Google, refresh token
- **Admin:** dashboard, empresas (parceiros), membros, upload de APK, versões do app
- **Prisma:** User, Membership, Partner, PartnerService, PartnerDiscount, Animal, Donation, Event, Notification, Payment, Transaction, VolunteerWork, etc.
- **Extras:** CORS para admin/web Vercel e Render, rate limit, multer/upload

### Mobile (React Native 0.74.5 – versão 1.2.3)
- **Telas:** Login, Registro, Esqueci senha, Home, Cartão (QR Code), Parceiros (mapa + lista + busca CNPJ), Detalhe parceiro, Adoções, Detalhe animal, Doações, Voluntariado, Transparência, Eventos, Notificações, Perfil, Editar perfil, Sobre, Debug, Pets, Vacinação, etc.
- **Serviços:** `api.ts` (axios + `apiConfig.js`), AuthService, NotificationService, UpdateService, BiometricService, RemoteLogger
- **Config:** `apiConfig.js` (API_BASE_URL: Vercel em prod, localhost em dev), Firebase (liga-do-bem-botucatu)
- **Build:** Android (gradle), iOS (Xcode), package `liga-do-bem-botucatu`

### Admin (HTML/JS estático)
- Login, dashboard, gestão de empresas parceiras (com mapa), membros, notificações, pagamentos, relatórios, upload de APK, configurações
- Todas as chamadas usam `API_BASE_URL` → `https://nova-versao-liga-do-bem.vercel.app`

### Web (site institucional)
- Landing, doações, contato, download de APK (ex.: `liga-do-bem-botucatu-v1.2.1.apk`, v1.2.3)
- Também usa API em `window.API_BASE_URL` (Vercel)

---

## 📄 Documentos úteis já existentes

- **COMECE_AQUI.md** – Problema de sincronização admin ↔ app; correções em 11 arquivos; URLs e Supabase
- **RESUMO_SOLUCAO.md** – Detalhes das correções, migrations, create-admin, testes
- **CHECKLIST_DEPLOY.md** – Passo a passo de deploy
- **CORRECOES_SINCRONIZACAO.md** – Detalhes técnicos das correções
- **PROJECT_STATUS.md** – Status ~95%, pendência principal: build APK
- **STATUS_PROJETO_COMPLETO.md** – Visão “pronto para produção”, URLs Render
- **RECURSOS_APLICATIVO.md** – Lista completa de funcionalidades do app (telas e módulos)
- **render.yaml** – Serviços Render: API, Web estático, DB PostgreSQL

---

## 📱 Fase atual e estratégia de release

- **Agora:** Alterações e novas funções no APK (app em desenvolvimento).
- **Release público:** Só quando o app estiver **completamente funcional**; aí sim gerar a versão final e liberar para o público.
- Os guias antigos (COMECE_AQUI, CHECKLIST_DEPLOY, etc.) ainda citam Render; a referência de deploy e stack atual é **Vercel + Supabase** e este documento.

---

## ⚠️ Lembretes ao dar sequência

1. **API e frontends** – Tudo na Vercel; mobile/admin/web já usam `nova-versao-liga-do-bem.vercel.app` em produção.
2. **Banco** – Supabase; `DATABASE_URL` e `DIRECT_URL` apenas em variáveis de ambiente no Vercel (nunca commitar).
3. **APK** – Builds de desenvolvimento à vontade; versão final e links públicos no site só quando for liberar para o público.
4. **Credenciais** – Firebase, Supabase, JWT etc. só em variáveis de ambiente (Vercel); nada sensível no repositório.

---

## (Obsoleto - remova esta seção se quiser)

3. **Build do APK** (referência antiga)
   - PROJECT_STATUS indica pendência: gerar APK (EAS ou build local com Java 17).
   - Site já oferece download de APK (v1.2.1 e v1.2.3); novos builds devem atualizar links e versão no backend/admin se houver “versões do app”.


---

## 🚀 Comandos rápidos para retomar

```bash
# Backend (porta 3001)
cd backend && npm install && npx prisma generate && npm run dev

# Mobile
cd mobile && npm install && npx react-native start

# Admin / Web
# Abrir arquivos HTML no navegador ou servir com um server estático
```

---

## 📞 Referência

- **ONG:** Liga do Bem Botucatu  
- **Contato:** administrativo@ligadobembotucatu.org.br, (14) 99822-5023  
- **Repositório:** https://github.com/Onigui/nova-versao-liga-do-bem  

---

*Documento gerado para retomada do desenvolvimento. Stack atual: **Vercel + Supabase**; app em desenvolvimento até versão final funcional; release público só após conclusão.*
