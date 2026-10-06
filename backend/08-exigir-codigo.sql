-- OPCIONAL: somente depois de publicar a função login-code e testar o envio.
-- Em auth-config.json: security.requireEmailCode=true e security.endpoint configurado.
-- Firebase SMS já usa código; outros métodos passam pela confirmação por e-mail.
update krs_private.login_policy set require_code=true where id=true;
-- Para desativar, use require_code=false. Isso não exclui contas.
