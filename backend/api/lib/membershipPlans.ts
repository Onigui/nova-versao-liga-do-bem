export const FALLBACK_MEMBERSHIP_PLANS = [
  {
    code: 'MONTHLY',
    name: 'Mensal',
    description: 'Assinatura mensal da Liga do Bem',
    months: 1,
    amountCents: 1990,
    order: 1,
  },
  {
    code: 'QUARTERLY',
    name: 'Trimestral',
    description: '3 meses com desconto mínimo',
    months: 3,
    amountCents: 5490,
    order: 2,
  },
  {
    code: 'SEMIANNUAL',
    name: 'Semestral',
    description: '6 meses com desconto mínimo',
    months: 6,
    amountCents: 10990,
    order: 3,
  },
  {
    code: 'ANNUAL',
    name: 'Anual',
    description: '12 meses com desconto mínimo',
    months: 12,
    amountCents: 21990,
    order: 4,
  },
] as const;

export function formatBrlFromCents(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function addMonths(base: Date, months: number) {
  const d = new Date(base.getTime());
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  // Ajuste fim de mês
  if (d.getDate() < day) {
    d.setDate(0);
  }
  return d;
}
