# Painel Único RBAC — Minha Conta (`/minha-conta`)

## 1. Contexto

O projeto mantém hoje **três entradas distintas** para o usuário autenticado:

| Entrada | Público | Problema |
|---|---|---|
| `/admin` (backend/admin/index.html) | Administradores | Duplicação de componentes, lógica de auth separada |
| `/painel` (backend/painel/index.html) | Clientes e comerciantes | Auth via seletor de tipo, UX inconsistente |
| (ausente) | — | Cliente não tem área dedicada |

**Meta:** consolidar tudo em `/minha-conta` — ponto único com renderização dinâmica por perfil.

**Restrição:** stack atual permanece. Não há Next.js, React nem framework de SPA. A solução é incremental sobre HTML + CSS + **JS vanilla com módulos ESM** + Express + Prisma.

---

## 2. Decisões Arquiteturais

Três decisões foram tomadas pelo dono do projeto e **não estão em discussão**:

| # | Decisão | Justificativa |
|---|---|---|
| 1 | **Stack vanilla com ESM** | Incremental; sem reescrita do backend Express + Prisma |
| 2 | **Subrotas reais** `/minha-conta/produtos`, `/minha-conta/pedidos` via `history.pushState` + `popstate`; Express serve catch-all `GET /minha-conta/*` → `minha-conta.html` | URLs limpas, bookmarkáveis, sem `?secao=` |
| 3 | **Auth por cookie httpOnly + CSRF double-submit + refresh com rotação** | Elimina token em `localStorage`; mitigação de XSS |

---

## 3. Perfis e Escopo Funcional

### `admin` — Gestão global

- Gerenciar usuários (criar, suspender, alterar role)
- Moderar lojas e catálogos
- Configurações do marketplace
- Logs e auditoria de ações críticas
- Integrações de sistema

### `comerciante` — Gestão da própria loja (1:N via `ownerId`)

- Produtos, variações e estoque
- Pedidos da própria loja
- Frete e regras de entrega
- Recebíveis e extratos
- Store switcher quando possui mais de uma loja

### `cliente` — Área pessoal

- Histórico de compras
- Rastreio de envio
- Pagamentos salvos
- Endereços
- Devoluções e solicitações

---

## 4. Matriz RBAC por Capability

A autorização é **capability-first**: o backend calcula as capabilities do usuário e as envia em `/api/auth/me`. Componentes e rotas verificam capabilities, não roles diretamente.

| Capability | admin | comerciante | cliente |
|---|:---:|:---:|:---:|
| `account.view` | ✅ | ✅ | ✅ |
| `account.view.store` (escopo `ownerId`) | ❌ | ✅ | ❌ |
| `users.manage` | ✅ | ❌ | ❌ |
| `stores.moderate` | ✅ | ❌ | ❌ |
| `stores.manage.own` | ❌ | ✅ | ❌ |
| `products.manage.own` | ❌ | ✅ | ❌ |
| `orders.view.global` | ✅ | ❌ | ❌ |
| `orders.view.ownStore` | ❌ | ✅ | ❌ |
| `orders.view.own` | ❌ | ❌ | ✅ |
| `shipping.manage.ownStore` | ❌ | ✅ | ❌ |
| `payouts.view.ownStore` | ❌ | ✅ | ❌ |
| `payments.manage.own` | ❌ | ❌ | ✅ |
| `addresses.manage.own` | ❌ | ❌ | ✅ |
| `returns.manage.own` | ❌ | ❌ | ✅ |
| `logs.read` | ✅ | ❌ | ❌ |
| `integrations.manage` | ✅ | ❌ | ❌ |

> `role` é derivado de `User.tipo` (compat layer). Coluna pode ser migrada para `role` no futuro sem quebrar a lógica de capabilities.

---

## 5. Arquitetura de Arquivos

### Estrutura nova

