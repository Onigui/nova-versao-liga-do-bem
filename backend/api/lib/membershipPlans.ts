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

/** Juros mensais repassados ao pagador no crédito (tabela Price). */
export const CARD_INSTALLMENT_MONTHLY_RATE = 0.0299;

export function quoteCardInstallment(amountCents: number, installments: number) {
  const n = Math.max(1, Math.min(12, Math.round(Number(installments) || 1)));
  const principal = Math.max(0, Math.round(Number(amountCents) || 0));
  if (n <= 1) {
    return {
      installments: 1,
      installmentCents: principal,
      totalCents: principal,
      interestCents: 0,
      monthlyRate: 0,
    };
  }
  const i = CARD_INSTALLMENT_MONTHLY_RATE;
  const factor = (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);
  const installmentCents = Math.ceil(principal * factor);
  const totalCents = installmentCents * n;
  return {
    installments: n,
    installmentCents,
    totalCents,
    interestCents: Math.max(0, totalCents - principal),
    monthlyRate: i,
  };
}

export function listCardInstallmentOptions(amountCents: number) {
  return Array.from({ length: 12 }, (_, idx) => {
    const quote = quoteCardInstallment(amountCents, idx + 1);
    const ratePct = (quote.monthlyRate * 100).toFixed(2).replace('.', ',');
    const installment = formatBrlFromCents(quote.installmentCents);
    const total = formatBrlFromCents(quote.totalCents);
    return {
      ...quote,
      label:
        quote.installments === 1
          ? `À vista — ${total}`
          : `${quote.installments}x de ${installment} (total ${total}, juros ${ratePct}% a.m.)`,
    };
  });
}
