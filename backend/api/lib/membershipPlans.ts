export const FALLBACK_MEMBERSHIP_PLANS = [
  {
    code: 'MONTHLY',
    name: 'Mensal',
    description: '1 mês de acesso ativo com QR Code',
    months: 1,
    amountCents: 1990,
    order: 1,
  },
  {
    code: 'QUARTERLY',
    name: 'Trimestral',
    description: '3 meses de acesso ativo com QR Code',
    months: 3,
    amountCents: 5490,
    order: 2,
  },
  {
    code: 'SEMIANNUAL',
    name: 'Semestral',
    description: '6 meses de acesso ativo com QR Code',
    months: 6,
    amountCents: 10490,
    order: 3,
  },
  {
    code: 'ANNUAL',
    name: 'Anual',
    description: '12 meses de acesso ativo com QR Code',
    months: 12,
    amountCents: 20490,
    order: 4,
  },
] as const;

export function formatBrlFromCents(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

/** Soma meses civis preservando o dia (ajuste em fim de mês). */
export function addMonths(base: Date, months: number) {
  const d = new Date(base.getTime());
  const day = d.getDate();
  d.setMonth(d.getMonth() + Number(months || 0));
  if (d.getDate() < day) {
    d.setDate(0);
  }
  return d;
}

export function planMonthsFromCode(code?: string | null) {
  const found = FALLBACK_MEMBERSHIP_PLANS.find(
    (p) => p.code === String(code || '').toUpperCase(),
  );
  return found?.months || null;
}

/** Parcelamento à vista apenas — juros reais vêm da API Fees do PagBank. */
export function cashOnlyInstallmentOptions(amountCents: number) {
  const principal = Math.max(0, Math.round(Number(amountCents) || 0));
  return [
    {
      installments: 1,
      installmentCents: principal,
      totalCents: principal,
      interestCents: 0,
      interestFree: true,
      label: `À vista — ${formatBrlFromCents(principal)}`,
      source: 'fallback' as const,
    },
  ];
}
