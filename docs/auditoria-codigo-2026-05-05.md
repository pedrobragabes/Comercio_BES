# Relatório de Auditoria de Código — Comércio BES

**Data:** 05/05/2026  
**Auditor:** OpenCode  
**Escopo:** Frontend (raiz/) + Backend (backend/)  
**Método:** Análise estática de código fonte

---

## Sumário Executivo

Foram identificadas **66 falhas/problemas** distribuídos entre backend e frontend. Os problemas mais graves são:
- Servidor Express servindo a raiz inteira do projeto (expondo `.env`, schema, código-fonte)
- Arquivo `.env` commitado com credenciais reais (Supabase, Cloudinary, Mercado Pago, JWT)
- Webhook de pagamento sem verificação de assinatura
- Checkout do frontend nunca chama a API backend (salva apenas no `localStorage`)
- CSRF ausente na maioria das rotas mutantes
- Vazamento de dados sensíveis (PIX QR Code, email/telefone do cliente) para comerciantes

---

## 1. Bugs / Erros Lógicos

| # | Arquivo (linha aprox.) | Severidade | Descrição | Recomendação |
|---|------------------------|------------|-----------|--------------|
| 1.1 | `backend/src/server.js:170` | **Crítica** | `express.static` serve a **raiz inteira do repositório** (`__dirname/../..`), expondo `backend/.env`, `prisma/schema.prisma`, `data/`, `docs/`, código-fonte e qualquer arquivo do servidor. | Restringir `express.static` a uma pasta `public/` ou `frontend/dist/` isolada. Remover imediatamente o acesso à raiz. |
| 1.2 | `backend/src/controllers/authController.js:224-235` | **Alta** | Rotação de refresh token faz busca **linear O(N)** por todos os usuários com `refreshTokenHash not null` e compara bcrypt em loop. Com milhares de usuários ativos, causa latência severa e potencial DoS. | Criar tabela dedicada `RefreshToken` com índice no hash ou no mínimo no `userId`, ou armazenar `refreshTokenJti` indexado no `User`. |
| 1.3 | `backend/src/controllers/pedidosController.js:8-15` | **Alta** | Geração do código de pedido (`BES-XXXXX`) usa `findFirst orderBy id desc`, sujeita a **race condition** em concorrência (dois pedidos podem receber o mesmo código). | Usar UUID nativo do banco, ou uma sequência/lock no banco (ex: `pg_sequences` no PostgreSQL). |
| 1.4 | `backend/src/controllers/comerciosController.js:68-73` | **Média** | `listar` inclui **todas as avaliações** de cada comércio (`avaliacoes: true`) só para calcular média no JavaScript. Isso carrega N avaliações por comércio. | Calcular média no banco via `aggregate` ou manter campo denormalizado `rating` atualizado por trigger/CRON. |
| 1.5 | `backend/src/controllers/authController.js:191-198` | **Média** | Endpoint `/api/auth/me` emite **novo CSRF token a cada requisição**. Requisições concorrentes podem invalidar o cookie `csrf_token` de uma requisição paralela. | Emitir CSRF token por sessão (ou com janela de tolerância de 1-2 tokens anteriores) em vez de rotacionar a cada GET. |
| 1.6 | `js/modules/checkout.js:103-117` | **Alta** | `confirmarPedido` cria o pedido **apenas no `localStorage`** (`Orders.create`), nunca chama `POST /api/pedidos`. O backend de pedidos existe mas é ignorado pelo fluxo principal. | Integrar o checkout com `POST /api/pedidos` do backend; usar `localStorage` apenas como cache offline. |
| 1.7 | `js/modules/auth.js:15` | **Média** | `isLoggedIn()` confia apenas no `localStorage` (`bes_sessao`). Um atacante pode definir manualmente o localStorage para bypassar gates de autenticação no frontend. | Verificar sessão no backend (`/api/auth/me`) antes de permitir ações sensíveis no frontend, ou não confiar no localStorage para segurança. |
| 1.8 | `backend/src/controllers/avaliacoesController.js:69-79` | **Média** | Permite **múltiplas avaliações do mesmo usuário** no mesmo comércio e **avaliações anônimas** (`userId: null`) sem vinculação a compra. Facilita spam de ratings. | Adicionar `unique` em `[comercioId, userId]` (para usuários logados) e exigir `auth` (não opcional) para avaliar. |
| 1.9 | `backend/src/controllers/authController.js:56-127` | **Média** | Registro público (`POST /api/auth/registro`) **não possui rate limiting**, permitindo criação massa de contas e enchimento do banco. | Adicionar `express-rate-limit` específico para `/api/auth/registro` (ex: 5 tentativas/hora por IP). |
| 1.10 | `backend/src/controllers/comerciosController.js:251-312` | **Média** | `atualizar` permite alterar `slug` sem verificar se o novo slug já existe, resultando em erro Prisma P2002 não tratado no controller. | Verificar unicidade do novo `slug` antes do `update`, ou capturar P2002 e retornar 409. |
| 1.11 | `js/modules/orders.js:12` | **Baixa** | IDs de pedido gerados no frontend (`PED-${Date.now().toString(36)}`) não seguem o padrão `BES-XXXXX` do backend, causando inconsistência de formato. | Unificar geração de ID no backend ou usar UUID no frontend alinhado ao backend. |
| 1.12 | `backend/src/controllers/pagamentosController.js:68-95` | **Média** | Pagamento `na_entrega` confirma o pedido automaticamente (`status: 'confirmado'`), mas não verifica se o pedido já foi cancelado ou se há estoque. | Verificar status atual do pedido antes de confirmar automaticamente. |
| 1.13 | `backend/src/controllers/estatisticasController.js:7-44` | **Baixa** | `registrar` não verifica se o `comercioId` existe antes de criar a estatística, gerando registros órfãos no banco. | Validar existência do comércio com `prisma.comercio.findUnique` antes do `create`. |
| 1.14 | `backend/src/controllers/pedidosController.js:244-274` | **Média** | Cliente pode cancelar pedido (`status: 'cancelado'`) mesmo que o pagamento já tenha sido aprovado pelo Mercado Pago. | Bloquear cancelamento pelo cliente se `pedido.pagamento.status === 'aprovado'`. |

