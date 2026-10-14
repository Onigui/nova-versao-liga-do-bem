/**
 * Converte o parceiro da API no formato que as telas do app dos membros usam
 * (lista de parceiros e página da empresa). Também usado na prévia do App Parceiros.
 */
import {partnerBadge} from './promo';

const coord = v => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

export function toMemberPartner(p, discounts) {
  const list = Array.isArray(discounts) ? discounts : Array.isArray(p?.discounts) ? p.discounts : [];
  const first = list[0];
  const short =
    p?.discount ||
    (first?.percentage != null
      ? `${Number(first.percentage)}%`
      : first?.fixedAmount != null
        ? `R$ ${Number(first.fixedAmount).toFixed(2).replace('.', ',')}`
        : null);
  return {
    id: p?.id,
    name: p?.name || '',
    category: p?.category || '',
    /** Selo pronto: "20% OFF", "R$ 10 OFF", "Por R$ 69,90", "Leve 3, pague 2"… (null = sem promoção) */
    badge: partnerBadge(p, list),
    discount: short || 'Sem desconto',
    description: p?.description || 'Parceiro da Liga do Bem',
    address: p?.address || `${p?.city || ''}${p?.state ? ` - ${p.state}` : ''}`.trim(),
    phone: p?.phone || '',
    whatsapp: String(p?.phone || '').replace(/\D/g, ''),
    latitude: coord(p?.latitude),
    longitude: coord(p?.longitude),
    // Sem horário cadastrado fica vazio: a página mostra "Horário não informado"
    hours: p?.hours || '',
    logo: p?.logo || null,
    website: p?.website || null,
    discounts: list,
    /** Avaliações (só de quem foi atendido): média e quantidade */
    rating: p?.rating != null ? Number(p.rating) : null,
    reviewCount: Number(p?.reviewCount) || 0,
  };
}
