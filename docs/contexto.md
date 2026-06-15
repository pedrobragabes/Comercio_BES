# Contexto do Projeto

## Objetivo

Comércio BES é um guia comercial local para Boa Esperança do Sul - SP. A primeira entrega pública deve resolver descoberta e contato com comércios locais, não competir com iFood, Mercado Livre ou apps de delivery.

## Escopo de lançamento

Incluído no lançamento inicial:

- Listagem de comércios.
- Busca por nome, categoria e tags.
- Página/modal de loja com endereço, horário, mapa, telefone, WhatsApp e fotos.
- Catálogo simples de produtos quando a loja tiver itens cadastrados.
- Pedido leve via WhatsApp.
- Favoritos e PWA.
- Login/cadastro.
- Painel único em `/minha-conta` para cliente, comerciante e admin.
- Backend hospedado em ambiente público.
- Banco PostgreSQL gerenciado.

Fora do lançamento inicial:

- PIX obrigatório.
- Cupons.
- Notificações push.
- Rastreamento em tempo real.
- Plano premium.
- App nativo.
- Migração para React/Next.

## Verdades técnicas atuais

- Frontend é HTML/CSS/JS vanilla.
- Backend é Express.
- Prisma está configurado para PostgreSQL.
- O painel legado `/admin` e `/painel` redireciona para `/minha-conta`.
- O frontend principal ainda mantém pedidos locais em `localStorage`; isso precisa ser corrigido antes de vender como pedido backend.
- O backend já possui rotas de pedidos e pagamentos, mas PIX ainda precisa homologação completa.
- Upload local serve para dev/homologação; produção deve usar Cloudinary ou outro storage externo.

## Decisão de arquitetura

Recomendado agora:

- Hostinger Node.js App para frontend + API.
- Supabase PostgreSQL para banco.
- Cloudinary para imagens quando houver lojas reais com fotos.

Não recomendado:

- API de produção rodando no PC local.
- SQLite em produção.
- Ativar pagamentos antes de fechar checkout, webhook e testes sandbox.

## Critério de pronto para lançar

O projeto pode ir ao ar quando:

- O site público carrega da URL final.
- Login e cadastro funcionam.
- Admin consegue entrar em `/minha-conta`.
- Loja real tem dados, fotos e WhatsApp validados.
- Pedido do usuário não fica apenas no navegador, ou o produto é anunciado claramente como pedido via WhatsApp.
- Banco está em Supabase com backup.
- `.env` não está versionado e segredos estão no hPanel.
- Testes backend passam.
- Há smoke test manual documentado.
