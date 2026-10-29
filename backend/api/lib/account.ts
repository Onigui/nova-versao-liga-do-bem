/**
 * Exclusão de conta (exigência da Play Store e direito do titular na LGPD).
 *
 * - No app: POST /api/user/account/delete  { password }       (com token)
 * - Na web: POST /api/public/account/delete { email, password } (sem o app)
 * - Páginas públicas: GET /api/excluir-conta e GET /api/privacidade
 *
 * O que acontece: apagamos os dados pessoais e o conteúdo da pessoa (pets, avisos,
 * comentários, notificações, aparelhos) e a conta é anonimizada e desativada.
 * Pagamentos e doações ficam guardados sem identificação, porque a Liga precisa
 * deles para prestação de contas (obrigação legal/fiscal — LGPD art. 16, I).
 * O CPF é liberado: a pessoa pode criar uma conta nova depois, se quiser.
 */
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

type Ctx = {
  req: any;
  res: any;
  path: string;
  method: string;
  body: any;
  db: any;
  authUser: () => { userId: string };
};

export const ACCOUNT_PATHS = ['/api/user/account/delete', '/api/public/account/delete', '/api/excluir-conta', '/api/privacidade'];
export function isAccountPath(path: string) {
  return ACCOUNT_PATHS.includes(path);
}

/** Passos de limpeza. Cada um é independente: uma tabela que não exista não impede o resto. */
const CLEANUP: string[] = [
  `DELETE FROM device_tokens WHERE "userId" = $1`,
  `DELETE FROM notifications WHERE "userId" = $1`,
  `DELETE FROM lf_alert_prefs WHERE "userId" = $1`,
  `DELETE FROM lf_alerts_sent WHERE "userId" = $1`,
  `DELETE FROM lf_follows WHERE "userId" = $1`,
  `DELETE FROM lf_comment_flags WHERE "userId" = $1`,
  `DELETE FROM nfp_supporters WHERE "userId" = $1`,
  `DELETE FROM partner_review_prompts WHERE "userId" = $1`,
  `DELETE FROM event_registrations WHERE "userId" = $1`,
  `DELETE FROM volunteer_works WHERE "userId" = $1`,
  // Pets levam junto histórico de saúde e vacinas (ON DELETE CASCADE)
  `DELETE FROM pets WHERE "userId" = $1`,
  `DELETE FROM adoptions WHERE "userId" = $1 AND status = 'PENDING'`,
  // Orçamentos: abertos são cancelados; receitas (fotos) apagadas
  `UPDATE quote_reservations SET status = 'CANCELLED' WHERE "userId" = $1 AND status = 'RESERVED'`,
  `UPDATE quote_requests SET status = 'CANCELLED', notes = NULL WHERE "userId" = $1 AND status = 'OPEN'`,
  `DELETE FROM quote_prescriptions WHERE "requestId" IN (SELECT id FROM quote_requests WHERE "userId" = $1)`,
  // Achados e perdidos: some do mapa e do mural; fotos apagadas
  `UPDATE lf_reports SET status = 'REMOVED', hidden = true, "hiddenReason" = 'ACCOUNT_DELETED', whatsapp = NULL,
     description = NULL, "locationNote" = NULL, "updatedAt" = NOW() WHERE "userId" = $1`,
  `DELETE FROM lf_photos WHERE "reportId" IN (SELECT id FROM lf_reports WHERE "userId" = $1)`,
  `UPDATE lf_sightings SET hidden = true, "hiddenBy" = 'ACCOUNT_DELETED', photo = NULL, note = NULL, "locationNote" = NULL WHERE "userId" = $1`,
  `UPDATE lf_comments SET hidden = true, "hiddenBy" = 'ACCOUNT_DELETED', body = '', photo = NULL WHERE "userId" = $1`,
  // Avaliação continua contando na média do parceiro, sem texto e sem autor
  `UPDATE partner_reviews SET comment = NULL, "updatedAt" = NOW() WHERE "userId" = $1`,
  `UPDATE memberships SET status = 'INACTIVE', "qrCode" = NULL, "updatedAt" = NOW() WHERE "userId" = $1`,
];

