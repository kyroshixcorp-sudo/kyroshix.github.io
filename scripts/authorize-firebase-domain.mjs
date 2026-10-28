#!/usr/bin/env node
/**
 * Adiciona um hostname à lista authorizedDomains do Firebase Authentication.
 *
 * A lista é uma configuração do SERVIDOR do projeto Firebase: nenhum commit,
 * arquivo público ou código de navegador pode alterá-la. Este script usa a
 * API administrativa oficial do Identity Platform com um token OAuth2 SEU.
 * Nenhuma credencial é lida do repositório, impressa ou enviada a terceiros.
 *
 * Uso:
 *   node scripts/authorize-firebase-domain.mjs                    # simulação
 *   npm run check:auth -- https://<host>/                        # verificar
 *   GOOGLE_OAUTH_TOKEN="$(gcloud auth print-access-token)" \
 *     node scripts/authorize-firebase-domain.mjs --apply
 *   node scripts/authorize-firebase-domain.mjs --domain outro.host.dev --apply
 *
 * Obtenha o token com uma conta que tenha firebaseauth.configs.update no
 * projeto (papel Firebase Authentication Admin / Editor), e habilite a API
 * Identity Toolkit se necessário.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_DOMAIN = 'arena-6a25f84d-kyroshix-github-io-kyroshix-preview.kyroshixcorp.workers.dev';
export const SECONDARY_DOMAIN = 'arena-1ad908f7-kyroshix-github-io-kyroshix-preview.kyroshixcorp.workers.dev';
const ADMIN = 'https://identitytoolkit.googleapis.com/admin/v2';
const PUBLIC_ENDPOINT = 'https://identitytoolkit.googleapis.com/v1/projects';

/** Aceita somente hostnames exatos, sem esquema, porta, caminho ou curinga. */
export function isHostname(value) {
  if (typeof value !== 'string' || !value || value.length > 253) return false;
  const host = value.toLowerCase();
  if (/[/\\@?#:]|\*|\s|\.\./.test(host)) return false;
  // localhost é autorizado por padrão pelo Firebase e precisa ser preservado.
  if (host === 'localhost') return true;
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(host)) return false;
  // Não autorizar domínios genéricos de terceiros: abriria o projeto a qualquer site.
  if (['workers.dev', 'web.app', 'firebaseapp.com', 'googleapis.com'].includes(host)) return false;
  return true;
}

/** Preserva a lista atual, remove duplicatas e devolve só o que falta. */
export function planDomains(current, additions) {
  const base = Array.isArray(current) ? current.filter(isHostname).map(d => d.toLowerCase()) : [];
  const seen = new Set(base);
  const added = [];
  for (const raw of additions || []) {
    const host = String(raw || '').trim().toLowerCase();
    if (!isHostname(host)) throw Error('Hostname inválido: ' + JSON.stringify(raw) +
      ' — use apenas o host, sem https://, sem barra e sem curingas.');
    if (!seen.has(host)) { seen.add(host); added.push(host); }
  }
  const domains = [...base, ...added];
  if (domains.length > 100) throw Error('Lista de domínios grande demais; revise a configuração no Console.');
  return { added, domains, changed: added.length > 0 };
}

async function readJson(url, options, request) {
  let response;
  try {
    response = await request(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(20000) });
  } catch (error) {
    throw Error('Não foi possível contactar o Identity Platform. Verifique a conexão/proxy e libere identitytoolkit.googleapis.com (' +
      (error?.cause?.code || error?.name || 'erro de rede') + ').');
  }
  const text = await response.text();
  let data = null;
  try { data = JSON.parse(text); } catch { /* corpo não JSON */ }
  if (!response.ok) {
    const reason = data?.error?.message || data?.error?.status || ('HTTP ' + response.status);
    throw Error('Falha na API do Identity Platform: ' + String(reason).slice(0, 300));
  }
  return data;
}

/** Lista pública somente leitura — não exige token. */
export async function publicDomains(apiKey, request = fetch) {
  const url = new URL(PUBLIC_ENDPOINT);
  url.searchParams.set('key', apiKey);
  const data = await readJson(url.href, { method: 'GET' }, request);
  if (!Array.isArray(data?.authorizedDomains)) throw Error('O Firebase não retornou authorizedDomains.');
  return data.authorizedDomains;
}

/** Config administrativa — exige OAuth2 com firebaseauth.configs.update. */
export async function adminDomains(projectId, token, request = fetch) {
  const data = await readJson(`${ADMIN}/projects/${encodeURIComponent(projectId)}/config`, {
    method: 'GET',
    headers: {
      Authorization: 'Bearer ' + token,
      'X-Goog-User-Project': projectId,
      Accept: 'application/json'
    }
  }, request);
  if (!Array.isArray(data?.authorizedDomains)) throw Error('A config administrativa não retornou authorizedDomains.');
  return data.authorizedDomains;
}

