-- Upgrade aditivo. Execute depois de 03-corrigir-envios-e-dono.sql.
begin;
alter table public.krs_profiles add column if not exists handle text;
alter table public.krs_profiles add column if not exists links jsonb not null default '[]';
create unique index if not exists krs_profile_handle on public.krs_profiles(lower(handle)) where handle is not null;
alter table public.krs_tracks add column if not exists kind text not null default 'audio' check(kind in ('audio','video'));
alter table public.krs_tracks add column if not exists channel_uid text not null default '8Q7S8FgBZjTrg4Mkf46ntcYvl0Q2';
alter table public.krs_tracks add column if not exists video_source text not null default '';
alter table public.krs_tracks add column if not exists video_url text not null default '';
alter table public.krs_tracks add column if not exists caption_url text not null default '';
alter table public.krs_tracks add column if not exists drm_system text not null default 'none';
alter table public.krs_tracks add column if not exists chapters jsonb not null default '[]';
alter table public.krs_tracks add column if not exists published boolean not null default true;
drop policy if exists krs_tracks_read on public.krs_tracks;
create policy krs_tracks_read on public.krs_tracks for select to anon,authenticated using(published or public.krs_is_owner());
drop policy if exists krs_comments_read on public.krs_comments;
create policy krs_comments_read on public.krs_comments for select to anon,authenticated using(exists(select 1 from public.krs_tracks t where t.id=track_id));
create table if not exists public.krs_reactions(
 track_id text references public.krs_tracks(id) on delete cascade,
 user_uid text not null, reaction text not null check(reaction in ('like','heart','fire','wow','clap')),
 created_at timestamptz not null default now(),primary key(track_id,user_uid,reaction)
);
create table if not exists public.krs_subscriptions(
 subscriber_uid text not null,channel_uid text references public.krs_profiles(uid) on delete cascade,
 created_at timestamptz not null default now(),primary key(subscriber_uid,channel_uid),check(subscriber_uid<>channel_uid)
);
alter table public.krs_reactions enable row level security;
alter table public.krs_subscriptions enable row level security;
revoke all on public.krs_reactions,public.krs_subscriptions from public,anon,authenticated;
-- Somente RPCs retornam contagens públicas; listas individuais ficam privadas.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('kyroshix-video','kyroshix-video',true,52428800,array['video/mp4','video/webm'])
on conflict(id) do update set file_size_limit=52428800,allowed_mime_types=array['video/mp4','video/webm'];
drop policy if exists krs_video_read on storage.objects;
create policy krs_video_read on storage.objects for select to anon,authenticated using(bucket_id='kyroshix-video');
drop policy if exists krs_video_write on storage.objects;
create policy krs_video_write on storage.objects for insert to anon,authenticated with check(bucket_id='kyroshix-video' and public.krs_is_owner() and name ~ '^videos/[a-z0-9-]+/[a-z0-9-]+[.](mp4|webm)$');
drop policy if exists krs_video_update on storage.objects;
create policy krs_video_update on storage.objects for update to anon,authenticated using(bucket_id='kyroshix-video' and public.krs_is_owner()) with check(bucket_id='kyroshix-video' and public.krs_is_owner() and name ~ '^videos/[a-z0-9-]+/[a-z0-9-]+[.](mp4|webm)$');
drop policy if exists krs_video_delete on storage.objects;
create policy krs_video_delete on storage.objects for delete to anon,authenticated using(bucket_id='kyroshix-video' and public.krs_is_owner());
commit;
