# Marca SóciONG

- **Ícone**: conceito "carteirinha de sócio". Arte em `mobile/scripts/brand-svg.js`.
  - App dos membros: fundo laranja `#FF7A3D`. App Parceiros: fundo verde `#0E7C66`.
- **Cores**: verde sócio `#0E7C66`, laranja calor `#FF7A3D`, verde fundo `#0A5C4C`, tinta `#10231F`.
- **Fonte**: Outfit (gratuita, Google Fonts). "Sóci" peso 600 + "ONG" peso 800 em verde.

| Arquivo | Uso |
|---|---|
| `store/play-icon-512.png` / `-parceiros` | Ícone da Play Store |
| `store/appstore-icon-1024.png` / `-parceiros` | Ícone da App Store |
| `store/feature-graphic-1024x500.png` | Imagem de destaque da Play Store |
| `logo-horizontal.png` / `logo-horizontal-escuro.png` | Site, painel, materiais |
| `logo-icone.svg`, `store/icon*.svg` | Vetores |

Gerar de novo: `node mobile/scripts/brand-icons.js` (ícones) e `node brand/render-logos.js` (logos e destaque).