---

## 2. Falhas de Segurança

| # | Arquivo (linha aprox.) | Severidade | Descrição | Recomendação |
|---|------------------------|------------|-----------|--------------|
| 2.1 | `backend/src/server.js:170` | **Crítica** | `express.static` na raiz do projeto permite acesso direto a `backend/.env`, `prisma/schema.prisma`, `package.json`, código-fonte, dados de seed, etc. | Servir apenas uma pasta `public/` ou build do frontend. Mover assets sensíveis para fora da raiz servida. |
| 2.2 | `backend/.env` (arquivo inteiro) | **Crítica** | Arquivo `.env` commitado com **credenciais reais**: `DATABASE_URL` (senha em texto plano do Supabase), `CLOUDINARY_API_SECRET`, `MERCADO_PAGO_ACCESS_TOKEN`, `JWT_SECRET`. | Remover do repositório (`git rm --cached`), rotacionar TODAS as credenciais expostas, adicionar `.env` ao `.gitignore`, usar variáveis de ambiente do host. |
| 2.3 | `backend/src/routes/*.js` (múltiplos) | **Alta** | **CSRF (`csrfGuard`) está ausente** na maioria das rotas mutantes: `/api/comercios/*`, `/api/pedidos/*`, `/api/avaliacoes/*`, `/api/upload/*`, `/api/admin/*`, `/api/pagamentos/criar`, `/api/auth/perfil`, `/api/auth/enderecos/*`. | Aplicar `csrfGuard` em **todas** as rotas POST/PUT/PATCH/DELETE que usam cookies de sessão. |
| 2.4 | `backend/src/controllers/pagamentosController.js:186-261` | **Alta** | Webhook do Mercado Pago **não verifica assinatura** (`x-signature`). Qualquer pessoa pode POSTar para `/api/pagamentos/webhook` e falsificar status de pagamento. | Implementar verificação de assinatura do webhook conforme documentação do Mercado Pago (validar `x-signature` com secret). |
| 2.5 | `backend/src/controllers/pagamentosController.js:296-317` | **Alta** | `consultarPagamento` retorna dados completos do pagamento (incluindo `pixQrCode`, `pixQrCodeBase64`, `mercadoPagoId`) para o **comerciante** (`isComercio`). O comerciante não deveria ver o QR Code do cliente. | Filtrar campos sensíveis de pagamento na resposta para comerciantes; retornar apenas `status`, `metodo`, `valor`. |
| 2.6 | `backend/src/controllers/pedidosController.js:179-185` | **Alta** | `listar` e `buscarPorCodigo` expõem **email e telefone do cliente** (`cliente: { nome, email, telefone }`) para o comerciante. | Avaliar necessidade de negócio; se não for essencial, remover `email`/`telefone` ou mascarar. |
| 2.7 | `backend/src/controllers/pedidosController.js:211-218` | **Alta** | `buscarPorCodigo` retorna `pagamento: true` completo para qualquer usuário autorizado (incluindo comerciante), vazando `pixQrCode`, `detalhes`, etc. | Restringir campos de `pagamento` na query com `select`. |
| 2.8 | `js/render/cards.js:20` | **Média** | `heroFoto` é interpolado diretamente em `style="background-image:url(' + heroFoto + ');"` sem `escapeHTML`. Se o backend permitir URL maliciosa em `fotos`, há vetor XSS via CSS injection. | Aplicar `escapeHTML(heroFoto)` antes de interpolar no atributo `style`. |
| 2.9 | `backend/minha-conta/js/sections/common/PerfilSection.js:11-98` | **Média** | Usa `container.innerHTML` com template string contendo `${user.nome}`, `${user.email}`, `${user.role}` sem escapar (`esc`). Se o backend retornar dados maliciosos (ou dados antigos pré-sanitização), há XSS no painel administrativo. | Usar a função `esc()` (importada de `../../utils.js`) em todas as interpolações de dados dinâmicos no `innerHTML`. |
| 2.10 | `backend/src/controllers/authController.js:363` | **Média** | `atualizarPerfil` permite atualizar `avatar` sem validação de URL/formato. Pode ser usado para armazenar `javascript:` ou URL maliciosa. | Validar que `avatar` é uma URL HTTPS válida (regex) ou permitir apenas uploads via `/api/upload`. |
| 2.11 | `backend/src/controllers/comerciosController.js:221-238` | **Média** | `criar` armazena `fotos: JSON.stringify(fotos || [])` sem validar conteúdo do array. O frontend `cards.js` escapa, mas outros consumidores da API podem não escapar. | Validar que cada item do array `fotos` é uma string URL segura (http/https) ou caminho local permitido. |
| 2.12 | `backend/src/middleware/upload.js:58-79` | **Média** | `uploadToCloudinary` não remove o arquivo local se o upload falhar (catch retorna `null`, mas `fs.unlinkSync` só é chamado em caso de sucesso). Arquivos temporários acumulam em disco. | Mover `fs.unlinkSync` para um bloco `finally` ou verificar existência do arquivo antes de deletar em ambos os casos. |
| 2.13 | `backend/src/controllers/authController.js:17` | **Média** | `JWT_SECRET` no `.env` é um token JWT completo (`eyJhbG...`), não uma chave secreta simples. Embora funcione como string para HS256, indica confusão de configuração e pode ter sido gerado a partir de outro secret exposto. | Gerar uma chave secreta longa e aleatória (ex: `openssl rand -base64 64`) e substituir o valor atual. |
| 2.14 | `backend/src/middleware/auth.js:42-58` | **Baixa** | `authByCookie` redireciona para `/login` sem preservar a URL original. Não é falha de segurança direta, mas prejudica UX e pode levar a loops de redirecionamento. | Adicionar `?redirectTo=` ou similar ao redirecionar. |
| 2.15 | `backend/src/controllers/comerciosController.js:355-370` | **Baixa** | `adicionarProduto` aceita `imagem: imagem || null` sem validar URL segura. | Validar formato de URL ou restringir a domínios confiáveis. |

