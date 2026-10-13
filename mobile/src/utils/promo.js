/**
 * Como cada tipo de promoção aparece para o membro (espelha backend/api/lib/promo.ts).
 *
 *   PERCENT      → selo "20% OFF"          · "20% de desconto"
 *   AMOUNT_OFF   → selo "R$ 10 OFF"        · "R$ 10,00 de desconto"
 *   FINAL_PRICE  → selo "Por R$ 69,90"     · "De R$ 89,90 por R$ 69,90" (preço final, sem OFF)
 *   OTHER        → selo com o texto livre  · "Leve 3, pague 2"
 */
export const PROMO_KINDS = [
  {
    id: 'PERCENT',
    title: '% de desconto',
    example: '20% OFF',
    help: 'Desconto em porcentagem sobre o preço.',
    icon: 'pricetag-outline',
  },
  {
    id: 'AMOUNT_OFF',
    title: 'R$ de desconto',
    example: 'R$ 10 OFF',
    help: 'Um valor em reais que sai do preço.',
    icon: 'remove-circle-outline',
  },
  {
    id: 'FINAL_PRICE',
    title: 'Preço promocional',
    example: 'Por R$ 69,90',
    help: 'O preço final que o membro paga pelo produto.',
    icon: 'cash-outline',
  },
  {
    id: 'OTHER',
    title: 'Outro benefício',
    example: 'Leve 3, pague 2',
    help: 'Brinde, combo, frete grátis…',
    icon: 'gift-outline',
  },
];

export const BENEFIT_TEXT_MAX = 40;

const num = v => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

export function brl(v, compact = false) {
  const n = Number(v);
  const fixed = compact && Number.isInteger(n) ? String(n) : n.toFixed(2);
  const [int, dec] = fixed.split('.');
  return `R$ ${int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}${dec ? `,${dec}` : ''}`;
}

export function promoKind(d) {
  const k = String(d?.kind || '').toUpperCase();
  if (PROMO_KINDS.some(p => p.id === k)) return k;
  if (num(d?.percentage) != null) return 'PERCENT';
  if (num(d?.promoPrice) != null) return 'FINAL_PRICE';
  if (num(d?.fixedAmount) != null) return 'AMOUNT_OFF';
  return 'OTHER';
}

/** {kind, badge, label, headline, caption, original, savings} */
export function describePromo(d) {
  const kind = promoKind(d);
  const pct = num(d?.percentage);
  const off = num(d?.fixedAmount);
  const price = num(d?.promoPrice);
  const orig = num(d?.originalPrice);
  const text = String(d?.benefitText || '').trim();
  if (kind === 'PERCENT' && pct != null) {
    return {kind, badge: `${pct}% OFF`, label: `${pct}% de desconto`, headline: `${pct}%`, caption: 'de desconto', original: null, savings: null};
  }
  if (kind === 'AMOUNT_OFF' && off != null) {
    return {kind, badge: `${brl(off, true)} OFF`, label: `${brl(off)} de desconto`, headline: brl(off, true), caption: 'de desconto', original: null, savings: null};
  }
  if (kind === 'FINAL_PRICE' && price != null) {
    const hasOrig = orig != null && orig > price;
    return {
      kind,
      badge: `Por ${brl(price)}`,
      label: hasOrig ? `De ${brl(orig)} por ${brl(price)}` : `Por ${brl(price)}`,
      headline: brl(price),
      caption: 'preço final para membros',
      original: hasOrig ? brl(orig) : null,
      savings: hasOrig ? Math.round((1 - price / orig) * 100) : null,
    };
  }
  return {kind: 'OTHER', badge: text || 'Benefício', label: text || 'Benefício exclusivo', headline: text || 'Benefício', caption: 'exclusivo para membros', original: null, savings: null};
}

/** Selo do cartão do parceiro na lista: a promoção mais recente. */
export function partnerBadge(p, discounts) {
  const list = Array.isArray(discounts) ? discounts : [];
  if (list.length) return describePromo(list[0]).badge;
  if (p?.badge) return p.badge;
  // API antiga: "20%" ou "R$ 15,00" (sempre desconto)
  if (p?.discount && p.discount !== 'Sem desconto') return `${p.discount} OFF`;
  return null;
}
