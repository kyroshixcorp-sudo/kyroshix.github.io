# Ativar a comunidade e o Estúdio KYROSHIX

O novo visual está pronto para publicar na mesma Cloudflare. O login continua no Firebase. Comentários, perfis e alterações do catálogo precisam de um projeto Supabase Free conectado. Não é preciso mudar a hospedagem nem ativar o Firebase Storage/Blaze.

Estado em 02/10/2026: o proprietário confirmou a execução da instalação e da autorização da conta dona. O pacote atual já inclui a URL e a chave pública do Supabase, com a comunidade ativada. A consulta real retornou as quatro músicas e a lista de comentários; ainda falta enviar este pacote ao Worker e conferir o acesso autenticado. Não é necessário repetir a instalação inicial.

## 1. Criar o projeto gratuito

1. Abra https://supabase.com/dashboard e entre ou crie sua conta.
2. Crie uma organização/projeto no plano **Free**. Nome sugerido: **KYROSHIX RELEASES**. Guarde a senha do banco com você; ela não vai no site.
3. No projeto, abra **Authentication → Sign In / Providers → Third-Party Auth → Add provider → Firebase**.
4. Informe o projeto Firebase **kyroshix-releases** e salve.

A integração verifica os tokens do Firebase. O site não usa o cadastro de contas do Supabase. Os provedores Google e E-mail/senha continuam ativos no Firebase e o domínio `releases.kyroshixcorp.workers.dev` continua autorizado.

## 2. Instalar os dados e as regras

1. Abra **SQL Editor → New query** no Supabase.
2. Cole o conteúdo completo de `01-instalar.sql` e clique em **Run**.
3. Essa instalação cria catálogo, perfis, comentários, o bucket público `kyroshix-media` e todas as permissões.
4. As quatro músicas existentes entram no catálogo. Os MP3 originais continuam na Cloudflare para economizar o espaço gratuito. Seus novos arquivos vão para o Supabase.

Não use políticas genéricas que liberem escrita para todos. Não desligue RLS. Não execute novamente o arquivo inicial depois de apagar uma das quatro músicas originais: o trecho de conteúdo inicial recolocaria essa música no catálogo. Para futuras mudanças de estrutura, use migrações específicas.

## 3. Definir sua conta como dona

1. Entre no seu site com sua conta Google ou e-mail confirmado pelo menos uma vez.
2. No **Firebase → Authentication → Usuários**, copie o **UID** dessa conta.
3. Abra `02-definir-dono.sql`, substitua `COLE_SEU_UID_FIREBASE_AQUI` pelo UID e execute no SQL Editor do Supabase.
4. Apenas essa conta poderá adicionar, editar e excluir músicas. O dono também pode remover comentários; cada visitante só pode editar ou remover os próprios.

O UID não é senha. Não envie sua senha, chave secreta do Supabase, `service_role` ou chave privada Firebase. O papel de dono é verificado no banco, nunca por uma configuração editável no navegador.

## 4. Conectar o site

Copie a **Project URL** e a chave **Publishable** nas configurações do Supabase (Connect / API Keys). A chave antiga `anon` também funciona. Estes são dados públicos do aplicativo.

Preencha `community-config.json` antes de enviar a nova versão à Cloudflare:

```json
{
  "enabled": true,
  "supabaseUrl": "https://SEU-PROJETO.supabase.co",
  "publishableKey": "SUA_CHAVE_PUBLICA"
}
```

Você pode enviar aqui a URL e a chave pública para eu colocar no ZIP. Nunca coloque uma chave `secret` ou `service_role` nesse arquivo. Até essa configuração existir, a comunidade e o estúdio mostram que a ativação está pendente; os quatro MP3 e o login continuam disponíveis.

## 5. Publicar e testar