---

## 3. Problemas de Qualidade / Manutenibilidade

| # | Arquivo (linha aprox.) | Severidade | Descrição | Recomendação |
|---|------------------------|------------|-----------|--------------|
| 3.1 | `backend/prisma/schema.prisma` (múltiplos campos) | **Alta** | **Ausência de índices** em campos de alta cardinalidade/filtro: `Comercio.ownerId`, `Comercio.categoriaId`, `Produto.comercioId`, `Pedido.clienteId`, `Pedido.comercioId`, `Pedido.status`, `Avaliacao.comercioId`, `Estatistica.comercioId`, `Endereco.userId`, `User.tipo`, `User.refreshTokenHash`. | Adicionar `@@index([campo])` em todas as colunas frequentemente usadas em `where`, `orderBy` e joins. |
| 3.2 | `backend/prisma/schema.prisma:129,201-204,244,249` | **Alta** | Uso de `Float` para valores monetários (`Produto.preco`, `Pedido.subtotal/total`, `Pagamento.valor`). Float causa erros de arredondamento em cálculos financeiros. | Migrar para `Decimal` do Prisma (mapeado para `numeric` no PostgreSQL). |
| 3.3 | `backend/src/controllers/*` (múltiplos) | **Média** | Validação de input é feita manualmente e de forma inconsistente em cada controller. Não há schema de validação centralizado (Zod, Joi, Yup). | Adotar biblioteca de validação (ex: Zod) e criar middlewares de validação reutilizáveis. |
| 3.4 | `backend/minha-conta/js/sections.js:179-196` | **Média** | `CAP_TO_ROLES` é duplicado do backend `capabilities.js`. Qualquer alteração no backend requer sync manual no frontend. | Gerar `CAP_TO_ROLES` automaticamente a partir do backend ou consolidar em um JSON compartilhado. |
| 3.5 | `backend/src/seed.js:42-68` | **Média** | Credenciais de seed (`admin123`, `demo123`) são **logadas no console** em texto plano. Logs podem ser persistidos em sistemas de monitoramento. | Remover logs de senhas ou mascarar. Documentar credenciais apenas em `docs/` ou README seguro. |
| 3.6 | `backend/src/server.js:105-106` | **Baixa** | `allowedHeaders` no CORS inclui `'X-CSRF-Token'`, mas a maioria das rotas não usa CSRF. É OK, mas inconsistente com a realidade. | Remover se CSRF não for implementado globalmente; manter se for adicionado. |
| 3.7 | `js/modules/auth.js:13` | **Baixa** | `getToken()` sempre retorna `null`, mas `api.js` ainda recebe e usa `token` como parâmetro legado. Código morto. | Remover parâmetro `token` de `enviarAvaliacaoApi` e confiar apenas em cookies. |
| 3.8 | `backend/src/controllers/estatisticasController.js:76-103` | **Baixa** | Agrupamento de eventos por dia é feito em JavaScript com `forEach`. Para 365 dias, é ineficiente e pouco escalável. | Usar `groupBy` do Prisma ou `rawQuery` com `DATE(createdAt)` para agrupar no banco. |
| 3.9 | `backend/src/middleware/errorHandler.js:45-50` | **Baixa** | Mensagem genérica "Erro interno do servidor" em produção, mas `err.message` pode vazar para clientes em erros 4xx se não for 500. | Sempre retornar mensagens genéricas para 500, e mensagens controladas para 4xx. |
| 3.10 | `backend/package.json` | **Baixa** | Ausência do campo `engines` (versão mínima do Node.js). | Adicionar `"engines": { "node": ">=18.0.0" }`. |
| 3.11 | `backend/src/server.js:141-142` | **Baixa** | `express.json` e `express.urlencoded` limitados a `100kb`. É bom para segurança, mas pode ser insuficiente para payloads grandes do painel admin no futuro. | Documentar o limite ou torná-lo configurável via `.env`. |

