// ===== COMÉRCIO BES — CART MODULE =====
// Carrinho persistente (localStorage) + Drawer UI.

import { KEYS } from '../config.js';
import { storageGet, storageSet, escapeHTML, formatCurrency } from './utils.js';
import { mostrarToast } from './ui.js';

// ===== DADOS =====
export const Cart = {
  get() { return storageGet(KEYS.CART) || []; },

  save(cart) { storageSet(KEYS.CART, cart); },

  add(lojaId, lojaNome, lojaWhatsapp, produto, qtd) {
    const cart = this.get();
    const existing = cart.find(i => i.lojaId === lojaId && i.produto.nome_produto === produto.nome_produto);
    if (existing) {
      existing.qtd += qtd;
    } else {
      cart.push({ lojaId, lojaNome, lojaWhatsapp, produto, qtd });
    }
    this.save(cart);
    this.updateBadge();
  },

  remove(index) {
    const cart = this.get();
    cart.splice(index, 1);
    this.save(cart);
    this.updateBadge();
  },

  updateQtd(index, delta) {
    const cart = this.get();
    if (!cart[index]) return;
    cart[index].qtd = Math.max(1, cart[index].qtd + delta);
    this.save(cart);
    this.updateBadge();
  },

  clear() {
    localStorage.removeItem(KEYS.CART);
    this.updateBadge();
  },

  total() {
    return this.get().reduce((sum, i) => sum + (i.produto.preco * i.qtd), 0);
  },

  count() {
    return this.get().reduce((sum, i) => sum + i.qtd, 0);
  },

  updateBadge() {
    const badge = document.getElementById('cart-badge');
    const count = this.count();
    if (badge) {
      badge.textContent = count > 0 ? count : '';
      badge.style.display = count > 0 ? 'flex' : 'none';
    }
    const fab = document.getElementById('fab-cart');
    const fabBadge = document.getElementById('fab-cart-badge');
    if (fab) fab.style.display = count > 0 ? 'flex' : 'none';
    if (fabBadge) fabBadge.textContent = count;
  }
};

// ===== DRAWER UI =====

export function toggleCarrinhoDrawer() {
  const drawer = document.getElementById('cart-drawer');
  const overlay = document.getElementById('drawer-overlay');
  if (drawer.classList.contains('open')) {
    fecharCarrinhoDrawer();
  } else {
    renderCarrinhoDrawer();
    drawer.classList.add('open');
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

export function fecharCarrinhoDrawer() {
  document.getElementById('cart-drawer').classList.remove('open');
  document.getElementById('drawer-overlay').classList.remove('open');
  if (!document.querySelector('.modal-overlay.open, .auth-overlay.open, .checkout-overlay.open')) {
    document.body.style.overflow = '';
  }
}

export function renderCarrinhoDrawer() {
  const cart = Cart.get();
  const body = document.getElementById('drawer-body');
  const footer = document.getElementById('drawer-footer');

  if (cart.length === 0) {
    body.innerHTML = '<div class="drawer-empty"><p style="font-size:48px;margin-bottom:16px;">🛒</p><p>Seu carrinho está vazio</p><p style="font-size:13px;color:#aaa;margin-top:8px;">Adicione itens do cardápio das lojas</p></div>';
    footer.style.display = 'none';
    return;
  }

  const byStore = {};
  cart.forEach((item, idx) => {
    if (!byStore[item.lojaId]) {
      byStore[item.lojaId] = { nome: item.lojaNome, whatsapp: item.lojaWhatsapp, items: [] };
    }
    byStore[item.lojaId].items.push({ ...item, globalIdx: idx });
  });

  let html = '';
  Object.entries(byStore).forEach(([, store]) => {
    html += '<div class="drawer-store">';
    html += '<div class="drawer-store-name">' + escapeHTML(store.nome) + '</div>';
    store.items.forEach(item => {
      const subtotal = item.produto.preco * item.qtd;
      html += '<div class="drawer-item">' +
        '<div class="drawer-item-info">' +
          '<div class="drawer-item-name">' + escapeHTML(item.produto.nome_produto) + '</div>' +
          '<div class="drawer-item-price">R$ ' + formatCurrency(subtotal) + '</div>' +
        '</div>' +
        '<div class="drawer-item-controls">' +
          '<button class="qtd-btn-sm" onclick="cartUpdateQtd(' + parseInt(item.globalIdx) + ', -1)">−</button>' +
          '<span>' + parseInt(item.qtd) + '</span>' +
          '<button class="qtd-btn-sm" onclick="cartUpdateQtd(' + parseInt(item.globalIdx) + ', 1)">+</button>' +
          '<button class="drawer-remove" onclick="cartRemove(' + parseInt(item.globalIdx) + ')">🗑️</button>' +
        '</div>' +
      '</div>';
    });
    html += '</div>';
  });

  body.innerHTML = html;
  footer.style.display = 'block';
  document.getElementById('drawer-total').innerHTML = '<strong>Total: R$ ' + formatCurrency(Cart.total()) + '</strong>';
}

export function cartUpdateQtd(idx, delta) {
  Cart.updateQtd(idx, delta);
  renderCarrinhoDrawer();
}

export function cartRemove(idx) {
  Cart.remove(idx);
  renderCarrinhoDrawer();
}

// enviarTudoWhatsApp vive em checkout.js para evitar dependência circular
export function abrirCarrinhoVazio() {
  mostrarToast('🛒 Carrinho vazio!');
}
