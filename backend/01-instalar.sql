-- KYROSHIX Releases. Execute no SQL Editor de um projeto Supabase Free.
-- Antes: Authentication > Third-party Auth > Firebase: kyroshix-releases.
-- Não habilite acesso anônimo de escrita nem desative RLS.
begin;
create schema if not exists krs_private;
revoke all on schema krs_private from public, anon, authenticated;
create table if not exists krs_private.owners(uid text primary key);

-- O JWT Firebase não possui role por padrão: Supabase o mapeia para anon.
-- As funções verificam assinatura (gateway), issuer, audience, UID e e-mail
-- confirmado. Incluir anon nas policies NÃO autoriza um visitante sem JWT.
create or replace function public.krs_uid() returns text language sql stable
set search_path = '' as $$
 select case when auth.jwt()->>'iss' = 'https://securetoken.google.com/kyroshix-releases'
 and auth.jwt()->>'aud' = 'kyroshix-releases'
 and auth.jwt()->>'email_verified' = 'true'
 and length(auth.jwt()->>'sub') between 1 and 128
 then auth.jwt()->>'sub' else null end;
$$;
create or replace function public.krs_is_owner() returns boolean language sql stable security definer
set search_path = '' as $$
 select exists(select 1 from krs_private.owners where uid = public.krs_uid());
$$;

