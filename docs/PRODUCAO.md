# Producao - Comercio BES

Este documento substitui os docs antigos. A meta agora e estabilidade primeiro.

## O que esta funcionando

- Frontend publico em `https://comerciobes.com.br`.
- API Express em `https://comerciobes.com.br/api`.
- `GET /api/comercios` e `GET /api/categorias` usam PostgreSQL quando disponivel.
- Se o banco cair, a vitrine publica responde com `data/data.json` para nao deixar a home vazia.
- Prisma Client usa `engineType = "binary"` para evitar panic do engine na Hostinger.
- Painel `/minha-conta` carrega a SPA e valida sessao via `GET /api/auth/me`.

## O que depende do Supabase estar correto

- Login.
- Cadastro.
- Painel Minha Conta.
- Pedidos, pagamentos, avaliacoes e uploads autenticados.
- Qualquer rota que grava ou le usuarios.

Se `GET /api/health` responder `database: "unreachable"`, o problema esta nas variaveis do banco na Hostinger ou no Supabase.

## Configuracao Hostinger

Configuracao da aplicacao:

```txt
Framework: Express
Branch: main
Diretorio raiz: backend
Gerenciador de pacotes: npm
Arquivo de entrada: src/server.js
Node: 20.x
```

Variaveis obrigatorias:

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

Nao defina `PORT` manualmente na Hostinger. Deixe a plataforma injetar a porta.

## Supabase

No ambiente local, com `.env` correto:

```bash
cd backend
npm run db:push
npm run seed
```

`DATABASE_URL` deve usar o pooler na porta `6543`.
`DIRECT_URL` deve usar a porta `5432`.

O usuario do pooler geralmente tem o formato:

```txt
postgres.PROJECT_REF
```

nao apenas `postgres`.

## Diagnostico rapido

```txt
/api
```

Deve responder JSON da API.

```txt
/api/health
```

Deve responder `database: "reachable"` para login/painel funcionarem.

```txt
/api/comercios?limit=3
```

Deve responder comercios. Se o header `X-Data-Source` for `data-json`, a vitrine esta usando fallback porque o banco falhou.

## Prioridade atual

1. Manter a vitrine publica carregando sempre.
2. Corrigir `DATABASE_URL`/`DIRECT_URL` ate `/api/health` ficar reachable.
3. Validar login e cadastro.
4. So depois reabrir marketplace, PIX e dashboard avancado.
