-- Instala o suporte. A exigência de código permanece desligada até configurar e-mail.
begin;
create table if not exists krs_private.login_policy(id boolean primary key default true check(id),require_code boolean not null default false);
insert into krs_private.login_policy(id,require_code) values(true,false) on conflict do nothing;
create table if not exists krs_private.login_challenges(id uuid primary key default gen_random_uuid(),uid text not null,auth_time bigint not null,code_hash text not null,created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '10 minutes',attempts integer not null default 0,used boolean not null default false);
create index if not exists krs_login_challenges_uid_time on krs_private.login_challenges(uid,created_at);
create table if not exists krs_private.login_verified(uid text not null,auth_time bigint not null,expires_at timestamptz not null,primary key(uid,auth_time));
revoke all on all tables in schema krs_private from public,anon,authenticated;
create or replace function public.krs_email_code_start(p_uid text,p_auth_time bigint,p_hash text) returns uuid
language plpgsql security definer set search_path='' as $$
declare ident uuid;
begin
 if length(p_uid) not between 1 and 128 or p_hash !~ '^[0-9a-f]{64}$' or p_uid is null or p_hash is null or p_auth_time is null then raise exception 'Invalid input'; end if;
 perform pg_advisory_xact_lock(hashtext('login-code:'||p_uid));
 if exists(select 1 from krs_private.login_challenges where uid=p_uid and created_at>now()-interval '60 seconds') or (select count(*) from krs_private.login_challenges where uid=p_uid and created_at>now()-interval '1 hour')>=5 then raise exception 'Rate limited'; end if;
 update krs_private.login_challenges set used=true where uid=p_uid and not used;
 delete from krs_private.login_challenges where expires_at<now()-interval '1 day';
 delete from krs_private.login_verified where expires_at<now();
 insert into krs_private.login_challenges(uid,auth_time,code_hash) values(p_uid,p_auth_time,p_hash) returning id into ident;return ident;
end $$;
create or replace function public.krs_email_code_check(p_uid text,p_auth_time bigint,p_id uuid,p_hash text) returns boolean
language plpgsql security definer set search_path='' as $$
declare c krs_private.login_challenges;
begin
 select * into c from krs_private.login_challenges where id=p_id and uid=p_uid and auth_time=p_auth_time for update;
 if not found or c.used or c.expires_at<=now() or c.attempts>=5 then return false; end if;
 update krs_private.login_challenges set attempts=attempts+1 where id=c.id;
 if c.code_hash<>p_hash or p_hash is null then return false; end if;
 update krs_private.login_challenges set used=true where id=c.id;
 insert into krs_private.login_verified(uid,auth_time,expires_at) values(p_uid,p_auth_time,now()+interval '12 hours') on conflict(uid,auth_time) do update set expires_at=excluded.expires_at;
 return true;
end $$;
create or replace function public.krs_email_code_status(p_uid text,p_auth_time bigint) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from krs_private.login_verified where uid=p_uid and auth_time=p_auth_time and expires_at>now());
$$;
revoke all on function public.krs_email_code_start(text,bigint,text),public.krs_email_code_check(text,bigint,uuid,text),public.krs_email_code_status(text,bigint) from public,anon,authenticated;
grant execute on function public.krs_email_code_start(text,bigint,text),public.krs_email_code_check(text,bigint,uuid,text),public.krs_email_code_status(text,bigint) to service_role;
create or replace function public.krs_uid() returns text language sql stable security definer set search_path='' as $$
 select case when auth.jwt()->>'iss'='https://securetoken.google.com/kyroshix-releases'
 and auth.jwt()->>'aud'='kyroshix-releases' and length(auth.jwt()->>'sub') between 1 and 128
 and (
  (auth.jwt()->'firebase'->>'sign_in_provider'='phone' and length(auth.jwt()->>'phone_number')>5)
  or (
   (auth.jwt()->>'email_verified'='true' or public.krs_email_code_status(auth.jwt()->>'sub',case when auth.jwt()->>'auth_time' ~ '^[0-9]{1,12}$' then (auth.jwt()->>'auth_time')::bigint else 0 end))
   and (not coalesce((select require_code from krs_private.login_policy where id=true),false)
    or public.krs_email_code_status(auth.jwt()->>'sub',case when auth.jwt()->>'auth_time' ~ '^[0-9]{1,12}$' then (auth.jwt()->>'auth_time')::bigint else 0 end))
  )
 ) then auth.jwt()->>'sub' else null end;
$$;
revoke all on function public.krs_uid() from public;
grant execute on function public.krs_uid() to anon,authenticated;
commit;