---

## 4. Inconsistências entre Frontend e Backend

| # | Arquivo (linha aprox.) | Severidade | Descrição | Recomendação |
|---|------------------------|------------|-----------|--------------|
| 4.1 | `js/modules/checkout.js:103-117` | **Crítica** | O frontend cria pedidos **exclusivamente no `localStorage`** (`Orders.create`). A API `POST /api/pedidos` existe, completa e funcional, mas **nunca é chamada** pelo fluxo principal de checkout. | Substituir `Orders.create` local por chamada `fetch` a `POST /api/pedidos` com `credentials: 'include'`. |
| 4.2 | `js/config.js:5-7` | **Alta** | `API_BASE` usa lógica `window.location.port === '3000'` para detectar API. Em produção (porta 80/443), sempre cairá em `http://localhost:3000/api`, quebrando completamente a integração. | Usar variável de ambiente/build-time ou detectar via `window.location.origin` quando o frontend e backend estão no mesmo domínio, ou configurar `API_BASE` via `.env` no build. |
| 4.3 | `js/modules/orders.js:12` | **Média** | IDs de pedido no frontend (`PED-...`) não correspondem ao formato `BES-XXXXX` gerado pelo backend. | Remover geração local de ID; usar o `codigo` retornado pelo backend após `POST /api/pedidos`. |
| 4.4 | `js/modules/auth.js:40-47` | **Média** | O frontend armazena sessão em `localStorage` (`bes_sessao`) enquanto o backend usa cookies `httpOnly`. Há dupla fonte de verdade para autenticação. | Remover persistência de sessão no `localStorage`; confiar unicamente nos cookies httpOnly. Usar `localStorage` apenas para dados não-sensíveis (tema, favoritos). |
| 4.5 | `backend/src/controllers/authController.js:123,160` | **Média** | Backend retorna `token` no JSON de registro/login, mas o frontend ignora (`localStorage.removeItem(KEYS.API_TOKEN)`). O contrato está desalinhado. | Remover `token` do corpo da resposta se o frontend não o utiliza (cookie é suficiente). |
| 4.6 | `js/render/orders-ui.js` vs `backend/src/controllers/pedidosController.js` | **Média** | O modal "Meus Pedidos" (`orders-ui.js`) lista pedidos do `localStorage`, enquanto o backend possui histórico completo por usuário (`GET /api/pedidos`). | Implementar sincronização: buscar pedidos da API ao abrir o modal; usar localStorage como cache offline. |

