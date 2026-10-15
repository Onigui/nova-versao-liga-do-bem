/**
 * Ícone do App Parceiros = arte da Liga (a mesma do app dos membros) dentro da vitrine de uma
 * lojinha branca, com fundo verde-azulado. Assim os dois ícones ficam diferentes no celular
 * e, se a arte for trocada no admin, o dos Parceiros acompanha no próximo build.
 *
 * Grava em android/app/src/partner/res/mipmap-* (só o flavor "partner" usa; os do main ficam
 * para o app dos membros) e em src/assets/images/app-icon-partner.png (tela de entrada).
 *
 * Uso: node scripts/partner-icon.js <arte.png>   (precisa do pacote sharp)
 */
const fs = require('fs');
const path = require('path');
const partnerBaseSvg = require('./partner-icon-svg');

const PARTNER_RES = path.join(__dirname, '../android/app/src/partner/res');
const ASSETS = path.join(__dirname, '../src/assets/images');
const SIZES = {'mipmap-mdpi': 48, 'mipmap-hdpi': 72, 'mipmap-xhdpi': 96, 'mipmap-xxhdpi': 144, 'mipmap-xxxhdpi': 192};
// Ícone adaptativo (Android 8+): camadas de 108dp. Sem ele, o Samsung encolhe o ícone dentro de uma plaquinha clara.
const ADAPTIVE_XML = `<?xml version="1.0" encoding="utf-8"?>
<!-- Gerado por scripts/partner-icon.js: fundo verde-azulado + lojinha com a arte da Liga -->
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
`;

async function renderPartnerIcon(sharp, artPath, size, shape) {
  if (shape === 'bg') return sharp(Buffer.from(partnerBaseSvg(size, 'bg'))).png().toBuffer();
  const win = partnerBaseSvg.window[shape];
  const s = size / 108;
  const side = Math.round(Math.min(win.w, win.h) * s * 0.86);
  const left = Math.round((win.x + win.w / 2) * s - side / 2);
  const top = Math.round((win.y + win.h / 2) * s - side / 2);
  // A arte é recortada nas bordas transparentes antes de caber na vitrine
  const art = await sharp(artPath).trim().resize(side, side, {fit: 'contain', background: {r: 0, g: 0, b: 0, alpha: 0}}).png().toBuffer();
  return sharp(Buffer.from(partnerBaseSvg(size, shape)))
    .composite([{input: art, left, top}])
    .png()
    .toBuffer();
}

async function writePartnerIcons(artPath) {
  const sharp = require('sharp');
  for (const [dir, size] of Object.entries(SIZES)) {
    const out = path.join(PARTNER_RES, dir);
    fs.mkdirSync(out, {recursive: true});
    fs.writeFileSync(path.join(out, 'ic_launcher.png'), await renderPartnerIcon(sharp, artPath, size, 'square'));
    fs.writeFileSync(path.join(out, 'ic_launcher_round.png'), await renderPartnerIcon(sharp, artPath, size, 'round'));
    const layer = Math.round((size * 108) / 48);
    fs.writeFileSync(path.join(out, 'ic_launcher_foreground.png'), await renderPartnerIcon(sharp, artPath, layer, 'fg'));
    fs.writeFileSync(path.join(out, 'ic_launcher_background.png'), await renderPartnerIcon(sharp, artPath, layer, 'bg'));
  }
  const anydpi = path.join(PARTNER_RES, 'mipmap-anydpi-v26');
  fs.mkdirSync(anydpi, {recursive: true});
  fs.writeFileSync(path.join(anydpi, 'ic_launcher.xml'), ADAPTIVE_XML);
  fs.writeFileSync(path.join(anydpi, 'ic_launcher_round.xml'), ADAPTIVE_XML);
  fs.mkdirSync(ASSETS, {recursive: true});
  fs.writeFileSync(path.join(ASSETS, 'app-icon-partner.png'), await renderPartnerIcon(sharp, artPath, 512, 'square'));
  console.log('✅ Ícone do App Parceiros gerado (lojinha verde com a arte da Liga)');
}

if (require.main === module) {
  const art = process.argv[2];
  if (!art) {
    console.error('Uso: node scripts/partner-icon.js <arte.png>');
    process.exit(1);
  }
  writePartnerIcons(art).catch(e => {
    console.error('❌ Ícone dos Parceiros:', e);
    process.exit(1);
  });
}

module.exports = {writePartnerIcons, renderPartnerIcon};
