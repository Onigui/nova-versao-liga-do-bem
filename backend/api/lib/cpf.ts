/**
 * CPF: validação pelos dígitos verificadores + bloqueio de números "de exemplo",
 * e checagem de duplicidade ignorando pontuação (um CPF = uma conta).
 *
 * Observação: a conta confere se o número é um CPF possível. Saber se ele EXISTE e é da
 * pessoa só é possível com consulta à Receita (serviços pagos); fica para depois, se precisar.
 */
export const BLOCKED_CPFS = new Set([
  '12345678909', // "123.456.789-09", o exemplo mais usado
  '11144477735', // exemplo clássico de gerador
  '52998224725', // exemplo de documentação
  '01234567890',
  '98765432100',
]);

export function normalizeCpf(raw: any) {
  return String(raw ?? '').replace(/\D/g, '');
}

export function isValidCpf(raw: any): boolean {
  const c = normalizeCpf(raw);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  const calc = (n: number) => {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += Number(c[i]) * (n + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(c[9]) && calc(10) === Number(c[10]);
}

/** Resultado da validação para mostrar ao usuário. */
export function checkCpf(raw: any): { ok: true; digits: string } | { ok: false; code: string; error: string } {
  const digits = normalizeCpf(raw);
  if (!digits) return { ok: false, code: 'CPF_REQUIRED', error: 'Informe o seu CPF' };
  if (digits.length !== 11) return { ok: false, code: 'CPF_INVALID', error: 'CPF deve ter 11 dígitos' };
  if (!isValidCpf(digits) || BLOCKED_CPFS.has(digits)) {
    return { ok: false, code: 'CPF_INVALID', error: 'CPF inválido. Confira os números (use o seu CPF de verdade).' };
  }
  return { ok: true, digits };
}

/** Outra conta já usa este CPF (com ou sem pontuação no cadastro)? */
export async function cpfInUse(db: any, digits: string, exceptUserId?: string | null) {
  const rows: any[] = await db.$queryRawUnsafe(
    `SELECT id FROM users WHERE regexp_replace(COALESCE(cpf, ''), '\\D', '', 'g') = $1 AND ($2::text IS NULL OR id <> $2) LIMIT 1`,
    digits,
    exceptUserId || null,
  );
  return !!rows[0];
}
