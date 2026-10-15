/**
 * CPF no app: máscara e validação pelos dígitos verificadores (a API confere de novo).
 */
export const BLOCKED_CPFS = ['12345678909', '11144477735', '52998224725', '01234567890', '98765432100'];

export function onlyDigits(v) {
  return String(v || '').replace(/\D/g, '');
}

export function formatCpf(v) {
  const d = onlyDigits(v).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
}

export function isValidCpf(v) {
  const c = onlyDigits(v);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c) || BLOCKED_CPFS.includes(c)) return false;
  const calc = n => {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += Number(c[i]) * (n + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(c[9]) && calc(10) === Number(c[10]);
}

/** Mensagem para mostrar enquanto digita (null = ainda incompleto, sem erro). */
export function cpfHint(v) {
  const d = onlyDigits(v);
  if (!d) return null;
  if (d.length < 11) return null;
  return isValidCpf(d) ? 'ok' : 'CPF inválido. Confira os números.';
}

export function formatPhoneBR(v) {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