1. Na Cloudflare, abra **Workers e Pages → releases** e envie o ZIP atualizado como uma nova versão.
2. Abra https://releases.kyroshixcorp.workers.dev/ e recarregue.
3. Entre como dono e abra **Estúdio**: edite um título e confirme a alteração em outro navegador sem login.
4. Publique uma faixa com capa e MP3; teste reprodução, avanço no áudio e download.
5. Entre com uma segunda conta: o Estúdio deve negar gerenciamento. Personalize o perfil e publique um comentário.
6. Volte à conta do dono e verifique o comentário. A segunda conta não deve conseguir editar conteúdo de outra pessoa.

## Como usar

- **Estúdio → Adicionar música:** título, artistas, versão, estilo, descrição, créditos, capa e MP3. Até **25 MB** por MP3.
- **Estúdio → Editar:** altere os textos; escolha outro MP3/capa apenas se quiser substituí-los. As mudanças só aparecem depois de salvar com sucesso.
- **Excluir:** pede confirmação e remove a música e seus comentários. Para uploads novos, também tenta apagar os arquivos. Os quatro MP3 originais fazem parte do ZIP estático; removê-los fisicamente exige retirar o arquivo do ZIP e republicar.
- **Meu perfil → Editar perfil:** nome público, avatar, banner, bio, pronomes, status e cor. Imagens são convertidas para WebP. Há no máximo um avatar e um banner por conta.
- **Comentários:** entrar com e-mail confirmado; publicar, responder, editar os próprios e excluir. Ao excluir um comentário, as respostas permanecem. Há limite de frequência para reduzir spam.
- **Favoritas:** continuam locais a este navegador; não são sincronizadas entre contas ou aparelhos.
- Comentários são atualizados ao abrir a faixa, publicar e tocar em **Atualizar**. Não há presença online ou chat em tempo real.

## Plano gratuito e limites

O Supabase Free consultado em 02/10/2026 inclui 1 GB para arquivos, 500 MB para o banco, 5 GB de tráfego de saída e 5 GB de tráfego de cache. Projetos gratuitos podem pausar após uma semana de inatividade. É uma opção para um catálogo pequeno; downloads e reproduções consomem a cota. O site não ativa upgrades automáticos nem promete tráfego ilimitado.

Um MP3 de 8 MB ocupa cerca de 8 MB a cada envio e pode transferir cerca de 8 MB por reprodução/download completo. Acompanhe Usage no Supabase. Mantenha os originais das músicas e capas como backup.

## Verificações feitas e pendências

- Regras PostgreSQL/RLS executadas localmente: visitantes não gravam, outras contas não alteram o catálogo, perfis/uploads são limitados ao dono e a moderação de comentários respeita permissões.
- Fluxos de interface verificados com provedores simulados; testes não criam usuários reais nem comentários públicos.
- Conexão real de leitura ao Supabase confirmada com a chave pública recebida: catálogo de quatro faixas e consulta dos comentários com seus perfis relacionados, incluindo CORS para o domínio Cloudflare.
- A integração real Firebase → Supabase e os uploads na nuvem precisam ser confirmados depois da configuração acima. Nenhuma publicação foi feita automaticamente no painel Cloudflare.

## Notas técnicas para manutenção

JWTs Firebase não têm `role` por padrão. Por isso, a integração atribui `anon`. As políticas desta aplicação incluem `anon` e `authenticated`, mas só autorizam escrita quando `krs_uid()` confirma issuer, audience, UID e `email_verified=true` do token validado pelo gateway. Nenhuma escrita se baseia apenas no nome de papel. A tabela de donos está em um schema privado. Não são necessárias Cloud Functions para inserir custom claims.

As leituras de catálogo, perfis públicos e comentários são públicas. Nenhuma tabela pública armazena e-mail ou senha. As imagens e os MP3 do bucket são públicos por finalidade. Contas exigem verificação para escrever. O controle de frequência dos comentários ocorre no banco, dentro de uma transação.

Fontes oficiais:
- https://supabase.com/pricing
- https://supabase.com/docs/guides/auth/third-party/firebase-auth
- https://supabase.com/docs/guides/storage/security/access-control
- https://supabase.com/docs/guides/storage/uploads/standard-uploads