---

## 5. Falhas de Tratamento de Erro

| # | Arquivo (linha aprox.) | Severidade | Descrição | Recomendação |
|---|------------------------|------------|-----------|--------------|
| 5.1 | `backend/src/middleware/errorHandler.js` | **Média** | Não trata erros de conexão do Prisma (`P1001`, `P1002`, `P1008`), erros de timeout, ou erros do Mercado Pago. | Adicionar blocos para códigos de erro de infraestrutura e retornar `503 Service Unavailable` com mensagem apropriada. |
| 5.2 | `backend/src/controllers/uploadController.js:15-34` | **Média** | Se `uploadToCloudinary` retorna `null` (falha), o controller retorna URL local `/uploads/...` sem verificar se o arquivo realmente existe. | Verificar `fs.existsSync(req.file.path)` antes de responder; se Cloudinary falhar e não houver fallback configurado, retornar `502` com erro. |
| 5.3 | `js/modules/api.js:8-15` | **Baixa** | `registrarEstatistica` silencia todos os erros com `.catch(err => console.warn...)`. Falhas de rede não são reportadas ao usuário nem à telemetria. | Adicionar métrica/alerta para falhas críticas de API; não silenciar erros em produção. |
| 5.4 | `backend/src/controllers/pagamentosController.js:186-261` | **Alta** | Webhook sempre responde `200` mesmo em erro interno, mas **não persiste o evento** para retry manual. Se houver bug, o pagamento fica des sincronizado. | Salvar payload bruto do webhook em tabela `WebhookEvent` para reprocessamento manual. |
| 5.5 | `js/modules/auth-ui.js:36-46` | **Baixa** | `fazerLogin` exibe apenas `result.msg` genérico em caso de erro de rede (`catch` não é tratado no `auth-ui.js`; é tratado em `auth.js`). | Adicionar tratamento de timeout/exceção no `auth-ui.js` para informar usuário sobre falha de conexão. |

---

## 6. Problemas de Performance

| # | Arquivo (linha aprox.) | Severidade | Descrição | Recomendação |
|---|------------------------|------------|-----------|--------------|
| 6.1 | `backend/src/controllers/authController.js:224-235` | **Alta** | Refresh token busca todos os usuários com hash e compara bcrypt sequencialmente (O(N) com hash lento). | Tabela dedicada de refresh tokens com índice ou campo `refreshTokenJti` indexado no `User`. |
| 6.2 | `backend/src/controllers/comerciosController.js:68-73` | **Alta** | `listar` carrega **todas as avaliações** (`avaliacoes: true`) de todos os comércios da página só para calcular média no JS. | Usar `aggregate` do Prisma para calcular média no banco; ou manter campo denormalizado. |
| 6.3 | `backend/prisma/schema.prisma` (vários models) | **Alta** | Falta de índices em praticamente todas as FKs e campos de filtro (`ownerId`, `categoriaId`, `clienteId`, `comercioId`, `status`, etc.). | Adicionar `@@index`/`@index` em todas as colunas usadas em `where`, `orderBy` e joins frequentes. |
| 6.4 | `backend/src/controllers/estatisticasController.js:76-103` | **Média** | Agrupamento por dia feito em memória (`forEach` + `switch`). | Delegar ao banco via `groupBy` ou raw SQL com `DATE(createdAt)`. |
| 6.5 | `backend/src/controllers/pedidosController.js:332-341` | **Baixa** | `resumo` faz 7 queries `count` separadas + 1 `aggregate`. Pode ser consolidado em uma única query com `groupBy status`. | Usar `groupBy` do Prisma para contar status em uma única query. |

