# Hospedagem gratuita fora do ChatGPT

Destino: **Cloudflare Pages Free**, com o subdomínio `pages.dev` fornecido pela Cloudflare. A confirmação do endereço exato depende de criar o projeto; o nome pode já estar ocupado. O site é estático e não usa Functions, R2 nem plano pago. Não é necessário comprar domínio.

O pacote exportado contém as quatro músicas, player, artes, logos, downloads e preparação das contas. Cada arquivo está abaixo de 25 MiB e a quantidade fica abaixo de 1.000, os limites do envio pelo painel. Os arquivos ficam na raiz do ZIP, com `index.html` pronto para publicação. O pacote não inclui o vínculo com Sites nem depende da tela de login do ChatGPT.

## Publicar pelo celular ou computador

1. Entre em https://dash.cloudflare.com/ ou crie sua conta.
2. Abra **Workers & Pages**, escolha criar uma aplicação e selecione **Pages / Upload assets / Drag and drop**. Os rótulos podem variar com o idioma do painel.
3. Use **kyroshix-releases** como nome sugerido. Envie `KYROSHIX-Cloudflare-Pages.zip` e publique.
4. Copie o endereço `pages.dev` realmente retornado e confira o player e os downloads. Não marque Google como funcional antes da ativação abaixo.

Essa é uma publicação pública. Qualquer pessoa com o novo endereço poderá ouvir e baixar os quatro MP3. O site anterior fica preservado até confirmar a migração. Nenhuma conta ou assinatura paga deve ser ativada.

## Ativar o Google e as contas de e-mail

A troca de hospedagem não cria automaticamente um provedor de login. O pacote mantém a autenticação inativa até conectar o Firebase. Os botões mostram essa condição e explicam o motivo ao tocar.

Use um projeto **Firebase Spark**, sem vincular faturamento. Ative **Google** e **E-mail/senha** em Authentication. Registre o aplicativo Web e copie sua configuração pública `firebaseConfig`. Adicione o endereço `pages.dev` de produção aos domínios autorizados. Não autorize indiscriminadamente domínios de prévias.

Preencha os valores reais em `dist/auth-config.json` e altere `enabled` para `true`. Exporte novamente e publique uma nova versão no mesmo projeto Cloudflare. Verifique login Google, criação por e-mail, confirmação, recuperação e saída com uma conta de teste autorizada antes de anunciar a ativação.

O projeto usa somente Authentication no Firebase; não requer Firebase Hosting, Cloud Storage, Functions ou SMS. Fique no Spark para respeitar o pedido de não pagar. Os planos gratuitos têm cotas e condições próprias.

## Gerar o pacote

```sh
python3 scripts/export-pages.py /caminho/KYROSHIX-Cloudflare-Pages.zip
```

Quando o endereço de produção estiver confirmado, acrescente `--origin https://ENDERECO-REAL.pages.dev` para preencher os metadados de compartilhamento. Não use o exemplo como endereço existente. O exportador remove os endereços antigos do ChatGPT do HTML público.

## Fontes oficiais verificadas em 2 de outubro de 2026

- Cloudflare Pages: https://www.cloudflare.com/products/pages/
- Limites: https://developers.cloudflare.com/pages/platform/limits/
- Envio direto: https://developers.cloudflare.com/pages/get-started/direct-upload/
- Firebase Spark: https://firebase.google.com/pricing

Atualização: o proprietário publicou em `https://releases.kyroshixcorp.workers.dev/` (Workers com arquivos estáticos) e forneceu a configuração Firebase. O pacote atualizado está habilitado para conectar ao projeto real. Faltam habilitar os provedores, autorizar `releases.kyroshixcorp.workers.dev`, reenviar o ZIP e testar o login real.
