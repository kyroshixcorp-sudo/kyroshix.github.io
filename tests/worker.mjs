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
  for(const path of ['/','/inicio','/musicas','/perfil/owner','/track/remember','/watch/video--id','/canal/creator','/favoritas/','/track/remember?shared=1']) {
    const response = await worker.fetch(new Request('https://site.test'+path),env);
    assert.equal(response.status,200,path); assert.match(response.headers.get('Content-Type'),/^text\/html/);
    assert((await response.text()).includes('/theme.js')); assert.equal(response.headers.get('Cache-Control'),'no-cache');
  }
  const script = await worker.fetch(new Request('https://site.test/router.js'),env);
  assert.match(script.headers.get('Content-Type'),/^application\/javascript/);
  const etag = script.headers.get('ETag');
  const conditional = await worker.fetch(new Request('https://site.test/router.js',{headers:{'If-None-Match':etag}}),env);
  assert.equal(conditional.status,304); assert.equal(await conditional.text(),'');
  const head = await worker.fetch(new Request('https://site.test/track/remember',{method:'HEAD'}),env);
  assert.equal(head.status,200); assert(Number(head.headers.get('Content-Length'))>0); assert.equal(await head.text(),'');
  assert.equal((await worker.fetch(new Request('https://site.test/inicio',{method:'POST'}),env)).status,405);
  for(const path of ['/assets/remember.mp3','/auth-config.json','/assets/missing.js','/unrecognized']) {
    const request = new Request('https://site.test'+path,{headers:{Range:'bytes=20-99'}});
    const response = await worker.fetch(request,env);
    assert.equal(delegated,request); assert.equal(delegated.headers.get('Range'),'bytes=20-99'); assert.equal(response.status,206);
  }
  console.log('PASS: generated Cloudflare document routes, root scripts, HEAD/ETag/405 responses and untouched static/range requests.');
} finally {rmSync(output,{recursive:true,force:true});}
