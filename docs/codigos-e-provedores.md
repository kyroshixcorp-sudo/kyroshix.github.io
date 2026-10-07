# Ativar códigos e mais opções de login

O site continua usando o Firebase **kyroshix-releases**. Não migre os usuários para o Supabase Auth: os UIDs e permissões atuais dependem do Firebase. No Supabase, mantenha a integração Firebase em Third-Party Auth.

## Mais provedores

No Firebase → Authentication → Método de login, configure cada provedor desejado com as credenciais e callback indicados pelo próprio painel. Segredos ficam no painel do provedor/Firebase, nunca no site.

Depois acrescente somente os provedores já configurados à lista `providers` de `auth-config.json` e envie o ZIP atualizado à Cloudflare. A tela mostra Google, Facebook, GitHub, X/Twitter, Instagram e SMS; opções sem configuração aparecem com aviso de indisponibilidade, e apenas provedores habilitados no Firebase podem ser usados:

| Nome | Identificador |
| --- | --- |
| Google | `google.com` |
| Apple | `apple.com` |
| Microsoft | `microsoft.com` |
| GitHub | `github.com` |
| Facebook | `facebook.com` |
| X / Twitter | `twitter.com` |
| Yahoo | `yahoo.com` |

Exemplo: `"providers": ["google.com", "github.com"]`. Apple e alguns provedores têm requisitos próprios de conta, aprovação ou cobrança. Não foram habilitados por esta atualização. Os botões ainda sem configuração ficam visíveis, com status e explicação ao clicar, para não sugerir que o login esteja pronto.

**Instagram:** o fluxo Firebase atual não tem provedor Instagram nativo. O botão informa a indisponibilidade; para torná-lo funcional será necessária uma integração OAuth própria, com aplicativo Meta, callback e troca segura de tokens no servidor. Não coloque segredos do Instagram no site estático.

Mantenha `releases.kyroshixcorp.workers.dev` nos domínios autorizados. Se uma conta já existir com outro método, entre pelo método original e use **Minha conta → Conectar outro acesso**. Criar outra conta pode gerar outro UID e não transfere o papel de dono.

## Código numérico por e-mail

O pacote inclui a função `login-code`. Ela verifica a assinatura do token Firebase, usa o e-mail da identidade autenticada, gera seis números e guarda somente um hash ligado ao UID e à sessão. O código expira em dez minutos, permite até cinco tentativas e só pode ser usado uma vez. Há espera de um minuto entre envios e limite de cinco envios por hora por usuário. A confirmação autoriza a sessão por até doze horas; uma nova autenticação precisa de novo código.

### A. Preparar o remetente

A implementação usa Resend. Configure no Resend um domínio de e-mail que você controla, verifique os registros DNS e gere uma API key de envio. O subdomínio gratuito `workers.dev` não é um domínio de e-mail sob seu controle. Se você não tem um domínio verificável, mantenha esta etapa desligada por enquanto; Google/e-mail e senha continuam funcionando. Não é possível prometer envio irrestrito e gratuito sem essa configuração.

### B. Publicar a função pelo painel Supabase

1. Execute primeiro o SQL `07-codigos-de-acesso.sql`.
2. No Supabase, abra **Edge Functions → Deploy a new function → Via Editor**. Nome: **login-code**.
3. Use o arquivo pronto `functions/login-code-dashboard.ts` como conteúdo de `index.ts`. É a mesma função testada, em um arquivo para facilitar a colagem no celular.
4. Publique. Nas configurações da função, desligue **Verify JWT / Enforce JWT verification** para essa função específica. O verificador padrão espera JWT Supabase; o código da função faz a validação criptográfica do Firebase. Não remova a validação implementada no código.
5. Em **Edge Functions → Secrets**, configure:

| Secret | Valor |
| --- | --- |
| `SITE_ORIGIN` | `https://releases.kyroshixcorp.workers.dev` |
| `CODE_HASH_SECRET` | Valor aleatório forte com pelo menos 32 caracteres, gerado e guardado por você. |
| `RESEND_API_KEY` | Sua chave de envio do Resend. |
| `EMAIL_FROM` | Remetente do domínio verificado, por exemplo `KYROSHIX <acesso@seu-dominio.com>`. |

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são variáveis disponibilizadas pelo ambiente Supabase. A função usa essa chave somente no servidor. **Não coloque esses segredos no ZIP do site nem no chat.**

Alternativa por computador: copie `functions/login-code/` para `supabase/functions/login-code/`, mescle o trecho de `functions/config.toml` em `supabase/config.toml` e publique com `supabase functions deploy login-code --project-ref cjjengufetslmjvwexaq --no-verify-jwt`. O diretório de funções não vai à Cloudflare.

### C. Testar e exigir o código

Altere somente o bloco `security` de `auth-config.json`, preservando o restante:

```json
"security": {
  "requireEmailCode": true,
  "endpoint": "https://cjjengufetslmjvwexaq.supabase.co/functions/v1/login-code"
}
```

Publique o site e teste numa aba privada: entre com Google, solicite o código, receba o e-mail e confirme. Teste também uma conta criada por e-mail/senha. Até executar o passo seguinte, o bloqueio no banco ainda não exige código para todas as identidades verificadas.

**Só depois de confirmar o recebimento e o acesso**, execute `08-exigir-codigo.sql`. Isso torna a exigência efetiva no servidor para as operações autenticadas, inclusive se alguém tentar contornar a interface. Contas Google e outros provedores também passam por essa confirmação. Login por telefone já valida o SMS no Firebase.

Se houver falha no remetente, volte temporariamente `requireEmailCode` para `false`, republique o site e, no SQL Editor, execute:

```sql
update krs_private.login_policy set require_code = false where id = true;
```

Isso retorna ao comportamento anterior de exigir conta Firebase verificada, sem apagar perfis ou contas.

## SMS e links de e-mail

SMS está desligado porque exige Firebase Blaze e pode gerar custos. Se você decidir configurar esse serviço depois, habilite Phone no Firebase, configure as regiões permitidas e teste o reCAPTCHA; só então mude `phoneEnabled` para `true`.

Para acesso por link de e-mail, habilite essa opção no Firebase e depois use `emailLinkEnabled: true`. A cota atual do Spark para envio de links de login é baixa; consulte o painel antes de ativar para todo o público. Código numérico por e-mail é a função acima, não o mesmo recurso do link de acesso.

Fontes: https://firebase.google.com/docs/auth/limits · https://supabase.com/docs/guides/functions/quickstart-dashboard · https://supabase.com/docs/guides/functions/deploy · https://resend.com/docs/dashboard/domains/introduction

Guia atualizado dos métodos e da primeira visita: [acesso-4.5.md](acesso-4.5.md).
