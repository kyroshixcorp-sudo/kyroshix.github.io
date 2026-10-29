# Diagnóstico de autenticação — 22/10/2026

> **Atualização 27/10/2026 — preview por branch.** Foi solicitada a autorização de
> `arena-6a25f84d-kyroshix-github-io-kyroshix-preview.kyroshixcorp.workers.dev`.
> Nova consulta pública a `identitytoolkit.googleapis.com/v1/projects` confirmou que a lista
> atual contém `localhost`, `kyroshix-releases.firebaseapp.com`,
> `kyroshix-releases.web.app`, `releases.kyroshixcorp.workers.dev`,
> `kyroshix-preview.kyroshixcorp.workers.dev` e os domínios de provedores OAuth —
> mas **não** o hostname do preview por branch. O preview já serve a WebUI v2 com
> `auth.google: true`. A alteração depende de credencial administrativa do Firebase;
> este branch registra o hostname, um script de aplicação via API oficial, testes e o
> guia em [firebase-preview-domain.md](firebase-preview-domain.md). Nenhuma credencial
> foi solicitada, armazenada ou usada. Use `npm run check:firebase-domain -- --check`
> para verificar depois de aplicar.

## Causa confirmada e alcance

O preview público `https://kyroshix-preview.kyroshixcorp.workers.dev` entrega configuração do Firebase `kyroshix-releases`. A consulta pública somente leitura a `identitytoolkit.googleapis.com/v1/projects` confirmou que **o hostname do preview não está em authorizedDomains**. Isso explica `auth/unauthorized-domain`; o código não pode substituir essa autorização do servidor.

O domínio de produção `releases.kyroshixcorp.workers.dev` está autorizado. Preview e produção compartilham o projeto Firebase e, portanto, contas e configurações dos provedores. Não houve alteração nos consoles Firebase/provedores, banco ou Worker `releases`. Este branch deve ser revisado por PR; não mesclar/publicar automaticamente em produção.

A lista pública também contém `microsoft.com`, `google.com`, `apple.com`, `github.com`, `facebook.com`, `twitter.com` e `yahoo.com`. Esses registros não habilitam provedores OAuth. Revisar e remover entradas que não sejam origens de aplicações próprias utilizadas pelo projeto, após verificar dependências. Não adicionar `workers.dev`, curingas ou domínios de terceiros para contornar o erro.

## Ação necessária no Firebase