```
backend/
  minha-conta/
    index.html           ← shell estático (sidebar + topbar + content area)
    css/
      shell.css          ← layout e componentes da shell
    js/
      app.js             ← router principal (history.pushState + popstate)
      sections.js        ← single source of truth: registro de seções e menus
      sections/
        common/
          InicioSection.js
          PerfilSection.js
        admin/
          UsuariosSection.js
          ModeracaoLojasSection.js
          ConfiguracoesSection.js
          LogsSection.js
        merchant/
          ProdutosSection.js
          EstoqueSection.js
          PedidosSection.js
          FreteSection.js
          RecebiveisSection.js
        customer/
          HistoricoSection.js
          RastreioSection.js
          PagamentosSection.js
          EnderecosSection.js
          DevolucoesSection.js
  src/
    rbac/
      capabilities.js    ← tabela role → capabilities (single source of truth backend)
    middleware/
      auth.js            ← manter requireTipo(); adicionar requireCapability(cap)
    routes/
      auth.js            ← adicionar /me, /refresh, /logout, /csrf, /active-store
    models/
      AuditLog           ← novo modelo Prisma para ações críticas de admin
```

### Express — catch-all SPA

```js
// serve qualquer subrota de /minha-conta para o shell
app.get('/minha-conta/*', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '../minha-conta/index.html'));
});
```

### Legados

Estado atual: `/admin` e `/painel` redirecionam permanentemente para `/minha-conta`. A flag planejada `LEGACY_PANELS` foi retirada do escopo ativo.

---

## 6. Roteamento Client-Side

Cada seção é um **módulo ESM** com a interface:

```js
// contrato de cada seção
export function mount(container, ctx) { /* renderiza */ }
export function unmount() { /* limpa listeners, timers */ }
```

O `app.js` gerencia o ciclo de vida:

```js
// app.js (simplificado)
import { resolveSection } from './sections.js';

async function navigate(path) {
  if (currentSection) currentSection.unmount();
  const section = resolveSection(path, ctx.capabilities);
  if (!section) { renderForbidden(); return; }
  const mod = await import(section.load); // code splitting por seção
  currentSection = mod;
  mod.mount(contentArea, ctx);
  history.pushState({}, '', path);
}

window.addEventListener('popstate', () => navigate(location.pathname));
```

**Prefetch:** `<link rel="modulepreload">` injetado ao `mouseenter` nos itens do sidebar para reduzir latência percebida.

---

## 7. Shell Visual

Alinhado a `docs/visual.md` — reutilizar tokens CSS existentes, zero duplicação.

```
+--------------------------------------------------------------+
| Topbar: Minha Conta | [store switcher?] | busca | perfil    |
+----------+---------------------------------------------------+
| Sidebar  | Content Area                                      |
| gerado   |  - seção ativa                                    |
| por      |  - estados: loading / empty / error padronizados  |
| /auth/me |                                                   |
+----------+---------------------------------------------------+
```

- **Sidebar** montada a partir das `capabilities` retornadas por `/api/auth/me` (itens sem permissão não aparecem nem chegam ao cliente)
- **Store switcher** no topbar: visível apenas quando `stores.length > 1` (comerciante multi-loja)
- **Responsivo:** sidebar colapsa para drawer em `< 768px`
- **Paleta:** `--color-bg: #FAFAFA`, `--color-accent: #047857`, fontes Inter + Plus Jakarta Sans

---

## 8. Contrato da Sessão — `GET /api/auth/me`

Endpoint novo (o existente `GET /api/auth/perfil` permanece para compat):

**Resposta 200:**

```json
{
  "user": {
    "id": 1,
    "email": "joao@exemplo.com",
    "nome": "João Silva",
    "role": "comerciante"
  },
  "capabilities": [
    "account.view",
    "account.view.store",
    "stores.manage.own",
    "products.manage.own",
    "orders.view.ownStore",
    "shipping.manage.ownStore",
    "payouts.view.ownStore"
  ],
  "stores": [
    { "id": 10, "nome": "Loja Alpha" },
    { "id": 11, "nome": "Loja Beta" }
  ],
  "activeStoreId": 10,
  "csrfToken": "<token_opaco>"
}
```

**Notas de contrato:**

