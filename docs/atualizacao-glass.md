# Atualizar KYROSHIX RELEASES

Este pacote atualiza seu site atual em https://releases.kyroshixcorp.workers.dev/. Não precisa criar outro projeto, trocar o dono ou refazer o login.

## 1. Ativar os limites maiores

1. Abra seu projeto **KYROSHIX RELEASES** no Supabase.
2. Entre no **SQL Editor** e abra uma consulta nova.
3. Abra `09-media-upgrade.sql` deste pacote, copie seu conteúdo inteiro, cole na consulta e pressione **Run**.
4. Em **Storage → Settings**, confira que o limite global de arquivo está em **50 MB**. O SQL já define o limite dos buckets; o limite global também precisa permitir esse tamanho.

Execute apenas o arquivo 09 para esta atualização. Não é necessário executar novamente os arquivos 01 a 08. O SQL 09 pode ser repetido e preserva músicas, vídeos, contas, comentários, dono e política de códigos.

## 2. Publicar o novo visual

No painel Cloudflare, abra **Workers & Pages → releases** e use o mesmo processo de upload que funcionou antes. Envie o conteúdo de `KYROSHIX-Cloudflare-Pages.zip` como nova versão. A raiz do upload deve conter `index.html`, `app.js`, `glass.css` e a pasta `assets`.

O ZIP de mídia/SQL não deve ser publicado como o site. As configurações públicas de Firebase e Supabase já continuam no ZIP do site; nenhum segredo de servidor foi adicionado.

## 3. Conferir no seu celular

- Recarregue o site. Toque na capa ou no nome da música no player inferior: abre o player expandido. Fechá-lo mantém a música no mesmo ponto.
- Entre na conta e abra **Meu perfil → Editar**. Salve foto e banner; a imagem deve aparecer inteira no perfil e no botão de conta. Se uma foto antiga não atualizar, recarregue a página.
- No **Estúdio**, envie uma música, edite seu título e teste seu download. O arquivo mantém o formato original.
- Nos vídeos HLS/DASH com várias resoluções, use **Automática**, **Economizar dados** ou uma resolução disponível. Um MP4 único mostra sua resolução original.

## Limites desta versão

| Conteúdo | Limite |
| --- | --- |
| Áudio MP3, FLAC, WAV, M4A ou OGG | 50 MB por arquivo, até 2 horas |
| Imagem selecionada JPG, PNG ou WebP | 30 MB, até 50 megapixels |
| Imagem otimizada enviada ao Storage | Até 8 MB em WebP |
| Avatar | Até 1024 × 1024, sem ampliar imagens pequenas |
| Banner | Até 2560 × 960, mantendo proporção |
| Capa de música | Até 2400 × 2400 |
| Miniatura de vídeo | Até 2560 × 1440 |
| Vídeo enviado MP4/WebM | 50 MB, até 2 horas |
| Vídeo maior | Usar URL externa MP4/WebM/HLS/DASH |

Os valores de arquivo usam MiB internamente. O plano gratuito do Supabase permite no máximo 50 MB por arquivo; aumentar apenas o código do site não muda o teto da hospedagem. A cota total de armazenamento e tráfego do projeto também continua valendo.

Envios acima de 6 MB usam trechos e tentam continuar do último trecho confirmado após falhas de conexão. Mantenha a página aberta até terminar. Fechar ou recarregar exige selecionar o arquivo novamente.

FLAC/WAV permitem usar fontes sem perdas. O site preserva o arquivo enviado; não transforma um MP3 já comprimido em uma gravação de maior qualidade. O som final depende da fonte, do navegador e do aparelho. Formatos incompatíveis mostram um erro antes da publicação.

## Widevine: preparado, ainda não ativado

O player usa Shaka/EME e agora verifica suporte do navegador, a configuração e o destino das licenças. Para ativar, ainda são necessários **conteúdo HLS/DASH criptografado e um serviço de licenças Widevine autorizado**. Selecionar Widevine no Estúdio não criptografa um MP4 ou uma música.

A hospedagem estática pode continuar gratuita. Não foi contratado nenhum serviço de DRM. Consulte `widevine.md` para os requisitos de integração. Não altere a configuração DRM para `true` antes de ter esses recursos funcionando.

## O que foi verificado

Testes locais de interface desktop/celular, áudio e vídeo reais, continuidade do player, volume/velocidade/busca, fotos, edição e publicação com backend simulado; testes PostgreSQL das permissões e dos novos limites; recuperação de upload por TUS e isolamento do token nas requisições de licença.

A publicação no Worker, o gateway Storage real com os novos limites e uma licença Widevine real dependem da instalação na sua conta. Não foram apresentados como testes de produção concluídos.

Fontes técnicas: https://supabase.com/docs/guides/storage/uploads/file-limits • https://supabase.com/docs/guides/storage/uploads/resumable-uploads • https://developers.google.com/widevine/drm/overview
