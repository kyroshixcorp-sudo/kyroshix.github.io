import {trackPath} from './router.js';
import {esc,format} from './ui-utils.js';
const icon=name=>`<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
// Discovery and listening history are local UI state; the catalog remains authoritative.
export function createListeningRoom({audio,state,cover,getQueue,onToggle,onNext,onPrevious,onSelect,onExplore,onOpen,onHistoryChange,confirm,toast}){
 const $=id=>document.getElementById(id);let history=[],recorded='',railKey='',sectionKey='';
 try{const saved=JSON.parse(localStorage.getItem('krs-listening-history')||'[]');history=Array.isArray(saved)?saved.filter(x=>x&&typeof x.id==='string'&&Number.isFinite(x.at)).slice(0,50):[];}catch{}
 function recent(){return history.map(x=>state.tracks.find(t=>t.id===x.id)).filter(Boolean);}
 function persist(){try{localStorage.setItem('krs-listening-history',JSON.stringify(history));}catch{}}
 function row(t,rail=false){return `<div class="listening-row"><button class="row-play" ${rail?'data-rail-select':'data-play'}="${esc(t.id)}" aria-label="Reproduzir ${esc(t.title)}"><span class="mini-cover">${cover(t)}</span><span class="row-play-icon">${icon('play')}</span></button><a href="${esc(trackPath(t))}"><strong>${esc(t.title)}</strong><small>${esc(t.artists)}</small></a><span class="row-duration">${format(t.duration)}</span>${rail?'':`<button class="icon-button" data-play="${esc(t.id)}" aria-label="Ouvir ${esc(t.title)}">${icon('play')}</button>`}</div>`;}
 function renderSections(){
  const home=state.view==='inicio'&&!state.query&&state.filter==='all',rows=recent();
  $('artist-section').hidden=!home||!state.tracks.length;$('recent-section').hidden=!home||!rows.length;$('history-tools').hidden=state.view!=='recentes';$('history-clear').disabled=!rows.length;
  const key=state.tracks.map(t=>t.id+':'+t.updated_at+':'+t.artists+':'+t.title).join('|')+'@'+history.map(x=>x.id).join('|');
  if(key!==sectionKey){sectionKey=key;const artists=[...new Set(state.tracks.map(t=>t.artists).filter(Boolean))];$('artist-list').innerHTML=artists.map(name=>{const t=state.tracks.find(x=>x.artists===name),n=state.tracks.filter(x=>x.artists===name).length;return `<button class="artist-chip" data-explore-artist="${esc(name)}"><span class="artist-cover">${cover(t)}</span><strong>${esc(name)}</strong><small>${n} ${n===1?'faixa':'faixas'}</small></button>`;}).join('');$('recent-list').innerHTML=rows.slice(0,4).map(t=>row(t)).join('');}
 }
 function sync(){
  const t=state.current;for(const id of ['rail-play','rail-prev','rail-next','rail-expand','rail-art','rail-sound','rail-queue-open'])$(id).disabled=!t;
  if(!t){$('rail-title').textContent='Escolha uma música';$('rail-artist').textContent='Seu próximo play começa aqui.';$('rail-art').innerHTML=icon('headphones');$('rail-queue').innerHTML='';railKey='';return;}
  const tracks=getQueue(),idx=tracks.findIndex(x=>x.id===t.id),ordered=[...tracks.slice(idx+1),...tracks.slice(0,Math.max(0,idx))].filter(x=>x.id!==t.id),key=t.id+':'+t.updated_at+'|'+tracks.map(x=>x.id+':'+x.updated_at).join(',');
  if(key!==railKey){railKey=key;$('rail-art').innerHTML=cover(t);$('rail-title').textContent=t.title;$('rail-title').href=trackPath(t);$('rail-artist').textContent=t.artists;$('rail-queue').innerHTML=ordered.slice(0,3).map(x=>row(x,true)).join('')||'<p class="subtle">Só esta faixa na seleção.</p>';}
  $('rail-play').innerHTML=icon(audio.paused?'play':'pause');$('rail-play').setAttribute('aria-label',audio.paused?'Reproduzir':'Pausar');$('rail-queue-title').textContent=$('shuffle').getAttribute('aria-pressed')==='true'?'Na sua seleção':'A seguir';
  const s=audio.settings;$('rail-sound-summary').textContent=(s.crossfade?`Transição de ${s.crossfade} s`:'Transição desligada')+(s.enabled?' · EQ ligado':'');
 }
 function remember(){const t=state.current;if(!t||audio.paused||audio.currentTime<1||recorded===t.id)return;recorded=t.id;history=[{id:t.id,at:Date.now()},...history.filter(x=>x.id!==t.id)].slice(0,50);persist();renderSections();if(state.view==='recentes')onHistoryChange();}
 audio.addEventListener('timeupdate',remember);audio.addEventListener('trackchange',()=>{recorded='';sync();});audio.addEventListener('soundchange',sync);
 $('artist-list').addEventListener('click',e=>{const b=e.target.closest('[data-explore-artist]');if(b)onExplore(b.dataset.exploreArtist);});
 $('rail-queue').addEventListener('click',e=>{const b=e.target.closest('[data-rail-select]');if(b)onSelect(b.dataset.railSelect);});
 for(const id of ['rail-art','rail-expand'])$(id).onclick=()=>onOpen();$('rail-sound').onclick=()=>onOpen('sound');$('rail-queue-open').onclick=()=>onOpen('queue');$('rail-play').onclick=onToggle;$('rail-next').onclick=onNext;$('rail-prev').onclick=onPrevious;
 $('history-clear').onclick=async()=>{if(!await confirm('Limpar histórico?','As músicas ouvidas serão removidas do histórico deste navegador.'))return;history=[];persist();renderSections();onHistoryChange();toast('Histórico de músicas limpo.');};
 return {recent,sync,renderSections};
}
