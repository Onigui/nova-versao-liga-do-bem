/**
 * Converte o parceiro da API no formato que as telas do app dos membros usam
 * (lista de parceiros e página da empresa). Também usado na prévia do App Parceiros.
 */
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
    discount: short || 'Sem desconto',
    description: p?.description || 'Parceiro da Liga do Bem',
    address:
      p?.address || `${p?.city || ''}${p?.state ? ` - ${p.state}` : ''}`.trim(),
    phone: p?.phone || '',
    whatsapp: String(p?.phone || '').replace(/\D/g, ''),
    latitude: p?.latitude ?? null,
    longitude: p?.longitude ?? null,
    hours: p?.hours || 'Seg-Sex: 09:00-18:00 | Sáb: 09:00-13:00',
    logo: p?.logo || null,
    website: p?.website || null,
    discounts: list,
  };
}
