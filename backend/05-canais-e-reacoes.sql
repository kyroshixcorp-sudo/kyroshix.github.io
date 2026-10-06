begin;
create or replace function public.krs_save_channel(p_handle text,p_links jsonb) returns public.krs_profiles
language plpgsql security definer set search_path='' as $$
declare u text:=public.krs_uid(); result public.krs_profiles; item jsonb;
begin
 if u is null then raise exception 'Entre e confirme sua conta.'; end if;
 if p_handle !~ '^[a-z0-9][a-z0-9_-]{2,29}$' then raise exception 'Escolha um endereço de 3 a 30 letras minúsculas, números, traços ou sublinhados.'; end if;
 if jsonb_typeof(p_links)<>'array' or jsonb_array_length(p_links)>5 then raise exception 'Escolha até cinco links.'; end if;
 for item in select * from jsonb_array_elements(p_links) loop
  if length(item->>'label') not between 1 and 40 or (item->>'label') is null or (item->>'url') is null or (item->>'url') !~ '^https://[^[:space:]/]+([/?#]|$)' or length(item->>'url')>1000 then raise exception 'Escolha um nome e um endereço HTTPS para cada link.'; end if;
 end loop;
 update public.krs_profiles set handle=p_handle,links=p_links,updated_at=now() where uid=u returning * into result;
 if not found then raise exception 'Salve seu perfil antes de criar o canal.'; end if;
 return result;
exception when unique_violation then raise exception 'Esse endereço de canal já está em uso.';
end $$;
create or replace function public.krs_react(p_track text,p_reaction text,p_active boolean) returns void
language plpgsql security definer set search_path='' as $$
declare u text:=public.krs_uid();
begin
 if u is null then raise exception 'Entre e confirme sua conta para reagir.'; end if;
 if p_reaction not in ('like','heart','fire','wow','clap') or p_reaction is null then raise exception 'Escolha uma reação válida.'; end if;
 if not exists(select 1 from public.krs_tracks where id=p_track and published) then raise exception 'Arquivo não encontrado.'; end if;
 if p_active then insert into public.krs_reactions(track_id,user_uid,reaction) values(p_track,u,p_reaction) on conflict do nothing;
 else delete from public.krs_reactions where track_id=p_track and user_uid=u and reaction=p_reaction; end if;
end $$;
create or replace function public.krs_subscribe(p_channel text,p_active boolean) returns void
language plpgsql security definer set search_path='' as $$
declare u text:=public.krs_uid();
begin
 if u is null then raise exception 'Entre e confirme sua conta para se inscrever.'; end if;
 if u=p_channel then raise exception 'Você já está no seu próprio canal.'; end if;
 if p_active then insert into public.krs_subscriptions(subscriber_uid,channel_uid) values(u,p_channel) on conflict do nothing;
 else delete from public.krs_subscriptions where subscriber_uid=u and channel_uid=p_channel; end if;
end $$;
create or replace function public.krs_social(p_track text default null,p_channel text default null) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
 'counts',(select coalesce(jsonb_object_agg(reaction,n),'{}') from (select reaction,count(*) n from public.krs_reactions r join public.krs_tracks t on t.id=r.track_id where r.track_id=p_track and t.published group by reaction) a),
 'mine',(select coalesce(jsonb_agg(reaction),'[]') from public.krs_reactions where track_id=p_track and user_uid=public.krs_uid()),
 'subscribers',(select count(*) from public.krs_subscriptions where channel_uid=p_channel),
 'subscribed',exists(select 1 from public.krs_subscriptions where channel_uid=p_channel and subscriber_uid=public.krs_uid()));
$$;
create or replace function public.krs_my_subscriptions() returns setof public.krs_profiles
language sql stable security definer set search_path='' as $$
 select p.* from public.krs_profiles p join public.krs_subscriptions s on s.channel_uid=p.uid where s.subscriber_uid=public.krs_uid() order by s.created_at desc limit 100;
$$;
revoke all on function public.krs_save_channel(text,jsonb),public.krs_react(text,text,boolean),public.krs_subscribe(text,boolean),public.krs_social(text,text),public.krs_my_subscriptions() from public;
grant execute on function public.krs_save_channel(text,jsonb),public.krs_react(text,text,boolean),public.krs_subscribe(text,boolean),public.krs_social(text,text),public.krs_my_subscriptions() to anon,authenticated;
commit;
