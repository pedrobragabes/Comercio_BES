# Comercio BES

Guia comercial local de Boa Esperanca do Sul - SP.

O foco atual e colocar o site em producao com estabilidade. Marketplace, PIX e dashboard avancado ficam depois que vitrine, login e painel basico estiverem firmes.

## Stack atual

- Frontend: HTML, CSS e JavaScript vanilla.
- Backend: Node.js + Express.
- Banco: PostgreSQL Supabase via Prisma.
- Deploy: Hostinger Node.js App com diretorio raiz `backend`.

## O que funciona agora

- Site publico.
- API em `/api`.
- Lista de comercios e categorias.
- Fallback publico via `data/data.json` se o Supabase falhar.
- Login/cadastro/painel quando `DATABASE_URL`, `DIRECT_URL` e `JWT_SECRET` estao corretos.

## O que ainda nao e prioridade

- Checkout completo.
- PIX em producao.
- Dashboard avancado.
- CI/CD completo.

## Rodar local

Crie `.env` na raiz a partir de `.env.example`.

```bash
cd backend
npm install
npm run db:push
npm run seed
npm run dev
```

URLs locais:

- Site: `http://localhost:3000`
- API: `http://localhost:3000/api`
- Health: `http://localhost:3000/api/health`
- Painel: `http://localhost:3000/minha-conta`

## Deploy Hostinger

Configuracao da aplicacao:

```txt
Framework: Express
Branch: main
Diretorio raiz: backend
Gerenciador de pacotes: npm
Arquivo de entrada: src/server.js
Node: 20.x
```

Variaveis principais:

```env
NODE_ENV=production
DATABASE_URL=postgresql://postgres.PROJECT_REF:SENHA@aws-1-us-east-2.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.PROJECT_REF:SENHA@aws-1-us-east-2.pooler.supabase.com:5432/postgres
JWT_SECRET=uma-chave-longa-real
FRONTEND_URL=https://comerciobes.com.br
WEBHOOK_BASE_URL=https://comerciobes.com.br
COOKIE_DOMAIN=
PRISMA_CLIENT_ENGINE_TYPE=binary
```

Nao defina `PORT` manualmente na Hostinger.

## Diagnostico

`/api` deve responder JSON da API.

`/api/health` deve responder `database: "reachable"` para login e painel funcionarem.

`/api/comercios?limit=3` deve responder dados. Se vier com header `X-Data-Source: data-json`, a vitrine esta usando fallback porque o banco falhou.

Mais detalhes em `docs/PRODUCAO.md`.
