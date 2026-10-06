import assert from 'node:assert/strict';
import {resumableUpload} from '../dist/resumable-upload.js';
import {configureDrm} from '../dist/drm.js';
import {downloadName,audioExtension} from '../dist/ui-utils.js';
const size=13*1024*1024,file=new Blob([new Uint8Array(size)],{type:'audio/flac'}),base='https://project-test.supabase.co',url='https://project-test.storage.supabase.co/storage/v1/upload/resumable/test-id';
let offset=0,failed=false,calls=[],progress=[];
const errorFromResponse=r=>new Error('Storage: '+r.status);
await resumableUpload({base,path:'tracks/test/original.flac',file,headers:async extra=>({Authorization:'Bearer fresh-token',apikey:'publishable-test',...extra}),errorFromResponse,onProgress:p=>progress.push(p),wait:async()=>{},fetcher:async(target,options)=>{
 assert.equal(options.redirect,'error');assert.equal(options.headers.Authorization,'Bearer fresh-token');calls.push(options.method);
 if(options.method==='POST'){assert.equal(options.headers['Upload-Length'],String(size));assert.match(options.headers['Upload-Metadata'],/contentType YXVkaW8vZmxhYw==/);return new Response(null,{status:201,headers:{Location:url}});}
 assert.equal(target,url);
 if(options.method==='HEAD')return new Response(null,{status:200,headers:{'Upload-Offset':String(offset)}});
 assert.equal(Number(options.headers['Upload-Offset']),offset);assert(options.body.size<=6*1024*1024);offset+=options.body.size;
 if(!failed){failed=true;throw Error('Lost response after commit');}
 return new Response(null,{status:204,headers:{'Upload-Offset':String(offset)}});
}});
assert.equal(offset,size);assert.equal(progress.at(-1),100);assert(calls.includes('HEAD'));
let externalCalls=0;
await assert.rejects(()=>resumableUpload({base,path:'tracks/test/a.wav',file,headers:async x=>x,errorFromResponse,fetcher:async()=>{externalCalls++;return new Response(null,{status:201,headers:{Location:'https://attacker.invalid/upload'}});}}),/inesperado/);assert.equal(externalCalls,1);
let count=0;
await assert.rejects(()=>resumableUpload({base,path:'tracks/test/a.wav',file,headers:async x=>x,errorFromResponse,fetcher:async()=>++count===1?new Response(null,{status:201,headers:{Location:url}}):new Response('{}',{status:403})}),/403/);assert.equal(count,2);
assert.equal(audioExtension({name:'Original.FLAC'}),'flac');assert.match(downloadName({title:'Faixa',audio_path:'tracks/a/b.flac'}),/\.flac$/);
let filter,configured,tokenReads=0,config={drmEnabled:true,licenseAuth:'firebase',licenseServers:{'com.widevine.alpha':base+'/functions/v1/drm-license'}};
const player={getNetworkingEngine:()=>({registerRequestFilter:fn=>filter=fn}),configure:c=>configured=c};
const shaka={Player:{probeSupport:async()=>({drm:{'com.widevine.alpha':{}}})},net:{NetworkingEngine:{RequestType:{LICENSE:2,SEGMENT:1}}}};
const options={secureContext:true,getToken:async()=>{tokenReads++;return 'signed-firebase-token';},fetcher:async u=>new Response(JSON.stringify(u==='video-config.json'?config:{supabaseUrl:base}))};
const item={id:'test-video',video_source:'dash',drm_system:'widevine'};
await configureDrm(player,shaka,item,options);assert.equal(configured.drm.servers['com.widevine.alpha'],base+'/functions/v1/drm-license');
const segment={uris:['https://cdn.invalid/media'],headers:{}};await filter(1,segment);assert.deepEqual(segment.headers,{});assert.equal(tokenReads,0);
await assert.rejects(()=>filter(2,{uris:['https://attacker.invalid/license'],headers:{}}),/inesperado/);assert.equal(tokenReads,0);
const license={uris:[base+'/functions/v1/drm-license'],headers:{}};await filter(2,license);assert.equal(license.headers.Authorization,'Bearer signed-firebase-token');assert.equal(license.headers['X-Content-ID'],'test-video');
config.licenseServers['com.widevine.alpha']='https://attacker.invalid/license';await assert.rejects(()=>configureDrm(player,shaka,item,options),/próprio projeto/);
config.drmEnabled=false;await assert.rejects(()=>configureDrm(player,shaka,item,options),/ativação/);
await assert.rejects(()=>configureDrm(player,shaka,{...item,video_source:'mp4'},options),/criptografado/);
console.log('PASS: TUS chunk size, response-loss recovery, progress, no auth forwarding to untrusted upload/license URLs, permanent failure handling, original download extension, DRM activation gate and authenticated license request isolation. Actual Widevine license playback requires a provider and encrypted media.');
