const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');
const artifacts=process.env.KRS_ARTIFACT_DIR||path.join(root,'.test-artifacts');fs.mkdirSync(artifacts,{recursive:true});
const fakeAuth=`export async function createFirebaseClient(){let user=null;const callbacks=[];const send=u=>{user=u;callbacks.forEach(cb=>cb(u));};return {observe(cb){callbacks.push(cb);queueMicrotask(()=>cb(user));return()=>{}},currentUser(){return user},token(){return Promise.resolve(user?'test-token':null)},async google(){const u={uid:'owner',displayName:'KYROSHIX',email:'owner@example.test',emailVerified:true};send(u);return{user:u}},async login(){return this.google()},async signup(){return this.google()},async logout(){send(null)},async reset(){},async verify(){},async refresh(){return user}}}`;
(async()=>{
 const packaged=process.env.KRS_CHROMIUM_MODULE?require(process.env.KRS_CHROMIUM_MODULE):null;
 const browser=await chromium.launch({headless:true,...(packaged?{executablePath:await packaged.executablePath(),args:packaged.args.filter(a=>!['--single-process','--disable-web-security'].includes(a))}:{})});
 const errors=[];
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 await context.addInitScript(()=>sessionStorage.setItem('krs-auth-prompted','1'));
 await context.route('**/community-config.json',r=>r.fulfill({json:{enabled:false,supabaseUrl:'',publishableKey:''}}));
 await context.route('**/firebase-client.js',r=>r.fulfill({contentType:'text/javascript',body:fakeAuth}));
 // A range-capable media origin, like production Storage/Cloudflare, for real seeks.
 await context.route('**/assets/*.mp3',r=>{const req=r.request(),f=path.join(root,'dist/assets',new URL(req.url()).pathname.split('/').pop()),b=fs.readFileSync(f),match=(req.headers().range||'').match(/bytes=(\d+)-(\d*)/);const start=match?Number(match[1]):0,end=match&&match[2]?Math.min(Number(match[2]),b.length-1):b.length-1;return r.fulfill({status:match?206:200,headers:{'content-type':'audio/mpeg','accept-ranges':'bytes','content-length':String(end-start+1),...(match?{'content-range':`bytes ${start}-${end}/${b.length}`}:{})},body:b.subarray(start,end+1)});});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8765/');await page.locator('.release-card').nth(3).waitFor();
 assert.equal(await page.locator('.release-card').count(),4);
 assert(await page.locator('#spotlight').isVisible());
 await page.evaluate(()=>Promise.all(document.getAnimations().map(x=>x.finished)));await page.screenshot({path:path.join(artifacts,'KYROSHIX-novo-visual.png'),fullPage:false});
 if(await page.locator('#search-toggle').isVisible())await page.locator('#search-toggle').click();await page.locator('#search').fill('darkness');assert.equal(await page.locator('.release-card').count(),1);
 await page.locator('#clear-search').click();await page.locator('[data-filter="synthwave"]').click();assert.equal(await page.locator('.release-card').count(),1);await page.locator('[data-filter="all"]').click();
 await page.locator('#release-grid [data-favorite="remember"]').click();await page.goto('http://127.0.0.1:8765/#favoritas');assert.equal(await page.locator('.release-card').count(),1);
 await page.goto('http://127.0.0.1:8765/#faixa/remember');await page.locator('.detail-title').waitFor();assert.equal(await page.locator('.detail-title').innerText(),'Remember');
 assert.match(await page.locator('#comments-status').innerText(),/ativada/);
 await page.goto('http://127.0.0.1:8765/#studio');assert(await page.locator('#studio-gate').isVisible());assert(!await page.locator('#add-track').isVisible());
 // Actual mobile layout, no horizontal overflow at 360 or 390 pixels.
 for(const width of [360,390]){await page.setViewportSize({width,height:844});await page.goto('http://127.0.0.1:8765/');await page.locator('.release-card').nth(3).waitFor();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Overflow at ${width}`);const header=await page.locator('.topbar').boundingBox();for(const selector of ['.topbar .brand','#menu-toggle','#search-toggle','#account-open']){const box=await page.locator(selector).boundingBox();assert(box&&box.y>=header.y&&box.y+box.height<=header.y+header.height,`${selector} outside header at ${width}`);}assert(await page.locator('.brand img').evaluate(el=>el.getBoundingClientRect().width>=100));await page.locator('#menu-toggle').click();assert(await page.locator('#nav-scrim').isVisible());await page.locator('#nav-scrim').click({position:{x:width-12,y:120}});assert.equal(await page.locator('#menu-toggle').getAttribute('aria-expanded'),'false');await page.locator('#menu-toggle').click();await page.keyboard.press('Escape');assert.equal(await page.locator('#menu-toggle').getAttribute('aria-expanded'),'false');}
 await page.locator('#menu-toggle').evaluate(el=>el.blur());await page.screenshot({path:path.join(artifacts,'KYROSHIX-celular.png'),fullPage:false});
 await page.locator('.mobile-nav [data-nav="musicas"]').click();await page.locator('#play-toggle').waitFor();await page.screenshot({path:path.join(artifacts,'KYROSHIX-catalogo-celular.png')});await page.locator('#play-toggle').click();await page.waitForFunction(()=>!document.querySelector('#audio').paused&&document.querySelector('#audio').currentTime>0);await page.locator('#play-toggle').click();await page.evaluate(()=>{location.hash='inicio'});await page.waitForFunction(()=>document.body.classList.contains('home-route'));assert(await page.locator('.player').isVisible(),'Paused audio remains accessible after returning home');

 // Expanded player operates the original audio, including volume, seeking and queue.
 await page.locator('#player-cover').click();await page.locator('#music-player').waitFor();
 const before=await page.locator('#audio').evaluate(a=>a.currentTime);assert(before>0);
 assert.equal(await page.locator('audio').count(),2);
 await page.locator('[data-now-play]').click();await page.waitForFunction(()=>!document.querySelector('#audio').paused&&document.querySelector('#audio').currentTime>0);
 await page.locator('#now-volume').fill('0.35');assert.equal(await page.locator('#volume').inputValue(),'0.35');
 await page.locator('#now-speed').selectOption('1.25');assert.equal(await page.locator('#audio').evaluate(a=>a.playbackRate),1.25);
 await page.locator('#now-seek').fill('20');await page.waitForFunction(()=>document.querySelector('#audio').currentTime>=19.9);
 await page.locator('[data-now-play]').click();await page.locator('[data-now-close]').click();
 const point=await page.locator('#audio').evaluate(a=>a.currentTime);await page.locator('#player-title').click();assert(Math.abs(await page.locator('#audio').evaluate(a=>a.currentTime)-point)<.2);
 assert(await page.evaluate(()=>document.querySelector('#music-player').scrollWidth<=document.querySelector('#music-player').clientWidth));
 await page.screenshot({path:path.join(artifacts,'KYROSHIX-player-celular.png')});
 await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:path.join(artifacts,'KYROSHIX-player.png')});
 await page.locator('[data-now-select]').first().click();await page.waitForFunction(()=>document.querySelector('#now-title').textContent!=='Remember');
 await page.locator('[data-now-close]').click();
 await context.close();
 const c=await browser.newContext({viewport:{width:1440,height:1000}});await c.addInitScript(()=>sessionStorage.setItem('krs-auth-prompted','1'));await c.route('**/firebase-client.js',r=>r.fulfill({contentType:'text/javascript',body:fakeAuth}));
 await c.route('**/community-config.json',r=>r.fulfill({json:{enabled:true,supabaseUrl:'https://project-test.supabase.co',publishableKey:'public-test-key'}}));
 let tracks=(await import('file://'+root+'/dist/catalog-seed.js')).seedTracks.map(t=>({...t})),profile=null,comments=[],failSave=false,uploaded=[],failProfileUpload=false;
 await c.route('https://project-test.supabase.co/**',async route=>{const request=route.request(),url=new URL(request.url()),p=url.pathname;let data=null;const body=request.postData();const json=body&&request.headers()['content-type']?.includes('application/json')?JSON.parse(body):{};if(request.method()==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'POST,GET,DELETE'}});
 if(p==='/rest/v1/krs_tracks')data=url.searchParams.get('kind')==='eq.video'?[]:tracks;
 else if(p==='/rest/v1/krs_profiles')data=profile?[profile]:[];
 else if(p==='/rest/v1/krs_comments')data=comments.map(x=>({...x,profile:profile||{display_name:'KYROSHIX'}}));
 else if(p.endsWith('/rpc/krs_social'))data={counts:{},mine:[],subscribers:0,subscribed:false};
 else if(p.endsWith('/rpc/krs_my_subscriptions'))data=[];
 else if(p.endsWith('/rpc/krs_is_owner'))data=request.headers().authorization==='Bearer test-token';
 else if(p.endsWith('/rpc/krs_save_profile')){assert.equal(request.headers().authorization,'Bearer test-token');profile={...json.p_profile,uid:'owner',updated_at:new Date().toISOString()};data=profile;}
 else if(p.endsWith('/rpc/krs_save_track')){assert.equal(request.headers().authorization,'Bearer test-token');if(failSave){failSave=false;return route.fulfill({status:500,json:{message:'Simulated outage'}});}const idx=tracks.findIndex(t=>t.id===json.p_track.id);if(idx<0)tracks.push(json.p_track);else tracks[idx]=json.p_track;data=json.p_track;}
 else if(p.endsWith('/rpc/krs_delete_track')){tracks=tracks.filter(t=>t.id!==json.p_id);data=null;}
 else if(p.endsWith('/rpc/krs_comment')){const row={id:'11111111-1111-4111-8111-111111111111',track_id:json.p_track,user_id:'owner',body:json.p_body,parent_id:json.p_parent,created_at:new Date().toISOString()};comments.unshift(row);data=row;}
 else if(p.endsWith('/rpc/krs_edit_comment')){comments.find(x=>x.id===json.p_id).body=json.p_body;data=null;}
 else if(p.endsWith('/rpc/krs_delete_comment')){const row=comments.find(x=>x.id===json.p_id);row.deleted=true;row.body='';data=null;}
 else if(p.startsWith('/storage/v1/object/kyroshix-media/')){if(p.includes('/profiles/')){assert.equal(request.headers().authorization,'Bearer test-token');assert.equal(request.headers()['content-type'],'image/webp');assert.equal(request.headers()['x-upsert'],'true');assert(request.postDataBuffer().length<2*1024*1024);if(failProfileUpload){failProfileUpload=false;return route.fulfill({status:400,json:{statusCode:'403',error:'Unauthorized',message:'new row violates row-level security policy'}});}}uploaded.push(p);data={Key:p};}
 else if(p==='/storage/v1/object/kyroshix-media'){data=[];}
 else if(p.startsWith('/storage/v1/object/public/'))return route.fulfill({contentType:'image/png',body:fs.readFileSync(root+'/dist/assets/brand-original.png')});
 else throw new Error('Unmocked endpoint '+p);
 await route.fulfill({json:data,headers:{'access-control-allow-origin':'*'}});
 });
 const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:8765/');await p.locator('.release-card').nth(3).waitFor();await p.locator('#account-open').click();await p.locator('#auth-google').waitFor();await p.screenshot({path:path.join(artifacts,'KYROSHIX-conta.png')});await p.locator('#auth-google').click();await p.locator('#profile-verified').waitFor();await p.locator('#account-dialog .dialog-close').click();
 await p.goto('http://127.0.0.1:8765/#studio');await p.locator('#add-track').waitFor();await p.screenshot({path:path.join(artifacts,'KYROSHIX-studio.png')});
 await p.locator('[data-edit-track="remember"]').click();await p.locator('#edit-title').fill('Remember <img src=x onerror=alert(1)>');failSave=true;await p.locator('#save-track').click();await p.locator('#track-save-status[data-error="true"]').waitFor();assert.equal(await p.locator('#edit-title').inputValue(),'Remember <img src=x onerror=alert(1)>');await p.locator('#save-track').click();await p.locator('#track-editor').waitFor({state:'hidden'});assert(await p.locator('#studio-list').innerText().then(t=>t.includes('<img src=x')));assert.equal(await p.locator('#studio-list img').count(),0);
 await p.locator('#add-track').click();await p.locator('#edit-title').fill('New test upload');await p.locator('#edit-artists').fill('Test artist');await p.locator('#edit-audio-file').setInputFiles(root+'/tests/fixtures/tone.wav');await p.locator('#edit-cover-file').setInputFiles(root+'/dist/assets/hero.webp');await p.locator('#save-track').click();await p.locator('#track-editor').waitFor({state:'hidden',timeout:25000});assert(uploaded.some(x=>x.endsWith('.wav')));assert(uploaded.some(x=>x.endsWith('.webp')));assert.equal(tracks.length,5);
 const newTrack=tracks.find(t=>t.title==='New test upload');assert(Number(newTrack.duration)>=1);await p.locator(`[data-delete-track="${newTrack.id}"]`).click();await p.locator('#confirm-cancel').click();assert.equal(tracks.length,5);await p.locator(`[data-delete-track="${newTrack.id}"]`).click();await p.locator('#confirm-yes').click();await p.waitForFunction(()=>document.querySelectorAll('#studio-list .studio-row').length===4);
 await p.goto('http://127.0.0.1:8765/#perfil');await p.locator('[data-profile-edit]').waitFor();await p.screenshot({path:path.join(artifacts,'KYROSHIX-perfil.png')});await p.locator('[data-profile-edit]').click();await p.locator('#edit-name').fill('Meu perfil <script>');await p.locator('#edit-bio').fill('Anime, nightcore e neon.');await p.locator('#edit-status').fill('Ouvindo remixes');await p.locator('#edit-accent').fill('#a070ff');await p.locator('#save-profile').click();await p.locator('#profile-editor').waitFor({state:'hidden'});assert.equal(await p.locator('#public-profile h1').innerText(),'Meu perfil <script>');assert.equal(await p.locator('#public-profile script').count(),0);
 // Real image conversion/upload bodies; a denied upload preserves the selected files and text.
 await p.locator('[data-profile-edit]').click();await p.locator('#edit-avatar').setInputFiles(root+'/dist/assets/brand-original.png');await p.locator('#edit-banner').setInputFiles(root+'/dist/assets/hero.webp');failProfileUpload=true;await p.locator('#save-profile').click();await p.locator('#profile-save-status[data-error="true"]').waitFor();assert.match(await p.locator('#profile-save-status').innerText(),/Storage: 403/);assert.equal(await p.locator('#edit-name').inputValue(),'Meu perfil <script>');assert.equal(await p.locator('#edit-avatar').evaluate(el=>el.files.length),1);await p.locator('#save-profile').click();await p.locator('#profile-editor').waitFor({state:'hidden'});assert.equal(profile.avatar_path,'profiles/owner/avatar.webp');assert.equal(profile.banner_path,'profiles/owner/banner.webp');assert(uploaded.some(x=>x.endsWith('/profiles/owner/avatar.webp')));assert(uploaded.some(x=>x.endsWith('/profiles/owner/banner.webp')));

 await p.locator('#account-open img').waitFor();await p.waitForFunction(()=>document.querySelector('#account-open img').naturalWidth>0);
 assert.equal(await p.locator('#account-open .account-avatar').count(),1);
 assert.equal(await p.locator('#account-open img').evaluate(img=>getComputedStyle(img).objectFit),'contain');
 const av=await p.locator('#account-open .account-avatar').boundingBox();assert.equal(av.width,av.height);
 // Overwriting the avatar keeps the saved banner reference.
 await p.locator('[data-profile-edit]').click();await p.locator('#edit-avatar').setInputFiles(root+'/dist/assets/wordmark-original.png');await p.locator('#save-profile').click();await p.locator('#profile-editor').waitFor({state:'hidden'});assert.equal(profile.banner_path,'profiles/owner/banner.webp');assert.equal(uploaded.filter(x=>x.endsWith('/profiles/owner/avatar.webp')).length,2);
 await p.goto('http://127.0.0.1:8765/#faixa/darkness');await p.locator('#comment-body').fill('Gostei <script>alert(1)</script>');await p.locator('#comment-send').click();await p.locator('.comment-body').waitFor();assert.equal(await p.locator('.comment-body').innerText(),'Gostei <script>alert(1)</script>');assert.equal(await p.locator('#comments-list script').count(),0);await p.locator('[data-edit-comment]').click();await p.locator('#comment-body').fill('Editado');await p.locator('#comment-send').click();await p.waitForFunction(()=>document.querySelector('.comment-body')?.textContent==='Editado');await p.locator('[data-delete-comment]').click();await p.locator('#confirm-yes').click();await p.locator('.comment.deleted').waitFor();
 await p.locator('#account-open').click();await p.locator('#auth-signout').click();await p.locator('#account-dialog .dialog-close').click();await p.goto('http://127.0.0.1:8765/#studio');await p.locator('#studio-gate').waitFor();assert(!await p.locator('#add-track').isVisible());
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS: browser desktop/mobile layout, search/filter/favorites/details, inactive community gating, mocked Firebase login, owner studio, failed-save recovery, expanded audio continuity/seek/volume/speed/queue, track create/edit/delete with real WAV/image parsing, profile avatar geometry, comments and escaping.');console.log('Authentication and remote data were simulated for these regression checks.');
})().catch(e=>{console.error(e);process.exit(1)});