export async function deleteAccount(db: any, userId: string): Promise<void> {
  for (const sql of CLEANUP) {
    await db.$executeRawUnsafe(sql, userId).catch((e: any) => {
      console.warn('⚠️ exclusão de conta: passo ignorado:', String(e?.message || e).slice(0, 120));
    });
  }
  // A conta em si: sem dados pessoais, sem como entrar de novo
  const unusable = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
  await db.$executeRawUnsafe(
    `UPDATE users SET name = 'Conta excluída', email = $2, phone = NULL, cpf = NULL, avatar = NULL,
       password = $3, "isActive" = false, "notificationsEnabled" = false, "locationEnabled" = false, "updatedAt" = NOW()
     WHERE id = $1`,
    userId,
    `excluida+${userId}@contas.ligadobem.invalid`,
    unusable,
  );
}

async function checkUser(db: any, where: { id?: string; email?: string }, password: string) {
  const rows: any[] = where.id
    ? await db.$queryRawUnsafe(`SELECT id, role, password, "isActive" FROM users WHERE id = $1 LIMIT 1`, where.id)
    : await db.$queryRawUnsafe(`SELECT id, role, password, "isActive" FROM users WHERE lower(email) = lower($1) LIMIT 1`, String(where.email || '').trim());
  const u = rows[0];
  if (!u || u.isActive === false) return { error: 'E-mail ou senha incorretos.', status: 401 };
  const ok = password ? await bcrypt.compare(String(password), u.password || '').catch(() => false) : false;
  if (!ok) return { error: 'Senha incorreta.', status: 401 };
  if (u.role === 'ADMIN' || u.role === 'PARTNER') {
    return {
      error: 'Contas de parceiro ou da administração são encerradas pela Liga. Fale com a equipe.',
      status: 409,
    };
  }
  return { user: u };
}

// Tentativas erradas na página web: no máximo 5 a cada 15 min por e-mail (por instância)
const webAttempts = new Map<string, number[]>();
function tooMany(key: string) {
  const now = Date.now();
  const list = (webAttempts.get(key) || []).filter(t => now - t < 15 * 60 * 1000);
  webAttempts.set(key, list);
  return list.length >= 5;
}
function noteFail(key: string) {
  const list = webAttempts.get(key) || [];
  list.push(Date.now());
  webAttempts.set(key, list);
}

export async function handleAccount(ctx: Ctx): Promise<boolean> {
  const { path, method, res, db } = ctx;
  if (!isAccountPath(path)) return false;
  const body = ctx.body && typeof ctx.body === 'object' ? ctx.body : {};

  if (path === '/api/privacidade' && method === 'GET') {
    sendHtml(res, privacyPage());
    return true;
  }
  if (path === '/api/excluir-conta' && method === 'GET') {
    sendHtml(res, deletePage());
    return true;
  }
  if (!db) {
    res.status(503).json({ error: 'Database not configured' });
    return true;
  }

  if (path === '/api/user/account/delete' && method === 'POST') {
    let userId: string;
    try {
      userId = ctx.authUser().userId;
    } catch (e: any) {
      res.status(401).json({ error: e?.message || 'Entre na sua conta.' });
      return true;
    }
    const check = await checkUser(db, { id: userId }, body.password);
    if (check.error) {
      // 403 (e não 401) para senha errada: o app não deve achar que a sessão venceu
      res.status(check.status === 401 ? 403 : check.status).json({ error: check.error });
      return true;
    }
    await deleteAccount(db, userId);
    console.log('🗑️ Conta excluída pelo app');
    res.status(200).json({ ok: true, message: 'Sua conta foi excluída.' });
    return true;
  }

  if (path === '/api/public/account/delete' && method === 'POST') {
    const email = String(body.email || '').trim().toLowerCase();
    if (!email || !body.password) {
      res.status(400).json({ error: 'Informe o e-mail e a senha da conta.' });
      return true;
    }
    if (tooMany(email)) {
      res.status(429).json({ error: 'Muitas tentativas. Aguarde alguns minutos.' });
      return true;
    }
    const check = await checkUser(db, { email }, body.password);
    if (check.error) {
      if (check.status === 401) noteFail(email);
      res.status(check.status).json({ error: check.status === 401 ? 'E-mail ou senha incorretos.' : check.error });
      return true;
    }
    await deleteAccount(db, check.user.id);
    console.log('🗑️ Conta excluída pela página web');
    res.status(200).json({ ok: true, message: 'Sua conta foi excluída.' });
    return true;
  }

  res.status(405).json({ error: 'Método não permitido' });
  return true;
}

