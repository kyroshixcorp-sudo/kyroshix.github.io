import {resumableUpload} from './resumable-upload.js';
// Only public Supabase project settings belong in community-config.json.
// Firebase verifies identity; SQL and Storage policies authorize every write.
function uploadError(xhr) {
  let data={};try{data=JSON.parse(xhr.responseText||'{}');}catch{}
  const status=Number(data?.statusCode)||xhr.status;
  const detail=[data?.code,data?.error,data?.message].filter(v=>typeof v==='string').join(' ');
  if(status===401||/invalid.?jwt|jwt.?expired|invalid.?token/i.test(detail))return new Error('Sua sessão expirou. Saia da conta e entre novamente para enviar o arquivo.');
  if(status===403||/row.level.security|AccessDenied|Unauthorized|permission denied/i.test(detail))return new Error('O envio foi bloqueado pelas permissões do armazenamento. Avise o responsável pelo site. (Storage: 403)');
  if(status===413||/EntityTooLarge|PayloadTooLarge|maximum allowed size/i.test(detail))return new Error('O arquivo ultrapassa o limite: 8 MB para imagens e 50 MB para áudio ou vídeo.');
  if(/InvalidMimeType|mime type.*not supported/i.test(detail))return new Error('O armazenamento recusou o formato do arquivo. Escolha JPG, PNG ou WebP para imagens, ou MP3, FLAC, WAV, M4A e OGG para músicas. Confira também a atualização do armazenamento.');
  if(status===404||/NoSuchBucket|Bucket not found/i.test(detail))return new Error('O armazenamento de arquivos ainda não está disponível. Avise o responsável pelo site. (Storage: 404)');
  if(status===429)return new Error('Há muitos envios neste momento. Aguarde um pouco e tente novamente.');
  return new Error(`Não foi possível enviar o arquivo. Tente novamente. (Storage: ${xhr.status})`);
}

export async function createDataClient(getToken) {
  const response = await fetch('/community-config.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('Não foi possível carregar a comunidade.');
  const config = await response.json();
  if (!config.enabled) return null;
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.supabaseUrl) || !config.publishableKey) throw new Error('A configuração da comunidade está incompleta.');
  const base = config.supabaseUrl;
  async function headers(extra={}) {
    const token = await getToken();
    return { apikey: config.publishableKey, ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra };
  }
  async function request(path, options={}) {
    let response;
    const { publicRead = false, ...fetchOptions } = options;
    try { response = await fetch(base+path,{...fetchOptions,headers:publicRead?{apikey:config.publishableKey}:await headers(options.headers)}); }
    catch { throw new Error('Sem conexão. Seu conteúdo continua no formulário. Tente novamente.'); }
    const data = await response.json().catch(()=>null);
    if (!response.ok) {
      const message = data?.message || data?.error_description || data?.error || '';
      const expected = /^(Confirme|Entre|Somente|Imagem|Arquivo|Capa|Envie|Escreva|Salve|Aguarde|Resposta|Você)/.test(message);
      throw new Error(expected ? message : response.status===401 || response.status===403 ? 'Acesso não autorizado. Confira sua conta e a ativação da comunidade.' : 'Não foi possível concluir. Confira a conexão e tente novamente.');
    }
    return data;
  }
  const rpc=(name,data={})=>request('/rest/v1/rpc/krs_'+name,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  const client = {
    rpc,
    async tracks() {
      let rows=[],offset=0;
      for (;;) { const page=await request(`/rest/v1/krs_tracks?select=*&order=featured.desc,created_at.desc,id.asc&limit=100&offset=${offset}`,{publicRead:true});rows.push(...page);if(page.length<100)return rows.filter(t=>t.kind!=='video');offset+=100; }
    },
    async videos(owner=false) { return request('/rest/v1/krs_tracks?kind=eq.video&select=*&order=created_at.desc&limit=200'+(owner?'':'&published=eq.true'),{publicRead:!owner}); },
    async video(id) { return (await request('/rest/v1/krs_tracks?id=eq.'+encodeURIComponent(id)+'&kind=eq.video&select=*'))[0]||null; },
    async profileByHandle(handle) { return (await request('/rest/v1/krs_profiles?handle=eq.'+encodeURIComponent(handle)+'&select=*',{publicRead:true}))[0]||null; },
    channelTracks(uid) { return request('/rest/v1/krs_tracks?channel_uid=eq.'+encodeURIComponent(uid)+'&published=eq.true&select=*&order=created_at.desc&limit=200',{publicRead:true}); },
    async profile(uid) { return (await request(`/rest/v1/krs_profiles?uid=eq.${encodeURIComponent(uid)}&select=*`,{publicRead:true}))[0]||null; },
    comments(track,offset=0) { return request(`/rest/v1/krs_comments?track_id=eq.${encodeURIComponent(track)}&select=*,profile:krs_profiles(display_name,avatar_path,accent,updated_at)&order=created_at.desc,id.desc&limit=30&offset=${offset}`,{publicRead:true}); },
    media(path,version='') {
      if (!path) return '';
      if (/^assets\/(remember|legends|darkness|blindfold)\.mp3$/.test(path)) return '/'+path;
      if (/^videos\/[a-z0-9-]+\/[a-z0-9-]+\.(mp4|webm)$/.test(path)) return `${base}/storage/v1/object/public/kyroshix-video/${path}`;
      if (!/^(tracks\/[a-z0-9-]+\/[a-z0-9-]+\.(mp3|flac|wav|m4a|ogg|webp)|profiles\/[^/]+\/(avatar|banner)\.webp)$/.test(path)) return '';
      return `${base}/storage/v1/object/public/kyroshix-media/${path.split('/').map(encodeURIComponent).join('/')}${version?'?v='+encodeURIComponent(version):''}`;
    },
    async upload(path,file,onProgress=()=>{}) {
      if(file.size>6*1024*1024){await resumableUpload({base,path,file,headers,onProgress,errorFromResponse:uploadError});return path;}
      const hdr = await headers({'Content-Type':file.type,'x-upsert':'true','cache-control':path.startsWith('profiles/')?'60':'3600'});
      await new Promise((resolve,reject)=>{
        const xhr=new XMLHttpRequest();xhr.open('POST',`${base}/storage/v1/object/${path.startsWith('videos/')?'kyroshix-video':'kyroshix-media'}/${path.split('/').map(encodeURIComponent).join('/')}`);xhr.timeout=180000;
        Object.entries(hdr).forEach(([key,value])=>xhr.setRequestHeader(key,value));
        xhr.upload.onprogress=e=>{if(e.lengthComputable)onProgress(Math.round(e.loaded/e.total*100));};
        xhr.onload=()=>xhr.status>=200&&xhr.status<300?resolve():reject(uploadError(xhr));
        xhr.onerror=xhr.ontimeout=()=>reject(new Error('O envio foi interrompido. Tente novamente; o formulário foi preservado.'));
        xhr.send(file);
      });
      return path;
    },
    async removeFiles(paths) {
      const owned=paths.filter(p=>p?.startsWith('tracks/'));
      const videos=paths.filter(p=>/^videos\/[a-z0-9-]+\/[a-z0-9-]+\.(mp4|webm)$/.test(p));
      if(videos.length)await request('/storage/v1/object/kyroshix-video',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({prefixes:videos})});
      if (owned.length) await request('/storage/v1/object/kyroshix-media',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({prefixes:owned})});
    }
  };
  return client;
}