export async function updateDomains(projectId, token, domains, request = fetch) {
  const url = `${ADMIN}/projects/${encodeURIComponent(projectId)}/config?updateMask=authorizedDomains`;
  const data = await readJson(url, {
    method: 'PATCH',
    headers: {
      Authorization: 'Bearer ' + token,
      'X-Goog-User-Project': projectId,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({ authorizedDomains: domains })
  }, request);
  return Array.isArray(data?.authorizedDomains) ? data.authorizedDomains : domains;
}

export function parseArgs(argv) {
  const options = { domains: [], apply: false, check: false, project: '', allPreviews: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--apply') options.apply = true;
    else if (arg === '--check') options.check = true;
    else if (arg === '--all-previews') options.allPreviews = true;
    else if (arg === '--domain' && argv[i + 1]) options.domains.push(...argv[++i].split(','));
    else if (arg === '--project' && argv[i + 1]) options.project = argv[++i];
    else if (arg.startsWith('--domain=')) options.domains.push(...arg.slice(9).split(','));
    else if (arg.startsWith('--project=')) options.project = arg.slice(10);
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw Error('Argumento desconhecido: ' + arg);
  }
  if (!options.domains.length) options.domains = [DEFAULT_DOMAIN];
  if (options.allPreviews && !options.domains.includes(SECONDARY_DOMAIN)) options.domains.push(SECONDARY_DOMAIN);
  return options;
}

export async function run(argv = [], env = process.env, request = fetch, log = console.log) {
  const options = parseArgs(argv);
  if (options.help) {
    log('Uso: node scripts/authorize-firebase-domain.mjs [--domain host] [--all-previews] [--check] [--apply]');
    log('Sem --apply é uma simulação. --apply exige GOOGLE_OAUTH_TOKEN.');
    return { help: true };
  }
  const config = JSON.parse(readFileSync(join(ROOT, 'dist/auth-config.json'), 'utf8'));
  const projectId = options.project || config.firebase?.projectId;
  const apiKey = config.firebase?.apiKey;
  if (!projectId || !apiKey) throw Error('dist/auth-config.json está incompleto.');

  const current = await publicDomains(apiKey, request);
  const { added, domains, changed } = planDomains(current, options.domains);
  const wanted = options.domains.map(d => d.trim().toLowerCase());
  const missing = wanted.filter(d => !current.map(x => x.toLowerCase()).includes(d));

  if (options.check || !options.apply) {
    log('Projeto Firebase: ' + projectId);
    log('Domínios autorizados hoje (' + current.length + '):');
    for (const d of current) log('  - ' + d);
    log('Solicitado: ' + wanted.join(', '));
    log('Falta autorizar: ' + (missing.length ? missing.join(', ') : 'nenhum — já está autorizado.'));
    if (options.check) return { check: true, authorized: missing.length === 0, missing, domains: current };
    log('\nSIMULAÇÃO — nada foi alterado. Para aplicar:');
    log('  1) Firebase Console → ' + projectId + ' → Authentication → Settings → Authorized domains');
    log('     → Add domain → ' + missing.join(' , ') + '   (sem https:// e sem /)');
    log('  2) Ou, com um token seu: GOOGLE_OAUTH_TOKEN="$(gcloud auth print-access-token)" \\');
    log('       node scripts/authorize-firebase-domain.mjs --apply');
    return { applied: false, added, domains, changed };
  }

  const token = env.GOOGLE_OAUTH_TOKEN || env.GCLOUD_ACCESS_TOKEN;
  if (!token) throw Error('Defina GOOGLE_OAUTH_TOKEN (ex.: "$(gcloud auth print-access-token)") antes de usar --apply.');
  if (!changed) {
    log('Nada a fazer: todos os domínios solicitados já estão autorizados.');
    return { applied: false, added: [], domains: current, changed: false };
  }
  // Fonte de verdade para a escrita: a config administrativa, não a lista pública.
  const live = await adminDomains(projectId, token, request);
  const plan = planDomains(live, options.domains);
  const result = await updateDomains(projectId, token, plan.domains, request);
  log('Domínios adicionados: ' + (plan.added.join(', ') || 'nenhum'));
  log('Lista após a atualização (' + result.length + ' domínios).');
  log('Verifique com: npm run check:auth -- https://' + wanted[0] + '/');
  return { applied: true, added: plan.added, domains: result, changed: plan.changed };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await run(process.argv.slice(2));
    if (result.check && !result.authorized) process.exitCode = 1;
  } catch (error) {
    console.error('ERRO: ' + (error?.message || String(error)));
    process.exitCode = 1;
  }
}
