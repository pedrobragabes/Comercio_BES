# Comércio BES

Guia comercial local para Boa Esperança do Sul - SP, com vitrine de lojas, busca, favoritos, catálogo, pedidos leves e painel único por perfil.

Este repositório ainda não deve ser tratado como marketplace completo em produção. O escopo seguro de lançamento inicial é: guia comercial + PWA + contato/pedido via WhatsApp + painel básico.

## Stack

| Camada | Tecnologia |
| --- | --- |
| Frontend | HTML, CSS e JavaScript vanilla |
| Backend | Node.js 18+ com Express |
| Banco | PostgreSQL via Prisma |
| Banco recomendado | Supabase PostgreSQL |
| Auth | JWT em cookie httpOnly + bcrypt |
| Upload | Local em dev; Cloudinary recomendado em produção |
| Deploy recomendado | Hostinger Node.js App + Supabase |

## Estado atual

Pronto para homologação:

- Página pública com busca, categorias, mapa, modal de loja, favoritos e PWA.
- API Express com rotas de auth, comércios, categorias, avaliações, pedidos, pagamentos, upload e estatísticas.
- Painel único em `/minha-conta`, protegido por cookie.
- Testes backend com Jest/Supertest.
- Prisma configurado para PostgreSQL.

Ainda não pronto para lançamento como marketplace completo:

- Checkout público ainda cria pedido local em `localStorage`; precisa integrar `POST /api/pedidos`.
- PIX Mercado Pago existe no backend, mas falta homologar sandbox, webhook e UI pública.
- CSRF ainda não cobre todas as rotas mutantes.
- Webhook do Mercado Pago ainda precisa assinatura e persistência de evento.
- Dados sensíveis em respostas de pedidos/pagamentos precisam ser filtrados por perfil.

## Comandos

```bash
cd backend
npm install
npm run db:generate
npm run db:push
npm run seed
npm run dev
```

Aplicação local:

- Site: `http://localhost:3000`
- API: `http://localhost:3000/api`
- Minha conta: `http://localhost:3000/minha-conta`

Testes:

```bash
cd backend
npm test
```

## Variáveis de ambiente

Copie `backend/.env.example` para `backend/.env` em desenvolvimento.

Obrigatórias:

- `DATABASE_URL`
- `TEST_DATABASE_URL` para rodar `npm test` com banco isolado
- `JWT_SECRET`
- `FRONTEND_URL` em produção

Opcionais:

- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- `MERCADO_PAGO_ACCESS_TOKEN`, `MERCADO_PAGO_PUBLIC_KEY`, `WEBHOOK_BASE_URL`

## Deploy recomendado

Recomendação atual: um app Node.js na Hostinger servindo frontend + API, com banco no Supabase.

Configuração sugerida no Hostinger Node.js App:

- Framework/type: `Other` ou Express.js, se disponível
- Repository/root: raiz do repositório
- Install command: `cd backend && npm ci`
- Build command: `cd backend && npm run build`
- Start command: `cd backend && npm start`
- Entry file: `backend/src/server.js`
- Node.js: 20 ou 22

Se separar frontend e API em domínios diferentes, defina antes de carregar `js/app.js`:

```html
<script>
  window.BES_API_BASE = 'https://api.seudominio.com.br/api';
</script>
```

## GitHub e Hostinger

A Hostinger suporta deploy via GitHub para Node.js Apps em planos Business/Cloud. O fluxo ideal é:

1. Trabalhar em branch curta.
2. Abrir PR para `dev`.
3. Testar localmente.
4. Fazer merge em `main` apenas quando pronto para produção.
5. Hostinger faz deploy automático da branch configurada ou você clica em redeploy manual no hPanel.

Referência oficial: https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/

## Próximo passo de produto

Não lançar PIX, cupons ou push agora. Primeiro fechar um lançamento enxuto:

1. Integrar checkout público com API de pedidos.
2. Rodar smoke test de login, busca, loja, carrinho, pedido e painel.
3. Subir homologação na Hostinger com Supabase.
4. Cadastrar lojas reais e revisar fotos/WhatsApp.
5. Só depois ativar Mercado Pago.
