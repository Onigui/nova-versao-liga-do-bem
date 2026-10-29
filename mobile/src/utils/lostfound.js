/**
 * Achados e perdidos: rótulos, cores, validação do aviso e links (WhatsApp, mapa, compartilhar).
 */
import {API_BASE_PATH} from '../config/apiConfig';

export const LF_TYPES = {
  LOST: {label: 'Perdido', verb: 'Perdi meu pet', color: '#DC2626', soft: '#FEE2E2', icon: 'alert-circle', letter: 'P'},
  FOUND: {label: 'Encontrado', verb: 'Encontrei um animal', color: '#059669', soft: '#D1FAE5', icon: 'hand-left', letter: 'E'},
  SIGHTED: {label: 'Visto solto', verb: 'Vi um animal solto', color: '#D97706', soft: '#FEF3C7', icon: 'eye', letter: 'V'},
};
export const LF_SPECIES = [
  {id: 'DOG', label: 'Cachorro', icon: 'paw'},
  {id: 'CAT', label: 'Gato', icon: 'paw'},
  {id: 'OTHER', label: 'Outro', icon: 'help-circle'},
];
export const LF_SIZES = [
  {id: 'PEQUENO', label: 'Pequeno'},
  {id: 'MEDIO', label: 'Médio'},
  {id: 'GRANDE', label: 'Grande'},
];
export const LF_SEX = [
  {id: 'MACHO', label: 'Macho'},
  {id: 'FEMEA', label: 'Fêmea'},
  {id: 'NAO_SEI', label: 'Não sei'},
];
export const LF_WITH = [
  {id: 'COMIGO', label: 'Está comigo'},
  {id: 'LAR_TEMPORARIO', label: 'Lar temporário'},
  {id: 'CLINICA', label: 'Em clínica'},
  {id: 'SOLTO', label: 'Continua solto'},
];

export const speciesLabel = id => LF_SPECIES.find(s => s.id === id)?.label || 'Animal';
export const sizeLabel = id => LF_SIZES.find(s => s.id === id)?.label || null;
export const withLabel = id => LF_WITH.find(s => s.id === id)?.label || null;

export function photoUrl(path) {
  if (!path) return null;
  return /^https?:/.test(path) ? path : `${API_BASE_PATH.replace(/\/api$/, '')}${path}`;
}

export function shareUrl(id) {
  return `${API_BASE_PATH.replace(/\/api$/, '')}/api/public/lostfound/${id}`;
}

export function whatsappUrl(report) {
  if (!report?.whatsapp) return null;
  const what =
    report.type === 'LOST'
      ? `Oi! Vi no app Liga do Bem o aviso de ${report.petName || 'pet perdido'} (${speciesLabel(report.species).toLowerCase()}, ${report.colors}).`
      : `Oi! Vi no app Liga do Bem o aviso do ${speciesLabel(report.species).toLowerCase()} ${report.type === 'FOUND' ? 'encontrado' : 'visto solto'} (${report.colors}).`;
  return `https://wa.me/${report.whatsapp}?text=${encodeURIComponent(what)}`;
}

export function directionsUrl(r) {
  return `https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lng}`;
}

/** "agora", "há 25 min", "há 3 h", "há 2 dias" */
export function timeAgo(date, now = Date.now()) {
  const min = Math.floor((now - new Date(date).getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return `há ${d} ${d === 1 ? 'dia' : 'dias'}`;
}

export function whenLabel(date) {
  const d = new Date(date);
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} às ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function distanceLabel(km) {
  if (km == null) return null;
  return km < 1 ? `${Math.round(km * 1000)} m` : `${String(km.toFixed(1)).replace('.', ',')} km`;
}

/** "14/10/2026 18:30" → Date (ou null). */
export function parseDateTime(text) {
  const m = String(text || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4] || 12), Number(m[5] || 0));
  if (d.getDate() !== Number(m[1]) || d.getMonth() !== Number(m[2]) - 1) return null;
  return d;
}

