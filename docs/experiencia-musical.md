# Experiência musical — versão 4.2

## Atualização

Envie o novo `KYROSHIX-Cloudflare-Pages.zip` para o Worker **releases**, substituindo os arquivos públicos da versão anterior. Não há migração SQL nem configuração nova no Firebase/Supabase para esta versão. Contas, músicas, perfis e permissões continuam usando a instalação atual.

## Descobrir

- Destaque com a capa e as informações do catálogo.
- Artistas no catálogo: tocar em um item busca as faixas com aquele crédito. As imagens redondas são capas das músicas, não fotografias dos artistas. Créditos com várias pessoas permanecem agrupados como cadastrados.
- Surpreenda-me inicia uma faixa da seleção e ativa reprodução aleatória. O botão de reprodução aleatória do player desliga esse modo.
- Ouvidas recentemente registra uma faixa após começar a reprodução. O histórico mantém até 50 faixas distintas, da mais recente para a mais antiga, somente no navegador atual. Abrir uma capa ou uma página de detalhes não registra uma reprodução.
- Limpar histórico remove apenas esse histórico. Não exclui músicas, downloads, favoritas ou dados da conta.

## Computador e celular

A partir de 1280 px, o catálogo tem painel lateral Tocando agora: capa, título, controles e três itens da seleção. No modo aleatório, a lista é identificada como Na sua seleção, pois não promete uma ordem fixa. Ver fila abre a lista completa no player.

Em telas menores, o player inferior mantém a reprodução acessível. Até 700 px, a navegação inferior oferece Descobrir, Músicas, Favoritas e Perfil; o menu do cabeçalho mantém Vídeos, Histórico e Estúdio.

O player ampliado exibe uma área compacta de capa/título em telas até 1100 px. Títulos longos podem ser expandidos pelo botão Título completo. As abas Fila e Som e transição mostram um painel por vez. Teclas de seta alternam entre as abas quando elas estão em foco. Abrir, recolher ou trocar de aba não reinicia o áudio.

Equalizador, transição, volume, velocidade, favoritos e downloads permanecem disponíveis. Os ajustes de som são os mesmos da versão 4.1; os arquivos não são reconvertidos.

## Verificações

O teste `test:discovery` exercita reprodução, histórico/persistência/limpeza, pesquisa por artista, modo aleatório, painel lateral, teclado das abas e ausência de rolagem horizontal em 360, 390, 768, 1024 e 1440 px. Os testes de navegador usam contas e backend simulados; a publicação é feita pelo proprietário na Cloudflare.
