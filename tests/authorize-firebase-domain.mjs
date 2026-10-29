import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DEFAULT_DOMAIN, SECONDARY_DOMAIN, isHostname, planDomains,
  publicDomains, adminDomains, updateDomains, parseArgs, run
} from '../scripts/authorize-firebase-domain.mjs';

const config = JSON.parse(readFileSync(new URL('../dist/auth-config.json', import.meta.url), 'utf8'));
const API_KEY = config.firebase.apiKey;
const PROJECT = config.firebase.projectId;
const PUBLIC_URL = 'https://identitytoolkit.googleapis.com/v1/projects?key=' + API_KEY;
const ADMIN_URL = 'https://identitytoolkit.googleapis.com/admin/v2/projects/' + PROJECT + '/config';
const TOKEN = 'token-secreto-de-teste';

const BASE = ['localhost', 'kyroshix-releases.firebaseapp.com', 'releases.kyroshixcorp.workers.dev',
  'kyroshix-preview.kyroshixcorp.workers.dev'];

function mock(options = {}) {
  const state = {
    publicDomains: [...(options.publicDomains || BASE)],
    adminDomains: [...(options.adminDomains || BASE)],
    calls: [],
    patches: [],
    failPatch: options.failPatch || null
  };
  const request = async (url, init = {}) => {
    state.calls.push({ url, init });
    const respond = (status, data) => ({ ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(data) });
    if (url.startsWith('https://identitytoolkit.googleapis.com/v1/projects')) {
      return respond(200, { projectId: '575800990212', authorizedDomains: state.publicDomains });
    }
    if (url.startsWith(ADMIN_URL + '?updateMask=authorizedDomains') && init.method === 'PATCH') {
      if (state.failPatch) return respond(state.failPatch, { error: { message: 'PERMISSION_DENIED: sem firebaseauth.configs.update' } });
      const body = JSON.parse(init.body);
      state.patches.push(body);
      state.adminDomains = body.authorizedDomains;
      state.publicDomains = body.authorizedDomains;
      return respond(200, { authorizedDomains: body.authorizedDomains });
    }
    if (url === ADMIN_URL && init.method === 'GET') {
      return respond(200, { name: 'projects/' + PROJECT + '/config', authorizedDomains: state.adminDomains });
    }
    return respond(404, { error: { message: 'not found' } });
  };
  return { state, request };
}

/* ------------------------------------------------------------- validação */
assert.equal(isHostname(DEFAULT_DOMAIN), true);
assert.equal(isHostname('localhost'), true, 'padrão do Firebase precisa sobreviver ao PATCH');
assert.equal(isHostname('kyroshix-preview.kyroshixcorp.workers.dev'), true);
for (const bad of [
  'https://' + DEFAULT_DOMAIN, DEFAULT_DOMAIN + '/', '*.workers.dev', 'workers.dev',
  'a b.com', 'host:443', 'host.com/path', '', '-host.com', 'host..com', 'x'.repeat(300)
]) assert.equal(isHostname(bad), false, 'deveria rejeitar ' + bad);

const planned = planDomains(BASE, [DEFAULT_DOMAIN, 'releases.kyroshixcorp.workers.dev']);
assert.deepEqual(planned.added, [DEFAULT_DOMAIN]);
assert.equal(planned.domains.length, BASE.length + 1);
assert.equal(planned.domains[0], 'localhost');
assert.equal(planned.changed, true);
assert.equal(planDomains(BASE, ['localhost']).changed, false);
assert.throws(() => planDomains(BASE, ['https://errado.com']), /Hostname inválido/);

const args = parseArgs(['--domain', 'a.dev,b.dev', '--all-previews', '--apply']);
assert.equal(args.apply, true);
assert.ok(args.domains.includes('a.dev') && args.domains.includes('b.dev'));
assert.ok(args.domains.includes(SECONDARY_DOMAIN));
assert.deepEqual(parseArgs([]).domains, [DEFAULT_DOMAIN]);
console.log('PASS: validação de hostname, planejamento sem duplicatas e argumentos.');

/* ------------------------------------------------------------- simulação */
{
  const { state, request } = mock();
  const lines = [];
  const result = await run([], {}, request, line => lines.push(line));
  assert.equal(result.applied, false);
  assert.deepEqual(result.added, [DEFAULT_DOMAIN]);
  assert.equal(state.patches.length, 0, 'simulação não pode escrever');
  assert.ok(lines.join('\n').includes(DEFAULT_DOMAIN));
  assert.ok(lines.join('\n').includes('SIMULAÇÃO'));
}
console.log('PASS: simulação mostra o domínio exato e não altera o Firebase.');