export function nowInput(now = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${p(now.getDate())}/${p(now.getMonth() + 1)}/${now.getFullYear()} ${p(now.getHours())}:${p(now.getMinutes())}`;
}

export function formatPhone(text) {
  const d = String(text || '').replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Valida o formulário e monta o corpo do aviso. */
export function buildReportBody(form, now = Date.now()) {
  if (!form.photos?.length) return {error: 'Adicione pelo menos uma foto do animal.'};
  if (!form.species) return {error: 'Escolha a espécie.'};
  if (String(form.colors || '').trim().length < 3) return {error: 'Informe a cor do animal.'};
  if (!form.location) return {error: 'Marque no mapa o local exato.'};
  const when = parseDateTime(form.when);
  if (!when) return {error: 'Data e hora inválidas. Use DD/MM/AAAA HH:MM.'};
  if (when.getTime() > now + 10 * 60e3) return {error: 'A data não pode ser no futuro.'};
  const phone = String(form.whatsapp || '').replace(/\D/g, '');
  if (form.showWhatsapp !== false && phone.length !== 10 && phone.length !== 11) return {error: 'Informe o WhatsApp com DDD.'};
  const body = {
    type: form.type,
    species: form.species,
    sex: form.sex || 'NAO_SEI',
    size: form.size || null,
    colors: form.colors.trim(),
    breed: String(form.breed || '').trim() || null,
    hasCollar: form.hasCollar ?? null,
    description: String(form.description || '').trim() || null,
    lat: form.location.lat,
    lng: form.location.lng,
    locationNote: String(form.locationNote || '').trim() || null,
    district: String(form.district || '').trim() || null,
    happenedAt: when.toISOString(),
    photos: form.photos.map(p => p.data),
    whatsapp: form.showWhatsapp === false ? null : phone,
    showWhatsapp: form.showWhatsapp !== false,
  };
  if (form.type === 'LOST') {
    body.petName = String(form.petName || '').trim() || null;
    if (form.petId) body.petId = form.petId;
  }
  if (form.type === 'FOUND') body.currentlyWith = form.currentlyWith || null;
  return {body};
}

/** Marcadores do mapa a partir dos avisos. */
export function toMarkers(reports) {
  // No mapa geral o caso aparece onde o animal foi visto por último
  return (reports || []).map(r => ({
    id: r.id,
    lat: r.lastSeen?.lat ?? r.lat,
    lng: r.lastSeen?.lng ?? r.lng,
    color: LF_TYPES[r.type]?.color || '#6B7280',
    label: LF_TYPES[r.type]?.letter || '',
    approximate: !!r.approximate,
  }));
}

// ---------------------------------------------------------------- casos e avistamentos

export const SIGHTING_KINDS = {
  SEEN: {label: 'Vi de novo', long: 'Vi este animal', icon: 'eye', color: '#D97706', soft: '#FEF3C7'},
  WITH_ME: {label: 'Está comigo', long: 'Recolhi, está comigo', icon: 'home', color: '#059669', soft: '#D1FAE5'},
  CLINIC: {label: 'Levei para clínica', long: 'Levei para uma clínica', icon: 'medkit', color: '#2563EB', soft: '#DBEAFE'},
};

/** Situação atual do caso para o topo da página: "Visto há 2 h", "Está com alguém"… */
export function caseSituation(r, now = Date.now()) {
  if (!r) return null;
  if (r.status === 'RESOLVED') return {text: 'Voltou para casa', color: '#166534'};
  const last = r.lastSeen;
  if (!last) return null;
  const k = SIGHTING_KINDS[last.kind] || SIGHTING_KINDS.SEEN;
  const verb = last.kind === 'WITH_ME' ? 'Está com alguém desde' : last.kind === 'CLINIC' ? 'Levado para clínica' : 'Visto por último';
  return {text: `${verb} ${timeAgo(last.at, now)}`, color: k.color, icon: k.icon};
}

/**
 * Pontos do trajeto: onde o caso começou + cada avistamento, em ordem de data.
 * Marcadores numerados (1 = início) e a linha que os liga.
 */
export function caseTrack(report, timeline = []) {
  if (!report) return {markers: [], track: []};
  const t = LF_TYPES[report.type];
  const start = {id: 'inicio', lat: report.lat, lng: report.lng, color: t?.color || '#6B7280', label: '1', approximate: !!report.approximate, at: report.happenedAt};
  const rest = (timeline || [])
    .slice()
    .sort((a, b) => new Date(a.happenedAt) - new Date(b.happenedAt))
    .map((s, i) => ({
      id: s.id,
      lat: s.lat,
      lng: s.lng,
      color: (SIGHTING_KINDS[s.kind] || SIGHTING_KINDS.SEEN).color,
      label: String(i + 2),
      approximate: !!s.approximate,
      at: s.happenedAt,
    }));
  const markers = [start, ...rest];
  return {markers, track: markers.map(m => ({lat: m.lat, lng: m.lng}))};
}

/** Formulário de "publicar" → avistamento no caso escolhido em "Pode ser um destes?". */
export function sightingFromReportForm(form) {
  const when = parseDateTime(form.when);
  const kind =
    form.type === 'FOUND'
      ? form.currentlyWith === 'CLINICA'
        ? 'CLINIC'
        : form.currentlyWith === 'SOLTO'
        ? 'SEEN'
        : 'WITH_ME'
      : 'SEEN';
  return {
    kind,
    photo: form.photos?.[0]?.data,
    lat: form.location?.lat,
    lng: form.location?.lng,
    happenedAt: when ? when.toISOString() : undefined,
    locationNote: String(form.locationNote || '').trim() || undefined,
    district: String(form.district || '').trim() || undefined,
    note: String(form.description || '').trim().slice(0, 300) || undefined,
  };
}

/** Validação do avistamento (foto obrigatória). */
export function buildSightingBody(f) {
  if (!f.photo) return {error: 'A foto é obrigatória: é ela que confirma que é o mesmo animal.'};
  if (!f.location) return {error: 'Marque no mapa onde você viu o animal.'};
  const when = parseDateTime(f.when);
  if (!when) return {error: 'Data e hora inválidas.'};
  if (when.getTime() > Date.now() + 10 * 60e3) return {error: 'A data não pode ser no futuro.'};
  return {
    body: {
      kind: f.kind || 'SEEN',
      photo: f.photo.data,
      lat: f.location.lat,
      lng: f.location.lng,
      happenedAt: when.toISOString(),
      locationNote: String(f.locationNote || '').trim() || undefined,
      note: String(f.note || '').trim() || undefined,
    },
  };
}
