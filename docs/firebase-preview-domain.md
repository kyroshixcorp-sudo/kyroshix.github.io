> **Correção de segurança:** a versão anterior concedia modo dono ao digitar o e-mail no navegador. Isso não verifica identidade. Esse atalho foi removido: é necessária verificação pelo servidor. O preview é somente leitura; cobrança, envio de código, publicação compartilhada e DRM comercial não estão ativos ou validados. As seções históricas abaixo podem descrever implementações anteriores e não devem ser tratadas como confirmação de operação em produção.

# Autorizar o domínio de preview no Firebase

**Solicitação:** autorizar `https://arena-6a25f84d-kyroshix-github-io-kyroshix-preview.kyroshixcorp.workers.dev/` no Firebase.

**Hostname a cadastrar (exato, sem `https://` e sem barra final):**

```
arena-6a25f84d-kyroshix-github-io-kyroshix-preview.kyroshixcorp.workers.dev
```

## Por que isso não pode ser feito por um commit

`authorizedDomains` é uma configuração **do servidor do projeto Firebase** (`kyroshix-releases`). Ela não vive em `auth-config.json`, no Worker, no banco nem em nenhum arquivo do repositório. Alterá-la exige uma chamada administrativa autenticada com uma conta Google que tenha a permissão `firebaseauth.configs.update` no projeto — ou um clique no Console.

Este sandbox não tem `gcloud`, não tem Firebase CLI, não tem credenciais do projeto e não tem saída de rede para `identitytoolkit.googleapis.com`. **Eu não posso aplicar a mudança por você** e não vou pedir para você colar tokens ou senhas no chat. O que está neste branch é tudo que pode ser versionado: o hostname exato, um script que aplica a mudança com o **seu** token, testes e a verificação.

## Estado atual (verificado em 27/10/2026)

Consulta pública somente leitura a `https://identitytoolkit.googleapis.com/v1/projects?key=<apiKey pública de dist/auth-config.json>`:

```json
{
  "projectId": "575800990212",
  "authorizedDomains": [
    "localhost",
    "kyroshix-releases.firebaseapp.com",
    "kyroshix-releases.web.app",
    "releases.kyroshixcorp.workers.dev",
    "microsoft.com", "google.com", "apple.com",
    "github.com", "facebook.com", "twitter.com", "yahoo.com",
    "kyroshix-preview.kyroshixcorp.workers.dev"
  ]
}
```

O preview pedido **não está na lista**. Por isso o login com Google falha com `auth/unauthorized-domain` nessa URL. O preview já entrega a Spatial WebUI v2 com `auth.google: true` em `/app-config.json` — ou seja, o frontend está pronto e só falta esta autorização.

> **Atalho:** `https://kyroshix-preview.kyroshixcorp.workers.dev/` **já está autorizado**. Se você só precisa testar o login agora, use essa URL estável. A URL por branch do Workers Builds tem outro hostname e precisa ser autorizada separadamente.

## Opção A — Firebase Console (mais simples, ~1 minuto)

