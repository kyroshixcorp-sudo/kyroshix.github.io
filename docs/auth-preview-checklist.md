# Diagnóstico de acesso no KYROSHIX Preview

O frontend usa **Firebase Authentication** para identidades e o Supabase para dados de perfil e comunidade.
O arquivo `dist/auth-config.json` declara apenas o provedor OAuth **Google**: Facebook, GitHub, X e SMS permanecem desativados de propósito. **E-mail/senha** utiliza um provedor separado e não aparece nessa lista.

## Etapas no console Firebase (não são executáveis apenas com commit GitHub)

1. Abra Firebase Console → projeto já associado ao `dist/auth-config.json` → Authentication → **Sign-in method**.
2. Ative **E-mail/Senha** e salve, caso ainda não esteja ativado. Para criar contas, o backend precisa permitir esse método.
3. Confira o Google; para usar outros OAuth, crie os aplicativos de desenvolvedor, configure os callbacks e adicione os segredos **somente no Firebase**, nunca no GitHub.
4. Em Authentication → Settings → **Authorized domains**, inclua **exatamente o hostname** do preview exibido na barra de endereço, além do domínio de produção. **Sem** `https://` e sem barras ou caminhos. Não autorize domínios genéricos. Para o preview do PR da WebUI v2, o hostname é `arena-6a25f84d-kyroshix-github-io-kyroshix-preview.kyroshixcorp.workers.dev`; o passo a passo (Console ou API com token próprio) está em [firebase-preview-domain.md](firebase-preview-domain.md).
5. Teste cadastro com novo e-mail, entrega da confirmação, login, recuperação de senha e Google em janela anônima; teste também no celular.
6. Para verificar os logs sem expor tokens, consulte erros `auth/...` apresentados pela interface ou no Console do navegador.

## Limitações e precauções

- Não acrescente provedores à lista `providers` até que estejam ativados no Firebase; habilitar apenas o botão causa falha em tempo de execução.
- SMS pode exigir configuração adicional e custos. Instagram não tem provedor Firebase nativo equivalente aos demais.
- A confirmação de e-mail é necessária para permissões de escrita da comunidade, de acordo com as políticas atuais.
- Este commit não altera produção, chaves ou políticas de banco, e não permite garantir login real sem um teste autenticado no Firebase.
