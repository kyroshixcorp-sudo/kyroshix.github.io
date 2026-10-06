# Correção da foto, banner e conta dona — 03/10/2026

## Aplicar no site existente

1. No Supabase, abra **SQL Editor → New query** e execute todo o arquivo `backend/03-corrigir-envios-e-dono.sql`. Ele é curto e pode ser repetido. Não execute novamente `01-instalar.sql`.
2. Publique o ZIP atualizado no mesmo Worker `releases`, na Cloudflare.
3. Recarregue o site, saia da conta e entre com a conta cujo UID é `8Q7S8FgBZjTrg4Mkf46ntcYvl0Q2`.
4. Em **Meu perfil → Editar perfil**, selecione a foto e o banner, toque em salvar e confira o resultado. Depois troque apenas a foto para confirmar que o banner permanece.
5. Abra **Estúdio** com essa conta. A conta anterior, `wcJXpZgLs8YMLZ3F2JAGk1TWVl12`, perde a permissão de dona quando o SQL é executado, mas seus dados e acesso normal permanecem.

A chave pública permite conectar o site, mas não permite executar essa alteração administrativa. Por isso a migração precisa ser aplicada no SQL Editor da sua conta Supabase. A publicação do ZIP sozinha não troca o dono nem corrige a regra do banco.

## O que mudou

O Supabase Storage verifica a permissão antes de enviar o arquivo. Nessa etapa, o tamanho vem em `metadata.contentLength`; no registro definitivo pode vir em `metadata.size`. A regra anterior exigia apenas `size`, bloqueando a checagem inicial de uma imagem válida. A função agora aceita os dois campos, exigindo um tamanho conhecido entre 1 byte e 2 MiB, formato WebP e o caminho da própria conta com e-mail verificado. A conversão de PNG/JPG/WebP continua automática no navegador. O limite de origem continua 12 MB.

As mensagens do site distinguem bloqueio de permissão, sessão expirada, limite de tamanho, formato recusado e falha de rede. O formulário e os arquivos escolhidos permanecem disponíveis quando o envio falha. O progresso identifica se está enviando a foto ou o banner.

A migração substitui somente o UID antigo pelo novo na tabela privada de donos. Não apaga músicas, perfis, comentários ou arquivos e não reintroduz músicas excluídas.

## Validação e limites

Os testes de SQL exercitam criação e substituição de imagens com os metadados da checagem inicial, limite de tamanho, pasta de outra pessoa e troca idempotente de dono. O teste de navegador converte imagens reais e verifica envio de foto e banner, erro de permissão, nova tentativa sem perder dados e substituição da foto. As respostas de autenticação e Storage nesses testes de navegador são simuladas. O envio autenticado na nuvem precisa ser confirmado após aplicar o SQL e publicar o ZIP.

Referências oficiais consultadas:
- https://github.com/supabase/storage/blob/master/src/storage/uploader.ts
- https://supabase.com/docs/guides/storage/security/access-control
