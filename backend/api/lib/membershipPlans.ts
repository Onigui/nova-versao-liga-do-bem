/**
 * Regra da plataforma SóciONG: nenhum plano de sócio pode sair por menos de R$ 20,00 por mês
 * (vale para todas as ONGs, as que existem e as que entrarem). O mensal é R$ 24,90 e o anual
 * chega a R$ 20,00 por mês.
 */
export const MIN_MONTHLY_CENTS = 2000;

/** Menor valor permitido para um plano de `months` meses. */
export function minPlanCents(months: number) {
  return MIN_MONTHLY_CENTS * Math.max(1, Math.round(Number(months) || 1));
}

/** Aplica o piso de R$ 20,00/mês: um plano abaixo dele sobe para o piso. */
export function enforcePlanFloor(amountCents: number, months: number) {
  return Math.max(Math.round(Number(amountCents) || 0), minPlanCents(months));
}

export const FALLBACK_MEMBERSHIP_PLANS = [
  {
    code: 'MONTHLY',
    name: 'Mensal',
    description: '1 mês de acesso ativo com QR Code · R$ 24,90/mês',
    months: 1,
    amountCents: 2490,
    order: 1,
  },
  {
    code: 'QUARTERLY',
    name: 'Trimestral',
    description: '3 meses de acesso ativo com QR Code · R$ 23,30/mês',
    months: 3,
    amountCents: 6990,
    order: 2,
  },
  {
    code: 'SEMIANNUAL',
    name: 'Semestral',
    description: '6 meses de acesso ativo com QR Code · R$ 21,65/mês',
    months: 6,
    amountCents: 12990,
    order: 3,
  },
  {
    code: 'ANNUAL',
    name: 'Anual',
    description: '12 meses de acesso ativo com QR Code · R$ 20,00/mês',
    months: 12,
    amountCents: 24000,
    order: 4,
  },
] as const;

// Trava no código: se alguém baixar um valor abaixo do piso, o servidor nem sobe
for (const p of FALLBACK_MEMBERSHIP_PLANS) {
  if (p.amountCents < minPlanCents(p.months)) throw new Error(`Plano ${p.code} abaixo de R$ 20,00/mês`);
}

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