function sendHtml(res: any, html: string) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.status(200).send(html);
}

const ORG = 'Liga do Bem Botucatu';
const CNPJ = '27.644.955/0001-38';
const CONTACT = 'contato@ligadobem.com';

function shell(title: string, inner: string) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} · ${ORG}</title>
<style>
:root{--bg:#F6F5FB;--card:#fff;--ink:#1F2937;--muted:#4B5563;--brand:#5B21B6;--line:#E5E7EB;--danger:#B91C1C}
@media (prefers-color-scheme:dark){:root{--bg:#121018;--card:#1C1926;--ink:#F3F4F6;--muted:#C4C4D0;--brand:#A78BFA;--line:#2E2A3A;--danger:#F87171}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
header{background:linear-gradient(135deg,#3B1A78,#5B21B6);color:#fff;padding:28px 16px;text-align:center}
header h1{margin:0;font-size:24px}header p{margin:4px 0 0;opacity:.9}
main{max-width:720px;margin:0 auto;padding:20px 16px 48px}
section{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:20px;margin-bottom:16px}
h2{font-size:18px;margin:0 0 8px}p,li{color:var(--muted)}ul{padding-left:20px}
label{display:block;font-weight:600;margin:12px 0 6px}
input{width:100%;padding:12px;border-radius:12px;border:1px solid var(--line);background:var(--bg);color:var(--ink);font-size:16px}
button{margin-top:16px;width:100%;padding:14px;border:0;border-radius:12px;background:var(--danger);color:#fff;font-weight:700;font-size:16px;cursor:pointer}
button:disabled{opacity:.6}.msg{margin-top:12px;font-weight:600}.ok{color:#047857}.err{color:var(--danger)}
a{color:var(--brand)}
</style></head><body><header><h1>${title}</h1><p>${ORG}</p></header><main>${inner}</main></body></html>`;
}

export function deletePage() {
  return shell(
    'Excluir minha conta',
    `<section><h2>Como excluir</h2>
<p>No aplicativo: <b>Perfil → Excluir minha conta</b>. Se você não tem mais o app, use o formulário abaixo com o e-mail e a senha da sua conta.</p>
<p>Esqueceu a senha? Use “Esqueci minha senha” no app ou escreva para <a href="mailto:${CONTACT}?subject=Excluir%20minha%20conta">${CONTACT}</a> com o assunto “Excluir minha conta”.</p></section>
<section><h2>O que é apagado</h2><ul>
<li>Nome, e-mail, telefone, CPF e foto do perfil;</li>
<li>Seus pets, histórico de saúde e vacinas;</li>
<li>Seus avisos de achados e perdidos, avistamentos, fotos e comentários;</li>
<li>Notificações, aparelhos cadastrados e preferências;</li>
<li>A carteirinha de membro (os descontos deixam de valer).</li></ul>
<h2>O que fica guardado, sem identificar você</h2>
<ul><li>Registros de pagamentos e doações, pela obrigação de prestação de contas da associação;</li>
<li>A nota (estrelas) de avaliações de parceiros, sem o texto e sem o seu nome.</li></ul>
<p>A exclusão é imediata e não pode ser desfeita. Pagamentos já feitos não são reembolsados automaticamente.</p></section>
<section><h2>Excluir agora</h2>
<form id="f"><label for="e">E-mail da conta</label><input id="e" type="email" autocomplete="email" required>
<label for="p">Senha</label><input id="p" type="password" autocomplete="current-password" required>
<label><input id="c" type="checkbox" style="width:auto" required> Entendo que a exclusão é definitiva.</label>
<button id="b" type="submit">Excluir minha conta</button><div id="m" class="msg"></div></form></section>
<script>
document.getElementById('f').addEventListener('submit',async function(ev){ev.preventDefault();
var b=document.getElementById('b'),m=document.getElementById('m');b.disabled=true;m.textContent='Excluindo…';m.className='msg';
try{var r=await fetch('/api/public/account/delete',{method:'POST',headers:{'Content-Type':'application/json'},
body:JSON.stringify({email:document.getElementById('e').value,password:document.getElementById('p').value})});
var d=await r.json().catch(function(){return{}});
if(r.ok){m.textContent='Pronto: sua conta foi excluída.';m.className='msg ok';document.getElementById('p').value='';}
else{m.textContent=d.error||'Não foi possível excluir.';m.className='msg err';b.disabled=false;}}
catch(e){m.textContent='Sem conexão. Tente de novo.';m.className='msg err';b.disabled=false;}});
</script>`,
  );
}

export function privacyPage() {
  return shell(
    'Política de Privacidade',
    `<section><p>Esta política explica como a ${ORG} (CNPJ ${CNPJ}, Botucatu/SP) trata os dados pessoais de quem usa o aplicativo da Liga do Bem e o aplicativo Liga do Bem Parceiros, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018). Última atualização: outubro de 2026.</p></section>
<section><h2>Dados que coletamos</h2><ul>
<li><b>Cadastro:</b> nome, e-mail, telefone, CPF e senha (guardada criptografada). O CPF é obrigatório para garantir uma conta por pessoa e validar a carteirinha de membro.</li>
<li><b>Localização:</b> usada, com a sua permissão, para mostrar parceiros e animais perdidos perto de você e para marcar avisos e avistamentos no mapa. Quando o animal está na sua casa, o mapa público mostra só a região aproximada.</li>
<li><b>Fotos e câmera:</b> fotos que você escolhe enviar (perfil, pets, avisos de achados e perdidos, receitas para orçamento).</li>
<li><b>Pets:</b> nome, espécie, vacinas e histórico de saúde que você ou o veterinário parceiro registram.</li>
<li><b>Pagamentos:</b> valores, datas e situação de mensalidades e doações. Os dados do cartão são enviados direto ao PagBank, criptografados; a Liga não guarda o número do cartão.</li>
<li><b>Uso de benefícios:</b> registro de quando a carteirinha é validada em um parceiro.</li>
<li><b>Notificações:</b> o identificador do aparelho para enviar avisos (Firebase Cloud Messaging).</li></ul></section>
<section><h2>Para que usamos</h2><ul>
<li>Criar e proteger a sua conta e emitir a carteirinha de membro;</li>
<li>Liberar descontos nos parceiros para membros ativos;</li>
<li>Processar mensalidades e doações e prestar contas;</li>
<li>Avisar sobre adoções, eventos, campanhas e animais perdidos perto de você;</li>
<li>Combater fraudes e abusos (por exemplo, golpes no mural de achados e perdidos).</li></ul>
<p>Não vendemos seus dados e não usamos para publicidade de terceiros.</p></section>
<section><h2>Com quem compartilhamos</h2><ul>
<li><b>Parceiros:</b> ao validar a carteirinha, o parceiro vê seu nome e se você é membro ativo; em orçamentos, vê apenas o que você enviar.</li>
<li><b>Outros membros:</b> avisos de achados e perdidos, avistamentos e comentários que você publica ficam visíveis para quem tem conta.</li>
<li><b>Prestadores de serviço:</b> PagBank (pagamentos), Supabase (banco de dados, no Brasil), Vercel (servidor), Google Firebase (notificações) e serviço de e-mail transacional.</li>
<li>Autoridades, quando exigido por lei.</li></ul></section>
<section><h2>Por quanto tempo guardamos</h2>
<p>Enquanto a sua conta existir. Ao excluir a conta, apagamos os dados pessoais e o conteúdo; registros de pagamentos e doações são mantidos sem identificação pelo prazo exigido para a prestação de contas da associação.</p></section>
<section><h2>Seus direitos</h2>
<p>Você pode acessar e corrigir seus dados no app (Perfil), revogar permissões de localização, câmera e notificações nas configurações do celular e <a href="/api/excluir-conta">excluir sua conta</a> a qualquer momento. Dúvidas ou pedidos: <a href="mailto:${CONTACT}">${CONTACT}</a>.</p></section>
<section><h2>Segurança</h2><p>Conexões criptografadas (HTTPS), senhas com hash, acesso restrito à administração e QR Code da carteirinha que muda a cada poucos minutos.</p></section>
<section><h2>Crianças</h2><p>O aplicativo é destinado a maiores de 18 anos.</p></section>`,
  );
}
