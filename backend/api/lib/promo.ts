/**
 * Tipos de promoção e como cada uma aparece para o membro.
 *
 *   PERCENT      → "20% OFF"            (percentage)
 *   AMOUNT_OFF   → "R$ 10 OFF"          (fixedAmount = valor descontado)
 *   FINAL_PRICE  → "Por R$ 69,90"       (promoPrice = preço final; originalPrice = "de", opcional)
 *   OTHER        → texto livre curto    (benefitText, ex.: "Leve 3, pague 2", "Brinde")
 *
 * Linhas antigas sem `kind` são lidas pelo valor preenchido (percentual ou valor descontado).
 */

export const PROMO_KINDS = ['PERCENT', 'AMOUNT_OFF', 'FINAL_PRICE', 'OTHER'] as const;
export type PromoKind = (typeof PROMO_KINDS)[number];

export const PROMO_SCHEMA_SQL = [
  `ALTER TABLE partner_discounts ADD COLUMN IF NOT EXISTS kind TEXT`,
  `ALTER TABLE partner_discounts ADD COLUMN IF NOT EXISTS "promoPrice" DECIMAL(10,2)`,
  `ALTER TABLE partner_discounts ADD COLUMN IF NOT EXISTS "originalPrice" DECIMAL(10,2)`,
  `ALTER TABLE partner_discounts ADD COLUMN IF NOT EXISTS "benefitText" TEXT`,
];

export const BENEFIT_TEXT_MAX = 40;

const n = (v: any) => (v == null || v === '' ? null : Number(v));

export function brl(v: number, compact = false): string {
  const fixed = compact && Number.isInteger(v) ? String(v) : v.toFixed(2);
  const [int, dec] = fixed.split('.');
  const intFmt = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `R$ ${intFmt}${dec ? `,${dec}` : ''}`;
}

export function promoKind(d: any): PromoKind {
  const k = String(d?.kind || '').toUpperCase();
  if ((PROMO_KINDS as readonly string[]).includes(k)) return k as PromoKind;
  if (n(d?.percentage) != null) return 'PERCENT';
  if (n(d?.promoPrice) != null) return 'FINAL_PRICE';
  if (n(d?.fixedAmount) != null) return 'AMOUNT_OFF';
  return 'OTHER';
}

/** Textos prontos para cada tela: selo curto, linha principal e explicação. */
export function describePromo(d: any) {
  const kind = promoKind(d);
  const pct = n(d?.percentage);
  const off = n(d?.fixedAmount);
  const price = n(d?.promoPrice);
  const orig = n(d?.originalPrice);
  const text = String(d?.benefitText || '').trim();

  if (kind === 'PERCENT' && pct != null) {
    return {
      kind,
      badge: `${pct}% OFF`,
      label: `${pct}% de desconto`,
      // compatível com versões antigas do app, que acrescentam " OFF"
      short: `${pct}%`,
      savings: null as number | null,
    };
  }
  if (kind === 'AMOUNT_OFF' && off != null) {
    return { kind, badge: `${brl(off, true)} OFF`, label: `${brl(off)} de desconto`, short: brl(off), savings: null };
  }
  if (kind === 'FINAL_PRICE' && price != null) {
    const savings = orig != null && orig > price ? Math.round((1 - price / orig) * 100) : null;
    return {
      kind,
      badge: `Por ${brl(price)}`,
      label: orig != null && orig > price ? `De ${brl(orig)} por ${brl(price)}` : `Por ${brl(price)}`,
      short: null,
      savings,
    };
  }
  return { kind: 'OTHER' as PromoKind, badge: text || 'Benefício', label: text || 'Benefício exclusivo', short: null, savings: null };
}
