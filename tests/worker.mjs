import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const root = new URL('../', import.meta.url).pathname, output = mkdtempSync(join(tmpdir(),'kyroshix-worker-'));
try {
  const zip = join(output,'public.zip'), dir = join(output,'worker');
  execFileSync('python3',['scripts/export-pages.py',zip],{cwd:root,stdio:'pipe'});
  execFileSync('python3',['scripts/export-worker.py',zip,dir],{cwd:root,stdio:'pipe'});
  const {default:worker} = await import(pathToFileURL(join(dir,'worker.mjs')));
  const metadata = JSON.parse(readFileSync(join(dir,'metadata.json'),'utf8'));
  assert.equal(metadata.keep_assets,true); assert(metadata.assets.config.run_worker_first.includes('/track/*'));
  assert(!metadata.assets.config.run_worker_first.includes('/*'));
  let delegated;
  const env = {ASSETS:{fetch:request=>{delegated=request;return new Response('static asset',{status:206,headers:{'Content-Type':'audio/mpeg'}});}}};
  for(const path of ['/','/inicio','/musicas','/perfil/owner','/track/remember','/watch/video--id','/canal/creator','/favoritas/','/track/remember?shared=1','/spatial-ui.html']) {
    const response = await worker.fetch(new Request('https://site.test'+path),env);
    assert.equal(response.status,200,path); assert.match(response.headers.get('Content-Type'),/^text\/html/);
    assert((await response.text()).includes('spatial-room.jpg'),path); assert.equal(response.headers.get('Cache-Control'),'no-cache');
  }
  const legacy = await worker.fetch(new Request('https://site.test/legacy.html'),env);
  assert.equal(legacy.status,200); assert((await legacy.text()).includes('/theme.js'));
  for(const path of ['/spatial.css','/spatial.js']) {
    const response = await worker.fetch(new Request('https://site.test'+path),env);
    assert.equal(response.status,200,path);
    assert.match(response.headers.get('Content-Type'),path.endsWith('.css') ? /^text\/css/ : /^application\/javascript/);
    assert((await response.text()).length>100,path);
    assert(metadata.assets.config.run_worker_first.includes(path));
  }
  const script = await worker.fetch(new Request('https://site.test/router.js'),env);
  for(const path of ['/account.css','/access-policy.js','/auth-controller.js','/firebase-client.js']) {
    const response = await worker.fetch(new Request('https://site.test'+path),env);
    assert.equal(response.status,200,path);
    assert.match(response.headers.get('Content-Type'),path.endsWith('.css') ? /^text\/css/ : /^application\/javascript/);
    assert((await response.text()).length>100,path);
    assert(metadata.assets.config.run_worker_first.includes(path));
  }
  assert.match(script.headers.get('Content-Type'),/^application\/javascript/);
  const etag = script.headers.get('ETag');
  const conditional = await worker.fetch(new Request('https://site.test/router.js',{headers:{'If-None-Match':etag}}),env);
  assert.equal(conditional.status,304); assert.equal(await conditional.text(),'');
  const head = await worker.fetch(new Request('https://site.test/track/remember',{method:'HEAD'}),env);
  assert.equal(head.status,200); assert(Number(head.headers.get('Content-Length'))>0); assert.equal(await head.text(),'');
  assert.equal((await worker.fetch(new Request('https://site.test/inicio',{method:'POST'}),env)).status,405);
  // Métricas reais: sem KV o endpoint responde de forma explícita e não quebra a página.
  for(const path of ['/api/metrics','/api/metrics/play','/api/metrics/presence']) {
    const response = await worker.fetch(new Request('https://site.test'+path),env);
    assert.equal(response.status,200,path);
    assert.match(response.headers.get('Content-Type'),/^application\/json/);
    const data = await response.json();
    assert.equal(data.ok,false,path); assert.match(data.reason,/KX_METRICS/);
  }
  const postPlay = await worker.fetch(new Request('https://site.test/api/metrics/play',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"track":"remember"}'}),env);
  assert.equal(postPlay.status,200); assert.equal((await postPlay.json()).ok,false);
  // Rotas /api/* precisam passar pelo Worker (run_worker_first).
  for(const path of ['/api/auth/code','/api/auth/verify','/api/admin/verify','/api/billing/checkout',
                     '/api/billing/webhook','/api/catalog','/api/chat','/api/profile','/api/videos']) {
    assert(metadata.assets.config.run_worker_first.includes(path),path);
  }
  // Sem segredos: os serviços reais respondem "not_configured", nunca simulam sucesso.
  for(const path of ['/api/auth/code','/api/admin/code','/api/billing/checkout','/api/billing/confirm','/api/billing/status']) {
    const response = await worker.fetch(new Request('https://site.test'+path,
      {method:path.includes('status')?'GET':'POST',headers:{'Content-Type':'application/json'},body:path.includes('status')?undefined:'{"email":"dono@kyroshix.local","plan":"pro"}'}),env);
    const data = await response.json();
    assert.equal(data.ok,false,path);
    assert.equal(data.reason,'not_configured',path+' => '+JSON.stringify(data));
  }
  // Webhook do Stripe: assinatura ausente é recusada (quando configurado).
  const store = new Map();
  const kv = {get:async k=>store.get(k)??null,put:async(k,v)=>store.set(k,v),delete:async k=>store.delete(k)};
  const envFull = {...env,KX_DATA:kv,STRIPE_WEBHOOK_SECRET:'whsec_test',ADMIN_EMAIL:'kyroshixcorp@gmail.com'};
  const badHook = await worker.fetch(new Request('https://site.test/api/billing/webhook',{method:'POST',body:'{}'}),envFull);
  assert.equal((await badHook.json()).ok,false);
  // Catálogo: escrita sem token de dono é recusada; leitura pública funciona.
  const rejected = await worker.fetch(new Request('https://site.test/api/catalog',{method:'POST',
    headers:{'Content-Type':'application/json'},body:JSON.stringify({tracks:[{id:'x',title:'x',image:'https://a.test/c.jpg',audio:'https://a.test/a.mp3'}]})}),envFull);
  assert.equal((await rejected.json()).ok,false);
  const emptyCatalog = await worker.fetch(new Request('https://site.test/api/catalog'),envFull);
  assert.equal((await emptyCatalog.json()).tracks,null);
  // Chat: mensagens reais persistem no KV.
  const chatPost = await worker.fetch(new Request('https://site.test/api/chat',{method:'POST',
    headers:{'Content-Type':'application/json'},body:'{"author":"Dono","text":"Oi","room":"geral"}'}),envFull);
  const chatData = await chatPost.json();
  assert.equal(chatData.ok,true); assert.equal(chatData.messages.length,1); assert.equal(chatData.messages[0].text,'Oi');
  const chatGet = await worker.fetch(new Request('https://site.test/api/chat'),envFull);
  assert.equal((await chatGet.json()).messages.length,1);
  for(const path of ['/assets/remember.mp3','/auth-config.json','/assets/missing.js','/unrecognized']) {
    const request = new Request('https://site.test'+path,{headers:{Range:'bytes=20-99'}});
    const response = await worker.fetch(request,env);
    assert.equal(delegated,request); assert.equal(delegated.headers.get('Range'),'bytes=20-99'); assert.equal(response.status,206);
  }
  console.log('PASS: generated Cloudflare document routes, root scripts, HEAD/ETag/405, real API endpoints (Stripe/auth/KV/chat) and untouched static/range requests.');
} finally {rmSync(output,{recursive:true,force:true});}
