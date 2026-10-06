begin;
create or replace function public.krs_save_video(p_video jsonb) returns public.krs_tracks
language plpgsql security definer set search_path='' as $$
declare result public.krs_tracks; v text:=p_video->>'video_url'; src text:=p_video->>'video_source'; cp text:=coalesce(p_video->>'cover_path',''); ch jsonb:=coalesce(p_video->'chapters','[]'); item jsonb; previous numeric:=-1;
begin
 if not public.krs_is_owner() then raise exception 'Somente o dono pode publicar vídeos.'; end if;
 if exists(select 1 from public.krs_tracks where id=p_video->>'id' and kind<>'video') then raise exception 'Escolha outro identificador de vídeo.'; end if;
 if src is null or src not in ('mp4','webm','hls','dash','youtube') or v is null then raise exception 'Escolha uma fonte de vídeo válida.'; end if;
 if src='youtube' then
  if v !~ '^[A-Za-z0-9_-]{11}$' then raise exception 'Escolha um link válido do YouTube.'; end if;
 elsif v like 'videos/%' then
  if v !~ '^videos/[a-z0-9-]+/[a-z0-9-]+[.](mp4|webm)$' or not exists(select 1 from storage.objects where bucket_id='kyroshix-video' and name=v) then raise exception 'Envie o vídeo antes de publicar.'; end if;
 elsif v !~ '^https://[^[:space:]/]+([/?#]|$)' or length(v)>2000 then raise exception 'Escolha um endereço HTTPS para o vídeo.'; end if;
 if cp<>'' and (cp !~ '^tracks/[a-z0-9-]+/[a-z0-9-]+[.]webp$' or not exists(select 1 from storage.objects where bucket_id='kyroshix-media' and name=cp)) then raise exception 'Envie uma capa válida.'; end if;
 if coalesce(p_video->>'caption_url','')<>'' and (p_video->>'caption_url' !~ '^https://[^[:space:]/]+([/?#]|$)' or length(p_video->>'caption_url')>2000) then raise exception 'Escolha um endereço HTTPS para a legenda.'; end if;
 if coalesce(p_video->>'drm_system','none') not in ('none','widevine','playready','fairplay') or (coalesce(p_video->>'drm_system','none')<>'none' and src not in ('hls','dash')) then raise exception 'Escolha HLS ou DASH para um vídeo com DRM.'; end if;
 if jsonb_typeof(ch)<>'array' or jsonb_array_length(ch)>100 then raise exception 'Escolha até 100 capítulos.'; end if;
 for item in select * from jsonb_array_elements(ch) loop
  if (item->>'start') is null or (item->>'title') is null or (item->>'start')::numeric<0 or (item->>'start')::numeric<=previous or length(item->>'title') not between 1 and 100 then raise exception 'Escolha capítulos em ordem crescente, com tempo e título.'; end if;
  previous:=(item->>'start')::numeric;
 end loop;
 insert into public.krs_tracks(id,title,artists,description,credits,tags,duration,audio_path,cover_path,kind,channel_uid,video_source,video_url,caption_url,drm_system,chapters,published,byte_size,remix)
 values(p_video->>'id',trim(p_video->>'title'),trim(p_video->>'artists'),coalesce(p_video->>'description',''),coalesce(p_video->>'credits',''),array['remix'],coalesce((p_video->>'duration')::numeric,0),'',cp,'video',public.krs_uid(),src,v,coalesce(p_video->>'caption_url',''),coalesce(p_video->>'drm_system','none'),ch,coalesce((p_video->>'published')::boolean,true),coalesce((p_video->>'byte_size')::bigint,0),'Vídeo')
 on conflict(id) do update set title=excluded.title,artists=excluded.artists,description=excluded.description,credits=excluded.credits,duration=excluded.duration,cover_path=excluded.cover_path,video_source=excluded.video_source,video_url=excluded.video_url,caption_url=excluded.caption_url,drm_system=excluded.drm_system,chapters=excluded.chapters,published=excluded.published,byte_size=excluded.byte_size,updated_at=now()
 returning * into result;return result;
end $$;
revoke all on function public.krs_save_video(jsonb) from public;
grant execute on function public.krs_save_video(jsonb) to anon,authenticated;
create or replace function public.krs_comment(p_track text,p_body text,p_parent uuid default null) returns public.krs_comments
language plpgsql security definer set search_path = '' as $$
declare u text:=public.krs_uid(); result public.krs_comments;
begin
 if not exists(select 1 from public.krs_tracks where id=p_track and published) then raise exception 'Arquivo não encontrado.'; end if;
 if u is null then raise exception 'Entre e confirme seu e-mail para comentar.'; end if;
 if not exists(select 1 from public.krs_profiles where uid=u) then raise exception 'Salve seu perfil antes de comentar.'; end if;
 if length(trim(p_body)) not between 1 and 2000 then raise exception 'Escreva de 1 a 2.000 caracteres.'; end if;
 perform pg_advisory_xact_lock(hashtext(u));
 if exists(select 1 from public.krs_comments where user_id=u and created_at>now()-interval '10 seconds')
 or (select count(*) from public.krs_comments where user_id=u and created_at>now()-interval '1 hour')>=40 then raise exception 'Aguarde um pouco antes de comentar novamente.'; end if;
 if p_parent is not null and not exists(select 1 from public.krs_comments where id=p_parent and track_id=p_track and parent_id is null and not deleted) then raise exception 'Resposta inválida.'; end if;
 insert into public.krs_comments(track_id,user_id,body,parent_id) values(p_track,u,trim(p_body),p_parent) returning * into result;
 return result;
end $$;
commit;
