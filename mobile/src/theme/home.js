/**
 * Visual da nova tela inicial (estilo app de banco): cores e fonte Plus Jakarta Sans
 * (arquivos em android/app/src/main/assets/fonts).
 */
import {Platform} from 'react-native';

export const C = {
  bg: '#F6F5FB',
  card: '#FFFFFF',
  ink: '#1E1B2E',
  muted: '#6B6880',
  line: '#ECEAF3',
  primary: '#6D28D9',
  primarySoft: '#EDE9FE',
  deep: '#3B1A78',
  deepText: '#DDD6FE',
  ok: '#166534',
  okSoft: '#DCFCE7',
  warn: '#92400E',
  warnSoft: '#FEF3C7',
  bad: '#9F1239',
  badSoft: '#FFE4E6',
};

const fam = name => (Platform.OS === 'android' ? `PlusJakartaSans-${name}` : undefined);

/** Peso → fonte. No Android cada peso é um arquivo; fontWeight junto com fontFamily customizada atrapalha. */
export const F = {
  regular: {fontFamily: fam('Regular')},
  semibold: Platform.OS === 'android' ? {fontFamily: fam('SemiBold')} : {fontWeight: '600'},
  bold: Platform.OS === 'android' ? {fontFamily: fam('Bold')} : {fontWeight: '700'},
  heavy: Platform.OS === 'android' ? {fontFamily: fam('ExtraBold')} : {fontWeight: '800'},
};

export function greeting(now = new Date()) {
  const h = now.getHours();
  if (h < 5) return 'Boa noite,';
  if (h < 12) return 'Bom dia,';
  if (h < 18) return 'Boa tarde,';
  return 'Boa noite,';
}

export function planName(months) {
  const m = Number(months) || 0;
  if (m >= 12) return 'Plano Anual';
  if (m === 6) return 'Plano Semestral';
  if (m === 3) return 'Plano Trimestral';
  if (m === 1) return 'Plano Mensal';
  return m ? `Plano de ${m} meses` : 'Membro Liga do Bem';
}

export function dateBR(d) {
  if (!d) return '';
  const x = new Date(d);
  return `${String(x.getDate()).padStart(2, '0')}/${String(x.getMonth() + 1).padStart(2, '0')}/${x.getFullYear()}`;
}

export const MONTHS_ABBR = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

export function money(v) {
  return `R$ ${Number(v || 0)
    .toFixed(2)
    .replace('.', ',')}`;
}

/**
 * Todos os serviços do app, em grupos (tela "Todos os serviços" e busca).
 * `screen` é a rota; `tab` indica uma aba da barra inferior.
 */
