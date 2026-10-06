export const esc = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const format = value => {const seconds=Math.max(0,Number(value)||0);return `${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;};
export const normalize = value => String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export const accent = value => /^#[0-9a-f]{6}$/i.test(value||'')?value:'#353535';
export const audioTypes={mp3:'audio/mpeg',flac:'audio/flac',wav:'audio/wav',m4a:'audio/mp4',ogg:'audio/ogg'};
export const audioExtension=t=>{const ext=(t.audio_path||t.name||'').split('.').pop().toLowerCase();return audioTypes[ext]?ext:'mp3';};
export function downloadName(t){return `KYROSHIX - ${t.title} (${t.remix||'Remix'}).${audioExtension(t)}`.replace(/[\\/:*?"<>|\x00-\x1f]/g,'-');}
export function legacyCover(value){return ['remember','legends','darkness','blindfold'].includes(value)?`cover-${value}`:'';}
export function filterTracks(tracks,{filter='all',query='',favoritesOnly=false,favorites=new Set(),sort='featured'}={}){
 const rows=tracks.filter(t=>(filter==='all'||t.tags.includes(filter))&&(!favoritesOnly||favorites.has(t.id))&&(!query||normalize(`${t.title} ${t.artists} ${t.remix}`).includes(normalize(query))));
 if(sort==='title')rows.sort((a,b)=>a.title.localeCompare(b.title,'pt-BR'));
 if(sort==='duration')rows.sort((a,b)=>Number(a.duration)-Number(b.duration));
 if(sort==='recent')rows.sort((a,b)=>String(b.created_at||'').localeCompare(a.created_at||''));
 return rows;
}
// Uploaded profile/covers are normalized to bounded WebP files before storage.
export async function prepareImage(file,maxWidth,maxHeight){
 if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('Escolha uma imagem JPG, PNG ou WebP.');
 if(file.size>30*1024*1024)throw new Error('Escolha uma imagem de até 30 MB.');
 const bitmap=await createImageBitmap(file).catch(()=>{throw new Error('Não foi possível abrir essa imagem.');});
 try{
  if(bitmap.width*bitmap.height>50000000)throw new Error('A imagem é muito grande. Reduza a resolução e tente novamente.');
  const scale=Math.min(1,maxWidth/bitmap.width,maxHeight/bitmap.height);
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
  let blob;for(const quality of [.92,.84,.76]){blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',quality));if(blob&&blob.size<=8*1024*1024)break;}
  if(!blob||blob.type!=='image/webp'||blob.size>8*1024*1024)throw new Error('Não foi possível preparar a imagem. Tente uma imagem menor.');
  return blob;
 }finally{bitmap.close();}
}
export async function inspectAudio(file){
 const ext=audioExtension({name:file?.name||''});
 if(!file||!Object.hasOwn(audioTypes,file.name.toLowerCase().split('.').pop())||file.size>50*1024*1024||file.size<128)throw new Error('Escolha MP3, FLAC, WAV, M4A ou OGG de até 50 MB.');
 const bytes=new Uint8Array(await file.slice(0,16).arrayBuffer()),text=String.fromCharCode(...bytes);
 const valid={mp3:text.startsWith('ID3')||(bytes[0]===255&&(bytes[1]&224)===224),flac:text.startsWith('fLaC'),wav:text.startsWith('RIFF')&&text.slice(8,12)==='WAVE',m4a:text.slice(4,8)==='ftyp',ogg:text.startsWith('OggS')};
 if(!valid[ext])throw new Error('O conteúdo do arquivo não corresponde ao formato selecionado.');
 const url=URL.createObjectURL(new Blob([file],{type:audioTypes[ext]}));
 try{return await new Promise((resolve,reject)=>{const a=new Audio();const timeout=setTimeout(()=>{a.src='';reject(new Error('Não foi possível ler a duração desse áudio.'));},15000);a.preload='metadata';a.onloadedmetadata=()=>{clearTimeout(timeout);const duration=a.duration;a.src='';if(!Number.isFinite(duration)||duration<=0||duration>7200)reject(new Error('Escolha uma faixa com duração de até 2 horas.'));else resolve(duration);};a.onerror=()=>{clearTimeout(timeout);a.src='';reject(new Error('Este formato de áudio não pôde ser lido pelo navegador. Tente MP3 ou outro navegador.'));};a.src=url;});}finally{URL.revokeObjectURL(url);}
}
export const inspectMp3=inspectAudio;