---

## 7. Problemas de Autenticação / Autorização

| # | Arquivo (linha aprox.) | Severidade | Descrição | Recomendação |
|---|------------------------|------------|-----------|--------------|
| 7.1 | `backend/src/middleware/auth.js:93-120` | **Alta** | `csrfGuard` é exportado mas **quase nunca aplicado** nas rotas. Apenas `/api/auth/active-store` o usa. Rotas como `POST /api/pedidos`, `PUT /api/comercios/:slug`, `POST /api/upload` ficam desprotegidas. | Aplicar `csrfGuard` em todas as rotas mutantes (POST/PUT/PATCH/DELETE) que aceitam cookies. |
| 7.2 | `backend/src/middleware/auth.js:12-36` | **Média** | `auth` e `authByCookie` verificam a assinatura do JWT, mas **não verificam se o usuário ainda existe no banco** (usuário deletado/bloqueado ainda teria token válido). | Adicionar lookup `prisma.user.findUnique` no middleware `auth` para validar existência/atividade do usuário. |
| 7.3 | `backend/src/controllers/authController.js:294-321` | **Média** | `activeStore` permite troca de loja ativa sem verificar se `req.userTipo === 'comerciante'` (admin pode cair nessa rota desnecessariamente). | Adicionar `requireTipo('comerciante')` na rota ou verificar `req.userTipo` no controller. |
| 7.4 | `backend/src/controllers/authController.js:56-127` | **Baixa** | Registro permite senha de exatamente 6 caracteres (muito fraca) e não exige complexidade (letras + números). | Aumentar mínimo para 8-10 caracteres e exigir mix de letras/números (ou integrar HaveIBeenPwned). |
| 7.5 | `backend/src/controllers/authController.js:132-164` | **Baixa** | Login não implementa bloqueio de conta após múltiplas falhas (apenas rate limit por IP). | Adicionar contador de tentativas falhas no `User` e bloquear temporariamente após N tentativas. |

---

## 8. Vazamento de Dados Sensíveis

| # | Arquivo (linha aprox.) | Severidade | Descrição | Recomendação |
|---|------------------------|------------|-----------|--------------|
| 8.1 | `backend/.env` | **Crítica** | Vazamento de: `DATABASE_URL` (senha Supabase), `CLOUDINARY_API_SECRET`, `MERCADO_PAGO_ACCESS_TOKEN`, `JWT_SECRET`. | Rotacionar credenciais imediatamente; remover arquivo do histórico git; usar secrets manager. |
| 8.2 | `backend/src/server.js:170` | **Crítica** | Servidor estático na raiz expõe código-fonte completo, `.env`, schema Prisma, documentação interna (`docs/security-audit.md`), etc. | Restringir a pasta `public/` exclusivamente. |
| 8.3 | `backend/src/controllers/pedidosController.js:179-185` | **Alta** | `listar` e `buscarPorCodigo` retornam `email` e `telefone` do cliente para o comerciante. | Remover ou mascarar campos PII do cliente na resposta para comerciantes. |
| 8.4 | `backend/src/controllers/pedidosController.js:211-218` | **Alta** | `buscarPorCodigo` inclui `pagamento: true` completo (QR Code PIX, detalhes) para comerciante. | Selecionar apenas campos necessários (`status`, `metodo`, `valor`). |
| 8.5 | `backend/src/controllers/pagamentosController.js:296-317` | **Alta** | `consultarPagamento` retorna `pixQrCode` e `pixQrCodeBase64` para comerciante. | Filtrar objeto `pagamento` antes de responder baseado no papel do usuário. |
| 8.6 | `backend/src/seed.js:42-68` | **Média** | Senhas de seed (`admin123`, `demo123`) são impressas nos logs do console. | Remover logs de senhas. |

