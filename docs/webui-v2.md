# Spatial WebUI — estado e configuração

## Segurança e estado atual

O `wrangler.jsonc` publica **apenas o preview** `kyroshix-preview`. Ele executa o Worker e serve `dist/`, mas `KX_PREVIEW_READ_ONLY=true` bloqueia códigos, pagamentos e gravações, mesmo com segredos ou bindings presentes. Portanto o botão do painel do dono não envia código no preview. `/api/health` informa `readOnly` e o estado dos recursos; a interface mostra o motivo sem afirmar que o e-mail foi enviado.

**O acesso de dono e a cobrança ainda não estão prontos para produção.** O código administrativo legado usa KV para OTP sem limite de tentativas atômico, e o Stripe legado identifica assinaturas por e-mail fornecido pelo cliente, sem vinculação segura a um UID autenticado. Não configure esses caminhos para produção apenas adicionando segredos, nem desligue a proteção do preview. Antes disso, implemente e teste autenticação server-side, verificação de identidade e autorização do dono, limitação de tentativas resistente à concorrência, vínculo de pagamentos ao UID verificado e tratamento do ciclo de vida do Stripe. Uma conta ou token no navegador não prova identidade. Os dados locais e os testes simulados não demonstram funcionamento de pagamentos, e-mail ou edição compartilhada.

Não coloque segredos no repositório nem os envie pelo chat. Login Google depende de configuração no Firebase e da autorização do hostname exato — veja [firebase-preview-domain.md](firebase-preview-domain.md); a configuração pública no repositório não altera a lista de domínios autorizados.

## Vídeos

`dist/app-config.json` contém uma cópia publicada de 16 vídeos da playlist oficial `PLHMuU4IdndW8`; esta lista é um fallback estático e não garante atualização automática nem remoção de vídeos privados. O embed só é inserido após o clique em **Assistir**.

`GET /api/videos/sync` tenta o feed público do canal. Se o feed falhar, o Worker pode consultar os primeiros 50 vídeos da playlist pela **YouTube Data API v3**, desde que `YOUTUBE_API_KEY` esteja configurada como segredo no Worker correto, com a API habilitada e cota disponível. Restrinja a chave à API e às regras aplicáveis à sua infraestrutura. Não é necessário fornecer a chave no chat. Sem chave ou se a consulta falhar, a página mostra o aviso e conserva o catálogo publicado ou a última lista disponível; não apresenta isso como sincronização concluída.

Sem `KX_DATA` o resultado fica em cache temporário no isolate, sem persistência entre dispositivos. O preview nunca grava no KV, mesmo se um binding for adicionado acidentalmente. Em outros ambientes, o cache de vídeos usa KV quando disponível. A integração com a YouTube Data API é coberta por teste simulado e precisa de validação com uma chave real antes de ser considerada operacional.

## DRM, métricas e anúncios

O player do YouTube não aceita DRM controlado pelo site. Widevine/PlayReady/FairPlay exigem mídia própria criptografada, player compatível e um serviço real de licença; veja [video-drm.md](video-drm.md). Os indicadores sem backend compartilhado são locais e não representam audiência global. AdSense exige conta e domínio aprovados, configuração apropriada e tráfego; o código não garante receita.

## Publicação e validação

Alterações no repositório não alteram automaticamente um endereço já implantado. Workers Builds ou uma publicação autorizada precisa entregar tanto os arquivos de `dist/` quanto o Worker. O preview é separado do Worker de produção; não publique o módulo legado inseguro como solução de autenticação ou cobrança.

```sh
npm run test:worker
npm run test:auth
npm run test:codes
node --check dist/spatial.js
npx wrangler deploy --dry-run
```

Os testes locais usam dados e provedores simulados. Execute testes reais de ponta a ponta somente depois que os serviços seguros e as configurações dos provedores estiverem disponíveis.
