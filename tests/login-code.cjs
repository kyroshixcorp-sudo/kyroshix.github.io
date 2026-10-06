const assert=require('node:assert/strict');
(async()=>{
 const {verifyFirebase,codeHash,generateCode,createHandler}=await import('../backend/functions/login-code/core.js');
 const keys=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const jwk=await crypto.subtle.exportKey('jwk',keys.publicKey);jwk.kid='test-key';const now=Math.floor(Date.now()/1000);
 const claims={sub:'alice',email:'alice@example.test',email_verified:true,aud:'kyroshix-releases',iss:'https://securetoken.google.com/kyroshix-releases',iat:now,exp:now+3600,auth_time:now,firebase:{sign_in_provider:'google.com'}};
 const b64=x=>Buffer.from(typeof x==='string'?x:JSON.stringify(x)).toString('base64url');
 async function jwt(extra={}){const text=b64({alg:'RS256',kid:jwk.kid})+'.'+b64({...claims,...extra});const signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',keys.privateKey,Buffer.from(text));return text+'.'+Buffer.from(signature).toString('base64url');}
 const fetchKeys=async()=>Response.json({keys:[jwk]});
 const token=await jwt();assert.equal((await verifyFirebase(token,{fetcher:fetchKeys})).sub,'alice');
 for(const extra of [{aud:'foreign'},{iss:'https://attacker.test'},{exp:now-1},{auth_time:now+1000}])await assert.rejects(()=>jwt(extra).then(t=>verifyFirebase(t,{fetcher:fetchKeys})));
 await assert.rejects(()=>verifyFirebase(token.slice(0,-10)+'AAAAAAAAAA',{fetcher:fetchKeys}));
 assert.match(generateCode(),/^\d{6}$/);assert.notEqual(await codeHash('secret','alice',1,'123456'),await codeHash('secret','bob',1,'123456'));
 let sent=null,stored=null,used=false;const id='11111111-1111-4111-8111-111111111111';
 const fetcher=async(url,opts)=>{if(url.includes('googleapis'))return fetchKeys();const body=JSON.parse(opts.body);if(url==='https://api.resend.com/emails'){sent=body;return Response.json({id:'mail'});}if(url.endsWith('_start')){stored=body.p_hash;return Response.json(id);}if(url.endsWith('_status'))return Response.json(used);if(url.endsWith('_check')){const ok=!used&&body.p_hash===stored&&body.p_id===id;if(ok)used=true;return Response.json(ok);}throw Error('Unexpected URL');};
 const handler=createHandler({SITE_ORIGIN:'https://site.test',SUPABASE_URL:'https://db.test',SUPABASE_SERVICE_ROLE_KEY:'server-test-key',CODE_HASH_SECRET:'x'.repeat(40),RESEND_API_KEY:'mail-test-key',EMAIL_FROM:'KYROSHIX <verified@example.test>'},fetcher);
 const request=(body,origin='https://site.test')=>handler(new Request('https://api.test',{method:'POST',headers:{origin,authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body)}));
 assert.equal((await request({action:'send'},'https://other.test')).status,403);
 assert.equal((await request({action:'send',email:'attacker@example.test'})).status,200);assert.deepEqual(sent.to,['alice@example.test']);
 const code=sent.text.match(/\b\d{6}\b/)[0];assert.equal((await request({action:'verify',challenge:id,code})).status,200);assert.equal((await request({action:'verify',challenge:id,code})).status,400);
 assert.equal((await (await request({action:'status'})).json()).verified,true);
 console.log('PASS: signed Firebase JWT validation, expiry/project/signature rejection, HMAC identity binding, origin restriction, token-derived recipient and one-time verification. No real email was sent.');
})().catch(e=>{console.error(e);process.exit(1)});
