# URLs e temas · 4.4

Publique o ZIP completo em **releases**, incluindo `_redirects`. Esta atualização
não exige SQL, novas contas ou alteração dos provedores de login. A integração
de contas e o catálogo carregam suas configurações pela raiz do site, inclusive
quando uma página interna é aberta diretamente.

| Página | Caminho |
| --- | --- |
| Descobrir | `/inicio` |
| Catálogo | `/musicas` |
| Música | `/track/remember` ou `/track/titulo--id` |
| Perfil | `/perfil` ou `/perfil/uid` |
| Canal | `/canal/nome` |
| Vídeos | `/videos` e `/watch/titulo--id` |
| Histórico de músicas | `/recentes` |
| Favoritos | `/favoritas` |
| Estúdio | `/studio` |
| Inscrições e histórico de vídeos | `/inscricoes` e `/biblioteca` |

Os links antigos como `/#faixa/remember` são convertidos para os novos caminhos.
Links de conteúdos novos incluem o identificador completo: editar o título não
invalida um link compartilhado anteriormente. Abrir esse link atualiza o nome
exibido no endereço. Os botões voltar/avançar usam o histórico do navegador;
downloads, links externos e abrir em uma nova aba mantêm o comportamento nativo.

O endereço atual é `https://releases.kyroshixcorp.workers.dev`. Os caminhos também
funcionam em outro domínio conectado ao mesmo site. Esta atualização não registra
nem conecta `kyroshix.com`. Um domínio novo precisa ser autorizado no Firebase
para login por provedores e configurado nos serviços que validam a origem.

O botão de sol/lua fica no cabeçalho. Seu movimento e a troca de cores respeitam
a preferência por movimento reduzido. A escolha fica em `kyroshix-theme` no
armazenamento local e é sincronizada entre abas. Sem escolha salva, o tema segue
o sistema. O tema é aplicado antes dos estilos para evitar uma tela clara ao
abrir com o tema escuro selecionado. Equalizador, crossfade e reprodução são
mantidos ao alternar.

As regras de Cloudflare encaminham somente as páginas conhecidas para
`index.html`. Não use uma regra global `/* /index.html 200`: ela pode substituir
respostas de arquivos por HTML. O ZIP contém regras para caminhos com e sem
barra final. Em outro servidor é necessário configurar rewrites equivalentes;
o GitHub guarda o código e não aplica as regras `_redirects` ao hospedar Pages.

Verificações executadas: `npm run test:navigation`, `npm run test:worker`,
`npm run test:media`, sintaxe dos módulos, referências estáticas e integridade
do ZIP. Os testes cobrem navegação, links antigos, preservação de parâmetros de
autenticação, preferências de tema e respostas do Worker. A validação visual em
navegador não foi executada nesta atualização porque o controle de navegador
exigido pelo ambiente não estava disponível.

Referência de publicação:
https://developers.cloudflare.com/workers/static-assets/redirects/