/* ------------------------------------------------------------------ check */
{
  const { request } = mock();
  const result = await run(['--check'], {}, request, () => {});
  assert.equal(result.authorized, false);
  assert.deepEqual(result.missing, [DEFAULT_DOMAIN]);
}
{
  const { request } = mock({ publicDomains: [...BASE, DEFAULT_DOMAIN] });
  const result = await run(['--check'], {}, request, () => {});
  assert.equal(result.authorized, true);
  assert.deepEqual(result.missing, []);
}
console.log('PASS: --check distingue domínio autorizado de pendente.');

/* -------------------------------------------------------------- aplicação */
await assert.rejects(run(['--apply'], {}, mock().request, () => {}), /GOOGLE_OAUTH_TOKEN/);
{
  const { state, request } = mock();
  const result = await run(['--apply'], { GOOGLE_OAUTH_TOKEN: TOKEN }, request, () => {});
  assert.equal(result.applied, true);
  assert.deepEqual(result.added, [DEFAULT_DOMAIN]);
  assert.equal(state.patches.length, 1);
  const patch = state.patches[0];
  assert.deepEqual(Object.keys(patch), ['authorizedDomains'], 'updateMask exige corpo mínimo');
  for (const d of BASE) assert.ok(patch.authorizedDomains.includes(d), 'preservou ' + d);
  assert.ok(patch.authorizedDomains.includes('localhost'), 'nunca remove localhost');
  assert.ok(patch.authorizedDomains.includes(DEFAULT_DOMAIN));
  assert.equal(new Set(patch.authorizedDomains).size, patch.authorizedDomains.length);
  const patchCall = state.calls.find(c => c.init.method === 'PATCH');
  assert.ok(patchCall.url.includes('updateMask=authorizedDomains'));
  assert.equal(patchCall.init.headers.Authorization, 'Bearer ' + TOKEN);
  assert.equal(patchCall.init.headers['X-Goog-User-Project'], PROJECT);
  const verified = await publicDomains(API_KEY, request);
  assert.ok(verified.includes(DEFAULT_DOMAIN), 'endpoint público confirma a mudança');
  assert.equal(JSON.stringify(state.calls).includes('apiKey'), false);
}
console.log('PASS: --apply usa a API administrativa, preserva a lista e é confirmável.');

/* ------------------------------- lista administrativa é a fonte de verdade */
{
  const extraAdminDomain = 'admin-only.kyroshixcorp.workers.dev';
  const { state, request } = mock({ adminDomains: [...BASE, extraAdminDomain] });
  await run(['--apply'], { GOOGLE_OAUTH_TOKEN: TOKEN }, request, () => {});
  assert.ok(state.patches[0].authorizedDomains.includes(extraAdminDomain),
    'não pode apagar domínio que só existe na config administrativa');
  assert.ok(state.patches[0].authorizedDomains.includes(DEFAULT_DOMAIN));
}
console.log('PASS: escrita usa getConfig, não a lista pública, evitando apagar entradas.');

/* --------------------------------------------------------------- 403/erros */
{
  const { state, request } = mock({ failPatch: 403 });
  const error = await run(['--apply'], { GOOGLE_OAUTH_TOKEN: TOKEN }, request, () => {}).catch(e => e);
  assert.ok(error instanceof Error);
  assert.match(error.message, /PERMISSION_DENIED|firebaseauth/);
  assert.equal(error.message.includes(TOKEN), false, 'token nunca vaza na mensagem');
  assert.equal(state.patches.length, 0);
}
console.log('PASS: 403 é reportado sem expor o token.');

/* ------------------------------------------------------------ auxiliares */
{
  const { request } = mock();
  assert.deepEqual(await publicDomains(API_KEY, request), BASE);
  assert.deepEqual(await adminDomains(PROJECT, TOKEN, request), BASE);
  const updated = await updateDomains(PROJECT, TOKEN, [...BASE, DEFAULT_DOMAIN], request);
  assert.ok(updated.includes(DEFAULT_DOMAIN));
}
console.log('PASS: leituras pública/administrativa e PATCH isolado.');
