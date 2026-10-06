# Ativar as contas KYROSHIX

Estado atual: o proprietário forneceu a configuração pública do projeto `kyroshix-releases`. Ela foi aplicada em `dist/auth-config.json`, com `enabled: true`. A publicação de produção informada pelo proprietário é `https://releases.kyroshixcorp.workers.dev/`. A ativação de Google/e-mail, os domínios autorizados e os testes reais ainda precisam ser confirmados no Firebase. O ZIP atualizado precisa substituir a versão anterior na Cloudflare.

## Configuração no Firebase

1. Entre em https://console.firebase.google.com/ com a conta Google do proprietário.
2. Crie um projeto chamado **KYROSHIX Releases** ou selecione um projeto seu. Google Analytics não é necessário para este site.
3. Registre um aplicativo **Web** (`</>`). Copie o objeto público `firebaseConfig` exibido pelo console. Não forneça senha, conta de serviço, chave privada ou segredo OAuth.
4. Em **Authentication > Sign-in method**, ative **E-mail/senha** e **Google**. No Google, configure o nome público e o e-mail de suporte solicitado pelo console.
5. Em **Authentication > Settings > Authorized domains**, adicione `releases.kyroshixcorp.workers.dev`.
6. Em **Authentication > Templates**, revise o nome e o idioma dos e-mails de confirmação e recuperação. Os links usam as páginas de ação hospedadas pelo Firebase e retornam ao site.
7. Configure a política de senhas com no mínimo 8 caracteres. O formulário já exige isso em novos cadastros. Habilite a proteção contra enumeração de e-mails quando disponível.

## Conectar ao site

Preencha `firebase.apiKey`, `firebase.authDomain`, `firebase.projectId` e `firebase.appId` em `dist/auth-config.json` usando os valores reais do aplicativo Web. Esses identificadores são configuração pública do cliente, não credenciais administrativas. Depois de habilitar os dois provedores e o domínio, altere `enabled` para `true`.

Publique o ZIP atualizado no mesmo Worker `releases` da Cloudflare. A versão antiga hospedada no ChatGPT é independente e não será atualizada nesta ativação. Não altere as permissões dessa cópia antiga.

## Verificação antes de anunciar como ativo

Com uma conta de teste autorizada, confirme: cadastro por e-mail, confirmação recebida, saída, entrada existente, senha errada, recuperação de senha recebida, Google, reabertura da sessão e saída. Teste Google no Chrome Android também. O fluxo usa popup para evitar falhas de redirecionamento com armazenamento de terceiros bloqueado; se o navegador bloquear a janela, a interface explica como permitir e oferece entrada por e-mail.

Os testes locais do controlador usam um provedor simulado e verificam a interface e os estados. Eles **não** comprovam acesso ao Google, entrega de e-mails ou cadastro real no Firebase.

As contas não restringem as músicas nem sincronizam favoritos. Todos os MP3 continuarão públicos após a mudança de audiência. Os favoritos permanecem locais ao navegador. Não há endpoints de escrita ou dados privados do aplicativo. Se forem adicionados, exigir validação de identidade/autorização no servidor ou regras Firebase; nunca confiar apenas no estado do navegador.

## Documentação oficial

- https://firebase.google.com/docs/web/setup
- https://firebase.google.com/docs/auth/web/start
- https://firebase.google.com/docs/auth/web/google-signin
- https://firebase.google.com/docs/auth/web/manage-users
- https://firebase.google.com/docs/auth/web/redirect-best-practices
