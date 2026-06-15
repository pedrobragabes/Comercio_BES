// ===== COMÉRCIO BES — RENDER: ORDERS UI =====

import { Auth } from '../modules/auth.js';
import { Orders } from '../modules/orders.js';
import { escapeHTML, formatCurrency } from '../modules/utils.js';
import { fecharContaMenu, abrirAuth } from '../modules/auth-ui.js';

export function abrirPedidos() {
  fecharContaMenu();
  if (!Auth.isLoggedIn()) { abrirAuth(); return; }

  const orders = Orders.get();
  const container = document.getElementById('orders-list');

  if (orders.length === 0) {
    container.innerHTML = '<div class="drawer-empty"><p style="font-size:48px;margin-bottom:16px;">📋</p><p>Nenhum pedido ainda</p></div>';
  } else {
    container.innerHTML = orders.map(o => {
      const data = new Date(o.criadoEm);
      const dataStr = data.toLocaleDateString('pt-BR') + ' ' + data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const statusCor = o.status === 'pendente' ? '#EA580C' : o.status === 'confirmado' ? '#10B981' : '#aaa';
      return '<div class="order-card">' +
        '<div class="order-header">' +
          '<strong>' + escapeHTML(o.id) + '</strong>' +
          '<span class="order-status" style="color:' + statusCor + '">' + escapeHTML(o.status).toUpperCase() + '</span>' +
        '</div>' +
        '<div class="order-date">' + escapeHTML(dataStr) + '</div>' +
        '<div class="order-items">' +
          o.items.map(i => '<div>' + parseInt(i.qtd) + 'x ' + escapeHTML(i.produto.nome_produto) + ' <span style="color:#aaa">(' + escapeHTML(i.lojaNome) + ')</span></div>').join('') +
        '</div>' +
        '<div class="order-total">Total: R$ ' + formatCurrency(o.total) + '</div>' +
        '<div class="order-payment">Pagamento: ' + escapeHTML(o.pagamento) + '</div>' +
      '</div>';
    }).join('');
  }

  document.getElementById('orders-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

export function fecharPedidos(e) {
  if (e && e.target !== document.getElementById('orders-overlay')) return;
  document.getElementById('orders-overlay').classList.remove('open');
  document.body.style.overflow = '';
}
