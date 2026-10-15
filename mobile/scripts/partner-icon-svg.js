// Desenho base do ícone dos Parceiros: fundo verde-azulado + lojinha com toldo listrado.
// A arte da Liga (a mesma do app dos membros) entra na vitrine branca. Usado na prévia e no CI.
// shape: 'square' | 'round' (PNG para Androids antigos), 'fg' / 'bg' (camadas do ícone adaptativo, Android 8+)
const SCALE = {square: 1, round: 0.84, fg: 0.66, bg: 1};
module.exports = function partnerBaseSvg(size, shape) {
  const round = shape === 'round';
  const clip = round ? '<circle cx="54" cy="54" r="54"/>' : '<rect width="108" height="108"/>';
  // toldo: 6 listras alternadas (branco / verde-água) com a borda de baixo ondulada
  let stripes = '';
  for (let i = 0; i < 6; i++) {
    const x = 24 + i * 10;
    stripes += `<path d="M${x} 22 H${x + 10} V33 a5 5 0 0 1 -10 0 Z" fill="${i % 2 ? '#99F6E4' : '#FFFFFF'}"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 108 108">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#14B8A6"/><stop offset="1" stop-color="#0F5E57"/></linearGradient>
    <clipPath id="c">${clip}</clipPath>
  </defs>
  <g clip-path="url(#c)">
    ${shape === 'fg' ? '' : '<rect width="108" height="108" fill="url(#g)"/>'}
    ${shape === 'bg' ? '' : `<g transform="translate(54 54) scale(${SCALE[shape]}) translate(-54 -54)">`}
      ${shape === 'bg' ? '' : `<rect x="22" y="17" width="64" height="6" rx="3" fill="#FFFFFF"/>
      ${stripes}
      <rect x="28" y="38" width="52" height="52" rx="8" fill="#FFFFFF"/>`}
    ${shape === 'bg' ? '' : '</g>'}
  </g>
</svg>`;
};
// vitrine (onde a arte entra), em unidades do viewBox 108
const sq = { x: 30, y: 40, w: 48, h: 48 };
const scaled = (k) => ({ x: 54 + (sq.x - 54) * k, y: 54 + (sq.y - 54) * k, w: sq.w * k, h: sq.h * k });
module.exports.window = { square: sq, round: scaled(SCALE.round), fg: scaled(SCALE.fg) };
