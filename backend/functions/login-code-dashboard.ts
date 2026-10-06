// Generated from login-code/core.js + index.ts. Paste as index.ts in the Dashboard.
// Firebase JWT verification and one-time email codes. No secrets or codes are logged.
const b64=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(s.length/4)*4,'=')),c=>c.charCodeAt(0));
const enc=new TextEncoder();
export async function verifyFirebase(token,{fetcher=fetch,project='kyroshix-releases',now=Date.now(),keyCache={}}={}){
 if(typeof token!=='string'||token.length>20000)throw Error('Invalid token');
 const parts=token.split('.');if(parts.length!==3)throw Error('Invalid token');
 const header=JSON.parse(new TextDecoder().decode(b64(parts[0]))),payload=JSON.parse(new TextDecoder().decode(b64(parts[1])));
 if(header.alg!=='RS256'||typeof header.kid!=='string'||payload.iss!==`https://securetoken.google.com/${project}`||payload.aud!==project||typeof payload.sub!=='string'||payload.sub.length<1||payload.sub.length>128||!Number.isFinite(payload.exp)||payload.exp<=now/1000||!Number.isFinite(payload.iat)||payload.iat>now/1000+60||!Number.isInteger(payload.auth_time)||payload.auth_time>now/1000+60)throw Error('Invalid token');
 if(!keyCache.keys||keyCache.expires<now){const response=await fetcher('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');if(!response.ok)throw Error('Identity unavailable');const data=await response.json();keyCache.keys=data.keys;keyCache.expires=now+300000;}
 const jwk=keyCache.keys.find(k=>k.kid===header.kid);if(!jwk)throw Error('Invalid token');
 const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
 if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,b64(parts[2]),enc.encode(parts[0]+'.'+parts[1])))throw Error('Invalid token');
 return payload;
}
export function generateCode(){const a=new Uint32Array(1);do{crypto.getRandomValues(a);}while(a[0]>=4294000000);return String(a[0]%1000000).padStart(6,'0');}
export async function codeHash(secret,uid,time,code){const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(`${uid}:${time}:${code}`)));return [...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');}
export function createHandler(env,fetcher=fetch){const keyCache={};return async request=>{
 const origin=request.headers.get('origin'),allowed=env.SITE_ORIGIN||'https://releases.kyroshixcorp.workers.dev';
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin',...(origin===allowed?{'Access-Control-Allow-Origin':allowed,'Access-Control-Allow-Headers':'authorization, content-type, apikey','Access-Control-Allow-Methods':'POST, OPTIONS'}:{})};
 const reply=(status,body)=>new Response(JSON.stringify(body),{status,headers});
 if(origin!==allowed)return reply(403,{message:'Origem não autorizada.'});
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(request.method!=='POST')return reply(405,{message:'Método não permitido.'});
 if(!env.SUPABASE_URL||!env.SUPABASE_SERVICE_ROLE_KEY||!env.CODE_HASH_SECRET||env.CODE_HASH_SECRET.length<32)return reply(503,{message:'A verificação por código ainda não está configurada.'});
 let user;try{user=await verifyFirebase(request.headers.get('authorization')?.replace(/^Bearer /,''),{fetcher,keyCache});}catch{return reply(401,{message:'Sua sessão expirou. Entre novamente.'});}
 let input;try{const body=await request.text();if(body.length>2048)throw Error();input=JSON.parse(body);}catch{return reply(400,{message:'Solicitação inválida.'});}
 async function rpc(name,data){const r=await fetcher(env.SUPABASE_URL+'/rest/v1/rpc/krs_email_code_'+name,{method:'POST',headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY,'Content-Type':'application/json'},body:JSON.stringify(data)});const result=await r.json();if(!r.ok)throw Error(result?.message==='Rate limited'?'rate':'db');return result;}
 const base={p_uid:user.sub,p_auth_time:user.auth_time};
 try{
  if(input.action==='status'){const verified=user.firebase?.sign_in_provider==='phone'&&!!user.phone_number||await rpc('status',base);return reply(200,{verified});}
  if(input.action==='send'){
   if(!user.email||typeof user.email!=='string'||!env.RESEND_API_KEY||!env.EMAIL_FROM)return reply(503,{message:'O envio de código por e-mail ainda não está disponível para esta conta.'});
   const code=generateCode(),hash=await codeHash(env.CODE_HASH_SECRET,user.sub,user.auth_time,code),challenge=await rpc('start',{...base,p_hash:hash});
   const response=await fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({from:env.EMAIL_FROM,to:[user.email],subject:'Seu código de acesso — KYROSHIX',text:`Seu código de acesso é ${code}. Ele expira em 10 minutos. Não compartilhe este código. Se você não solicitou o acesso, ignore esta mensagem.`})});
   if(!response.ok)return reply(503,{message:'Não foi possível enviar o e-mail agora. Aguarde um minuto e tente novamente.'});
   const [name,domain]=user.email.split('@');return reply(200,{challenge,destination:name.slice(0,2)+'•••@'+domain,retryAfter:60});
  }
  if(input.action==='verify'){
   if(!/^[0-9]{6}$/.test(input.code||'')||! /^[0-9a-f-]{36}$/.test(input.challenge||''))return reply(400,{message:'Digite os seis números do código.'});
   const hash=await codeHash(env.CODE_HASH_SECRET,user.sub,user.auth_time,input.code);const ok=await rpc('check',{...base,p_id:input.challenge,p_hash:hash});
   return ok?reply(200,{verified:true}):reply(400,{message:'Código incorreto, expirado ou já utilizado. Solicite outro se necessário.'});
  }
  return reply(400,{message:'Ação inválida.'});
 }catch(error){return reply(error.message==='rate'?429:503,{message:error.message==='rate'?'Aguarde um minuto. Você pode solicitar até cinco códigos por hora.':'A verificação está indisponível no momento. Tente novamente.'});}
};}

Deno.serve(createHandler({
 SITE_ORIGIN: Deno.env.get('SITE_ORIGIN'),
 SUPABASE_URL: Deno.env.get('SUPABASE_URL'),
 SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
 CODE_HASH_SECRET: Deno.env.get('CODE_HASH_SECRET'),
 RESEND_API_KEY: Deno.env.get('RESEND_API_KEY'),
 EMAIL_FROM: Deno.env.get('EMAIL_FROM'),
}));
