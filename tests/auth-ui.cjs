const {chromium}=require('playwright');
const assert=require('node:assert/strict');

const fakeAuth=`export async function createFirebaseClient(_config,options={}){
 let user=null,smsSent=false;const callbacks=[];
 const emit=next=>{user=next;callbacks.forEach(callback=>callback(next));};
 const makeUser=(uid='listener')=>({uid,displayName:uid==='owner'?'KYROSHIX':'Ouvinte',email:uid+'@example.test',emailVerified:true});
 return{
  providers:options.providers||['google.com'],phoneEnabled:options.phoneEnabled===true,emailLinkEnabled:false,requiresCode:false,
  observe(callback){callbacks.push(callback);queueMicrotask(()=>callback(user));return()=>{};},
  currentUser(){return user;},token(){return Promise.resolve(user?'test-token':null);},hasEmailLink(){return false;},
  async google(){const next=makeUser('owner');emit(next);return{user:next};},
  async oauth(provider){const next=makeUser(provider==='github.com'?'github-listener':'listener');emit(next);return{user:next};},
  async login(){const next=makeUser();emit(next);return{user:next};},
  async signup(){const next=makeUser();emit(next);return{user:next};},
  async logout(){emit(null);},async reset(){},async verify(){},async refresh(){return user;},
  async sendSms(){smsSent=true;},async confirmSms(){if(!smsSent)throw{publicMessage:'Solicite um novo código SMS.'};const next={uid:'phone-listener',displayName:'Ouvinte',phoneNumber:'+5511999999999'};emit(next);return{user:next};}
 };
}`;

(async()=>{
 const packaged=process.env.KRS_CHROMIUM_MODULE?require(process.env.KRS_CHROMIUM_MODULE):null;
 const browser=await chromium.launch({headless:true,...(packaged?{executablePath:await packaged.executablePath(),args:packaged.args.filter(arg=>!['--single-process','--disable-web-security'].includes(arg))}:{})});
 const errors=[];
 async function makeContext({providers=['google.com'],phoneEnabled=false,viewport={width:1365,height:900}}={}){
  const context=await browser.newContext({viewport});
  await context.route('**/auth-config.json',route=>route.fulfill({json:{
   enabled:true,firebase:{apiKey:'test-key',authDomain:'auth.example.test',projectId:'test-project',appId:'test-app'},
   providers,phoneEnabled,emailLinkEnabled:false,security:{requireEmailCode:false,endpoint:''}
  }}));
  await context.route('**/firebase-client.js',route=>route.fulfill({contentType:'text/javascript',body:fakeAuth}));
  await context.route('**/community-config.json',route=>route.fulfill({json:{enabled:false,supabaseUrl:'',publishableKey:''}}));
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:8765/');
  await page.locator('.release-card').nth(3).waitFor();
  return{context,page};
 }
 try{
  // A new browser session gets the account welcome screen, while all methods
  // that are not configured are visible but safely disabled.
  const first=await makeContext();
  const page=first.page;
  await page.locator('#account-dialog[open]').waitFor();
  assert.equal(await page.locator('#account-title').innerText(),'Entre na sua conta.');
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('krs-auth-prompted')),'1');
  assert.equal(await page.locator('#auth-google').isDisabled(),false,'Google is the only configured provider in this test.');
  assert.equal(await page.locator('#auth-submit').innerText(),'Entrar');
  for(const id of ['auth-facebook','auth-github','auth-twitter','auth-instagram','auth-phone-open']){
   assert(await page.locator('#'+id).isVisible(),`${id} is shown in the entry screen`);
   assert.equal(await page.locator('#'+id).isDisabled(),true,`${id} is inactive until configured`);
  }
  assert.match(await page.locator('#auth-provider-note').innerText(),/Instagram/);
  await page.locator('[data-auth-mode="signup"]').click();
  assert.equal(await page.locator('#auth-submit').innerText(),'Criar conta');
  assert(await page.locator('#auth-name-field').isVisible());
  assert(await page.locator('#auth-confirm-field').isVisible());
  assert.equal(await page.locator('#auth-password').getAttribute('minlength'),'12');
  await page.locator('#auth-guest-continue').click();
  await page.waitForFunction(()=>!document.querySelector('#account-dialog').open);
  await page.reload();await page.locator('.release-card').nth(3).waitFor();
  await page.waitForFunction(()=>document.querySelector('#auth-google-status').textContent==='Disponível');
  assert.equal(await page.locator('#account-dialog').evaluate(dialog=>dialog.open),false,'The prompt does not reopen during the same tab session.');
  await page.locator('#account-open').click();
  assert.equal(await page.locator('#account-dialog').evaluate(dialog=>dialog.open),true,'The account button can reopen the dialog.');
  await page.locator('#account-dialog .dialog-close').click();
  await first.context.close();

  // Once configured, Firebase-enabled providers and SMS become actionable.
  const ready=await makeContext({providers:['google.com','facebook.com','github.com','twitter.com'],phoneEnabled:true});
  const readyPage=ready.page;
  await readyPage.locator('#account-dialog[open]').waitFor();
  for(const id of ['auth-google','auth-facebook','auth-github','auth-twitter','auth-phone-open'])assert.equal(await readyPage.locator('#'+id).isDisabled(),false,`${id} is enabled from config`);
  assert.equal(await readyPage.locator('#auth-instagram').isDisabled(),true,'Instagram stays inactive until a dedicated integration exists.');
  await readyPage.locator('#auth-phone-open').click();
  assert(await readyPage.locator('#auth-phone-panel').isVisible());
  await readyPage.locator('#auth-phone-back').click();
  assert(await readyPage.locator('#auth-methods').isVisible());
  await readyPage.locator('#auth-github').click();
  await readyPage.locator('#auth-profile').waitFor();
  assert.equal(await readyPage.locator('#profile-email').innerText(),'github-listener@example.test');
  await readyPage.setViewportSize({width:390,height:844});
  const box=await readyPage.locator('#account-dialog').boundingBox();
  assert(box&&box.x>=0&&box.y>=0&&box.x+box.width<=390&&box.y+box.height<=844,'Account dialog fits the mobile viewport.');
  assert(await readyPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow on mobile.');
  assert.deepEqual(errors,[]);
  await ready.context.close();await browser.close();
  console.log('PASS: first-visit account prompt, session-only dismissal, guest access, login/register tabs, visible-but-disabled provider states, enabled OAuth/SMS controls and mobile layout. Authentication is simulated; no real sign-in was performed.');
 }catch(error){await browser.close();throw error;}
})().catch(error=>{console.error(error);process.exit(1);});