create table if not exists public.krs_profiles (
 uid text primary key, display_name text not null check(length(display_name) between 1 and 60),
 bio text not null default '' check(length(bio)<=300), pronouns text not null default '' check(length(pronouns)<=30),
 status text not null default '' check(length(status)<=80), accent text not null default '#ff4059' check(accent ~ '^#[0-9a-fA-F]{6}$'),
 avatar_path text not null default '', banner_path text not null default '', updated_at timestamptz not null default now()
);
create table if not exists public.krs_tracks (
 id text primary key check(id ~ '^[a-z0-9-]{1,64}$'), title text not null check(length(title) between 1 and 120),
 artists text not null check(length(artists) between 1 and 200), remix text not null default 'Nightcore Remix' check(length(remix)<=100),
 description text not null default '' check(length(description)<=5000), credits text not null default '' check(length(credits)<=2000),
 tags text[] not null default array['nightcore']::text[] check(tags <@ array['nightcore','synthwave','remix']::text[] and cardinality(tags)>0),
 duration numeric not null default 0 check(duration>=0 and duration<=7200), audio_path text not null,
 cover_path text not null default '', legacy_cover text not null default '' check(legacy_cover in ('','remember','legends','darkness','blindfold')),
 featured boolean not null default false, byte_size bigint not null default 0 check(byte_size>=0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.krs_comments (
 id uuid primary key default gen_random_uuid(), track_id text not null references public.krs_tracks(id) on delete cascade,
 user_id text not null references public.krs_profiles(uid), parent_id uuid references public.krs_comments(id),
 body text not null check(length(body)<=2000), deleted boolean not null default false,
 created_at timestamptz not null default now(), edited_at timestamptz
);
create index if not exists krs_comments_track_time on public.krs_comments(track_id, created_at desc, id);
create index if not exists krs_comments_user_time on public.krs_comments(user_id, created_at desc);
alter table public.krs_profiles enable row level security;
alter table public.krs_tracks enable row level security;
alter table public.krs_comments enable row level security;
revoke all on public.krs_profiles,public.krs_tracks,public.krs_comments from public,anon,authenticated;
grant select on public.krs_profiles,public.krs_tracks,public.krs_comments to anon,authenticated;
drop policy if exists krs_profiles_read on public.krs_profiles;
create policy krs_profiles_read on public.krs_profiles for select to anon,authenticated using(true);
drop policy if exists krs_tracks_read on public.krs_tracks;
create policy krs_tracks_read on public.krs_tracks for select to anon,authenticated using(true);
drop policy if exists krs_comments_read on public.krs_comments;
create policy krs_comments_read on public.krs_comments for select to anon,authenticated using(true);

create or replace function public.krs_save_profile(p_profile jsonb) returns public.krs_profiles
language plpgsql security definer set search_path = '' as $$
declare u text := public.krs_uid(); result public.krs_profiles; av text; ba text;
begin
 if u is null then raise exception 'Confirme seu e-mail para personalizar o perfil.'; end if;
 av:=coalesce(p_profile->>'avatar_path',''); ba:=coalesce(p_profile->>'banner_path','');
 if av not in ('','profiles/'||u||'/avatar.webp') or ba not in ('','profiles/'||u||'/banner.webp') then raise exception 'Imagem de perfil inválida.'; end if;
 insert into public.krs_profiles(uid,display_name,bio,pronouns,status,accent,avatar_path,banner_path)
 values(u,trim(p_profile->>'display_name'),coalesce(p_profile->>'bio',''),coalesce(p_profile->>'pronouns',''),coalesce(p_profile->>'status',''),coalesce(p_profile->>'accent','#ff4059'),av,ba)
 on conflict(uid) do update set display_name=excluded.display_name,bio=excluded.bio,pronouns=excluded.pronouns,status=excluded.status,accent=excluded.accent,avatar_path=excluded.avatar_path,banner_path=excluded.banner_path,updated_at=now()
 returning * into result; return result;
end $$;

create or replace function public.krs_save_track(p_track jsonb) returns public.krs_tracks
language plpgsql security definer set search_path = '' as $$
declare result public.krs_tracks; ident text; ap text; cp text;
begin
 if not public.krs_is_owner() then raise exception 'Somente o dono pode gerenciar músicas.'; end if;
 ident:=p_track->>'id'; ap:=p_track->>'audio_path'; cp:=coalesce(p_track->>'cover_path','');
 if ap not in ('assets/remember.mp3','assets/legends.mp3','assets/darkness.mp3','assets/blindfold.mp3')
 and ap !~ '^tracks/[a-z0-9-]+/[a-z0-9-]+[.]mp3$' then raise exception 'Arquivo de áudio inválido.'; end if;
 if cp<>'' and cp !~ '^tracks/[a-z0-9-]+/[a-z0-9-]+[.]webp$' then raise exception 'Capa inválida.'; end if;
 if ap like 'tracks/%' and not exists(select 1 from storage.objects where bucket_id='kyroshix-media' and name=ap) then raise exception 'Envie o MP3 antes de publicar.'; end if;
 if cp<>'' and not exists(select 1 from storage.objects where bucket_id='kyroshix-media' and name=cp) then raise exception 'Envie a capa antes de publicar.'; end if;
 insert into public.krs_tracks(id,title,artists,remix,description,credits,tags,duration,audio_path,cover_path,legacy_cover,featured,byte_size)
 values(ident,trim(p_track->>'title'),trim(p_track->>'artists'),coalesce(p_track->>'remix','Remix'),coalesce(p_track->>'description',''),coalesce(p_track->>'credits',''),array(select jsonb_array_elements_text(p_track->'tags')),coalesce((p_track->>'duration')::numeric,0),ap,cp,coalesce(p_track->>'legacy_cover',''),coalesce((p_track->>'featured')::boolean,false),coalesce((p_track->>'byte_size')::bigint,0))
 on conflict(id) do update set title=excluded.title,artists=excluded.artists,remix=excluded.remix,description=excluded.description,credits=excluded.credits,tags=excluded.tags,duration=excluded.duration,audio_path=excluded.audio_path,cover_path=excluded.cover_path,legacy_cover=excluded.legacy_cover,featured=excluded.featured,byte_size=excluded.byte_size,updated_at=now()
 returning * into result; return result;
end $$;
create or replace function public.krs_delete_track(p_id text) returns void language plpgsql security definer set search_path = '' as $$
begin
 if not public.krs_is_owner() then raise exception 'Somente o dono pode excluir músicas.'; end if;
 delete from public.krs_tracks where id=p_id;
end $$;

create or replace function public.krs_comment(p_track text,p_body text,p_parent uuid default null) returns public.krs_comments
language plpgsql security definer set search_path = '' as $$
declare u text:=public.krs_uid(); result public.krs_comments;
begin
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
create or replace function public.krs_edit_comment(p_id uuid,p_body text) returns void language plpgsql security definer set search_path = '' as $$
begin
 if public.krs_uid() is null then raise exception 'Entre na sua conta.'; end if;
 if length(trim(p_body)) not between 1 and 2000 then raise exception 'Escreva de 1 a 2.000 caracteres.'; end if;
 update public.krs_comments set body=trim(p_body),edited_at=now() where id=p_id and user_id=public.krs_uid() and not deleted;
 if not found then raise exception 'Você só pode editar seus próprios comentários.'; end if;
end $$;
create or replace function public.krs_delete_comment(p_id uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
 if public.krs_uid() is null then raise exception 'Entre na sua conta.'; end if;
 update public.krs_comments set body='',deleted=true,edited_at=now() where id=p_id and (user_id=public.krs_uid() or public.krs_is_owner());
 if not found then raise exception 'Você não pode excluir este comentário.'; end if;
end $$;

-- Bucket público para ouvir/baixar. Escritas passam pelas policies abaixo.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('kyroshix-media','kyroshix-media',true,26214400,array['audio/mpeg','image/webp'])
on conflict(id) do update set public=true,file_size_limit=26214400,allowed_mime_types=array['audio/mpeg','image/webp'];
create or replace function public.krs_can_upload(p_name text,p_meta jsonb) returns boolean language sql stable set search_path = '' as $$
 select public.krs_uid() is not null and (
 (p_name in ('profiles/'||public.krs_uid()||'/avatar.webp','profiles/'||public.krs_uid()||'/banner.webp')
  and p_meta->>'mimetype'='image/webp' and coalesce(p_meta->>'size',p_meta->>'contentLength')::bigint between 1 and 2097152)
 or (public.krs_is_owner() and ((p_name ~ '^tracks/[a-z0-9-]+/[a-z0-9-]+[.]mp3$' and p_meta->>'mimetype'='audio/mpeg')
 or(p_name ~ '^tracks/[a-z0-9-]+/[a-z0-9-]+[.]webp$' and p_meta->>'mimetype'='image/webp')))
 );
$$;
drop policy if exists krs_media_read on storage.objects;
create policy krs_media_read on storage.objects for select to anon,authenticated using(bucket_id='kyroshix-media');
drop policy if exists krs_media_insert on storage.objects;
create policy krs_media_insert on storage.objects for insert to anon,authenticated with check(bucket_id='kyroshix-media' and public.krs_can_upload(name,metadata));
drop policy if exists krs_media_update on storage.objects;
create policy krs_media_update on storage.objects for update to anon,authenticated
using(bucket_id='kyroshix-media' and public.krs_can_upload(name,metadata)) with check(bucket_id='kyroshix-media' and public.krs_can_upload(name,metadata));
drop policy if exists krs_media_delete on storage.objects;
create policy krs_media_delete on storage.objects for delete to anon,authenticated using(bucket_id='kyroshix-media' and (
(public.krs_is_owner() and name like 'tracks/%') or (public.krs_uid() is not null and name in ('profiles/'||public.krs_uid()||'/avatar.webp','profiles/'||public.krs_uid()||'/banner.webp'))));

revoke all on function public.krs_uid(),public.krs_is_owner(),public.krs_save_profile(jsonb),public.krs_save_track(jsonb),public.krs_delete_track(text),public.krs_comment(text,text,uuid),public.krs_edit_comment(uuid,text),public.krs_delete_comment(uuid),public.krs_can_upload(text,jsonb) from public;
grant execute on function public.krs_uid(),public.krs_is_owner(),public.krs_save_profile(jsonb),public.krs_save_track(jsonb),public.krs_delete_track(text),public.krs_comment(text,text,uuid),public.krs_edit_comment(uuid,text),public.krs_delete_comment(uuid),public.krs_can_upload(text,jsonb) to anon,authenticated;

-- Conteúdo inicial. Reexecutar não substitui edições feitas no painel.
insert into public.krs_tracks(id,title,artists,remix,description,credits,tags,duration,audio_path,legacy_cover,featured,byte_size) values
('remember','Remember','Levianth & Axol feat. The Tech Thieves','Nightcore Remix','O som que fica. Uma nova frequência, por KYROSHIX.','Obra original: Remember — Levianth & Axol feat. The Tech Thieves. Remix: KYROSHIX.',array['nightcore'],171.936,'assets/remember.mp3','remember',true,6878445),
('legends','Legends Never Die','Against The Current · League of Legends','Nightcore Remix','A energia de Worlds em uma nova velocidade.','Obra original: Legends Never Die — Worlds 2017, League of Legends feat. Against The Current. Remix: KYROSHIX.',array['nightcore'],207.744,'assets/legends.mp3','legends',false,8310765),
('darkness','Darkness','Lost Sky × She Is Jules','Synthwave / Nightcore Remix','Entre luzes de neon e noites de synthwave.','Obra original: Darkness — Lost Sky & She Is Jules. Remix: KYROSHIX.',array['nightcore','synthwave'],200.616,'assets/darkness.mp3','darkness',false,8025645),
('blindfold','Blindfold','Warriyo feat. Laura Brehm','Nightcore Remix','Feche os olhos. Entre na frequência.','Obra original: Blindfold — Warriyo feat. Laura Brehm. Remix: KYROSHIX.',array['nightcore'],189.5792,'assets/blindfold.mp3','blindfold',false,7584045)
on conflict(id) do nothing;
commit;
