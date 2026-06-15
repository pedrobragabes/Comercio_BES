// ===== COMÉRCIO BES — CHECKOUT MODULE =====

import { Auth } from './auth.js';
import { Cart, fecharCarrinhoDrawer, renderCarrinhoDrawer } from './cart.js';
import { Orders } from './orders.js';
import { escapeHTML, formatCurrency } from './utils.js';
import { mostrarToast } from './ui.js';
import { abrirAuth } from './auth-ui.js';

// ===== WHATSAPP LINK =====

export function gerarLinkWhatsApp(loja, produtosSelecionados, cliente) {
  const nome = cliente && cliente.nome ? cliente.nome : (Auth.getUser()?.nome || 'Cliente');
  let texto = 'Olá meu nome é ' + nome + ' vim pelo ComércioBes! e gostaria de fazer um pedido:\n';
  texto += '======================\n';
  let total = 0;
  produtosSelecionados.forEach(item => {
    total += item.produto.preco * item.qtd;
    texto += '- ' + item.qtd + 'x ' + item.produto.nome_produto + '\n';
  });
  texto += '======================\n';
  if (cliente && cliente.rua) {
    texto += cliente.rua + '\n';
    texto += (cliente.bairro || '') + '\n';
    const compNum = ((cliente.complemento || '') + ' ' + (cliente.numero || '')).trim();
    if (compNum) texto += compNum + '\n';
    if (cliente.referencia) texto += cliente.referencia + '\n';
  }
  texto += '=========================\n';
  texto += 'Total: R$' + formatCurrency(total);
  return 'https://wa.me/' + encodeURIComponent(loja.whatsapp) + '?text=' + encodeURIComponent(texto);
}

// ===== CHECKOUT OVERLAY =====

export function abrirCheckout() {
  if (!Auth.isLoggedIn()) {
    mostrarToast('👤 Faça login para finalizar o pedido.');
    abrirAuth();
    return;
  }
  const cart = Cart.get();
  if (cart.length === 0) { mostrarToast('🛒 Carrinho vazio!'); return; }

  fecharCarrinhoDrawer();

  const user = Auth.getUser();
  if (user) {
    document.getElementById('checkout-nome').value = user.nome || '';
    document.getElementById('checkout-tel').value = user.tel || '';
    ['checkout-rua', 'checkout-numero', 'checkout-bairro', 'checkout-complemento', 'checkout-referencia']
      .forEach(id => { document.getElementById(id).value = ''; });
  }

  let html = '';
  cart.forEach(item => {
    html += '<div class="checkout-item">' +
      '<span>' + parseInt(item.qtd) + 'x ' + escapeHTML(item.produto.nome_produto) + '</span>' +
      '<span>R$ ' + formatCurrency(item.produto.preco * item.qtd) + '</span>' +
    '</div>';
  });
  document.getElementById('checkout-items').innerHTML = html;
  document.getElementById('checkout-total').innerHTML = '<strong>Total: R$ ' + formatCurrency(Cart.total()) + '</strong>';

  document.getElementById('checkout-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

export function fecharCheckout(e) {
  if (e && e.target !== document.getElementById('checkout-overlay')) return;
  document.getElementById('checkout-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

function getCheckoutCliente() {
  const nome = document.getElementById('checkout-nome').value.trim();
  const rua = document.getElementById('checkout-rua').value.trim();
  const numero = document.getElementById('checkout-numero').value.trim();
  const bairro = document.getElementById('checkout-bairro').value.trim();
  const complemento = document.getElementById('checkout-complemento').value.trim();
  const referencia = document.getElementById('checkout-referencia').value.trim();
  const tel = document.getElementById('checkout-tel').value.trim();
  const pagamento = document.getElementById('checkout-pagamento').value;
  const obs = document.getElementById('checkout-obs').value.trim();

  if (!nome || !rua || !numero || !bairro || !tel) {
    mostrarToast('⚠️ Preencha todos os campos obrigatórios.');
    return null;
  }
  return { nome, rua, numero, bairro, complemento, referencia, tel, pagamento, obs };
}

export function confirmarPedido(e) {
  if (e) e.preventDefault();
  const cliente = getCheckoutCliente();
  if (!cliente) return false;

  const cart = Cart.get();
  const endereco = cliente.rua + ', ' + cliente.numero + ' - ' + cliente.bairro +
    (cliente.complemento ? ' (' + cliente.complemento + ')' : '') +
    (cliente.referencia ? ' · Ref: ' + cliente.referencia : '');

  const order = Orders.create({
    items: cart,
    total: Cart.total(),
    cliente: { nome: cliente.nome, endereco, tel: cliente.tel },
    pagamento: cliente.pagamento,
    obs: cliente.obs,
    userId: Auth.getSession()?.userId
  });

  Cart.clear();
  fecharCheckout();
  renderCarrinhoDrawer();
  mostrarToast('✅ Pedido ' + order.id + ' confirmado com sucesso!');
  return false;
}

export function confirmarPedidoWhatsApp() {
  const cliente = getCheckoutCliente();
  if (!cliente) return;

  const cart = Cart.get();
  const byStore = {};
  cart.forEach(item => {
    if (!byStore[item.lojaId]) byStore[item.lojaId] = { whatsapp: item.lojaWhatsapp, items: [] };
    byStore[item.lojaId].items.push(item);
  });

  Object.values(byStore).forEach(store => {
    const link = gerarLinkWhatsApp(
      { whatsapp: store.whatsapp },
      store.items.map(i => ({ produto: i.produto, qtd: i.qtd })),
      cliente
    );
    window.open(link, '_blank', 'noopener,noreferrer');
  });

  const endereco = cliente.rua + ', ' + cliente.numero + ' - ' + cliente.bairro;
  Orders.create({
    items: cart, total: Cart.total(),
    cliente: { nome: cliente.nome, endereco, tel: cliente.tel },
    pagamento: cliente.pagamento, obs: cliente.obs,
    userId: Auth.getSession()?.userId
  });

  Cart.clear();
  fecharCheckout();
  renderCarrinhoDrawer();
  mostrarToast('✅ Pedido enviado via WhatsApp!');
}

export function enviarTudoWhatsApp() {
  const cart = Cart.get();
  if (cart.length === 0) { mostrarToast('🛒 Carrinho vazio!'); return; }
  abrirCheckout();
  mostrarToast('📋 Preencha seus dados e clique em "Enviar via WhatsApp".');
}
