# Atualizar o KYROSHIX — versão 3

Esta versão mantém seu endereço **https://releases.kyroshixcorp.workers.dev/**, suas músicas, logos, contas Firebase e dados no Supabase. Os arquivos estão prontos para instalar; a Cloudflare e o banco de produção não foram alterados automaticamente.

## 1. Atualizar o banco pelo celular

Extraia `KYROSHIX-Ativar-Comunidade.zip`. No projeto **KYROSHIX RELEASES** do Supabase, abra **SQL Editor → New query**. Cole e execute **um arquivo completo por vez**, nesta ordem. Aguarde a mensagem de sucesso antes do seguinte.

| Arquivo | O que faz |
| --- | --- |
| `03-corrigir-envios-e-dono.sql` | Corrige avatar/banner e autoriza seu novo UID `8Q7S8FgBZjTrg4Mkf46ntcYvl0Q2`. Pode repetir se já executou. |
| `04-plataforma.sql` | Acrescenta vídeos, canais, reações, inscrições e armazenamento de vídeo. |
| `05-canais-e-reacoes.sql` | Instala as operações de canal, likes, emojis e inscrições. |
| `06-videos.sql` | Instala publicação/edição de vídeos e protege comentários de rascunhos. |
| `07-codigos-de-acesso.sql` | Prepara a confirmação por código. Ainda não exige o código. |

Essas migrações preservam os registros existentes. **Não execute novamente `01-instalar.sql`**: a instalação inicial poderia recolocar músicas originais que você apagou. O pacote desta atualização não inclui essa instalação.

**Não execute ainda o arquivo opcional `08-exigir-codigo.sql`.** Ele só deve ser executado depois de configurar e testar o envio de e-mail, conforme `codigos-e-provedores.md`.

## 2. Atualizar a Cloudflare

Envie **`KYROSHIX-Cloudflare-Pages.zip`** como uma nova versão do Worker **releases**, pelo mesmo processo de upload que você já usou. Apesar do nome do ZIP, ele contém os arquivos estáticos do seu Worker atual, com `index.html` na raiz.

Não envie o pacote de SQLs nem as funções administrativas como arquivos do site. Depois da publicação, recarregue a página. Se aparecer a versão anterior, feche a aba e abra novamente o endereço.

## 3. Usar as novidades

- **Descobrir e Músicas:** novo visual escuro, detalhes vermelhos, busca, downloads, favoritos e player de música mantidos.
- **Vídeos:** catálogo, página própria e compartilhamento por URL. Você começa com um catálogo de vídeos vazio, sem conteúdo fictício.
- **Player:** reproduzir/pausar, avanço e retorno, velocidade, legendas WebVTT, capítulos, modo cinema, tela cheia e picture-in-picture quando o navegador oferece suporte. Áudio e vídeo não tocam juntos.
- **Continuar assistindo:** guarda a posição no navegador. Favoritos e histórico não são sincronizados entre dispositivos.
- **Meu perfil → Personalizar canal e links:** escolha um nome de usuário exclusivo e até cinco links HTTPS. O canal usa seu avatar, banner, nome e bio. Seu endereço será `#canal/seu-nome`.
- **Reações:** gostei, coração, fogo, surpresa e aplausos em músicas e vídeos. Você pode retirar uma reação tocando nela novamente.
- **Inscrições:** acompanhe perfis/canais; suas inscrições aparecem na seção lateral. A lista individual é privada, e a contagem é pública.
- **Comentários:** comentários, respostas, edição própria e moderação pelo dono continuam disponíveis nas músicas e nos vídeos publicados.
- **Estúdio:** só a conta dona publica, edita e exclui músicas/vídeos. Visitantes podem criar conta, personalizar perfil e participar da comunidade.

## 4. Publicar um vídeo

Entre como dono → **Estúdio → Publicar vídeo**. Informe título, artista/criador e descrição. Escolha um MP4/WebM de até **50 MB** ou uma URL HTTPS de MP4, WebM, HLS, DASH ou YouTube. Uploads aceitam até duas horas; formatos precisam ser compatíveis com o navegador.

Você pode trocar o arquivo, miniatura, título, descrição, créditos, legendas e capítulos depois. Para capítulos, use uma linha por trecho: `0:00 Introdução`, `0:30 Refrão`. Abra **Legendas, capítulos e proteção** para esses campos.

Links externos precisam permitir reprodução no site, acesso por CORS e, para avanço eficiente, requisições de intervalo (Range). A plataforma não converte formatos nem cria automaticamente versões 1080p/720p. As opções de qualidade aparecem quando o HLS/DASH já oferece essas versões. Vídeos do YouTube usam o player incorporado do próprio YouTube, após um toque para carregar.

**Rascunhos:** ocultam a página no catálogo público. Os arquivos enviados ficam em um bucket público e ainda podem ser acessados por quem possui a URL. Rascunho não equivale a vídeo privado ou protegido por DRM.

Esta edição permite editar a publicação e seus capítulos; não inclui corte/renderização do arquivo de vídeo ou um editor de timeline.

## 5. Contas, códigos e DRM

| Recurso | Estado desta entrega |
| --- | --- |
| Google, cadastro com e-mail/senha, recuperação e confirmação de e-mail | Mantidos no Firebase atual. |
| Apple, Microsoft, GitHub, Facebook, X e Yahoo | Integração implementada; cada provedor precisa ser habilitado/configurado antes de aparecer. |
| Associar outro provedor à mesma conta | Disponível em Minha conta para os provedores habilitados. Preserva o UID. |
| Código de e-mail após login | Implementado no servidor e na interface; requer função publicada e remetente configurado. Desligado inicialmente. |
| Telefone/SMS | Integração preparada, desligada. O Firebase exige plano Blaze para SMS. |
| Link de acesso por e-mail | Integração preparada, desligada. As cotas do Firebase se aplicam. |
| HLS/DASH com DRM | Player preparado; depende de mídia criptografada e de um serviço de licenças. Não está ativo. |

Não existe uma configuração única que habilite todas as plataformas de login. Provedores adicionais, como Discord, exigem uma integração própria ou um intermediário de identidade; não estão implementados como login direto nesta versão. Passkeys e chaves físicas também não fazem parte desta entrega.

Para DRM, leia `video-drm.md`. Marcar Widevine/FairPlay/PlayReady no Estúdio não criptografa o arquivo. Nenhuma cobrança, assinatura de serviço, transcodificador ou serviço de licenças foi ativado.

## 6. Conferir depois de instalar

1. Entre com a conta dona; confirme que o Estúdio abre.
2. Salve avatar e banner e recarregue o perfil.
3. Publique um vídeo pequeno, teste reprodução e capítulos, edite o título e confira em outra aba.
4. Com outra conta, teste comentário, reação e inscrição. Essa conta não deve conseguir publicar pelo Estúdio.

Os testes locais passaram com PostgreSQL/RLS e Chromium, incluindo reprodução real de um WebM de teste. Firebase, respostas de API e envio de e-mail foram simulados nos testes de interface; não foram criadas contas nem enviadas mensagens reais. O teste de produção depende da instalação acima.

O site continua sem servidor próprio de hospedagem. Arquivos e reproduções consomem as cotas do Supabase/Cloudflare: não há promessa de armazenamento ou tráfego ilimitado. Nenhum plano pago foi habilitado.

Fontes oficiais: https://firebase.google.com/docs/auth/limits · https://supabase.com/docs/guides/functions/quickstart-dashboard · https://shaka-project.github.io/shaka-player/docs/api/tutorial-drm-config.html