---

## 9. Outras Falhas Relevantes

| # | Arquivo (linha aprox.) | Severidade | Descrição | Recomendação |
|---|------------------------|------------|-----------|--------------|
| 9.1 | `backend/prisma/schema.prisma:22-52` | **Média** | `User` model armazena PII sensível (`cpf`, `cpfCnpj`, `enderecoComercial`, `telefone`) sem criptografia de campo (encryption at application level). | Avaliar criptografia de colunas sensíveis (ex: `@pgcrypto` ou campo criptografado na aplicação). |
| 9.2 | `backend/src/controllers/comerciosController.js:221-238` | **Média** | `criar` e `atualizar` não validam coordenadas geográficas (`lat`/`lng`). Podem ser inseridos valores fora do Brasil ou absurdos. | Validar range: lat `-90,90`, lng `-180,180`; opcionalmente validar proximidade de Boa Esperança do Sul. |
| 9.3 | `backend/src/controllers/authController.js:390-396` | **Baixa** | `atualizarPerfil` permite alterar senha sem exigir que a nova senha seja diferente da atual. | Verificar `novaSenha !== senhaAtual` e retornar erro apropriado. |
| 9.4 | `backend/src/controllers/authController.js:363` | **Baixa** | `atualizarPerfil` aceita qualquer string para `avatar`, sem validação de formato URL. | Validar com regex de URL HTTPS ou restringir a upload controlado. |
| 9.5 | `js/modules/cart.js:14-23` | **Baixa** | Carrinho permite adicionar o mesmo produto múltiplas vezes (por nome). O backend não consolida itens duplicados ao criar pedido. | Consolidar itens duplicados no frontend ou validar no backend. |
| 9.6 | `backend/src/controllers/pagamentosController.js:105-136` | **Média** | `back_urls` usam `FRONTEND_URL` sem trailing slash handling; se vazio, fallback para `localhost:5500` mesmo em produção. | Garantir que `FRONTEND_URL` esteja sempre configurado em produção; validar URL antes de usar. |
| 9.7 | `sw.js:1-92` | **Baixa** | Service Worker não implementa estratégia de atualização forçada nem notifica usuário quando nova versão está disponível. | Implementar `skipWaiting` + `clients.claim` com notificação de "Nova versão disponível, clique para atualizar". |

---

## Resumo por Categoria e Severidade

| Categoria | Crítica | Alta | Média | Baixa | Total |
|-----------|:-------:|:----:|:-----:|:-----:|:-----:|
| 1. Bugs / Erros Lógicos | 1 | 3 | 6 | 2 | 12 |
| 2. Falhas de Segurança | 2 | 5 | 5 | 2 | 14 |
| 3. Qualidade / Manutenibilidade | 0 | 2 | 4 | 3 | 9 |
| 4. Inconsistências Front/Back | 1 | 2 | 3 | 0 | 6 |
| 5. Tratamento de Erro | 0 | 1 | 2 | 1 | 4 |
| 6. Performance | 0 | 3 | 1 | 1 | 5 |
| 7. Auth / Autorização | 0 | 1 | 3 | 1 | 5 |
| 8. Vazamento de Dados | 2 | 3 | 1 | 0 | 6 |
| 9. Outras Falhas | 0 | 0 | 3 | 2 | 5 |
| **TOTAL** | **6** | **20** | **28** | **12** | **66** |

---

## Recomendações Prioritárias Imediatas

1. **Remover `express.static` da raiz** e criar uma pasta `public/` isolada.
2. **Rotacionar TODAS as credenciais** do `.env` e removê-lo do Git.
3. **Aplicar `csrfGuard` em todas as rotas mutantes** (POST/PUT/PATCH/DELETE).
4. **Implementar assinatura do webhook** do Mercado Pago.
5. **Integrar checkout do frontend com `POST /api/pedidos`** em vez de `localStorage`.
6. **Corrigir `API_BASE`** para detectar corretamente o ambiente de produção.
7. **Adicionar índices no schema Prisma** para todas as FKs e campos de filtro.
8. **Migrar campos monetários** de `Float` para `Decimal`.
9. **Filtrar dados sensíveis de pagamento** (`pixQrCode`, `detalhes`) nas respostas para comerciantes.