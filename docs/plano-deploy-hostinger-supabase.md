# Deploy: Hostinger + Supabase

## Decisão recomendada

Use:

- Hostinger Business para o app Node.js.
- Supabase PostgreSQL para o banco.
- Cloudinary para imagens em produção.

Motivo: é simples, cabe no orçamento, evita banco local/SQLite em produção e mantém a operação leve.

## A Hostinger Business aguenta?

Para o começo de uma cidade pequena, sim, desde que o app seja leve:

- Express atendendo API e frontend.
- Banco fora da Hostinger, no Supabase.
- Imagens fora do disco local, no Cloudinary.
- Sem filas pesadas, processamento de imagem ou jobs longos dentro do Node.

A própria Hostinger documenta suporte a Node.js Apps em Business/Cloud, Express.js, Node 18/20/22/24, deploy por GitHub e painel com métricas de CPU/RAM/I/O.

Referência: https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/

Se CPU/RAM/I/O chegar perto do limite no hPanel, o próximo passo é Cloud ou VPS, não otimização prematura.

## API no servidor local?

Não para produção.

Use o servidor local apenas para desenvolvimento ou demonstração interna. Para o público, a API precisa de:

- HTTPS.
- Uptime independente do seu PC.
- URL pública para webhooks.
- Backups e logs acessíveis.
- Reinício automático.

Mercado Pago, login e pedidos não devem depender do seu computador ligado.

## Opções

### Opção A - Um app Node.js na Hostinger

Recomendada para lançar.

- Um domínio/app serve frontend e API.
- Menos CORS.
- `API_BASE` cai em `/api` no mesmo domínio.
- Deploy por GitHub em um lugar.

Configuração:

```txt
Branch: main
Diretorio raiz: raiz do repositorio, vazio ou /
Install: cd backend && npm ci
Build: cd backend && npm run build
Start: cd backend && npm start
Entry: backend/src/server.js
Node: 20 ou 22
```

Nao use `backend` como diretorio raiz na Hostinger. Se usar, a Hostinger pode publicar apenas a pasta backend e o servidor nao encontra `index.html`, `html/cadastro.html`, CSS, JS e imagens do frontend.

### Opção B - Frontend estático + API em subdomínio

Boa quando quiser separar `www` e `api`.

- Frontend em `https://comerciobes.com.br`.
- API em `https://api.comerciobes.com.br`.
- Exige CORS bem configurado.
- Exige configurar `window.BES_API_BASE` no HTML.

```html
<script>
  window.BES_API_BASE = 'https://api.comerciobes.com.br/api';
</script>
```

### Opção C - Backend fora da Hostinger

Use se a Hostinger limitar Node ou deploy.

- Frontend na Hostinger.
- API em Render/Railway/Fly/VPS.
- Banco Supabase.

Mais flexível, mas aumenta operação e custo.

## GitHub -> Hostinger

Fluxo recomendado:

1. `dev` recebe trabalho diário.
2. `main` representa produção.
3. Hostinger deploya `main`.
4. Toda alteração vai por PR.
5. Depois do merge, o hPanel redeploya automaticamente ou por botão manual.

Pelo hPanel:

1. Websites -> Add Website.
2. Node.js Apps.
3. Import Git Repository.
4. Autorizar GitHub.
5. Escolher repo e branch.
6. Ajustar comandos.
7. Configurar env vars.
8. Deploy.

As variaveis ficam centralizadas no `.env` da raiz do projeto em desenvolvimento. Na Hostinger, use **Importar .env** ou cadastre os mesmos pares chave/valor manualmente no painel. Em producao, o app deve depender das variaveis do painel, nao de um arquivo com segredos versionado.

Variaveis minimas para homologacao:

```env
NODE_ENV=production
DATABASE_URL=postgresql://...
JWT_SECRET=...
FRONTEND_URL=https://comerciobes.com.br
WEBHOOK_BASE_URL=https://comerciobes.com.br
SITE_USERNAME=comerciobes
SITE_PASSWORD=uma-senha-forte
COOKIE_DOMAIN=
```

Variaveis opcionais para ativar recursos:

```env
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
MERCADO_PAGO_ACCESS_TOKEN=
MERCADO_PAGO_PUBLIC_KEY=
TEST_DATABASE_URL=
```

Para sites estáticos, a Hostinger também tem Git em Advanced -> Git; para Node.js, use o fluxo de Node.js Apps.

## GitHub Actions

O repositório tem `.github/workflows/ci-deploy.yml`.

Ele faz:

- Em `push` e `pull_request`: instala dependências do backend e gera Prisma Client.
- Roda testes somente quando `TEST_DATABASE_URL` estiver configurado nos secrets.
- Em `main`: tenta deploy por SSH somente se os secrets da Hostinger existirem.

Secrets esperados:

- `TEST_DATABASE_URL`
- `HOSTINGER_SSH_HOST`
- `HOSTINGER_SSH_USER`
- `HOSTINGER_SSH_KEY`
- `HOSTINGER_SSH_PORT`
- `HOSTINGER_APP_PATH`

Se a integração GitHub nativa da Hostinger estiver funcionando bem, use ela e mantenha o Actions como CI. Se quiser deploy controlado pelo GitHub Actions, configure os secrets SSH acima.

## Homologação privada

Para deixar `comerciobes.com.br` privado durante testes, defina no ambiente da Hostinger:

```env
SITE_USERNAME=comerciobes
SITE_PASSWORD=uma-senha-forte
```

Enquanto `SITE_PASSWORD` existir, o navegador pede usuário/senha antes de abrir o site. Remova `SITE_PASSWORD` no lançamento público.

Referências:

- Node.js Apps: https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/
- Git em hPanel para sites estáticos/PHP: https://www.hostinger.com/support/1583302-how-to-deploy-a-git-repository-in-hostinger/

## Checklist de homologação

- [ ] `GET /api` responde 200.
- [ ] Home carrega CSS/JS/imagens.
- [ ] `/backend/package.json` e `/docs/...` não são públicos.
- [ ] Login admin funciona.
- [ ] `/minha-conta` abre após login.
- [ ] Busca e modal de loja funcionam.
- [ ] WhatsApp abre com mensagem correta.
- [ ] Seed rodou no Supabase.
- [ ] CORS só aceita domínio real.
- [ ] Logs não mostram senhas.
