// TUS resumes from the server-confirmed offset after a transient failure.
// The file stays in memory only while this page is open; no tokens are persisted.
export async function resumableUpload({base,path,file,headers,onProgress=()=>{},errorFromResponse,fetcher=fetch,wait=ms=>new Promise(r=>setTimeout(r,ms))}){
 const endpoint=base.replace('.supabase.co','.storage.supabase.co')+'/storage/v1/upload/resumable';
 const bucket=path.startsWith('videos/')?'kyroshix-video':'kyroshix-media',chunk=6*1024*1024;
 const metadata={bucketName:bucket,objectName:path,contentType:file.type,cacheControl:path.startsWith('profiles/')?'60':'3600'};
 const encode=value=>btoa(String.fromCharCode(...new TextEncoder().encode(value)));
 async function send(url,options){
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),60000);
  try{return await fetcher(url,{...options,redirect:'error',signal:controller.signal,headers:await headers({'Tus-Resumable':'1.0.0','x-upsert':'true',...options.headers})});}
  finally{clearTimeout(timeout);}
 }
 async function failure(response){return errorFromResponse({status:response.status,responseText:await response.text()});}
 const created=await send(endpoint,{method:'POST',headers:{'Upload-Length':String(file.size),'Upload-Metadata':Object.entries(metadata).map(([k,v])=>k+' '+encode(v)).join(',')}});
 if(!created.ok)throw await failure(created);
 const location=created.headers.get('Location');
 let target;try{target=new URL(location,endpoint);}catch{throw Error('O armazenamento não retornou um endereço de envio válido.');}
 if(!location||target.origin!==new URL(endpoint).origin||!target.pathname.startsWith(new URL(endpoint).pathname+'/')||target.username||target.password)throw Error('O armazenamento retornou um endereço de envio inesperado.');
 let offset=0,attempts=0;onProgress(0);
 while(offset<file.size){
  const end=Math.min(offset+chunk,file.size);
  try{
   const response=await send(target.href,{method:'PATCH',headers:{'Upload-Offset':String(offset),'Content-Type':'application/offset+octet-stream'},body:file.slice(offset,end)});
   if(!response.ok){const error=await failure(response);if(![408,409,423,429].includes(response.status)&&response.status<500)error.permanent=true;throw error;}
   const confirmed=Number(response.headers.get('Upload-Offset'));
   if(confirmed!==end)throw Error('O armazenamento não confirmou o trecho enviado.');
   offset=confirmed;attempts=0;onProgress(Math.round(offset/file.size*100));
  }catch(error){
   if(error.permanent||attempts++>=3)throw error.permanent?error:Error('A conexão interrompeu o envio. O formulário foi preservado; tente salvar novamente.');
   await wait([1000,2500,5000][attempts-1]);
   // A timed-out PATCH may have succeeded. HEAD prevents resending accepted bytes.
   const check=await send(target.href,{method:'HEAD'}).catch(()=>null);
   if(check?.ok){const header=check.headers.get('Upload-Offset'),confirmed=Number(header);if(header!==null&&Number.isInteger(confirmed)&&confirmed>=0&&confirmed<=file.size){offset=confirmed;onProgress(Math.round(offset/file.size*100));}}
  }
 }
 onProgress(100);return path;
}
