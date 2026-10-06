# KYROSHIX RELEASES — versão 4.2 · Descobrir + Player

Plataforma de música, vídeo e comunidade em português. Produção do proprietário: https://releases.kyroshixcorp.workers.dev/. Hospedagem estática no Worker Cloudflare do usuário; Firebase Authentication; Supabase Database/Storage com integração Firebase. Não requer build para servir `dist/`.

Código completo: https://github.com/kyroshixcorp-sudo/kyroshix.github.io. A produção usa o Worker `releases` da Cloudflare.

## Atualização da experiência de música

A página Descobrir reúne destaque, artistas do catálogo (representados pelas capas das faixas), histórico local e lançamentos. O painel Tocando agora permanece ao lado em telas a partir de 1280 px, com controles, fila e acesso ao som. Surpreenda-me inicia a seleção em modo aleatório.

No celular, a navegação inferior fica separada do player. O player ampliado tem resumo compacto, título completo expansível quando longo e abas Fila / Som e transição. Ícones SVG consistentes e textos maiores também se aplicam às telas de conta, vídeos, perfil e Estúdio.

**Esta atualização não precisa de SQL novo.** Publique o ZIP completo na Cloudflare ou prepare os seis arquivos de texto alterados com [scripts/export-worker.py](scripts/export-worker.py), conforme [docs/publicar-worker.md](docs/publicar-worker.md). Histórico de música é privado deste navegador, limitado às 50 últimas faixas distintas, com opção Limpar histórico. Guia: [docs/experiencia-musical.md](docs/experiencia-musical.md).

## Atualização de som e transição

O player agora tem **Som e transição**, com crossfade ajustável de 0 a 12 segundos (padrão: 4), equalizador de seis bandas, seis perfis de som, reforço de graves, clareza e suavização de picos. Os efeitos começam desligados e as preferências ficam salvas neste navegador. Abrir o painel não interrompe a música; pausar ou buscar outro ponto encerra uma transição em andamento.

**Esta atualização exige apenas substituir o ZIP público na Cloudflare. Não há SQL novo.** As instruções de banco da versão Glass abaixo são somente para quem ainda não instalou aquele upgrade. Guia: [docs/som-e-transicao.md](docs/som-e-transicao.md).

## Atualização Glass de outubro de 2026

Interface translúcida escura com acentos violeta/rosa, logos originais, menu lateral no desktop, busca permanente e telas de conta, perfil, vídeo e Estúdio com o mesmo tema. A capa ou o título no dock abrem um player de música próprio com fila, controles, velocidade e espectro real por Web Audio. Ele reutiliza o áudio atual sem reiniciar a faixa. Avatares usam uma única moldura quadrada/circular e preservam a imagem inteira; falhas de carregamento mostram a inicial.

Para atualizar a produção existente: execute **somente `backend/09-media-upgrade.sql`**, confirme o limite global de 50 MB no Storage e envie o novo ZIP ao Worker **releases**. O banco mantém o dono e os conteúdos. As configurações de Firebase, provedores e códigos de login não foram alteradas. Guia: [docs/atualizacao-glass.md](docs/atualizacao-glass.md).

## Instalação da plataforma

Veja [docs/upgrade-plataforma.md](docs/upgrade-plataforma.md). As etapas abaixo se aplicam à instalação inicial; a atualização visual 4.2 exige somente a publicação dos arquivos públicos.

1. No Supabase, execute `backend/03-corrigir-envios-e-dono.sql`, depois `04`, `05`, `06` e `07`, em ordem.
2. Exporte somente `dist/` com `scripts/export-pages.py` e envie o ZIP ao Worker **releases**.
3. Não execute novamente `01-instalar.sql`: os seeds podem repor faixas originais excluídas.
4. `08-exigir-codigo.sql` é opcional e só deve ser executado depois da configuração e teste do remetente/função de e-mail.

UID de dono solicitado: `8Q7S8FgBZjTrg4Mkf46ntcYvl0Q2`. A migração 03 remove apenas o UID antigo especificado pelo usuário e preserva outras autorizações. Permissões são verificadas no banco, não por uma opção editável no navegador.

## Recursos

- Catálogo, busca, filtros, downloads no formato original, favoritos locais, fila, shuffle, repetição e controles de mídia.
- Transição entre faixas, EQ de 60 Hz a 10 kHz, perfis e efeitos opcionais; reprodução com dois elementos de áudio e um grafo Web Audio compartilhado.
- Perfis com avatar/banner convertidos para WebP, bio, cor, pronomes e status; canais com handle exclusivo e links HTTPS.
- Comentários, respostas, edição própria e moderação pelo dono; reações por emoji e inscrições persistidas no banco.
- Catálogo/páginas de vídeo, compartilhamento por hash URL, player nativo MP4/WebM e Shaka para HLS/DASH; incorporação YouTube com consentimento ao tocar.
- Velocidade, capítulos, WebVTT, cinema, fullscreen/PiP quando suportados, qualidade adaptativa quando oferecida pelo manifesto e histórico local.
- Estúdio exclusivo do dono: CRUD de música e vídeo, miniaturas, textos, créditos, arquivos e rascunhos de vídeo.
- Login Google, e-mail/senha, cadastro, recuperação e verificação; provedores adicionais/SMS/link de e-mail configuráveis. Só métodos habilitados aparecem.
- Código de e-mail pós-login implementado como Edge Function, desligado até configurar remetente e endpoint. O banco impõe o código quando a política opcional é ativada.
- Interface responsiva translúcida, transições discretas e respeito a `prefers-reduced-motion`.

