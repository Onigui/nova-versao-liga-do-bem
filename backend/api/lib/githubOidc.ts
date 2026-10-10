/**
 * Autenticação do CI por OIDC do GitHub Actions — sem segredo compartilhado.
 *
 * Cada execução do workflow pede ao GitHub um JWT assinado (RS256) que diz de qual
 * repositório, branch e evento ele veio. A API confere a assinatura com as chaves
 * públicas do GitHub (JWKS) e as claims abaixo. Não há token para cadastrar, vazar ou rotacionar.
 */
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

export const GITHUB_OIDC_ISSUER = 'https://token.actions.githubusercontent.com';
export const PUBLISH_AUDIENCE = 'liga-do-bem-app-publish';
const JWKS_URL = `${GITHUB_OIDC_ISSUER}/.well-known/jwks`;
const JWKS_TTL_MS = 60 * 60 * 1000;

let jwksCache: { at: number; keys: Record<string, string> } | null = null;

async function loadJwks(force = false): Promise<Record<string, string>> {
  if (!force && jwksCache && Date.now() - jwksCache.at < JWKS_TTL_MS) return jwksCache.keys;
  const res = await fetch(JWKS_URL, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`JWKS do GitHub indisponível (HTTP ${res.status})`);
  const body: any = await res.json();
  const keys: Record<string, string> = {};
  for (const jwk of body?.keys || []) {
    if (!jwk?.kid || jwk.kty !== 'RSA') continue;
    keys[jwk.kid] = crypto
      .createPublicKey({ key: jwk, format: 'jwk' })
      .export({ type: 'spki', format: 'pem' })
      .toString();
  }
  jwksCache = { at: Date.now(), keys };
  return keys;
}

export type PublishPolicy = {
  repository: string; // ex.: "Onigui/nova-versao-liga-do-bem"
  refs: string[]; // ex.: ["refs/heads/master"]
};

export function publishPolicyFromEnv(): PublishPolicy {
  return {
    repository: (process.env.CI_PUBLISH_REPOSITORY || 'Onigui/nova-versao-liga-do-bem').trim(),
    refs: (process.env.CI_PUBLISH_REFS || 'refs/heads/master,refs/heads/main')
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean),
  };
}

/**
 * Retorna as claims se o token for um OIDC válido do GitHub para o repositório/branch
 * permitidos; senão lança erro com o motivo (não inclui o token na mensagem).
 */
export async function verifyGithubOidc(token: string, policy = publishPolicyFromEnv()) {
  const decoded: any = jwt.decode(token, { complete: true });
  const kid = decoded?.header?.kid;
  if (!kid || decoded?.header?.alg !== 'RS256') throw new Error('token OIDC malformado');

  let keys = await loadJwks();
  if (!keys[kid]) keys = await loadJwks(true); // GitHub rotacionou as chaves
  const pem = keys[kid];
  if (!pem) throw new Error('chave do token OIDC desconhecida');

  const claims: any = jwt.verify(token, pem, {
    algorithms: ['RS256'],
    issuer: GITHUB_OIDC_ISSUER,
    audience: PUBLISH_AUDIENCE,
  });

  if (String(claims.repository || '').toLowerCase() !== policy.repository.toLowerCase()) {
    throw new Error(`repositório não autorizado: ${claims.repository}`);
  }
  if (!policy.refs.includes(String(claims.ref || ''))) {
    throw new Error(`branch não autorizada: ${claims.ref}`);
  }
  if (!['push', 'workflow_dispatch'].includes(String(claims.event_name || ''))) {
    throw new Error(`evento não autorizado: ${claims.event_name}`);
  }
  return claims;
}

/** Apenas para testes: limpa o cache de chaves. */
export function _resetJwksCacheForTests() {
  jwksCache = null;
}
