# Interface Atelier · 4.3

O tema usa a referência fornecida pelo proprietário: painel claro, biblioteca
escura, capas em destaque, cantos arredondados e um player flutuante em carvão.
O amarelo suave identifica os controles de reprodução. O símbolo KYROSHIX
continua vermelho no cabeçalho; os arquivos de marca foram preservados.

`dist/atelier.css` é a camada de tema carregada após as folhas existentes.
Também cobre login, cadastro, recuperação de senha, verificação, perfis,
comentários, páginas de músicas e vídeos e os formulários do estúdio.

O player expandido mantém a capa, os controles, a fila e as abas de som e
transição. No celular, o player compacto permanece acima da navegação inferior.
Todos os controles de música usam os mesmos quatro símbolos SVG de reproduzir,
pausar, faixa anterior e próxima faixa. A visualização real de áudio recebe
suas cores do tema, sem alterar o motor de reprodução.
O vídeo também usa símbolos SVG para play, pause, volume, retrocesso e avanço
de dez segundos, janela flutuante, modo cinema e tela cheia.

## Publicação

Esta alteração não exige SQL ou mudanças no Firebase/Supabase. Publique o ZIP
completo gerado por:

```sh
python3 scripts/export-pages.py /caminho/KYROSHIX-Cloudflare-Pages.zip \
  --origin https://releases.kyroshixcorp.workers.dev
```

O ZIP precisa conter `atelier.css` e o `index.html` atualizado. O exportador de
módulo Worker também inclui a nova folha de estilo nas rotas de atualização.
O ZIP público contém somente os arquivos de `dist/`, os cabeçalhos e `robots.txt`.

## Verificação desta entrega

Foram verificados a sintaxe dos módulos JavaScript, os caminhos dos arquivos,
os símbolos SVG, os delimitadores do CSS, o contraste dos textos principais
e a integridade do ZIP. Os arquivos de áudio, as imagens e o motor de som
continuam iguais à versão anterior.

A prévia local gerenciada não iniciou por uma limitação do ambiente. A aparência
e as interações desta versão no navegador ainda precisam de conferência após
a publicação, especialmente o login e os players nas telas de celular e desktop.
