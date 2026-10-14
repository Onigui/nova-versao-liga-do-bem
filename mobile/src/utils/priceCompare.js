/**
 * Comparação de preços entre parceiros (app dos membros).
 */
import {distanceKm} from './geo';
import {openStatus} from './openingHours';

export const PRICE_CATEGORIES = [
  {id: 'CONSULTAS', label: 'Consultas', icon: 'medkit'},
  {id: 'VACINAS', label: 'Vacinas', icon: 'eyedrop'},
  {id: 'PROCEDIMENTOS', label: 'Cirurgias', icon: 'cut'},
  {id: 'EXAMES', label: 'Exames', icon: 'flask'},
  {id: 'INTERNACAO', label: 'Internação', icon: 'bed'},
  {id: 'ESTETICA', label: 'Banho e tosa', icon: 'water'},
  {id: 'HOSPEDAGEM', label: 'Hotel e creche', icon: 'home'},
  {id: 'ANTIPULGAS', label: 'Antipulgas', icon: 'bug'},
  {id: 'MEDICAMENTOS', label: 'Medicamentos', icon: 'bandage'},
  {id: 'RACAO', label: 'Ração', icon: 'nutrition'},
  {id: 'ACESSORIOS', label: 'Acessórios', icon: 'pricetag'},
];

export function brl(v) {
  return `R$ ${Number(v || 0)
    .toFixed(2)
    .replace('.', ',')
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

/** "hoje", "há 3 dias", "há 2 meses" */
export function updatedLabel(date, now = Date.now()) {
  if (!date) return '';
  const days = Math.floor((now - new Date(date).getTime()) / 864e5);
  if (days <= 0) return 'atualizado hoje';
  if (days === 1) return 'atualizado ontem';
  if (days < 30) return `atualizado há ${days} dias`;
  const m = Math.floor(days / 30);
  return `atualizado há ${m} ${m === 1 ? 'mês' : 'meses'}`;
}

/**
 * Prepara e ordena as ofertas: disponíveis primeiro; depois menor preço ou mais perto.
 * Calcula distância (se houver localização) e "aberto agora".
 */
export function sortOffers(offers, {by = 'price', location = null, now = new Date()} = {}) {
  const list = (offers || []).map(o => {
    const st = openStatus(o.partner?.hours, now);
    return {
      ...o,
      distanceKm: location ? distanceKm(location, o.partner) : null,
      openNow: st ? st.open : null,
      openLabel: st?.label || null,
    };
  });
  const cheapest = Math.min(...list.filter(o => o.available).map(o => o.memberPrice));
  list.forEach(o => (o.cheapest = o.available && o.memberPrice === cheapest));
  return list.sort((a, b) => {
    if (a.available !== b.available) return a.available ? -1 : 1;
    if (by === 'distance' && a.distanceKm != null && b.distanceKm != null && a.distanceKm !== b.distanceKm) {
      return a.distanceKm - b.distanceKm;
    }
    if (by === 'distance' && (a.distanceKm == null) !== (b.distanceKm == null)) return a.distanceKm == null ? 1 : -1;
    return a.memberPrice - b.memberPrice || String(a.partner?.name).localeCompare(String(b.partner?.name), 'pt-BR');
  });
}

/** Diferença entre a mais barata e a mais cara (para o resumo "economize até R$ X"). */
export function spread(offers) {
  const prices = (offers || []).filter(o => o.available).map(o => o.memberPrice);
  if (prices.length < 2) return null;
  const d = Math.max(...prices) - Math.min(...prices);
  return d > 0 ? Math.round(d * 100) / 100 : null;
}