1. Abrir [Authentication → Settings](https://console.firebase.google.com/project/kyroshix-releases/authentication/settings).
2. Acrescentar exatamente `kyroshix-preview.kyroshixcorp.workers.dev`, sem protocolo, porta ou caminho. Preservar os domínios próprios existentes, incluindo produção e Firebase Hosting.
3. Usar a URL estável acima para testar; URLs de versões do Worker têm outros hostnames e não ficam autorizadas por esse registro.
4. Em [Sign-in method](https://console.firebase.google.com/project/kyroshix-releases/authentication/providers), verificar E-mail/Senha e Google. Os flags do frontend não comprovam ativação no backend. A configuração administrativa não foi acessada nesta auditoria.
5. Conferir a política de senhas e proteção contra enumeração de e-mails. A validação de 12 caracteres na interface não substitui a política do Firebase.
6. Testar cadastro, confirmação, login, recuperação, logout e restauração em janela anônima e celular, com contas de teste. Não foram criadas contas ou enviados e-mails/SMS nesta auditoria.

## Provedores

O callback para os provedores abaixo, mantendo o authDomain atual, é `https://kyroshix-releases.firebaseapp.com/__/auth/handler`. Copiar a URI exibida no console Firebase para evitar divergências. Não trocar authDomain pelo domínio workers.dev: o site estático não hospeda automaticamente o handler Firebase.

| Método | Estado confirmado no frontend | Ação externa e sequência |
| --- | --- | --- |
| E-mail/senha | Formulários implementados | Confirmar ativação no Firebase; verificar templates e entrega. É independente da lista OAuth `providers`. |
| Google | Único OAuth declarado | Confirmar ativação, e-mail de suporte e configuração OAuth; adicionar hostname do preview aos domínios autorizados. |
| Facebook | Implementado, não declarado | Criar/configurar app Meta e Facebook Login, callback válido, permissões/revisão/modo público conforme o caso; salvar App ID/secret no Firebase; só então acrescentar `facebook.com` em `providers`. |
| GitHub | Implementado, não declarado | Configurar OAuth App e callback, salvar Client ID/secret no Firebase; só então acrescentar `github.com`. |
| X/Twitter | Implementado, não declarado | Configurar aplicativo X e callback, habilitar Twitter no Firebase com as credenciais exigidas; só então acrescentar `twitter.com`. |
| Telefone/SMS | Implementado, `phoneEnabled:false` | Habilitar Phone no Firebase, conferir faturamento/cotas, regiões permitidas, domínio e reCAPTCHA; usar números de teste primeiro; só então ativar flag. |
| Instagram | Exibido como indisponível; sem provedor Firebase nativo implementado | Não acrescentar `instagram.com` à lista. Exige desenho de integração próprio no servidor e avaliação do produto/permissões Meta; Facebook Login não autentica automaticamente uma conta Instagram. |

Segredos OAuth ficam no Firebase/provedor, nunca no JSON público, Git ou navegador. Para vincular métodos a uma conta existente, entrar pelo método original e usar a vinculação por UID. Não conceder papel de dono por nome ou e-mail informado no cliente.

## Correções e segurança

- Erros de domínio agora identificam o hostname atual, sem expor query strings ou mensagem bruta do SDK.
- Corrigido selo que podia anunciar e-mail confirmado em conta com telefone confirmado e e-mail ainda não verificado. A ação de confirmação continua disponível quando há e-mail não confirmado.
- Adicionada verificação somente leitura: `npm run check:auth -- https://kyroshix-preview.kyroshixcorp.workers.dev`. Retorna código 1 enquanto o domínio estiver ausente; não ativa provedores.
- Testes cobrem correspondência exata de hostname, falhas HTTP, URLs inválidas, relatório sem chave, estados de confirmação e erros da interface; regressões de cadastro continuam incluídas em `npm run test:auth`.
- A configuração pública Firebase e a chave publishable da comunidade são identificadores de cliente; não equivalem a credenciais administrativas.
- O SQL versionado exige issuer/audience do projeto, UID e `email_verified` para escrita; o papel de dono é consultado em esquema privado. Login por telefone sozinho não satisfaz a política atual de escrita. Não relaxar essa regra para ativar SMS.
- A execução local de testes não comprova a configuração do gateway ou as políticas implantadas no banco. O frontend do preview aponta ao mesmo backend de comunidade: testes de escrita nele podem afetar dados reais. Recomenda-se projeto Firebase e backend separados para isolamento completo de staging.

## Validação após a ação externa

Executar `npm run test:auth` e `npm run check:auth -- https://kyroshix-preview.kyroshixcorp.workers.dev`. Depois validar login real e entrega de e-mail manualmente. Habilitar cada provedor individualmente e testar vinculação, cancelamento de popup e conta já existente antes de publicá-lo.

Referências oficiais: [Google](https://firebase.google.com/docs/auth/web/google-signin), [Facebook](https://firebase.google.com/docs/auth/web/facebook-login), [GitHub](https://firebase.google.com/docs/auth/web/github-auth), [Twitter](https://firebase.google.com/docs/auth/web/twitter-login), [telefone](https://firebase.google.com/docs/auth/web/phone-auth).

## Observações adicionais de revisão

A API GitHub informou `protected:false` para `main`. Recomenda-se exigir revisão e verificações antes do merge; não foram alteradas regras administrativas do repositório. O arquivo `wrangler.jsonc` mantém o destino `kyroshix-preview` e não foi modificado.

A auditoria npm identificou [GHSA-7mvr-c777-76hp](https://github.com/advisories/GHSA-7mvr-c777-76hp) no Playwright 1.51.1. A dependência de desenvolvimento foi fixada em 1.55.1, versão corrigida segundo o advisory, com lockfile atualizado. Não é uma biblioteca enviada ao navegador do visitante.

## Resultados executados nesta revisão

- `npm run test:auth`: passou, incluindo regressões de cadastro e novos testes.
- `npm run test:security`: passou no PostgreSQL local simulado por PGlite, incluindo RLS, limites de upload e operações de dono.
- `node tests/login-code.cjs`: passou para assinatura, expiração, issuer/audience, origem e código de uso único; sem envio real de e-mail.
- `npm audit --json`: zero vulnerabilidades após a atualização.
- `npm run check:auth -- https://kyroshix-preview.kyroshixcorp.workers.dev`: retornou `authorized:false` e código 1, resultado esperado e evidência da configuração externa pendente.
- `npm run test:auth-ui`: passou no Chrome local em modo headless, desktop e celular, com autenticação simulada. O teste do aviso de Instagram usa clique explícito porque Playwright trata aria-disabled como bloqueado; nenhum OAuth foi ativado.
