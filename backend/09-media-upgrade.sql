-- KYROSHIX · atualização 09. Execute no SQL Editor do projeto existente.
-- Repetível. Não apaga conteúdos, não troca o dono e não altera login/códigos.
-- Requer a instalação existente da plataforma (01 a 07).
begin;
update storage.buckets set file_size_limit=52428800,
 allowed_mime_types=array['audio/mpeg','audio/flac','audio/wav','audio/mp4','audio/ogg','image/webp']
 where id='kyroshix-media';
update storage.buckets set file_size_limit=52428800 where id='kyroshix-video';

create or replace function public.krs_can_upload(p_name text,p_meta jsonb)
returns boolean language sql stable set search_path = '' as $$
 select public.krs_uid() is not null and (
  (p_name in ('profiles/'||public.krs_uid()||'/avatar.webp','profiles/'||public.krs_uid()||'/banner.webp')
   and p_meta->>'mimetype'='image/webp'
   and coalesce(p_meta->>'size',p_meta->>'contentLength')::bigint between 1 and 8388608)
  or (public.krs_is_owner() and (
   (p_name ~ '^tracks/[a-z0-9-]+/[a-z0-9-]+[.]webp$' and p_meta->>'mimetype'='image/webp'
    and coalesce(p_meta->>'size',p_meta->>'contentLength')::bigint between 1 and 8388608)
   or (p_name ~ '^tracks/[a-z0-9-]+/[a-z0-9-]+[.](mp3|flac|wav|m4a|ogg)$'
    and p_meta->>'mimetype'=case split_part(p_name,'.',2)
      when 'mp3' then 'audio/mpeg' when 'flac' then 'audio/flac'
      when 'wav' then 'audio/wav' when 'm4a' then 'audio/mp4' when 'ogg' then 'audio/ogg' end
    and coalesce(p_meta->>'size',p_meta->>'contentLength')::bigint between 1 and 52428800)
  ))
 );
$$;
revoke all on function public.krs_can_upload(text,jsonb) from public;
grant execute on function public.krs_can_upload(text,jsonb) to anon,authenticated;

create or replace function public.krs_save_track(p_track jsonb) returns public.krs_tracks
language plpgsql security definer set search_path = '' as $$
declare result public.krs_tracks; ident text; ap text; cp text;
begin
 if not public.krs_is_owner() then raise exception 'Somente o dono pode gerenciar músicas.'; end if;
 ident:=p_track->>'id';
 if exists(select 1 from public.krs_tracks where id=ident and kind='video') then raise exception 'Arquivo pertence a um vídeo. Use o editor de vídeos.'; end if;
 if coalesce((p_track->>'byte_size')::bigint,0) not between 0 and 52428800 then raise exception 'Arquivo de áudio deve ter até 50 MB.'; end if; ap:=p_track->>'audio_path'; cp:=coalesce(p_track->>'cover_path','');
 if ap is null or ap='' then raise exception 'Envie o áudio antes de publicar.'; end if;
 if ap not in ('assets/remember.mp3','assets/legends.mp3','assets/darkness.mp3','assets/blindfold.mp3')
 and ap !~ '^tracks/[a-z0-9-]+/[a-z0-9-]+[.](mp3|flac|wav|m4a|ogg)$' then raise exception 'Arquivo de áudio inválido.'; end if;
 if cp<>'' and cp !~ '^tracks/[a-z0-9-]+/[a-z0-9-]+[.]webp$' then raise exception 'Capa inválida.'; end if;
 if ap like 'tracks/%' and not exists(select 1 from storage.objects where bucket_id='kyroshix-media' and name=ap) then raise exception 'Envie o áudio antes de publicar.'; end if;
 if cp<>'' and not exists(select 1 from storage.objects where bucket_id='kyroshix-media' and name=cp) then raise exception 'Envie a capa antes de publicar.'; end if;
 insert into public.krs_tracks(id,title,artists,remix,description,credits,tags,duration,audio_path,cover_path,legacy_cover,featured,byte_size)
 values(ident,trim(p_track->>'title'),trim(p_track->>'artists'),coalesce(p_track->>'remix','Remix'),coalesce(p_track->>'description',''),coalesce(p_track->>'credits',''),array(select jsonb_array_elements_text(p_track->'tags')),coalesce((p_track->>'duration')::numeric,0),ap,cp,coalesce(p_track->>'legacy_cover',''),coalesce((p_track->>'featured')::boolean,false),coalesce((p_track->>'byte_size')::bigint,0))
 on conflict(id) do update set title=excluded.title,artists=excluded.artists,remix=excluded.remix,description=excluded.description,credits=excluded.credits,tags=excluded.tags,duration=excluded.duration,audio_path=excluded.audio_path,cover_path=excluded.cover_path,legacy_cover=excluded.legacy_cover,featured=excluded.featured,byte_size=excluded.byte_size,updated_at=now()
 returning * into result; return result;
end $$;

commit;
