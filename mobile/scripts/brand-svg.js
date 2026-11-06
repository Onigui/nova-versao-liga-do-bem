/**
 * Arte do ícone do SóciONG (conceito B: carteirinha de sócio), em SVG.
 * Fonte única para os ícones do Android, iOS, lojas e telas do app (scripts/brand-icons.js).
 *
 * variant: 'member' (fundo laranja) | 'partner' (fundo verde, para diferenciar no celular)
 */
const C = {
  green: '#0E7C66',
  orange: '#FF7A3D',
  white: '#FFFFFF',
};

const PAW = `<path d="M50 54 C 38 54 30 64 30 72 C 30 80 37 84 44 82 C 47 81 53 81 56 82 C 63 84 70 80 70 72 C 70 64 62 54 50 54 Z"/>
<ellipse cx="32" cy="44" rx="7" ry="9" transform="rotate(-20 32 44)"/>
<ellipse cx="44" cy="33" rx="7" ry="9.5"/>
<ellipse cx="56" cy="33" rx="7" ry="9.5"/>
<ellipse cx="68" cy="44" rx="7" ry="9" transform="rotate(20 68 44)"/>`;

function palette(variant) {
  return variant === 'partner'
    ? {bg: C.green, back: C.orange, card: C.white, mark: C.orange}
    : {bg: C.orange, back: C.green, card: C.white, mark: C.green};
}

/** As duas carteirinhas, no quadro 0–100 (centro aproximado em 50,51). */
function cards(variant) {
  const p = palette(variant);
  return `<rect x="20" y="26" width="64" height="44" rx="8" fill="${p.back}" transform="rotate(6 52 48)"/>
<g transform="rotate(-8 50 52)">
<rect x="14" y="32" width="68" height="44" rx="8" fill="${p.card}"/>
<g fill="${p.mark}" transform="translate(32 54) scale(0.34) translate(-50 -54)">${PAW}</g>
<rect x="48" y="45" width="24" height="6" rx="3" fill="${p.mark}"/>
<rect x="48" y="56" width="16" height="6" rx="3" fill="${p.mark}" opacity="0.45"/>
</g>`;
}

/**
 * shape: 'square' (sangrado, para lojas: a loja aplica a máscara) | 'rounded' | 'circle'
 *        | 'foreground' (camada do ícone adaptativo, 108dp, fundo transparente) | 'background'
 */
function iconSvg(size, variant = 'member', shape = 'square') {
  const p = palette(variant);
  const open = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"`;
  if (shape === 'background') return `${open} viewBox="0 0 108 108"><rect width="108" height="108" fill="${p.bg}"/></svg>`;
  if (shape === 'foreground') {
    // Área segura do ícone adaptativo: círculo de 66dp no centro do quadro de 108dp
    return `${open} viewBox="0 0 108 108"><g transform="translate(54 54) scale(0.74) translate(-50 -51)">${cards(variant)}</g></svg>`;
  }
  const bg =
    shape === 'circle'
      ? `<circle cx="50" cy="50" r="50" fill="${p.bg}"/>`
      : shape === 'rounded'
        ? `<rect width="100" height="100" rx="22" fill="${p.bg}"/>`
        : `<rect width="100" height="100" fill="${p.bg}"/>`;
  const art = shape === 'circle' ? `<g transform="translate(50 50) scale(0.86) translate(-50 -51)">${cards(variant)}</g>` : cards(variant);
  return `${open} viewBox="0 0 100 100">${bg}${art}</svg>`;
}

module.exports = {iconSvg, COLORS: C};
