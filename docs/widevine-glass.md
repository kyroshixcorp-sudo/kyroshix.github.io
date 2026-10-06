# Widevine nesta versão

Status: integração do player pronta para configuração; DRM não ativado. Nenhum servidor de licenças, contrato ou criptografia foi criado. `dist/video-config.json` mantém `drmEnabled: false`.

## Ativação com um provedor de DRM

1. Obter acesso a um provedor autorizado de licenças Widevine e definir suas regras de acesso ao conteúdo.
2. Codificar/empacotar os vídeos em DASH/HLS criptografado com CENC e chaves gerenciadas pelo provedor. Disponibilizar manifestos e segmentos por HTTPS/CORS. Não publicar cópias sem proteção se o objetivo for restringir acesso.
3. Disponibilizar um endpoint de licença HTTPS compatível com os desafios binários do CDM. As credenciais do provedor e as chaves do conteúdo ficam exclusivamente no servidor. O provedor ou proxy precisa verificar a identidade, a permissão e a correspondência das chaves pedidas ao conteúdo autorizado.
4. Em `video-config.json`, configurar `licenseServers["com.widevine.alpha"]` com o endpoint do provedor e `drmEnabled: true`. `licenseAuth: "none"` significa que o site não injeta o token Firebase; o endpoint deve ter seu próprio mecanismo de autorização apropriado. Não coloque chaves privadas ou credenciais permanentes nesse JSON público.
5. No Estúdio, cadastrar o manifesto HTTPS como DASH/HLS e selecionar Widevine. Testar login, licença negada, licença vencida, busca e reprodução em aparelhos reais antes de anunciar proteção ativa.

## Integração autenticada com Firebase

Para um proxy próprio, `licenseAuth: "firebase"` encaminha o token atualizado **apenas** ao endereço exato `https://SEU-PROJETO.supabase.co/functions/v1/drm-license`, usando o projeto existente de `community-config.json`. Apenas requisições de licença recebem o token; manifestos/segmentos não recebem. `X-Content-ID` identifica o cadastro solicitado.

Esse endpoint de servidor **não é fornecido nem publicado neste pacote**: sua implementação depende da API e do formato de licença do provedor escolhido. Antes de ativar, o servidor precisa validar o JWT Firebase, aplicar a política de códigos/conta e consultar permissões no banco. Não deve confiar apenas em `X-Content-ID`: precisa conferir ou fazer o provedor conferir que o desafio binário pede somente as chaves daquele conteúdo. Deve limitar tamanho/frequência e guardar credenciais apenas em Secrets. Uma autenticação feita somente no navegador não protege as licenças.

Se o serviço usar licença em JSON/base64 ou tokens próprios, será necessário adaptar a requisição/resposta conforme o contrato oficial desse serviço. Não invente chaves ou endpoints; não use servidores públicos de teste para conteúdo comercial.

## Compatibilidade

Widevine depende do CDM do navegador e do nível exigido pelo provedor. Não funciona em todos os aparelhos. Safari normalmente requer FairPlay; esta versão mantém o ponto de configuração correspondente, mas isso também exige serviço/certificado próprios. Não é prometido Widevine L1, 4K, Dolby ou playback protegido em todos os dispositivos.

Áudios MP3/FLAC/WAV/M4A/OGG e vídeos MP4/WebM enviados aos buckets públicos continuam públicos e sem DRM. A opção de download de músicas continua funcionando. DRM não aumenta a qualidade da mídia.

Documentação: https://developers.google.com/widevine/drm/overview e https://shaka-project.github.io/shaka-player/docs/api/tutorial-drm-config.html
