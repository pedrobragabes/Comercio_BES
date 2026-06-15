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
Root/repository: raiz do repo
Install: cd backend && npm ci
Build: cd backend && npm run build
Start: cd backend && npm start
Entry: backend/src/server.js
Node: 20 ou 22
```

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

Para sites estáticos, a Hostinger também tem Git em Advanced -> Git; para Node.js, use o fluxo de Node.js Apps.

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
