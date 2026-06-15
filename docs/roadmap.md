# Roadmap Restrito

Este roadmap substitui a lista ampla anterior. O objetivo é lançar uma versão pequena, confiável e útil.

## Fase 0 - Preparação técnica

Status: em andamento.

- [x] Express servindo apenas assets públicos, sem expor raiz do repositório.
- [x] Prisma alinhado com PostgreSQL.
- [x] `.env.example` reduzido ao necessário.
- [x] `API_BASE` com suporte a override por `window.BES_API_BASE`.
- [ ] Conferir se nenhuma credencial real ficou no histórico remoto.
- [ ] Rotacionar segredos se algum `.env` antigo já foi enviado ao GitHub.

## Fase 1 - Lançamento guia comercial

Objetivo: publicar o guia e começar uso real.

- [ ] Homologar deploy Hostinger + Supabase.
- [ ] Validar domínio, HTTPS e CORS.
- [ ] Cadastrar lojas reais prioritárias.
- [ ] Revisar telefones/WhatsApp, horários, categorias e fotos.
- [ ] Rodar smoke test: home, busca, loja, mapa, WhatsApp, login, painel.
- [ ] Definir texto público: "pedido via WhatsApp" enquanto pedido backend não estiver integrado no fluxo principal.

## Fase 2 - Pedidos reais no backend

Objetivo: tirar pedido do `localStorage` e gravar no banco.

- [ ] Integrar checkout público com `POST /api/pedidos`.
- [ ] Sincronizar "Meus Pedidos" com `GET /api/pedidos`.
- [ ] Criar/selecionar endereço de entrega antes do pedido.
- [ ] Garantir que pedido por WhatsApp e pedido backend não dupliquem o fluxo.
- [ ] Filtrar dados sensíveis de cliente/pagamento por role.
- [ ] Adicionar teste automatizado do fluxo de pedido.

## Fase 3 - Segurança mínima de produção

Objetivo: reduzir risco antes de crescer.

- [ ] Aplicar CSRF em todas as rotas mutantes autenticadas por cookie.
- [ ] Melhorar middleware de auth para validar usuário ativo no banco.
- [ ] Adicionar índices Prisma em FKs e campos de filtro.
- [ ] Trocar valores monetários de `Float` para `Decimal`.
- [ ] Validar URLs de imagem/avatar/fotos.
- [ ] Adicionar rotina de backup/restore do banco.

## Fase 4 - Pagamentos PIX

Só começa depois da Fase 2.

- [ ] Testar Mercado Pago sandbox ponta a ponta.
- [ ] Implementar assinatura do webhook.
- [ ] Persistir eventos de webhook para reprocessamento.
- [ ] Criar UI pública do pagamento.
- [ ] Definir processo operacional para pagamento aprovado, recusado e estorno.

## Depois do lançamento

Backlog, não indispensável agora:

- Cupons.
- Notificações push.
- Delivery tracking.
- Premium para lojistas.
- App nativo.
- Migração para framework frontend.
