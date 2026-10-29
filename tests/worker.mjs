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
  const {default:worker, parseYoutubeFeed} = await import(pathToFileURL(join(dir,'worker.mjs')));
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
                     '/api/billing/webhook','/api/catalog','/api/chat','/api/profile','/api/videos',
                     '/api/videos/sync','/api/health','/api/drm/status']) {
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
  const store = new Map();
  const kv = {get:async k=>store.get(k)??null,put:async(k,v)=>store.set(k,v),delete:async k=>store.delete(k)};
  const envFull = {...env,KX_DATA:kv,STRIPE_WEBHOOK_SECRET:'whsec_test',ADMIN_EMAIL:'kyroshixcorp@gmail.com'};
  // Preview não pode habilitar escrita ou pagamentos mesmo com bindings presentes.
  const preview = {...envFull, KX_PREVIEW_READ_ONLY:'true', STRIPE_SECRET_KEY:'sk_test_private', STRIPE_PRICE_PRO:'price_test'};
  for (const route of ['/api/auth/code','/api/admin/verify','/api/billing/checkout','/api/catalog']) {
    const response = await worker.fetch(new Request('https://site.test'+route,{method:'POST',body:'{}'}),preview);
    assert.equal((await response.json()).reason,'not_configured', route);
  }
  const previewHealth = await (await worker.fetch(new Request('https://site.test/api/health'),preview)).json();
  assert.equal(previewHealth.stripe,false); assert.equal(previewHealth.kv,false); assert.equal(previewHealth.readOnly,true);
  // /api/health: só booleanos, nunca segredos.
  const health = await worker.fetch(new Request('https://site.test/api/health'),envFull);
  const healthData = await health.json();
  assert.equal(healthData.ok,true);
  assert.equal(healthData.worker,true);
  assert.equal(healthData.stripe,false);
  assert.equal(/sk_|whsec_|AIza/.test(JSON.stringify(healthData)),false,'health não pode vazar segredo');
  assert.equal(healthData.youtubeChannelId,'UCGzRDl1ps7nPbgQybBv2J4Q');
  const drm = await worker.fetch(new Request('https://site.test/api/drm/status'),envFull);
  const drmData = await drm.json();
  assert.equal(drmData.enabled,false);
  assert.match(drmData.note,/YouTube/);
  // Parse do feed Atom público do YouTube (sem rede).
  const feedXml = `<?xml version="1.0"?><feed>
    <entry><yt:videoId>6hbfr21jgWU</yt:videoId><title>Snakes &amp; Ladders | NIGHTCORE</title>
      <published>2026-10-15T04:30:31+00:00</published>
      <media:description>Remix &lt;oficial&gt; da KYROSHIX</media:description></entry>
    <entry><yt:videoId>kRy4L4h2oBE</yt:videoId><title>Willow Tree</title>
      <published>2026-10-09T17:30:22+00:00</published></entry></feed>`;
  const parsed = parseYoutubeFeed(feedXml);
  assert.equal(parsed.length,2);
  assert.equal(parsed[0].id,'6hbfr21jgWU');
  assert.match(parsed[0].title,/Snakes & Ladders/);
  assert.match(parsed[0].description,/Remix/);
  assert.equal(parsed[0].description.includes('<'),false,'descrição não pode conter marcação');
  // Bypass clássico de sanitização de tag não pode sobreviver.
  const evil = parseYoutubeFeed('<feed><entry><yt:videoId>6hbfr21jgWU</yt:videoId>' +
    '<title>&lt;&lt;script&gt;script&gt;alert(1)</title></entry></feed>');
  assert.equal(/[<>]/.test(evil[0].title),false,'título não pode conter marcação HTML');
  assert.ok(evil[0].title.includes('‹'),'entidades devem virar texto seguro');
  assert.equal(parsed[0].source,'youtube-feed');
  assert.equal(parseYoutubeFeed('').length,0);
  assert.equal(parseYoutubeFeed('<feed><entry><yt:videoId>curto</yt:videoId></entry></feed>').length,0);
  // Com KV, sincroniza o feed público e persiste a lista.
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok:true, status:200, text:async()=>feedXml });
  try {
    const syncNoKv = await (await worker.fetch(new Request('https://site.test/api/videos/sync'),env)).json();
    assert.equal(syncNoKv.ok,true); assert.equal(syncNoKv.ephemeral,true);
    const previewSync = await (await worker.fetch(new Request('https://site.test/api/videos/sync'),preview)).json();
    assert.equal(previewSync.ephemeral,true); assert.equal(previewSync.persisted,false);
    assert.equal(store.has('kx:videos:v1'),false,'preview jamais grava o feed em KV');
    const synced = await worker.fetch(new Request('https://site.test/api/videos/sync'),envFull);
    const syncData = await synced.json();
    assert.equal(syncData.ok,true);
    assert.equal(syncData.videos.length,2);
    assert.equal(syncData.source,'youtube-feed');
    assert.equal(syncData.videos[0].id,'6hbfr21jgWU');
    const listed = await worker.fetch(new Request('https://site.test/api/videos'),envFull);
    const listData = await listed.json();
    assert.equal(listData.videos.length,2);
    assert.ok(listData.updatedAt>0);
    // Segunda chamada usa cache (10 min): não deve buscar o feed de novo.
    let feedCalls = 0;
    globalThis.fetch = async () => { feedCalls++; return {ok:true, status:200, text:async()=>feedXml}; };
    const cached = await (await worker.fetch(new Request('https://site.test/api/videos/sync'),envFull)).json();
    assert.equal(cached.cached,true); assert.equal(cached.persisted,true); assert.equal(cached.ephemeral,false);
    const cachedEphemeral = await (await worker.fetch(new Request('https://site.test/api/videos/sync'),env)).json();
    assert.equal(cachedEphemeral.cached,true); assert.equal(cachedEphemeral.ephemeral,true); assert.equal(cachedEphemeral.persisted,false);
    assert.equal(feedCalls,0,'cache do feed deve evitar nova requisição ao YouTube');
    const forced = await (await worker.fetch(new Request('https://site.test/api/videos/sync?force=1'),envFull)).json();
    assert.equal(forced.cached,false);
    assert.equal(feedCalls,1,'force=1 deve buscar o feed novamente');
    // Se o feed retornar 404, consulta a playlist fixa pela API oficial, sem expor a chave.
    const fallbackStore = new Map();
    const fallbackKV = {get:async k=>fallbackStore.get(k)??null,put:async(k,v)=>fallbackStore.set(k,v),delete:async k=>fallbackStore.delete(k)};
    const fallbackEnv = {...env,KX_DATA:fallbackKV,YOUTUBE_API_KEY:'fake-test-key'};
    let apiRequests = 0;
    globalThis.fetch = async url => {
      if (String(url).startsWith('https://www.youtube.com/')) return {ok:false,status:404};
      const u = new URL(url); apiRequests++;
      assert.equal(u.origin,'https://www.googleapis.com'); assert.equal(u.pathname,'/youtube/v3/playlistItems');
      assert.equal(u.searchParams.get('playlistId'),'PLHMuU4IdndW8');
      return {ok:true,json:async()=>({items:[
        {snippet:{title:'Remix <script>alert(1)</script>',description:'Oficial',publishedAt:'2026-10-01',resourceId:{videoId:'6hbfr21jgWU'}}},
        {snippet:{title:'Private video',resourceId:{videoId:'kRy4L4h2oBE'}}},
        {snippet:{title:'invalido',resourceId:{videoId:'../../bad'}}}
      ]})};
    };
    const apiFallback = await (await worker.fetch(new Request('https://site.test/api/videos/sync'),fallbackEnv)).json();
    assert.equal(apiFallback.ok,true); assert.equal(apiFallback.source,'youtube-api'); assert.equal(apiRequests,1);
    assert.equal(apiFallback.videos.length,1); assert.equal(apiFallback.videos[0].id,'6hbfr21jgWU');
    assert.equal(/[<>]/.test(apiFallback.videos[0].title),false);
    assert(!JSON.stringify(apiFallback).includes('fake-test-key'));
    globalThis.fetch = async () => { throw Error('https://www.googleapis.com/?key=fake-test-key'); };
    const stale = await (await worker.fetch(new Request('https://site.test/api/videos/sync?force=1'),fallbackEnv)).json();
    assert.equal(stale.ok,true); assert.equal(stale.cached,true); assert(stale.warning);
    assert(!JSON.stringify(stale).includes('fake-test-key'));
    const emptyEnv = {...fallbackEnv,KX_DATA:{get:async()=>null,put:async()=>{throw Error('unexpected write')}}};
    const failed = await (await worker.fetch(new Request('https://site.test/api/videos/sync'),emptyEnv)).json();
    assert.equal(failed.ok,false); assert.equal(failed.reason,'feed_error');
    assert(!JSON.stringify(failed).includes('fake-test-key'));
  } finally { globalThis.fetch = realFetch; }
  // DRM: health e status concordam quando há servidor de licenças.
  const drmEnv = {...envFull, DRM_LICENSE_WIDEVINE:'https://license.example.com/widevine'};
  const health2 = await (await worker.fetch(new Request('https://site.test/api/health'),drmEnv)).json();
  const drm2 = await (await worker.fetch(new Request('https://site.test/api/drm/status'),drmEnv)).json();
  assert.equal(health2.drm,true); assert.equal(drm2.enabled,true);
  assert.equal(drm2.licenseServers['com.widevine.alpha'],'https://license.example.com/widevine');
  // Webhook do Stripe: assinatura ausente é recusada (quando configurado).
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
