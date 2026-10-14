/**
 * Lista rápida para o carimbo (o veterinário pode escrever outro nome).
 * `nextDays` é só a sugestão da próxima dose; o veterinário escolhe.
 */
export const RECORD_CATEGORIES = [
  {id: 'VACCINE', label: 'Vacina', icon: 'medkit'},
  {id: 'DEWORMER', label: 'Vermífugo', icon: 'bug'},
  {id: 'ANTIPARASITIC', label: 'Antipulgas', icon: 'shield-checkmark'},
];

const DOG = [
  {name: 'V8', type: 'Polivalente', nextDays: 365},
  {name: 'V10', type: 'Polivalente', nextDays: 365},
  {name: 'Antirrábica', type: 'Raiva', nextDays: 365},
  {name: 'Gripe canina', type: 'Tosse dos canis', nextDays: 365},
  {name: 'Giárdia', type: 'Giardíase', nextDays: 365},
  {name: 'Leishmaniose', type: 'Leishmaniose', nextDays: 365},
];
const CAT = [
  {name: 'V3 Felina', type: 'Tríplice felina', nextDays: 365},
  {name: 'V4 Felina', type: 'Quádrupla felina', nextDays: 365},
  {name: 'V5 Felina', type: 'Quíntupla felina (com FeLV)', nextDays: 365},
  {name: 'Antirrábica', type: 'Raiva', nextDays: 365},
  {name: 'FeLV', type: 'Leucemia felina', nextDays: 365},
];
const DEWORMERS = [
  {name: 'Drontal', nextDays: 90},
  {name: 'Milbemax', nextDays: 90},
  {name: 'Vermivet', nextDays: 90},
  {name: 'Endogard', nextDays: 90},
];
const ANTIPARASITICS = [
  {name: 'Bravecto', nextDays: 84},
  {name: 'NexGard', nextDays: 30},
  {name: 'Simparic', nextDays: 35},
  {name: 'Revolution', nextDays: 30},
  {name: 'Seresto (coleira)', nextDays: 240},
];

export const MANUFACTURERS = ['Zoetis', 'MSD', 'Boehringer', 'Ceva', 'Virbac', 'Elanco'];

export const NEXT_DOSE_OPTIONS = [
  {days: 21, label: '21 dias'},
  {days: 30, label: '30 dias'},
  {days: 90, label: '3 meses'},
  {days: 180, label: '6 meses'},
  {days: 365, label: '1 ano'},
  {days: 0, label: 'Sem próxima'},
];

export function speciesKind(species) {
  const s = String(species || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  if (/gat|felin|cat/.test(s)) return 'cat';
  if (/cao|cachorr|canin|dog/.test(s)) return 'dog';
  return 'other';
}

export function catalogFor(category, species) {
  if (category === 'DEWORMER') return DEWORMERS;
  if (category === 'ANTIPARASITIC') return ANTIPARASITICS;
  const k = speciesKind(species);
  if (k === 'cat') return CAT;
  if (k === 'dog') return DOG;
  return [...DOG, ...CAT.filter(c => !DOG.some(d => d.name === c.name))];
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function categoryLabel(c) {
  return RECORD_CATEGORIES.find(x => x.id === c)?.label || 'Vacina';
}
