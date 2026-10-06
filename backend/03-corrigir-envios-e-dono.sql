-- Execute uma vez no SQL Editor do Supabase. Pode repetir com segurança.
-- Preserva músicas, comentários, perfis e arquivos existentes.
begin;

-- O Storage usa contentLength na checagem inicial e size no objeto salvo.
-- Continuamos exigindo conta verificada, pasta própria, WebP e até 2 MiB.
create or replace function public.krs_can_upload(p_name text,p_meta jsonb)
returns boolean language sql stable set search_path = '' as $$
 select public.krs_uid() is not null and (
  (p_name in (
    'profiles/'||public.krs_uid()||'/avatar.webp',
    'profiles/'||public.krs_uid()||'/banner.webp'
   ) and p_meta->>'mimetype'='image/webp'
   and coalesce(p_meta->>'size',p_meta->>'contentLength')::bigint
       between 1 and 2097152)
  or (public.krs_is_owner() and (
    (p_name ~ '^tracks/[a-z0-9-]+/[a-z0-9-]+[.]mp3$'
     and p_meta->>'mimetype'='audio/mpeg')
    or (p_name ~ '^tracks/[a-z0-9-]+/[a-z0-9-]+[.]webp$'
     and p_meta->>'mimetype'='image/webp')
  ))
 );
$$;
revoke all on function public.krs_can_upload(text,jsonb) from public;
grant execute on function public.krs_can_upload(text,jsonb) to anon,authenticated;

-- Substitui apenas a conta dona anterior, sem excluir contas ou conteúdos.
insert into krs_private.owners(uid)
values ('8Q7S8FgBZjTrg4Mkf46ntcYvl0Q2')
on conflict(uid) do nothing;
delete from krs_private.owners
where uid='wcJXpZgLs8YMLZ3F2JAGk1TWVl12';

commit;