export const SERVICE_GROUPS = [
  {
    title: 'CARTEIRINHA E BENEFÍCIOS',
    items: [
      {id: 'qr', label: 'Mostrar QR', icon: 'qr-code', bg: '#EDE9FE', fg: '#6D28D9', screen: 'Cartão', keywords: 'carteirinha cartao membro'},
      {id: 'plano', label: 'Minha assinatura', icon: 'card', bg: '#EDE9FE', fg: '#6D28D9', screen: 'MembershipCheckout', keywords: 'plano pagar renovar membro'},
      {id: 'parceiros', label: 'Parceiros perto', icon: 'location', bg: '#EDE9FE', fg: '#6D28D9', screen: 'Parceiros', keywords: 'loja desconto mapa'},
      {id: 'precos', label: 'Comparar preços', icon: 'pricetags', bg: '#FCE7F3', fg: '#9D174D', screen: 'ComparePrices', keywords: 'preco tabela consulta vacina'},
      {id: 'orcamento', label: 'Orçamento', icon: 'flash', bg: '#FCE7F3', fg: '#9D174D', screen: 'QuotesList', keywords: 'orcamento proposta lista remedio', isNew: true},
    ],
  },
  {
    title: 'MEUS PETS',
    items: [
      {id: 'pets', label: 'Meus pets', icon: 'paw', bg: '#DCFCE7', fg: '#15803D', screen: 'Pets', keywords: 'pet cachorro gato'},
      {id: 'addpet', label: 'Adicionar pet', icon: 'add-circle', bg: '#DCFCE7', fg: '#15803D', screen: 'AddPet', keywords: 'cadastrar pet'},
      {id: 'vacinas', label: 'Vacinas', icon: 'medkit', bg: '#CCFBF1', fg: '#0F766E', screen: 'Pets', keywords: 'vacina carteira vacinacao veterinario carimbo'},
      {id: 'achados', label: 'Achados e perdidos', icon: 'search', bg: '#FFE4E6', fg: '#BE123C', screen: 'LostFound', keywords: 'perdi perdido encontrei achado mapa sumiu', isNew: true},
    ],
  },
  {
    title: 'AJUDAR A LIGA',
    items: [
      {id: 'doar', label: 'Doar', icon: 'heart', bg: '#FFE4E6', fg: '#BE123C', screen: 'Donation', keywords: 'doacao pix ajudar'},
      {id: 'nfp', label: 'Nota Fiscal Paulista', icon: 'receipt', bg: '#D1FAE5', fg: '#047857', screen: 'NotaFiscal', keywords: 'nota fiscal cpf doacao automatica', isNew: true},
      {id: 'adotar', label: 'Adotar', icon: 'happy', bg: '#FCE7F3', fg: '#9D174D', screen: 'Adoções', keywords: 'adocao adotar animal'},
      {id: 'voluntario', label: 'Voluntariado', icon: 'people', bg: '#E0F2FE', fg: '#0369A1', screen: 'Volunteer', keywords: 'voluntario ajudar'},
      {id: 'eventos', label: 'Eventos', icon: 'calendar', bg: '#FEF3C7', fg: '#B45309', screen: 'EventsCalendar', keywords: 'evento feira agenda'},
      {id: 'transparencia', label: 'Transparência', icon: 'stats-chart', bg: '#E0F2FE', fg: '#0369A1', screen: 'Transparency', keywords: 'prestacao contas gastos'},
    ],
  },
  {
    title: 'MINHA CONTA',
    items: [
      {id: 'notificacoes', label: 'Notificações', icon: 'notifications', bg: '#F1F0F6', fg: '#1E1B2E', screen: 'Notifications', keywords: 'avisos'},
      {id: 'doacoes', label: 'Minhas doações', icon: 'document-text', bg: '#F1F0F6', fg: '#1E1B2E', screen: 'MyDonations', keywords: 'recibo comprovante'},
      {id: 'adocoes', label: 'Minhas adoções', icon: 'paw', bg: '#F1F0F6', fg: '#1E1B2E', screen: 'MyAdoptions', keywords: 'adocao'},
      {id: 'meuseventos', label: 'Meus eventos', icon: 'calendar-outline', bg: '#F1F0F6', fg: '#1E1B2E', screen: 'MyEvents', keywords: 'inscricao'},
      {id: 'orcamentos', label: 'Meus orçamentos', icon: 'list', bg: '#F1F0F6', fg: '#1E1B2E', screen: 'QuotesList', keywords: 'reserva proposta'},
      {id: 'meusavisos', label: 'Meus avisos', icon: 'megaphone', bg: '#F1F0F6', fg: '#1E1B2E', screen: 'LostFoundMine', keywords: 'achados perdidos'},
      {id: 'perfil', label: 'Perfil', icon: 'person', bg: '#F1F0F6', fg: '#1E1B2E', screen: 'Perfil', keywords: 'dados conta senha'},
      {id: 'ajuda', label: 'Ajuda e contatos', icon: 'information-circle', bg: '#F1F0F6', fg: '#1E1B2E', screen: 'Info', keywords: 'contato whatsapp sobre'},
      {id: 'termos', label: 'Termos e privacidade', icon: 'document', bg: '#F1F0F6', fg: '#1E1B2E', screen: 'Legal', keywords: 'lgpd privacidade'},
    ],
  },
];

const norm = s =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export function searchServices(query, groups = SERVICE_GROUPS) {
  const q = norm(query).trim();
  if (!q) return groups;
  return groups
    .map(g => ({...g, items: g.items.filter(i => norm(`${i.label} ${i.keywords || ''}`).includes(q))}))
    .filter(g => g.items.length);
}

/** Atalhos do Início (8: o último é "Ver tudo"). */
export const HOME_SHORTCUTS = ['pets', 'orcamento', 'achados', 'precos', 'doar', 'nfp', 'eventos'];

export function findService(id) {
  for (const g of SERVICE_GROUPS) {
    const s = g.items.find(i => i.id === id);
    if (s) return s;
  }
  return null;
}
