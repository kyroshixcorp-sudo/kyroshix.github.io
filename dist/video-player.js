import {configureDrm} from './drm.js';
import {esc,format} from './ui-utils.js';
let loader;
export function secureUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';}}
export function youtubeId(value){if(/^[\w-]{11}$/.test(value))return value;try{const u=new URL(value);const host=u.hostname.replace(/^www\./,'');if(host==='youtu.be')return /^[\w-]{11}$/.test(u.pathname.slice(1))?u.pathname.slice(1):'';if(['youtube.com','m.youtube.com'].includes(host)){const id=u.searchParams.get('v')||u.pathname.split('/')[2];return /^[\w-]{11}$/.test(id||'')?id:'';}}catch{}return '';}
function loadShaka(){return loader||=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='vendor/shaka-player-5.2.12.js';script.onload=()=>resolve(window.shaka);script.onerror=()=>{loader=null;reject(new Error('Não foi possível carregar o player de streaming.'));};document.head.append(script);});}
export function readHistory(){try{return JSON.parse(localStorage.getItem('krs-watch-history')||'{}');}catch{return {};}}
export async function mountVideoPlayer(root,item,{media,onPlay=()=>{},toast=()=>{},getToken=async()=>null}){
 let disposed=false,shakaPlayer=null,timer,lastSaved=0;const cleanup=[];
 if(item.video_source==='youtube'){
  const consent=()=>{root.innerHTML=`<div class="embed-consent"><span class="eyebrow">YOUTUBE</span><h2>${esc(item.title)}</h2><p>Ao reproduzir, o vídeo será carregado do YouTube.</p><button class="primary" data-load-embed>Reproduzir vídeo</button></div>`;root.querySelector('button').onclick=()=>{onPlay();root.innerHTML=`<iframe title="${esc(item.title)}" src="https://www.youtube-nocookie.com/embed/${youtubeId(item.video_url)}?autoplay=1&rel=0" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;};};
  consent();return {destroy(){disposed=true;root.innerHTML='';},pause(){if(!disposed&&root.querySelector('iframe'))consent();}};
 }
 const source=item.video_url?.startsWith('videos/')?media(item.video_url):secureUrl(item.video_url);
 root.innerHTML=`<video playsinline preload="metadata" crossorigin="anonymous" ${media(item.cover_path)?`poster="${esc(media(item.cover_path))}"`:''}></video><div class="video-shade"></div><span class="video-quality-label" aria-live="polite">Original</span><span class="video-buffering" hidden role="status">Carregando…</span><button class="video-center" data-vplay aria-label="Reproduzir vídeo">▶</button><p class="video-alert" role="status" hidden></p><button class="resume-video secondary" hidden></button><div class="video-controls"><input class="video-seek" type="range" min="0" max="1" step=".1" value="0" aria-label="Posição do vídeo"><div class="video-control-row"><button data-vplay aria-label="Reproduzir ou pausar">▶</button><button data-jump="-10" aria-label="Voltar 10 segundos">↶ 10</button><button data-jump="10" aria-label="Avançar 10 segundos">10 ↷</button><button data-mute aria-label="Ativar ou desativar som">♪</button><input class="video-volume" aria-label="Volume do vídeo" type="range" min="0" max="1" step=".05" value="1"><span class="video-time">0:00 / 0:00</span><div class="video-options"><label><span class="sr-only">Velocidade</span><select data-speed>${[.5,.75,1,1.25,1.5,1.75,2].map(x=>`<option value="${x}" ${x===1?'selected':''}>${x}×</option>`).join('')}</select></label><label hidden data-quality-wrap><span class="sr-only">Qualidade</span><select data-quality><option value="auto">Auto</option></select></label><button data-captions aria-label="Ativar legendas" aria-pressed="false" hidden>CC</button><button data-pip aria-label="Picture-in-picture">▣</button><button data-theater aria-label="Modo cinema" aria-pressed="false">▭</button><button data-fullscreen aria-label="Tela cheia">⛶</button></div></div></div>`;
 const v=root.querySelector('video'),seek=root.querySelector('.video-seek'),status=root.querySelector('.video-alert'),resume=root.querySelector('.resume-video');
 const on=(el,event,fn)=>{el.addEventListener(event,fn);cleanup.push(()=>el.removeEventListener(event,fn));};
 const fail=text=>{root.querySelector('.video-buffering').hidden=true;status.textContent=text;status.hidden=false;root.classList.remove('controls-hidden');};
 const position=readHistory()[item.id]?.time||0;
 if(position>5){resume.hidden=false;resume.textContent=`Continuar de ${format(position)}`;resume.onclick=()=>{if(v.readyState){v.currentTime=position;resume.hidden=true;toggle();}};}
 if(item.caption_url){const track=document.createElement('track');track.kind='subtitles';track.srclang='pt';track.label='Português';track.src=secureUrl(item.caption_url);v.append(track);root.querySelector('[data-captions]').hidden=false;}
 async function toggle(){if(v.paused){try{status.hidden=true;await v.play();}catch{fail('Não foi possível reproduzir. Confira a conexão, o formato e tente novamente.');}}else v.pause();}
 function reveal(){root.classList.remove('controls-hidden');clearTimeout(timer);if(!v.paused)timer=setTimeout(()=>{if(!root.contains(document.activeElement))root.classList.add('controls-hidden');},3000);}
 function record(force=false){if(!Number.isFinite(v.duration)||v.currentTime<1||(!force&&Date.now()-lastSaved<5000))return;lastSaved=Date.now();try{const h=readHistory();h[item.id]={time:v.currentTime>=v.duration-3?0:v.currentTime,title:item.title,updated:Date.now()};const recent=Object.fromEntries(Object.entries(h).sort((a,b)=>b[1].updated-a[1].updated).slice(0,100));localStorage.setItem('krs-watch-history',JSON.stringify(recent));}catch{}}
 on(v,'loadedmetadata',()=>{seek.max=v.duration||1;if(position>=v.duration-3)resume.hidden=true;if(!shakaPlayer)root.querySelector('.video-quality-label').textContent=v.videoHeight?`${v.videoHeight}p · Original`:'Áudio original';});
 on(v,'timeupdate',()=>{seek.value=v.currentTime;root.querySelector('.video-time').textContent=`${format(v.currentTime)} / ${format(v.duration)}`;record();});
 on(v,'play',()=>{onPlay();root.classList.add('is-playing');root.querySelector('.video-center').hidden=true;root.querySelector('.video-control-row [data-vplay]').textContent='Ⅱ';resume.hidden=true;reveal();});
 on(v,'pause',()=>{root.classList.remove('is-playing','controls-hidden');root.querySelector('.video-center').hidden=false;root.querySelector('.video-control-row [data-vplay]').textContent='▶';record(true);});
 on(v,'waiting',()=>{root.querySelector('.video-buffering').hidden=false;});
 on(v,'playing',()=>{root.querySelector('.video-buffering').hidden=true;});
 on(v,'pause',()=>{root.querySelector('.video-buffering').hidden=true;});
 on(v,'error',()=>fail('O vídeo não carregou. A origem precisa permitir reprodução neste site.'));
 on(root,'pointermove',reveal);on(root,'touchstart',reveal);on(root,'focusin',reveal);
 on(seek,'input',()=>{v.currentTime=Number(seek.value);});on(root.querySelector('.video-volume'),'input',e=>v.volume=Number(e.target.value));
 on(root,'click',async e=>{const b=e.target.closest('button');if(!b)return;try{if(b.matches('[data-vplay]'))await toggle();if(b.dataset.jump)v.currentTime=Math.max(0,Math.min(v.duration||Infinity,v.currentTime+Number(b.dataset.jump)));if(b.hasAttribute('data-mute')){v.muted=!v.muted;b.setAttribute('aria-pressed',String(v.muted));}if(b.hasAttribute('data-fullscreen')){if(document.fullscreenElement)await document.exitFullscreen();else if(root.requestFullscreen)await root.requestFullscreen();else v.webkitEnterFullscreen?.();}if(b.hasAttribute('data-pip')){if(document.pictureInPictureElement)await document.exitPictureInPicture();else await v.requestPictureInPicture();}if(b.hasAttribute('data-theater')){const active=root.closest('.watch-layout').classList.toggle('theater');b.setAttribute('aria-pressed',String(active));}if(b.hasAttribute('data-captions')){const active=b.getAttribute('aria-pressed')!=='true';for(const t of v.textTracks)t.mode=active?'showing':'hidden';if(shakaPlayer)await shakaPlayer.setTextTrackVisibility(active);b.setAttribute('aria-pressed',String(active));}}catch{toast('Este recurso não está disponível neste navegador.');}});
 if(!document.pictureInPictureEnabled)root.querySelector('[data-pip]').hidden=true;
 on(root.querySelector('[data-speed]'),'change',e=>{v.playbackRate=Number(e.target.value);v.preservesPitch=true;});
 on(root,'keydown',e=>{if(/INPUT|TEXTAREA|SELECT|BUTTON/.test(e.target.tagName)||e.ctrlKey||e.altKey||e.metaKey)return;const k=e.key.toLowerCase();if([' ','k','j','l','m','f'].includes(k)){e.preventDefault();if([' ','k'].includes(k))toggle();if(k==='j')v.currentTime=Math.max(0,v.currentTime-10);if(k==='l')v.currentTime=Math.min(v.duration||Infinity,v.currentTime+10);if(k==='m')v.muted=!v.muted;if(k==='f')root.querySelector('[data-fullscreen]').click();}});
 root.tabIndex=0;
 try{
  if(!source)throw new Error('Endereço de vídeo inválido.');
  if(['hls','dash'].includes(item.video_source)){
   const shaka=await loadShaka();if(disposed)return {destroy(){},pause(){}};shaka.polyfill.installAll();if(!shaka.Player.isBrowserSupported())throw new Error('Este navegador não oferece suporte a esse streaming.');
   shakaPlayer=new shaka.Player();await shakaPlayer.attach(v);
   shakaPlayer.configure({streaming:{bufferingGoal:30,rebufferingGoal:2,bufferBehind:20,retryParameters:{maxAttempts:3,baseDelay:1000,backoffFactor:2,fuzzFactor:.5,timeout:30000}},abr:{enabled:true}});
   await configureDrm(shakaPlayer,shaka,item,{getToken});
   shakaPlayer.addEventListener('error',()=>{if(!disposed)fail('O streaming não pôde ser reproduzido. Confira a fonte e, se houver proteção, a licença.');});
   await shakaPlayer.load(source);if(disposed){await shakaPlayer.destroy();return {destroy(){},pause(){}};}
   const quality=root.querySelector('[data-quality]');
   let preferred='auto';try{preferred=localStorage.getItem('krs-video-quality')||'auto';}catch{}
   const variants=()=>{const all=shakaPlayer.getVariantTracks(),active=all.find(t=>t.active);return all.filter(t=>!active||t.language===active.language);};
   const heights=[...new Set(variants().map(t=>t.height).filter(Boolean))].sort((a,b)=>b-a);
   quality.innerHTML='<option value="auto">Automática</option><option value="data">Economizar dados</option>'+heights.map(h=>`<option value="${h}">${h}p</option>`).join('');root.querySelector('[data-quality-wrap]').hidden=false;
   quality.value=['auto','data',...heights.map(String)].includes(preferred)?preferred:'auto';
   function qualityLabel(){if(disposed)return;const t=shakaPlayer.getVariantTracks().find(t=>t.active),resolution=t?.height?`${t.height}p`:'Streaming';root.querySelector('.video-quality-label').textContent=resolution+(quality.value==='auto'?' · Auto':quality.value==='data'?' · Economia':'')+(item.drm_system&&item.drm_system!=='none'?' · '+item.drm_system.toUpperCase():'');}
   function selectQuality(){const adaptive=['auto','data'].includes(quality.value);const minimum=Math.min(...heights);shakaPlayer.configure({abr:{enabled:adaptive,restrictions:{maxHeight:quality.value==='data'?Math.max(480,Number.isFinite(minimum)?minimum:480):Infinity}}});if(!adaptive){const t=variants().filter(t=>t.height===Number(quality.value)).sort((a,b)=>b.bandwidth-a.bandwidth)[0];if(t)shakaPlayer.selectVariantTrack(t,true);}qualityLabel();}
   selectQuality();on(quality,'change',()=>{selectQuality();try{localStorage.setItem('krs-video-quality',quality.value);}catch{}});
   shakaPlayer.addEventListener('adaptation',qualityLabel);shakaPlayer.addEventListener('variantchanged',qualityLabel);
   shakaPlayer.addEventListener('buffering',e=>{if(disposed)return;root.querySelector('.video-buffering').hidden=!e.buffering||v.paused;});
   root.querySelector('[data-captions]').hidden=!item.caption_url&&!shakaPlayer.getTextTracks().length;
  }else v.src=source;
 }catch(e){if(!disposed)fail(e.message);}
 return {seek(time){v.currentTime=time;},pause(){v.pause();},destroy(){disposed=true;record(true);clearTimeout(timer);cleanup.forEach(fn=>fn());v.pause();v.removeAttribute('src');v.load();shakaPlayer?.destroy();root.innerHTML='';}};
}