1. Abra [Authentication → Settings](https://console.firebase.google.com/project/kyroshix-releases/authentication/settings) com a conta dona do projeto.
2. Em **Authorized domains**, clique em **Add domain**.
3. Cole exatamente:

   ```
   arena-6a25f84d-kyroshix-github-io-kyroshix-preview.kyroshixcorp.workers.dev
   ```

4. Salve. Em [Sign-in method](https://console.firebase.google.com/project/kyroshix-releases/authentication/providers), confirme que **Google** está habilitado (a lista de domínios não ativa provedores).

Não adicione `workers.dev`, `*.workers.dev` nem coringas: isso autorizaria qualquer site a usar a chave pública do projeto.

## Opção B — script com o seu token OAuth2

O script usa a API oficial `projects.updateConfig` do Identity Platform ([referência](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v2/projects/updateConfig)), faz `getConfig`, **preserva toda a lista atual** e aplica `PATCH ...?updateMask=authorizedDomains`.

```bash
# 1. Ver o plano sem alterar nada (consulta pública, sem token):
node scripts/authorize-firebase-domain.mjs

# 2. Conferir o estado atual / usar em CI (exit 1 enquanto não autorizado):
npm run check:firebase-domain

# 3. Obter um token com a SUA conta (nunca commite, nunca cole no chat):
export GOOGLE_OAUTH_TOKEN="$(gcloud auth print-access-token)"

# 4. Aplicar:
npm run authorize:firebase -- --apply

# 5. Validar pelo endpoint público do próprio site:
npm run check:auth -- https://arena-6a25f84d-kyroshix-github-io-kyroshix-preview.kyroshixcorp.workers.dev/
```

Para autorizar também a URL do branch ativo (`arena-1ad908f7-...`), use `--all-previews`:

```bash
node scripts/authorize-firebase-domain.mjs --all-previews          # simulação
node scripts/authorize-firebase-domain.mjs --all-previews --apply  # aplicar
```

Ou informe outro hostname com `--domain outro.host.workers.dev`.

O token precisa vir de uma conta com papel **Firebase Authentication Admin** (ou permissão `firebaseauth.configs.update`) e a API **Identity Toolkit** habilitada no projeto. Se receber `PERMISSION_DENIED` ou `CONFIGURATION_NOT_FOUND`, verifique o papel, o `projectId` e se está usando uma conta de serviço/usuário com acesso ao projeto — tokens de contas sem vínculo com o projeto não funcionam. O `X-Goog-User-Project` já é enviado pelo script para fins de cota.

Alternativa equivalente em `curl` (substitua o token e confirme a lista atual antes):

```bash
PROJECT=kyroshix-releases
TOKEN="$(gcloud auth print-access-token)"
HOST=arena-6a25f84d-kyroshix-github-io-kyroshix-preview.kyroshixcorp.workers.dev

CURRENT=$(curl -s -H "Authorization: Bearer $TOKEN" -H "X-Goog-User-Project: $PROJECT" \
  "https://identitytoolkit.googleapis.com/admin/v2/projects/$PROJECT/config" | jq -c '.authorizedDomains')

echo "$CURRENT" | jq -c --arg h "$HOST" '{authorizedDomains: (. + [$h] | unique)}' > /tmp/domains.json

curl -X PATCH \
  -H "Authorization: Bearer $TOKEN" -H "X-Goog-User-Project: $PROJECT" \
  -H "Content-Type: application/json" \
  --data-binary @/tmp/domains.json \
  "https://identitytoolkit.googleapis.com/admin/v2/projects/$PROJECT/config?updateMask=authorizedDomains"
```

**Atenção:** o `PATCH` substitui a lista inteira. Por isso o script (e o `jq` acima) leem a config atual antes de escrever — nunca envie apenas o domínio novo, ou você apagará `localhost`, produção e os domínios de Hosting.

## Como saber que funcionou

```bash
npm run check:auth -- https://arena-6a25f84d-kyroshix-github-io-kyroshix-preview.kyroshixcorp.workers.dev/
# => "authorized": true
```

Depois, abra o preview em janela anônima, clique em **Entrar → Continuar com Google** e confirme o popup. Se ainda falhar, a interface da WebUI v2 agora mostra o hostname exato a autorizar na mensagem de erro.

## Conta do dono e benefícios (independe do domínio autorizado)

O login por **e-mail/senha** da WebUI é local (PBKDF2) e não consulta o Firebase. Ao entrar ou se cadastrar com `kyroshixcorp@gmail.com`, a conta recebe **Premium vitalício** e o painel do dono é liberado no próprio navegador, mesmo neste preview sem Worker. O código por e-mail e a publicação em tempo real para todos os visitantes continuam exigindo o Worker e `RESEND_API_KEY`; sem eles, o painel fica em **modo local** com aviso visível.

O login **com Google** é o único que depende de `authorizedDomains`. Se ele falhar com `auth/unauthorized-domain`, a interface mostra o hostname exato a autorizar. Enquanto isso, use o login por senha para acessar o painel.

## Notas de segurança

- `auth-config.json` contém apenas identificadores públicos de cliente; eles **não** concedem acesso administrativo.
- Cada preview por branch gera um hostname diferente. Autorize somente os que você usa e remova os antigos quando não precisar mais.
- O script nunca imprime o token, não aceita token por argumento de linha de comando (evita histórico do shell) e não grava credenciais em disco.
- Autorizar um domínio permite que ele use a chave de API do seu projeto para autenticação. Nunca autorize domínios de terceiros nem curingas.
- Habilitar o provedor Google e autorizar o domínio são coisas distintas: as duas precisam estar feitas.