- `role` mapeado de `User.tipo` (compat); futuro: migrar coluna para `role`
- `capabilities` computada **em tempo de request** no backend a partir de `backend/src/rbac/capabilities.js` — evita drift
- `stores` só preenchido para `comerciante`; `[]` para outros roles
- `activeStoreId` determina escopo dos filtros nas APIs sensíveis
- `csrfToken` emitido junto para evitar round-trip extra

**Resposta 401:** `{ "error": "unauthenticated" }` → client redireciona para `/login`

---

## 9. Hardening de Auth

### Cookies

| Cookie | httpOnly | Path | SameSite | TTL |
|---|:---:|---|---|---|
| `access_token` | ✅ | `/` | Lax | 15 min |
| `refresh_token` | ✅ | `/api/auth/refresh` | Strict | 7 dias |
| `csrf_token` | ❌ | `/` | Lax | 15 min |

### CSRF double-submit

Todo request de mutação (`POST`, `PATCH`, `PUT`, `DELETE`) deve incluir o header `X-CSRF-Token` com o valor do cookie `csrf_token`. O backend compara os dois; mismatch → 403.

### Novos endpoints de auth

| Endpoint | Método | Descrição |
|---|---|---|
| `GET /api/auth/me` | GET | Payload de sessão completo (ver §8) |
| `POST /api/auth/refresh` | POST | Valida `refresh_token`, emite novo par rotacionado |
| `POST /api/auth/logout` | POST | Invalida `refresh_token` e limpa cookies |
| `GET /api/auth/csrf` | GET | Emite par `(csrf_token cookie, csrfToken body)` |
| `PATCH /api/auth/active-store` | PATCH | Troca `activeStoreId` no claim; re-emite cookies |

### Rate limit

`POST /api/auth/login` → 5 tentativas / minuto / IP via `express-rate-limit`.

### Audit Log

Novo modelo Prisma para ações críticas de admin:

```prisma
model AuditLog {
  id        Int      @id @default(autoincrement())
  userId    Int
  action    String   // ex: "user.delete", "store.moderate", "role.change"
  resource  String   // ex: "User:42", "Comercio:7"
  meta      Json?
  ip        String
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id])
}
```

---

## 10. Single Source of Truth — `sections.js`

```js
// backend/minha-conta/js/sections.js

/** @typedef {{ key: string, path: string, roles: string[], label: string, icon: string, load: string }} Section */

/** @type {Section[]} */
export const sections = [
  {
    key: 'inicio',
    path: '/minha-conta',
    roles: ['admin', 'comerciante', 'cliente'],
    label: 'Início',
    icon: 'layout-dashboard',
    load: './sections/common/InicioSection.js'
  },
  {
    key: 'usuarios',
    path: '/minha-conta/usuarios',
    roles: ['admin'],
    label: 'Usuários',
    icon: 'users',
    load: './sections/admin/UsuariosSection.js'
  },
  {
    key: 'moderacao',
    path: '/minha-conta/moderacao',
    roles: ['admin'],
    label: 'Moderação de Lojas',
    icon: 'shield-check',
    load: './sections/admin/ModeracaoLojasSection.js'
  },
  {
    key: 'produtos',
    path: '/minha-conta/produtos',
    roles: ['comerciante'],
    label: 'Produtos',
    icon: 'package',
    load: './sections/merchant/ProdutosSection.js'
  },
  {
    key: 'pedidos',
    path: '/minha-conta/pedidos',
    roles: ['comerciante', 'cliente'],
    label: 'Pedidos',
    icon: 'shopping-bag',
    load: './sections/merchant/PedidosSection.js' // cliente carrega HistoricoSection.js
  },
  // ... demais seções omitidas por brevidade
];

/**
 * Resolve a seção ativa pela URL, validando contra as capabilities do usuário.
 * @param {string} pathname
 * @param {string[]} capabilities
 * @returns {Section|null}
 */
export function resolveSection(pathname, capabilities) {
  const s = sections.find((s) => pathname === s.path || pathname.startsWith(s.path + '/'));
  if (!s) return null;
  // verifica se alguma capability do usuário cobre a role da seção
  return hasAccess(s.roles, capabilities) ? s : null;
}

export function getMenuByCapabilities(capabilities) {
  return sections.filter((s) => hasAccess(s.roles, capabilities));
}
```

