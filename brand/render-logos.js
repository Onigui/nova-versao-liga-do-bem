/**
 * Logos e arte da loja do SóciONG (precisa de Playwright e do pacote @fontsource/outfit):
 *   npm i --no-save playwright @fontsource/outfit && node brand/render-logos.js
 * Gera em brand/: logo-horizontal.png (fundo claro), logo-horizontal-escuro.png,
 * e brand/store/feature-graphic-1024x500.png (imagem de destaque da Play Store).
 */
const fs = require('fs');
const path = require('path');
const {chromium} = require('playwright');
const {iconSvg} = require('../mobile/scripts/brand-svg');

const FONT_DIR = process.env.OUTFIT_DIR || path.dirname(require.resolve('@fontsource/outfit/package.json'));
const font = (w) => fs.readFileSync(path.join(FONT_DIR, `files/outfit-latin-${w}-normal.woff2`)).toString('base64');
const CSS = `@font-face{font-family:Outfit;font-weight:600;src:url(data:font/woff2;base64,${font(600)})}
@font-face{font-family:Outfit;font-weight:800;src:url(data:font/woff2;base64,${font(800)})}
*{margin:0;box-sizing:border-box}body{font-family:Outfit}`;
const icon = (size) => iconSvg(size, 'member', 'rounded');
const word = (dark) =>
  `<span style="font-weight:600;color:${dark ? '#FFFFFF' : '#10231F'}">Sóci</span><span style="font-weight:800;color:${dark ? '#5FD3B8' : '#0E7C66'}">ONG</span>`;

const PAGES = {
  'logo-horizontal.png': {w: 1200, h: 360, html: `<div style="width:1200px;height:360px;display:flex;align-items:center;justify-content:center;gap:48px">${icon(240)}<div style="font-size:150px;letter-spacing:-3px">${word(false)}</div></div>`, transparent: true},
  'logo-horizontal-escuro.png': {w: 1200, h: 360, html: `<div style="width:1200px;height:360px;background:#10231F;display:flex;align-items:center;justify-content:center;gap:48px">${icon(240)}<div style="font-size:150px;letter-spacing:-3px">${word(true)}</div></div>`},
  'store/feature-graphic-1024x500.png': {w: 1024, h: 500, html: `<div style="width:1024px;height:500px;background:#0E7C66;display:flex;align-items:center;gap:44px;padding:0 72px">${icon(220)}<div style="display:flex;flex-direction:column;gap:18px"><div style="font-size:96px;letter-spacing:-2px;line-height:1"><span style="font-weight:600;color:#FFFFFF">Sóci</span><span style="font-weight:800;color:#FFD2BC">ONG</span></div><div style="font-size:34px;font-weight:600;color:#E6F6F1;line-height:1.25">Seja sócio de uma ONG.<br>Ganhe vantagens nos parceiros.</div></div></div>`},
};

(async () => {
  const browser = await chromium.launch();
  for (const [file, p] of Object.entries(PAGES)) {
    const page = await browser.newPage({viewport: {width: p.w, height: p.h}, deviceScaleFactor: 1});
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>${p.html}</body></html>`);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({path: path.join(__dirname, file), omitBackground: !!p.transparent});
    await page.close();
  }
  fs.writeFileSync(path.join(__dirname, 'logo-icone.svg'), icon(1024));
  await browser.close();
  console.log('Logos gerados.');
})();
