# Som e transição — versão 4.1

## Publicar

Substitua o site do Worker **releases** pelo conteúdo do novo `KYROSHIX-Cloudflare-Pages.zip`, como nas atualizações anteriores. Esta alteração não exige SQL, mudança no Firebase, Supabase ou serviços pagos. A produção permanece em https://releases.kyroshixcorp.workers.dev/.

## Usar

1. Toque na capa ou no título da música no player inferior.
2. Abra **Som e transição**.
3. Ajuste a transição de 0 a 12 segundos. O padrão é 4 segundos; 0 desliga.
4. Ative **Equalizador e efeitos** para selecionar um perfil ou ajustar o som.

As seis bandas são 60 Hz, 170 Hz, 350 Hz, 1 kHz, 3,5 kHz e 10 kHz, com ajuste de −12 a +12 dB. Os perfis são Equilibrado, Nightcore, Eletrônica, Voz em destaque, Graves e Suave. Alterar uma banda seleciona Personalizado. O perfil Nightcore ajusta frequências; a velocidade continua no controle próprio do player.

Reforço de graves e Clareza adicionam até 6 dB nas respectivas regiões. Suavizar picos usa compressão dinâmica moderada. O processamento reserva margem de volume para os reforços, por isso pode soar mais baixo quando ativado. Não recupera informações ausentes do arquivo original nem normaliza o volume de todo o catálogo.

**Restaurar som original** desliga e zera os efeitos, preservando a duração escolhida para a transição. As preferências ficam neste navegador; o arquivo e o download permanecem originais. Esses ajustes se aplicam ao player de música, não ao player de vídeo.

## Comportamento da transição

- O final da música se mistura ao começo da próxima na fila. A mesma duração também se aplica ao trocar de música enquanto uma faixa está tocando.
- O player carrega a próxima faixa perto do fim da atual; não baixa a fila inteira.
- Pausar, buscar outro ponto ou mudar a velocidade encerra a sobreposição e mantém somente a faixa atual.
- Repetir uma faixa não aplica crossfade. Em faixas curtas, a duração se adapta ao tempo disponível.
- A transição depende do carregamento da próxima mídia. Rede lenta pode atrasá-la. É uma mistura de volume, sem detecção de batida/BPM.
- Web Audio é necessário para os efeitos e a mistura. URLs externas devem permitir reprodução com CORS; o catálogo atual já usa mídia com essa configuração.

## Verificação local

Passaram os testes `test:sound`, `test:browser` e `test:platform`: resposta real dos filtros com OfflineAudioContext, reprodução e transição com dois áudios, pausa/busca, velocidade, repetição, persistência, telas móveis, player de vídeo e fluxos existentes. As rotinas de conta e banco foram simuladas nos testes de navegador. A publicação na Cloudflare e a conferência em aparelhos reais dependem do proprietário.
