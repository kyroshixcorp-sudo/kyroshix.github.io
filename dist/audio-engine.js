// Shared audio graph: two streaming decks, one equalizer and one analyser.
export const BANDS=[60,170,350,1000,3500,10000];
export const PRESETS={original:{name:'Equilibrado',bands:[0,0,0,0,0,0]},nightcore:{name:'Nightcore',bands:[2,1,-1,0,2,1]},electronic:{name:'Eletrônica',bands:[4,2,-2,0,2,3]},voice:{name:'Voz em destaque',bands:[-2,-1,0,3,3,1]},bass:{name:'Graves',bands:[5,4,1,0,-1,-2]},soft:{name:'Suave',bands:[1,0,0,-1,-2,-3]}};
export const defaults=()=>({crossfade:4,enabled:false,preset:'original',bands:BANDS.map(()=>0),bass:0,clarity:0,peaks:true});
const clamp=(v,min,max,fallback=0)=>Number.isFinite(Number(v))?Math.min(max,Math.max(min,Number(v))):fallback;
export function sanitizeSettings(value={}){return {crossfade:clamp(value.crossfade,0,12,4),enabled:value.enabled===true,preset:Object.hasOwn(PRESETS,value.preset)?value.preset:'custom',bands:BANDS.map((_,i)=>clamp(value.bands?.[i],-12,12)),bass:clamp(value.bass,0,6),clarity:clamp(value.clarity,0,6),peaks:value.peaks!==false};}
export function fadeCurves(){const incoming=new Float32Array(65),outgoing=new Float32Array(65);for(let i=0;i<65;i++){const x=i/64*Math.PI/2,a=Math.cos(x),b=Math.sin(x);incoming[i]=b/(a+b);outgoing[i]=a/(a+b);}return {incoming,outgoing};}
function smooth(param,value,ctx){param.cancelScheduledValues(ctx.currentTime);param.setTargetAtTime(value,ctx.currentTime,.025);}
export function createSoundGraph(ctx,initial=defaults(),volume=.8){
 const mix=ctx.createGain(),dry=ctx.createGain(),pre=ctx.createGain(),wet=ctx.createGain(),master=ctx.createGain(),analyser=ctx.createAnalyser();
 const specs=BANDS.map((frequency,i)=>({frequency,type:i===0?'lowshelf':i===5?'highshelf':'peaking'})).concat([{frequency:100,type:'lowshelf'},{frequency:4000,type:'highshelf'}]);
 const filters=specs.map(s=>{const f=ctx.createBiquadFilter();f.type=s.type;f.frequency.value=s.frequency;f.Q.value=1;return f;});
 const probes=specs.map(s=>{const f=ctx.createBiquadFilter();f.type=s.type;f.frequency.value=s.frequency;f.Q.value=1;return f;});
 const compressor=ctx.createDynamicsCompressor();compressor.attack.value=.006;compressor.release.value=.22;
 mix.connect(dry);dry.connect(master);mix.connect(pre);let node=pre;for(const f of filters){node.connect(f);node=f;}node.connect(compressor);compressor.connect(wet);wet.connect(master);master.connect(analyser);analyser.connect(ctx.destination);analyser.fftSize=512;
 dry.gain.value=initial.enabled?0:1;wet.gain.value=initial.enabled?1:0;master.gain.value=volume;
 function apply(settings){
  const gains=[...settings.bands,settings.bass,settings.clarity],freqs=new Float32Array(256),response=new Float32Array(256),phase=new Float32Array(256),sum=new Float32Array(256);
  for(let i=0;i<freqs.length;i++)freqs[i]=20*Math.pow(Math.min(20000,ctx.sampleRate*.49)/20,i/(freqs.length-1));
  filters.forEach((f,i)=>{smooth(f.gain,gains[i],ctx);probes[i].gain.value=gains[i];probes[i].getFrequencyResponse(freqs,response,phase);for(let n=0;n<sum.length;n++)sum[n]+=20*Math.log10(Math.max(1e-8,response[n]));});
  // Reserve headroom based on the combined filter response, never add loudness gain.
  const attenuation=Math.max(0,...sum)+1;smooth(pre.gain,10**(-attenuation/20),ctx);
  smooth(compressor.threshold,settings.peaks?-18:0,ctx);smooth(compressor.knee,settings.peaks?18:0,ctx);smooth(compressor.ratio,settings.peaks?3:1,ctx);
  smooth(dry.gain,settings.enabled?0:1,ctx);smooth(wet.gain,settings.enabled?1:0,ctx);
 }
 apply(initial);return {mix,analyser,apply,volume:value=>smooth(master.gain,value,ctx)};
}
export function createAudioEngine(primary,{notify=()=>{},storage=globalThis.localStorage}={}){
 const bus=new EventTarget(),secondary=document.createElement('audio');secondary.id='audio-next';secondary.preload='none';secondary.crossOrigin='anonymous';primary.after(secondary);
 const slots=[{el:primary},{el:secondary}];let active=slots[0],ctx=null,graph=null,settings=defaults(),volume=primary.volume,rate=1,loop=false,serial=0,pending=false,transition=null,timer=0,prepared='',track=null;
 try{settings=sanitizeSettings({...defaults(),...JSON.parse(storage?.getItem('krs-sound')||'{}')});}catch{}
 const emit=(name,detail)=>bus.dispatchEvent(detail===undefined?new Event(name):new CustomEvent(name,{detail}));
 const gain=(slot,value)=>{if(slot.gain){slot.gain.gain.cancelScheduledValues(ctx.currentTime);slot.gain.gain.setValueAtTime(value,ctx.currentTime);}};
 function resetTransition(){clearTimeout(timer);const previous=transition;transition=null;pending=false;for(const s of slots){gain(s,s===active?1:0);if(s!==active)s.el.pause();}if(previous)emit('transitionchange',null);}
 async function ensure(){
  const AudioCtx=globalThis.AudioContext||globalThis.webkitAudioContext;if(!AudioCtx)return false;
  if(!ctx){ctx=new AudioCtx();graph=createSoundGraph(ctx,settings,volume);for(const s of slots){s.source=ctx.createMediaElementSource(s.el);s.gain=ctx.createGain();s.gain.gain.value=s===active?1:0;s.source.connect(s.gain);s.gain.connect(graph.mix);s.el.volume=1;}}
  if(ctx.state!=='running')await ctx.resume();return true;
 }
 function activate(slot,nextTrack){active=slot;for(const s of slots)s.el.id=s===active?'audio':'audio-next';track=nextTrack;active.el.loop=loop;emit('trackchange',nextTrack);emit('loadedmetadata');emit('play');}
 async function play(){
  const attempt=serial;const ready=ensure();const playback=active.el.play();await Promise.all([ready,playback]);if(attempt===serial)emit('play');
 }
 function pause(){serial++;pending=false;resetTransition();active.el.pause();emit('pause');}
 async function select(url,{autoplay=true,fade=true,item=null}={}){
  const token=++serial,wasPlaying=!active.el.paused;resetTransition();
  const canFade=fade&&autoplay&&wasPlaying&&settings.crossfade>0&&url!==active.el.getAttribute('src');
  if(canFade){
   pending=true;const next=slots.find(s=>s!==active);next.el.loop=false;
   try{
    if(await ensure()){
     if(token!==serial)return false;
     if(next.el.getAttribute('src')!==url){next.el.src=url;next.el.preload='auto';next.el.load();}else next.el.currentTime=0;
     next.el.playbackRate=rate;next.el.preservesPitch=true;gain(next,0);
     await next.el.play();if(token!==serial)return false;
     const old=active,remaining=Number.isFinite(old.el.duration)?Math.max(0,(old.el.duration-old.el.currentTime)/rate):settings.crossfade;
     const incomingLength=Number.isFinite(next.el.duration)?next.el.duration/rate/2:settings.crossfade;
     const duration=Math.min(settings.crossfade,remaining,incomingLength);
     pending=false;prepared='';activate(next,item);
     if(duration<.08){old.el.pause();gain(old,0);gain(next,1);return true;}
     transition={old,next,duration};const curves=fadeCurves(),now=ctx.currentTime;
     old.gain.gain.cancelScheduledValues(now);next.gain.gain.cancelScheduledValues(now);
     old.gain.gain.setValueCurveAtTime(curves.outgoing,now,duration);next.gain.gain.setValueCurveAtTime(curves.incoming,now,duration);
     emit('transitionchange',{duration,title:item?.title||''});timer=setTimeout(()=>{if(token===serial)resetTransition();},duration*1000+60);return true;
    }
   }catch(error){if(token!==serial)return false;resetTransition();if(active.el.ended)emit('pause');throw error;}
   if(token!==serial)return false;pending=false;
  }
  active.el.pause();active.el.src=url;active.el.preload='metadata';active.el.load();prepared='';track=item;emit('trackchange',item);emit('loadedmetadata');if(autoplay)await play();return true;
 }
 function prepare(url){if(!url||settings.crossfade===0||transition||pending||url===active.el.getAttribute('src'))return;const next=slots.find(s=>s!==active);if(prepared===url&&next.el.getAttribute('src')===url)return;next.el.pause();gain(next,0);next.el.preload='auto';next.el.src=url;next.el.load();prepared=url;}
 for(const slot of slots)for(const name of ['play','pause','ended','timeupdate','loadedmetadata','durationchange','emptied','error','waiting','playing','seeking','seeked','ratechange'])slot.el.addEventListener(name,()=>{if(slot===active)emit(name);});
 Object.assign(bus,{play,pause,select,prepare,load(){serial++;resetTransition();active.el.load();},removeAttribute(name){serial++;resetTransition();active.el.removeAttribute(name);},async getAnalyser(){if(!await ensure())throw Error('Web Audio indisponível');return graph.analyser;},async configure(patch){settings=sanitizeSettings({...settings,...patch});if(patch.crossfade===0){serial++;resetTransition();const idle=slots.find(s=>s!==active);idle.el.removeAttribute('src');idle.el.load();prepared='';}try{storage?.setItem('krs-sound',JSON.stringify(settings));}catch{}if(graph)graph.apply(settings);emit('soundchange',settings);if(settings.enabled&&!graph){try{if(!await ensure())throw Error();}catch{notify('Os efeitos de áudio não estão disponíveis neste navegador.');return false;}}return true;}});
 Object.defineProperties(bus,{
  paused:{get:()=>active.el.paused},duration:{get:()=>active.el.duration},error:{get:()=>active.el.error},ended:{get:()=>active.el.ended},readyState:{get:()=>active.el.readyState},currentSrc:{get:()=>active.el.currentSrc},settings:{get:()=>({...settings,bands:[...settings.bands]})},transitioning:{get:()=>pending||!!transition},supported:{get:()=>!!(globalThis.AudioContext||globalThis.webkitAudioContext)},
  currentTime:{get:()=>active.el.currentTime,set:value=>{serial++;resetTransition();active.el.currentTime=value;}},
  volume:{get:()=>volume,set:value=>{volume=clamp(value,0,1,.8);if(graph)graph.volume(volume);else for(const s of slots)s.el.volume=volume;emit('volumechange');}},
  playbackRate:{get:()=>rate,set:value=>{rate=clamp(value,.5,2,1);serial++;resetTransition();for(const s of slots)s.el.playbackRate=rate;emit('ratechange');}},
  preservesPitch:{get:()=>active.el.preservesPitch,set:value=>{for(const s of slots)s.el.preservesPitch=value;}},
  loop:{get:()=>loop,set:value=>{loop=!!value;active.el.loop=loop;if(loop){serial++;resetTransition();}emit('soundchange',settings);}},
  src:{get:()=>active.el.src,set:value=>{serial++;resetTransition();active.el.src=value;}}
 });return bus;
}
