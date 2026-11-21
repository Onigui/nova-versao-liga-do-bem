/**
 * Perfis de administrador da ONG.
 *
 * Todo administrador tem role ADMIN; o tipo de acesso fica em users."adminScope":
 *   GESTOR       tudo da ONG (padrão: quem já era administrador continua com acesso total)
 *   CONTEUDO     eventos, adoção, achados e perdidos, notificações e textos
 *   FINANCEIRO   pagamentos, mensalidades, doações, relatórios e Nota Fiscal Paulista
 *   ATENDIMENTO  membros, voluntários, moderação, validações de parceiros e orçamentos
 *
 * A equipe da plataforma (PLATFORM_ADMIN_EMAILS) passa sempre. Algumas rotas valem para todas
 * as ONGs (versões do app, diagnóstico, ajuda do app…) e ficam só para a equipe da plataforma.
 */

export const ADMIN_SCOPES = ['GESTOR', 'CONTEUDO', 'FINANCEIRO', 'ATENDIMENTO'] as const;
export type AdminScope = (typeof ADMIN_SCOPES)[number];
export type AdminArea = 'conteudo' | 'financeiro' | 'atendimento' | 'gestao';

export const SCOPE_LABELS: Record<AdminScope, string> = {
  GESTOR: 'Gestor (tudo da ONG)',
  CONTEUDO: 'Conteúdo (eventos, adoção, notificações e textos)',
  FINANCEIRO: 'Financeiro (pagamentos e relatórios)',
  ATENDIMENTO: 'Atendimento (membros e moderação)',
};

const SCOPE_AREAS: Record<AdminScope, AdminArea[]> = {
  GESTOR: ['conteudo', 'financeiro', 'atendimento', 'gestao'],
  CONTEUDO: ['conteudo'],
  FINANCEIRO: ['financeiro'],
  ATENDIMENTO: ['atendimento'],
};

export function normalizeScope(v: any): AdminScope {
  const s = String(v || '').trim().toUpperCase();
  return (ADMIN_SCOPES as readonly string[]).includes(s) ? (s as AdminScope) : 'GESTOR';
}

export function isValidScope(v: any): boolean {
  return (ADMIN_SCOPES as readonly string[]).includes(String(v || '').trim().toUpperCase());
}

export function areasFor(scope: AdminScope): AdminArea[] {
  return SCOPE_AREAS[scope];
}

/** Rotas que valem para todas as ONGs: só a equipe da plataforma. */
export function isPlatformOnlyRoute(path: string, method: string): boolean {
  if (path.startsWith('/api/platform/')) return true;
  if (path.startsWith('/api/admin/app/versions') || path === '/api/admin/app/upload-apk') return true;
  if (path === '/api/app/versions/publish') return true;
  if (path.startsWith('/api/admin/diagnostics/')) return true;
  if (path === '/api/admin/migrate' || path === '/api/admin/system-status') return true;
  if (path.startsWith('/api/admin/pagbank/')) return true;
  // A ajuda do app é a mesma para todas as ONGs: qualquer administrador lê, só a plataforma escreve
  if (path.startsWith('/api/admin/help-info') && method !== 'GET') return true;
  return false;
}

const AREA_ROUTES: [AdminArea, RegExp][] = [
  ['conteudo', /^\/api\/admin\/(events|animals|adoptions|lostfound|notifications|docs|campaigns)(\/|$)/],
  ['conteudo', /^\/api\/notifications\/admin\//],
  ['financeiro', /^\/api\/admin\/(memberships|membership-payments|donations|financial-reports|nfp|partner-push-campaigns)(\/|$)/],
  ['atendimento', /^\/api\/admin\/(members|volunteers|reviews|partner-validations|quotes)(\/|$)/],
];

/** Abertas a qualquer perfil de administrador (só leitura ou a própria sessão). */
function isCommonRoute(path: string, method: string): boolean {
  if (path === '/api/admin/verify') return true;
  if (method !== 'GET') return false;
  return (
    path === '/api/admin/dashboard' ||
    path === '/api/admin/overview' ||
    path === '/api/admin/org' ||
    path.startsWith('/api/admin/help-info') ||
    path === '/api/admin/app/config'
  );
}

/** Área de uma rota de administrador; o que não estiver mapeado é "gestao" (só o Gestor). */
export function areaForRoute(path: string): AdminArea {
  for (const [area, re] of AREA_ROUTES) if (re.test(path)) return area;
  return 'gestao';
}

export type AdminAccessDecision = { ok: true } | { ok: false; status: number; error: string };

export function decideAdminAccess(input: {
  path: string;
  method: string;
  isPlatform: boolean;
  scope: AdminScope;
}): AdminAccessDecision {
  const { path, method, isPlatform, scope } = input;
  if (isPlatform) return { ok: true };
  if (isPlatformOnlyRoute(path, method)) return { ok: false, status: 403, error: 'Só a equipe da plataforma' };
  if (isCommonRoute(path, method)) return { ok: true };
  const area = areaForRoute(path);
  if (areasFor(scope).includes(area)) return { ok: true };
  return { ok: false, status: 403, error: 'Seu perfil de administrador não tem acesso a esta área' };
}

/** Só o Gestor (ou a plataforma) cria administradores ou muda perfis de acesso. */
export function canManageAdmins(isPlatform: boolean, scope: AdminScope): boolean {
  return isPlatform || scope === 'GESTOR';
}
