/**
 * Gera todos os ícones do SóciONG a partir de scripts/brand-svg.js (precisa do pacote sharp).
 *
 *   node scripts/brand-icons.js
 *
 * - Android: mipmap-* (quadrado, redondo e as duas camadas do ícone adaptativo) dos dois apps:
 *   main = SóciONG (membros), partner = SóciONG Parceiros.
 * - iOS: AppIcon de 1024 px (o Xcode gera os outros tamanhos).
 * - Telas do app: src/assets/images/app-icon.png e app-icon-partner.png (entrada e login).
 * - Lojas: ../brand/store/ (Play Store 512 px e App Store 1024 px, para os dois apps).
 *
 * O ícone é da plataforma e não muda por ONG. A marca de cada ONG aparece dentro do app.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const {iconSvg} = require('./brand-svg');

const ROOT = path.join(__dirname, '..');
const RES = {member: path.join(ROOT, 'android/app/src/main/res'), partner: path.join(ROOT, 'android/app/src/partner/res')};
const ASSETS = path.join(ROOT, 'src/assets/images');
const STORE = path.join(ROOT, '../brand/store');
const IOS_SET = path.join(ROOT, 'ios/LigaDoBemNovo/Images.xcassets/AppIcon.appiconset');
const DENSITIES = {mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4};
const ADAPTIVE_XML = `<?xml version="1.0" encoding="utf-8"?>
<!-- Gerado por scripts/brand-icons.js (SóciONG) -->
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
`;

async function png(svg, out, {flatten} = {}) {
  fs.mkdirSync(path.dirname(out), {recursive: true});
  let img = sharp(Buffer.from(svg), {density: 384});
  if (flatten) img = img.flatten({background: '#FFFFFF'}).removeAlpha();
  await img.png().toFile(out);
}

async function android(variant) {
  const res = RES[variant];
  for (const [d, k] of Object.entries(DENSITIES)) {
    const dir = path.join(res, `mipmap-${d}`);
    const legacy = Math.round(48 * k);
    const layer = Math.round(108 * k);
    await png(iconSvg(legacy, variant, 'rounded'), path.join(dir, 'ic_launcher.png'));
    await png(iconSvg(legacy, variant, 'circle'), path.join(dir, 'ic_launcher_round.png'));
    await png(iconSvg(layer, variant, 'foreground'), path.join(dir, 'ic_launcher_foreground.png'));
    await png(iconSvg(layer, variant, 'background'), path.join(dir, 'ic_launcher_background.png'));
  }
  const anydpi = path.join(res, 'mipmap-anydpi-v26');
  fs.mkdirSync(anydpi, {recursive: true});
  fs.writeFileSync(path.join(anydpi, 'ic_launcher.xml'), ADAPTIVE_XML);
  fs.writeFileSync(path.join(anydpi, 'ic_launcher_round.xml'), ADAPTIVE_XML);
}

async function main() {
  for (const v of ['member', 'partner']) await android(v);
  await png(iconSvg(512, 'member', 'rounded'), path.join(ASSETS, 'app-icon.png'));
  await png(iconSvg(512, 'partner', 'rounded'), path.join(ASSETS, 'app-icon-partner.png'));
  // Lojas: quadrado sangrado (a loja arredonda); App Store não aceita transparência
  await png(iconSvg(512, 'member', 'square'), path.join(STORE, 'play-icon-512.png'), {flatten: true});
  await png(iconSvg(512, 'partner', 'square'), path.join(STORE, 'play-icon-512-parceiros.png'), {flatten: true});
  await png(iconSvg(1024, 'member', 'square'), path.join(STORE, 'appstore-icon-1024.png'), {flatten: true});
  await png(iconSvg(1024, 'partner', 'square'), path.join(STORE, 'appstore-icon-1024-parceiros.png'), {flatten: true});
  fs.writeFileSync(path.join(STORE, 'icon.svg'), iconSvg(1024, 'member', 'square'));
  fs.writeFileSync(path.join(STORE, 'icon-parceiros.svg'), iconSvg(1024, 'partner', 'square'));
  // iOS: um único ícone de 1024 (Xcode 14+)
  await png(iconSvg(1024, 'member', 'square'), path.join(IOS_SET, 'icon-1024.png'), {flatten: true});
  fs.writeFileSync(
    path.join(IOS_SET, 'Contents.json'),
    JSON.stringify({images: [{filename: 'icon-1024.png', idiom: 'universal', platform: 'ios', size: '1024x1024'}], info: {author: 'xcode', version: 1}}, null, 2) + '\n',
  );
  console.log('Ícones do SóciONG gerados.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
