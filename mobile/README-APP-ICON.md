# Ícone do app

O ícone é o da plataforma **SóciONG** (conceito "carteirinha de sócio") e fica versionado no repositório.
Ele não muda por ONG: a marca de cada ONG aparece dentro do app (carteirinha, cores, textos).

- Arte: `scripts/brand-svg.js` (membros: fundo laranja; Parceiros: fundo verde).
- Gerar tudo de novo: `node scripts/brand-icons.js` (precisa do pacote `sharp`).
  - Android: `mipmap-*` dos dois apps, com ícone adaptativo.
  - iOS: `AppIcon.appiconset/icon-1024.png`.
  - Telas do app: `src/assets/images/app-icon.png` e `app-icon-partner.png`.
  - Lojas: `brand/store/` (Play Store 512 px, App Store 1024 px).
