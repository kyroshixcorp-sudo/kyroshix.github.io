# Vídeo e DRM

O player utiliza vídeo HTML e carrega Shaka Player 5.2.12 somente ao abrir HLS/DASH. A licença do Shaka está incluída em `dist/vendor`. A integração não usa código da Netflix.

## Reprodução comum

MP4/WebM podem ser enviados pelo Estúdio ou informados por URL HTTPS. HLS/DASH precisam estar prontos em uma origem que permita CORS; o site não codifica nem segmenta o arquivo. Legendas externas devem ser WebVTT. O servidor deve oferecer suporte a requisições Range para avanço eficiente em arquivos simples.

## Conteúdo protegido

Para reprodução protegida é necessário ter:

1. Mídia HLS/DASH já criptografada para o sistema pretendido.
2. Um serviço de licenças Widevine, PlayReady e/ou FairPlay compatível com essa mídia.
3. Autorização de usuários e emissão de licenças configuradas no serviço contratado/operado por você.
4. Navegador e dispositivo compatíveis; FairPlay pode exigir certificado.

O arquivo público `video-config.json` está com `drmEnabled: false`. Quando o serviço estiver pronto, a configuração tem este formato:

```json
{
  "drmEnabled": true,
  "licenseServers": {
    "com.widevine.alpha": "https://seu-servico/licenca-widevine",
    "com.microsoft.playready": "https://seu-servico/licenca-playready",
    "com.apple.fps": "https://seu-servico/licenca-fairplay"
  },
  "fairplayCertificateUrl": "https://seu-servico/certificado-fairplay"
}
```

Use apenas as entradas disponíveis no seu serviço. Não coloque chave de descriptografia, segredo ou token permanente nesse arquivo: ele é público. A configuração atual suporta URLs de licenças; provedores que exigem tokens efêmeros, cabeçalhos específicos ou formatos próprios de resposta precisam de um adaptador adicional no servidor/player.

Depois escolha o sistema correspondente no vídeo do Estúdio. Marcar uma opção não criptografa um MP4 comum. Também não torna privado o bucket público de uploads. O backend de licenças, empacotamento da mídia, regras de autorização e cobrança de assinaturas **não estão implementados nem ativados** nesta entrega.

Validação realizada: player comum em Chromium, controles, capítulos e responsividade. Não houve teste de reprodução DRM comercial, porque não foram fornecidos manifestos protegidos nem um serviço de licenças. HLS/DASH e DRM exigem teste final com a mídia real e os dispositivos de destino.

Referência: https://shaka-project.github.io/shaka-player/docs/api/tutorial-drm-config.html
