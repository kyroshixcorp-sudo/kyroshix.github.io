// Executar com o preview em funcionamento: PREVIEW_URL=http://127.0.0.1:4188 CHROMIUM_PATH=... node tests/preview-owner-security.cjs
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({headless: true, executablePath: process.env.CHROMIUM_PATH || undefined, args:['--no-sandbox']});
  const page = await browser.newPage({viewport:{width:1440,height:900}});
  const errors=[]; page.on('pageerror', e=>errors.push(e.message));
  const base=process.env.PREVIEW_URL || 'http://127.0.0.1:4188';
  // Simula uma conta local falsificada, inclusive um plano e token antigos.
  await page.addInitScript(() => {
    localStorage.setItem('kx.accounts.v2', JSON.stringify([{id:'spoof',name:'Teste',email:'kyroshixcorp@gmail.com',plan:'owner',createdAt:Date.now()}]));
    localStorage.setItem('kx.session.v2', JSON.stringify({id:'spoof'}));
    localStorage.setItem('kx.owner.token', 'fake');
  });
  await page.goto(base, {waitUntil:'domcontentloaded'});
  await page.waitForSelector('.hero h1');
  assert.doesNotMatch(await page.locator('#plan-btn').innerText(), /PREMIUM|OWNER/i);
  await page.locator('.rail [data-view="admin"]').click();
  assert.equal(await page.locator('.admin-page').count(),0);
  assert.match(await page.locator('#stage').innerText(),/ACESSO RESTRITO/);
  await page.locator('[data-action="owner-verify"]').click();
  assert.equal(await page.locator('.admin-page').count(),0);
  await page.locator('.topnav [data-view="videos"]').click();
  assert.ok(await page.locator('.video-card').count() >= 16);
  assert.equal(await page.locator('.video-thumb iframe').count(),0);
  assert.deepEqual(errors, []);
  await browser.close();
  console.log('PASS: conta local e token falsos não ativam modo dono; vídeos carregam sem embed prévio.');
})().catch(e=>{console.error(e);process.exitCode=1;});
