/**
 * Busca, categorias, "Aberto agora" e "Perto de mim" da lista de parceiros (app dos membros).
 * As categorias são cadastradas de jeitos diferentes ("Pet Shop", "pet-shop", "Clinica Veterinaria"),
 * então a comparação ignora acentos, maiúsculas e hífens e usa palavras-chave.
 */
import {distanceKm} from './geo';
import {openStatus} from './openingHours';

export const norm = s =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[-_/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const CATEGORY_FILTERS = [
  {id: 'pet', label: 'Pet shop', icon: 'basket', match: /pet ?shop|^pet$/},
  {id: 'vet', label: 'Veterinária', icon: 'medical', match: /veterin|clinica|hospital|vet\b/},
  {id: 'banho', label: 'Banho e tosa', icon: 'cut', match: /banho|tosa|estetica|groom/},
  {id: 'racao', label: 'Ração', icon: 'nutrition', match: /racao|alimenta|agropecu|petisco/},
  {id: 'hotel', label: 'Hotel e creche', icon: 'bed', match: /hotel|creche|hosped|adestr/},
];

export function categoryOf(p) {
  const c = norm(p?.category);
  return CATEGORY_FILTERS.find(f => f.match.test(c))?.id || 'outros';
}

/** Só as categorias que têm algum parceiro (não mostra filtro que leva a lista vazia). */
export function availableCategories(partners) {
  const ids = new Set((partners || []).map(categoryOf));
  return CATEGORY_FILTERS.filter(f => ids.has(f.id));
}

/** Aceita os nomes antigos vindos de outras telas ("veterinária", "veterinario"). */
export function categoryFromRoute(v) {
  const n = norm(v);
  if (!n) return 'all';
  if (CATEGORY_FILTERS.some(f => f.id === n)) return n;
  return CATEGORY_FILTERS.find(f => f.match.test(n))?.id || 'all';
}

/**
 * Aplica os filtros e devolve a lista com `distanceKm` e `openNow` calculados.
 * Ordem: perto de mim (sem coordenada vai para o fim) ou A–Z.
 */
export function applyPartnerFilters(partners, {query = '', category = 'all', openNow = false, nearMe = false, location = null, now = new Date()} = {}) {
  const q = norm(query);
  let list = (partners || []).map(p => {
    const st = openStatus(p.hours, now);
    return {...p, distanceKm: location ? distanceKm(location, p) : null, openNow: st ? st.open : null, openLabel: st?.label || null};
  });
  if (q) {
    list = list.filter(p => [p.name, p.category, p.address, p.description].some(f => norm(f).includes(q)));
  }
  if (category && category !== 'all') list = list.filter(p => categoryOf(p) === category);
  if (openNow) list = list.filter(p => p.openNow === true);
  const byName = (a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR');
  if (nearMe && location) {
    list.sort((a, b) => {
      if (a.distanceKm == null && b.distanceKm == null) return byName(a, b);
      if (a.distanceKm == null) return 1;
      if (b.distanceKm == null) return -1;
      return a.distanceKm - b.distanceKm;
    });
  } else {
    list.sort(byName);
  }
  return list;
}
