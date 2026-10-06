-- Substitua pelo UID da SUA conta, copiado do Firebase Authentication > Usuários.
-- Execute no SQL Editor. Não use seu e-mail nem sua senha.
do $$
declare owner_uid text := 'COLE_SEU_UID_FIREBASE_AQUI';
begin
 if owner_uid='COLE_SEU_UID_FIREBASE_AQUI' or length(owner_uid) not between 1 and 128 then
   raise exception 'Cole seu UID do Firebase antes de executar.';
 end if;
 insert into krs_private.owners(uid) values(owner_uid) on conflict do nothing;
end $$;