Os quatro MP3 fornecidos pelo usuário permanecem nos assets: Remember, Legends Never Die, Darkness e Blindfold. Logos originais foram preservadas; o símbolo recebe branco por máscara CSS, sem redesenho. A wordmark enquadra a imagem original com SVG; o cabeçalho usa um enquadramento curto da mesma imagem. Nenhum vídeo fictício é publicado.

## Estrutura

| Caminho | Responsabilidade |
| --- | --- |
| `dist/app.js`, `style.css`, `modern.css`, `glass.css`, `music-player.js` | Catálogo, perfis, música e estrutura visual |
| `dist/listening-room.js`, `experience.css` | Descoberta, histórico local, painel lateral e interface responsiva |
| `dist/audio-engine.js`, `sound-panel.js` | Crossfade, equalizador, efeitos, controles e preferências locais |
| `dist/platform.js`, `video-player.js`, `drm.js` | Canais, reações, inscrições, Studio de vídeo e player |
| `dist/auth-controller.js`, `firebase-client.js` | Interface de contas e Firebase |
| `dist/data-client.js`, `resumable-upload.js` | API Supabase e uploads |
| `dist/*-config.json` | Configurações públicas; nunca segredos |
| `backend/` | Migrações PostgreSQL e funções de servidor |
| `docs/` | Instalação, contas, códigos e limites do DRM |
| `tests/` | Permissões, função de código e fluxos de navegador |

## Limites deliberados

Uploads: MP3/FLAC/WAV/M4A/OGG até 50 MiB, imagens de entrada até 30 MiB/50 megapixels, WebP final até 8 MiB, vídeos MP4/WebM até 50 MiB e duração até duas horas. A compatibilidade de codecs depende do navegador. Áudio e vídeo são enviados sem reconversão. Acima de 6 MiB, TUS envia em trechos de 6 MiB e consulta o offset do servidor após falhas transitórias; requer manter a página aberta. Não há retomada após fechar/recarregar. Vídeos maiores usam URL externa. Buckets são públicos; rascunhos escondem o cadastro, não a URL do arquivo. Sem transcodificação, editor de timeline, transmissões ao vivo, cobrança, anúncios ou recomendações algorítmicas.

DRM é uma integração de player, não um serviço de licenças/criptografia. Não está ativado nem validado com mídia comercial. SMS está desligado, pois exige Firebase Blaze. Outros provedores dependem de configuração e requisitos próprios. Código de e-mail requer função, Resend e domínio remetente verificado. Consulte [docs/codigos-e-provedores.md](docs/codigos-e-provedores.md) e [docs/video-drm.md](docs/video-drm.md).

## Segurança e dados

Firebase cuida das senhas/OAuth/tokens. A integração Supabase valida a assinatura Firebase; `krs_uid()` também confere issuer, audience, identidade verificada e, quando ativado, código válido para aquela sessão. JWT Firebase sem claim de papel usa `anon`; isso não concede escrita sem identidade validada.

Tabelas de donos/códigos são privadas. Reações e inscrições só são acessadas por RPCs específicas. Uploads de perfil são restritos ao UID/path/tipo/tamanho. A pré-validação do Storage usa `contentLength`, e o metadado persistido usa `size`; ambos são tratados. Comentários têm limites de frequência e regras de propriedade. O frontend escapa o conteúdo inserido por usuários.

Nunca publique chaves service_role, chaves privadas, segredos OAuth, Resend ou chaves de mídia dentro de `dist/`. A chave publishable Supabase e a configuração Firebase são públicas por finalidade.

## Desenvolvimento e testes

```sh
npm ci
npx playwright install chromium
python3 -m http.server 8765 --bind 127.0.0.1 --directory dist
```

Em outro terminal:

```sh
npm run test:security
npm run test:codes
npm run test:browser
npm run test:platform
npm run test:media
npm run test:sound
npm run test:discovery
```

`KRS_CHROMIUM_MODULE` permite apontar para uma instalação existente de `@sparticuz/chromium` em ambientes restritos. O WebM curto em `tests/fixtures` é apenas um padrão de teste, nunca entra na produção. Capturas intermediárias ficam em `.test-artifacts`.

PGlite executa PostgreSQL/RLS. Testes da função verificam JWT RSA assinado, projeto, expiração, HMAC, origem, destinatário e código; APIs de e-mail/banco são simuladas. Chromium verifica reprodução real, capítulos, velocidade, telas móveis, campos de login, confirmação por código, uploads/edição, canais, inscrições e permissões de interface com provedores simulados. A verificação de login/upload de produção deve ser concluída após instalar os arquivos.

`test:sound` verifica a sobreposição real de dois áudios, fim da transição, cancelamento por pausa/busca, repetição, velocidade, preferências e painel móvel. Renderização com OfflineAudioContext confirma a resposta dos filtros e o bypass; as curvas de crossfade mantêm a soma dos ganhos em no máximo 1. Os áudios sintéticos usados nessa verificação não entram no ZIP público.

## Exportar

```sh
python3 scripts/export-pages.py ../exports/KYROSHIX-Cloudflare-Pages.zip --origin https://releases.kyroshixcorp.workers.dev
python3 scripts/export-upgrade.py ../exports/KYROSHIX-Ativar-Comunidade.zip
```

O primeiro ZIP contém somente o site público. O segundo contém migrações 03–07, o SQL 08 em pasta opcional, guias e a função de códigos. Não envia SQLs ou código de servidor à hospedagem estática.
