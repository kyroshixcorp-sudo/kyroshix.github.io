// License credentials and content keys never belong in this public configuration.
const systems={widevine:'com.widevine.alpha',playready:'com.microsoft.playready',fairplay:'com.apple.fps'};
const https=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.hash?u.href:'';}catch{return '';}};
export async function configureDrm(player,shaka,item,{getToken=async()=>null,fetcher=fetch,secureContext=globalThis.isSecureContext}={}){
 if(!item.drm_system||item.drm_system==='none')return;
 if(!['hls','dash'].includes(item.video_source))throw Error('A proteção exige streaming HLS ou DASH criptografado.');
 if(!secureContext)throw Error('Abra o site em HTTPS para reproduzir conteúdo protegido.');
 const response=await fetcher('video-config.json',{cache:'no-store'});
 if(!response.ok)throw Error('Não foi possível carregar a configuração de reprodução protegida.');
 const config=await response.json(),key=systems[item.drm_system],server=https(config.licenseServers?.[key]);
 if(!config.drmEnabled||!key||!server)throw Error('Este vídeo aguarda a ativação do serviço de licenças '+(item.drm_system==='widevine'?'Widevine':item.drm_system)+'.');
 const supported=await shaka.Player.probeSupport();
 if(!supported.drm?.[key])throw Error('Este navegador não oferece suporte à proteção '+item.drm_system+'. Tente um navegador compatível com esse conteúdo.');
 if(config.licenseAuth==='firebase'){
  const community=await fetcher('community-config.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Não foi possível verificar o serviço de licenças.');return r.json();});
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(community.supabaseUrl)||server!==community.supabaseUrl+'/functions/v1/drm-license')throw Error('A autenticação DRM precisa usar o servidor de licenças do próprio projeto.');
 }
 player.getNetworkingEngine().registerRequestFilter(async(type,request)=>{
  if(type!==shaka.net.NetworkingEngine.RequestType.LICENSE)return;
  // Prevent a manifest from substituting another URL and receiving the user's token.
  if(!request.uris.length||request.uris.some(uri=>https(uri)!==server))throw Error('Endereço de licença inesperado.');
  if(config.licenseAuth==='firebase'){
   const token=await getToken();if(!token)throw Error('Entre na sua conta para reproduzir este vídeo.');
   request.headers.Authorization='Bearer '+token;
   request.headers['X-Content-ID']=item.id;
  }
 });
 player.configure({drm:{servers:{[key]:server},retryParameters:{maxAttempts:2,baseDelay:1000,backoffFactor:2,fuzzFactor:.5,timeout:20000}}});
 if(item.drm_system==='fairplay'&&https(config.fairplayCertificateUrl))player.configure({drm:{advanced:{[key]:{serverCertificateUri:config.fairplayCertificateUrl}}}});
 return key;
}