---

## 11. Guardas de Acesso em Camadas

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Borda (Express middleware)                               │
│    requireAuth → valida cookie JWT em /minha-conta/*        │
├─────────────────────────────────────────────────────────────┤
│ 2. Client (app.js router)                                   │
│    resolveSection(path, capabilities) → null → 403 inline   │
├─────────────────────────────────────────────────────────────┤
│ 3. API (requireCapability)                                  │
│    requireCapability('products.manage.own') em cada rota    │
└─────────────────────────────────────────────────────────────┘
```

**`requireCapability` no backend:**

```js
// backend/src/middleware/auth.js (adição)
export function requireCapability(cap) {
  return (req, res, next) => {
    const caps = getCapabilities(req.user.tipo); // de capabilities.js
    if (!caps.includes(cap)) {
      logger.warn({ userId: req.user.id, cap, route: req.path }, '403 capability denied');
      return res.status(403).json({ error: 'forbidden', required: cap });
    }
    next();
  };
}
```

---

## 12. Multi-Store

Quando `stores.length > 1` o topbar exibe um `<select>` de troca de loja:

1. Usuário seleciona outra loja
2. Client faz `PATCH /api/auth/active-store { storeId: 11 }` com CSRF header
3. Backend valida que `storeId` pertence ao `ownerId = req.user.id`
4. Re-emite `access_token` com `activeStoreId` atualizado
5. Client recarrega `ctx` (chama `/api/auth/me` novamente) e re-renderiza seção ativa

---

## 13. Plano de Migração

### Fase 1 — Fundação (backend + shell vazio)

- [ ] Endpoint `GET /api/auth/me` com payload da §8
- [ ] Módulo `backend/src/rbac/capabilities.js` (tabela role → capabilities)
- [ ] `requireCapability(cap)` em `middleware/auth.js`
- [ ] Cookie httpOnly + CSRF + refresh + rate limit no login
- [ ] `backend/minha-conta/index.html` com shell estático + `InicioSection` vazia
- [ ] Express serve `GET /minha-conta/*` com SPA fallback
- [x] `/admin` e `/painel` redirecionam para `/minha-conta`

**DoD:** login via cookie funciona; `/minha-conta` renderiza shell com seção início para os 3 roles.

---

### Fase 2 — Seções comuns e cliente

- [ ] `PerfilSection`, `EnderecosSection`, `HistoricoSection`, `RastreioSection`, `PagamentosSection`, `DevolucoesSection`
- [ ] Router com `history.pushState`, subrotas, `popstate`
- [ ] Prefetch via `<link rel="modulepreload">` ao hover no sidebar
- [ ] Estados padronizados: `loading`, `empty`, `error` (componentes reutilizáveis)

**DoD:** cliente navega completamente em `/minha-conta/*` sem recarregar página.

---

### Fase 3 — Comerciante + admin

- [ ] Port de `backend/painel/` → seções `merchant/*` (produtos, estoque, pedidos, frete, recebíveis)
- [ ] Port de `backend/admin/` → seções `admin/*` (usuários, moderação, logs, configurações)
- [ ] Store switcher no topbar (multi-loja)
- [ ] `AuditLog` preenchido em ações críticas de admin
- [ ] `requireCapability` aplicado a todas as rotas sensíveis da API

**DoD:** todas as funcionalidades dos painéis legados presentes e operacionais no novo shell.

---

### Fase 4 — Hardening e sunset

- [ ] Testes E2E RBAC (Playwright): 1 fluxo completo por role + 1 teste de negação por role
- [ ] Testes unitários de `capabilities.js` e `requireCapability`
- [ ] Acessibilidade: sidebar com keyboard-nav, foco visível, `aria-current="page"` na rota ativa
- [x] `/admin` e `/painel` retornam 301 para `/minha-conta`
- [ ] Observabilidade: log estruturado `{ userId, cap, route, status: 403 }` em cada negação de capability
- [ ] CSP revisada: `script-src 'self'` sem `'unsafe-inline'` novo

**DoD:** painéis legados removidos do repo; testes E2E e unitários passam no CI; CSP sem inline JS novo.

---

## 14. Critérios de Aceite (12 testáveis)

1. **Bundle isolation:** cliente não baixa JS de seções `admin/` nem `merchant/` (verificável no DevTools → Network → JS)
2. **RBAC na URL:** admin acessa `/minha-conta/usuarios`; cliente na mesma URL recebe tela 403 inline (sem reload)
3. **Multi-store:** comerciante com 2 lojas vê store switcher; troca recarrega somente o contexto, sem full reload
4. **Logout:** invalida cookies `access_token` e `refresh_token`; se usar o refresh anterior → 401
5. **Refresh rotation:** reutilizar refresh token já rotacionado → backend loga, invalida a sessão inteira e retorna 401
6. **CSRF:** mutação sem header `X-CSRF-Token` correto → 403
7. **Rate limit:** 5 logins falhos consecutivos do mesmo IP em 60s → 429
8. **Acessibilidade:** `aria-current="page"` no item ativo da sidebar (verificável no DevTools → Elements)
9. **Responsividade:** sidebar colapsa para drawer em viewport `< 768px`
10. **Consistência visual:** CSS vars de cor e tipografia idênticas às de `docs/visual.md` (diff de variáveis)
11. **Legados:** `/admin` e `/painel` retornam `301 Moved Permanently` → `/minha-conta`
12. **Audit log:** ações criar usuário, deletar usuário, moderar loja e alterar role geram entrada em `AuditLog`

---

## 15. Riscos e Mitigações

| Risco | Probabilidade | Mitigação |
|---|:---:|---|
| Breaking change de auth quebra sessões ativas | Alta | Deploy em janela de baixo tráfego + forçar re-login; grace-period de 24h para o refresh token antigo |
| CSP atual bloqueia `import()` dinâmico | Média | Revisar `Content-Security-Policy`; `script-src 'self'` já deve cobrir ESM; validar remoção de `'unsafe-inline'` |
| Perda de indexação / PWA ao reorganizar rotas | Baixa | `/minha-conta/*` é `robots: noindex`; `sw.js` ignora essas rotas no cache |
| Drift entre capabilities no backend e no client | Média | Um único `capabilities.js` servido via `/api/auth/me`; client não mantém cópia local da matriz |
| Commerciante acessa dados de loja alheia via `storeId` na URL | Alta | Backend valida `storeId ∈ req.user.stores` em **toda** rota de escopo de loja |

---

## 16. Explicitamente Fora de Escopo

- 2FA, SSO, OAuth
- i18n (pt-BR hardcoded mantido)
- Migração do frontend público (`index.html` raiz) — permanece vanilla sem mudanças
- Docker / CI-CD (tarefa separada)
- Qualquer framework de SPA (Next.js, Nuxt, SvelteKit, etc.)
- Migração de banco de dados destrutiva — schema apenas cresce (novo modelo `AuditLog`, campo opcional `refreshTokenHash` em `User`)

---

## 17. Perguntas Remanescentes

1. **Audit log storage:** armazenar em tabela Prisma `AuditLog` (Postgres) ou em arquivo rotativo (ex.: winston file transport)? *(Sugestão: tabela Prisma — já está no schema, consultável via admin e exportável)*

---

## Resumo Executivo

A proposta elimina três entradas paralelas e estabelece `/minha-conta` como ponto único de acesso, com **RBAC real por capability** no fluxo completo:

```
cookie JWT → Express middleware → /api/auth/me (capabilities) → client router → seção carregada
```

A solução é **incremental** sobre o stack existente (Express + Prisma + JS vanilla), mantém os painéis legados sob feature flag durante a transição e garante que cada perfil baixe apenas o código que lhe é pertinente. O design respeita os tokens visuais de `docs/visual.md` e a segurança é endurecida com cookie httpOnly, CSRF double-submit e refresh com rotação.
