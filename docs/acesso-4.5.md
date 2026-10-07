# Acesso e primeira visita · 4.5

Publique o novo ZIP completo no Worker **releases**, pelo mesmo procedimento manual usado antes. A atualização de interface não exige SQL, migração de contas, troca do UID do dono ou mudança no Supabase. O ZIP contém somente arquivos públicos.

## O que muda

O cartão de acesso combina arte KYROSHIX com um formulário de duas colunas no desktop e uma faixa de arte no celular. Cadastro, login, recuperação, SMS, código de e-mail e conta usam o mesmo tema. Há ícones de Google, Facebook, GitHub, telefone, Instagram e X, foco de teclado, indicação de processamento e opção de ouvir sem entrar.

O site espera o Firebase restaurar a sessão antes de apresentar o cadastro. Visitante anônimo sem o marcador `krs-access-seen-v1` vê a tela automaticamente uma vez. Fechar ou continuar sem conta grava apenas `1` nesse marcador local. Conta restaurada abre o site normalmente; o botão do cabeçalho abre Minha conta. A confirmação adicional por código continua sendo aplicada quando a política existente está ativada.

O site não identifica pessoas por IP nem descobre e-mail/telefone antes do login. IPs mudam e podem ser compartilhados; não são uma prova de identidade. Navegação anônima, outro dispositivo ou limpeza dos dados pode exibir o cadastro novamente. Se o armazenamento local estiver bloqueado, a tela é apresentada uma vez por carregamento; a sessão pode ficar somente em memória. O marcador não concede nenhuma permissão.

## Disponibilidade real

| Opção | Situação no pacote | Para ativar |
| --- | --- | --- |
| Google | Configurado | Manter Google habilitado no Firebase e o domínio autorizado |
| E-mail/senha | Configurado | Manter E-mail/senha habilitado no Firebase |
| Facebook | Fluxo preparado; botão indica Não ativo | Criar app Meta, configurar App ID/secret e ativar Facebook no Firebase |
| GitHub | Fluxo preparado; botão indica Não ativo | Criar OAuth App, configurar Client ID/secret e ativar GitHub no Firebase |
| X / Twitter | Fluxo preparado; botão indica Não ativo | Configurar app X, credenciais e ativar Twitter no Firebase |
| Telefone / SMS | Desligado | Requer Firebase Blaze, provedor Phone, política regional, domínio autorizado e reCAPTCHA; SMS pode gerar custos |
| Instagram | Indisponível | Não há um provedor Firebase nativo nem um login geral de contas pessoais neste pacote; uma integração própria para contas profissionais é trabalho de servidor separado |

Métodos pendentes explicam a indisponibilidade ao clicar e não enviam credenciais, SMS ou pedidos OAuth. O botão não simula sucesso. Apple, Microsoft, Yahoo ou OIDC já configurados também podem ser listados pelo mesmo controlador.

## Ativar Facebook, GitHub ou X

1. No serviço do provedor, crie o app de login. Use o callback informado pelo Firebase, normalmente `https://kyroshix-releases.firebaseapp.com/__/auth/handler`.
2. Em **Firebase → Authentication → Método de login**, habilite o provedor e salve as credenciais **nesse painel**, nunca nos arquivos públicos.
3. Em **Authentication → Configurações → Domínios autorizados**, mantenha `releases.kyroshixcorp.workers.dev`.
4. Em `dist/auth-config.json`, adicione o ID que foi configurado à lista `providers`: `facebook.com`, `github.com` ou `twitter.com`. Preserve `google.com`.
5. Exporte/publice novamente o ZIP. O botão passa a iniciar o popup do Firebase. Teste em desktop e celular e confira a confirmação de e-mail quando aplicável.

GitHub solicita somente `user:email`; Facebook solicita `email`. Conectar outro método em Minha conta usa `linkWithPopup` para conservar o UID, os comentários, o perfil e a autorização do dono. Se o provedor já pertence a outra conta, o site pede que você entre nela; não combina contas automaticamente.

## Ativar SMS somente se decidir usar o plano necessário

Ative Phone no Firebase, configure as regiões permitidas e revise cobrança/limites. Depois altere `phoneEnabled` para `true` em `auth-config.json`. O site pede telefone completo com `+` e código do país, apresenta reCAPTCHA e aceita um código de seis números. Voltar ou fechar cancela o desafio local. Em telas pequenas o reCAPTCHA usa o modo compacto. O número é processado pelo Google para autenticação e prevenção de abuso.

Esta atualização não ativa SMS nem contrata serviços. Telefone sem e-mail continua com a identidade verificada pelo Firebase. Novos provedores só terão acesso às funções da comunidade se o token atender às políticas existentes no banco; um login sem e-mail verificado ou telefone confirmado não recebe permissão de escrita por causa da interface.

## Verificação

Foram preparados testes Node para primeira visita, sessão restaurada, armazenamento bloqueado, campos preservados durante carregamento, links de e-mail, validação, recuperação, métodos pendentes, prevenção de cliques duplicados, vinculação por UID, SMS e confirmação de e-mail validada pelo servidor. Os provedores são simulados nesses testes, sem envio de mensagens. A suíte de navegador do projeto pode ser executada em um ambiente autorizado com Chromium; a versão 4.5 precisa de conferência visual e login real depois da publicação.

Referências oficiais: [Facebook](https://firebase.google.com/docs/auth/web/facebook-login), [GitHub](https://firebase.google.com/docs/auth/web/github-auth), [Twitter](https://firebase.google.com/docs/auth/web/twitter-login), [telefone](https://firebase.google.com/docs/auth/web/phone-auth), [limites/SMS](https://firebase.google.com/docs/auth/limits), [Instagram API — documentação da Meta](https://www.postman.com/meta/workspace/instagram/documentation/23987686-9386f468-7714-490f-9bfc-9442db5c8f00).
