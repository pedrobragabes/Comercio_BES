// ===== COMÉRCIO BES — RENDER: MODAL =====
// Perfil da loja, catálogo, avaliação e carrinho modal.

import { escapeHTML, gerarStars, formatCurrency } from '../modules/utils.js';
import { registrarEstatistica, enviarAvaliacaoApi } from '../modules/api.js';
import { Auth } from '../modules/auth.js';
import { Cart } from '../modules/cart.js';
import { Favorites } from '../modules/favorites.js';
import { mostrarToast } from '../modules/ui.js';
import { abrirCheckout } from '../modules/checkout.js';
import { state } from '../modules/state.js';
import { GOOGLE_MAPS_KEY } from '../config.js';

// ===== STATE LOCAL =====
let avaliacao = 0;
let carrinhoModal = {};
let lightboxFotos = [];
let lightboxIdx = 0;

// ===== ABERTURA / FECHAMENTO =====

export function abrirModal(id) {
  const c = state.comercios.find(x => x.id === id);
  if (!c) return;
  state.comercioAtual = c;
  avaliacao = 0;
  carrinhoModal = {};
  resetStars();

  registrarEstatistica(c.id, 'visita');

  // Hero foto ou emoji no cabeçalho
  const modalImgEl = document.getElementById('modal-img');
  const heroFoto = (c.fotos || []).find(f => f.startsWith('http') || f.startsWith('/'));
  if (heroFoto) {
    modalImgEl.style.backgroundImage = 'url(' + heroFoto + ')';
    modalImgEl.classList.add('has-photo');
    document.getElementById('modal-emoji').style.display = 'none';
  } else {
    modalImgEl.style.backgroundImage = '';
    modalImgEl.classList.remove('has-photo');
    document.getElementById('modal-emoji').style.display = '';
    document.getElementById('modal-emoji').textContent = c.emoji;
  }
  document.getElementById('modal-cat').textContent = c.categoria.toUpperCase();
  document.getElementById('modal-name').textContent = c.nome;

  const favBtn = document.getElementById('modal-fav');
  if (favBtn) {
    const isFav = Favorites.isFav(c.id);
    favBtn.textContent = isFav ? '♥' : '♡';
    favBtn.classList.toggle('active', isFav);
  }

  document.getElementById('modal-info').innerHTML =
    '<div class="modal-info-row"><span class="modal-info-icon">📍</span> ' + escapeHTML(c.endereco) + '</div>' +
    '<div class="modal-info-row"><span class="modal-info-icon">🕐</span> ' + escapeHTML(c.horario) + '</div>' +
    '<div class="modal-info-row"><span class="modal-info-icon">📞</span> ' + escapeHTML(c.tel.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')) + '</div>' +
    '<div class="modal-info-row"><span class="modal-info-icon">' + (c.aberto ? '✅' : '❌') + '</span> ' + (c.aberto ? 'Aberto agora' : 'Fechado no momento') + '</div>' +
    (c.promo ? '<div class="modal-info-row"><span class="modal-info-icon">🔥</span> <strong>Promoção:</strong>&nbsp;' + escapeHTML(c.promo.desc) + ' — ' + escapeHTML(c.promo.preco) + '</div>' : '');

  document.getElementById('modal-stars-big').innerHTML =
    gerarStars(c.rating) +
    '<span class="modal-rating-big">' + escapeHTML(String(c.rating)) + '</span>' +
    '<span style="font-size:14px;color:#aaa;margin-left:8px;">(' + parseInt(c.visitas) + ' avaliações)</span>';

  // Fotos — detecta URL real vs emoji placeholder
  lightboxFotos = (c.fotos || []).filter(f => f.startsWith('http') || f.startsWith('/'));
  document.getElementById('modal-fotos').innerHTML = (c.fotos || []).map((f, idx) => {
    const isUrl = f.startsWith('http') || f.startsWith('/');
    return '<div class="foto-thumb" ' + (isUrl ? 'onclick="abrirLightbox(' + idx + ')"' : '') + '>' +
      (isUrl
        ? '<img src="' + escapeHTML(f) + '" alt="Foto ' + (idx + 1) + '" loading="lazy">'
        : '<span class="foto-emoji">' + escapeHTML(f) + '</span>'
      ) +
    '</div>';
  }).join('');

  // Mapa embed — Google Maps (se tiver key) ou OpenStreetMap (gratuito)
  const mapaEl = document.getElementById('modal-mapa');
  if (c.lat && c.lng) {
    const embedSrc = GOOGLE_MAPS_KEY
      ? 'https://www.google.com/maps/embed/v1/view?key=' + encodeURIComponent(GOOGLE_MAPS_KEY) + '&center=' + c.lat + ',' + c.lng + '&zoom=17'
      : 'https://www.openstreetmap.org/export/embed.html?bbox=' + (c.lng - 0.003) + ',' + (c.lat - 0.003) + ',' + (c.lng + 0.003) + ',' + (c.lat + 0.003) + '&layer=mapnik&marker=' + c.lat + ',' + c.lng;
    mapaEl.innerHTML =
      '<div class="modal-mapa-wrap">' +
        '<iframe src="' + embedSrc + '" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Localização da loja"></iframe>' +
      '</div>';
  } else {
    mapaEl.innerHTML = '';
  }

  const catalogoContainer = document.getElementById('modal-catalogo');
  if (c.catalogo && c.catalogo.length > 0) {
    catalogoContainer.style.display = 'block';
    catalogoContainer.innerHTML =
      '<hr class="modal-divider">' +
      '<p style="font-family:\'Plus Jakarta Sans\',sans-serif;font-weight:700;font-size:17px;margin-bottom:16px;">Cardápio / Produtos</p>' +
      '<div class="catalogo-lista">' +
        c.catalogo.map((prod, idx) =>
          '<div class="catalogo-item">' +
            '<div class="catalogo-item-info">' +
              '<div class="catalogo-item-name">' + escapeHTML(prod.nome_produto) + '</div>' +
              '<div class="catalogo-item-desc">' + escapeHTML(prod.descricao) + '</div>' +
              '<div class="catalogo-item-price">R$ ' + formatCurrency(prod.preco) + '</div>' +
            '</div>' +
            '<div class="catalogo-qty">' +
              '<button onclick="alterarQtdModal(' + idx + ',-1)">−</button>' +
              '<span id="qtd-' + idx + '">0</span>' +
              '<button onclick="alterarQtdModal(' + idx + ',1)">+</button>' +
            '</div>' +
          '</div>'
        ).join('') +
      '</div>' +
      '<div class="carrinho-resumo" id="carrinho-resumo" style="display:none;">' +
        '<div class="carrinho-total" id="carrinho-total"></div>' +
        '<div class="carrinho-actions">' +
          '<button class="btn-add-cart" onclick="adicionarAoCarrinho()">Adicionar ao Carrinho</button>' +
          '<button class="btn-enviar-pedido" onclick="enviarPedidoWhatsApp()">Enviar via WhatsApp</button>' +
        '</div>' +
      '</div>';
  } else {
    catalogoContainer.style.display = 'none';
    catalogoContainer.innerHTML = '';
  }

  document.getElementById('modal-actions').innerHTML =
    '<a class="btn-whats-big" href="https://wa.me/' + encodeURIComponent(c.whatsapp) + '?text=' + encodeURIComponent('Olá! Encontrei seu comércio no Comércio BES. Gostaria de mais informações!') + '" target="_blank" rel="noopener noreferrer" onclick="registrarEstatistica(' + parseInt(c.id) + ',\'whatsapp_click\')">Falar no WhatsApp</a>' +
    '<a class="btn-maps" href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(c.lat + ',' + c.lng) + '" target="_blank" rel="noopener noreferrer">Ver no Mapa</a>' +
    '<button class="btn-compartilhar" onclick="copiarLinkLoja(\'' + escapeHTML(c.slug) + '\')">Compartilhar Loja</button>';

  document.getElementById('modal-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

export function fecharModal(e) {
  if (e && e.target !== document.getElementById('modal-overlay')) return;
  document.getElementById('modal-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

// ===== CARRINHO MODAL =====

export function alterarQtdModal(idx, delta) {
  const atual = carrinhoModal[idx] || 0;
  const novo = Math.max(0, atual + delta);
  carrinhoModal[idx] = novo;
  const el = document.getElementById('qtd-' + idx);
  if (el) el.textContent = novo;
  atualizarResumoModal();
}

function atualizarResumoModal() {
  if (!state.comercioAtual || !state.comercioAtual.catalogo) return;
  const itens = Object.entries(carrinhoModal)
    .filter(([, qtd]) => qtd > 0)
    .map(([idx, qtd]) => ({ produto: state.comercioAtual.catalogo[parseInt(idx)], qtd }));

  const resumoEl = document.getElementById('carrinho-resumo');
  const totalEl = document.getElementById('carrinho-total');
  if (itens.length === 0) { resumoEl.style.display = 'none'; return; }

  const total = itens.reduce((sum, i) => sum + (i.produto.preco * i.qtd), 0);
  resumoEl.style.display = 'block';
  totalEl.innerHTML = '<strong>' + itens.length + ' ' + (itens.length === 1 ? 'item' : 'itens') + '</strong> · Total: <strong>R$ ' + formatCurrency(total) + '</strong>';
}

function mostrarAuthGateModal() {
  const container = document.getElementById('modal-catalogo');
  if (!container) return;
  const existing = document.getElementById('auth-gate-modal');
  if (existing) { existing.classList.add('visible'); existing.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); return; }

  const gate = document.createElement('div');
  gate.id = 'auth-gate-modal';
  gate.className = 'auth-gate-modal';
  gate.innerHTML =
    '<p class="auth-gate-title">Faça login para fazer pedidos</p>' +
    '<p class="auth-gate-sub">Crie sua conta gratuita em menos de 1 minuto</p>' +
    '<a href="html/cadastro.html" class="auth-gate-btn-create" onclick="localStorage.setItem(\'bes_cart_pending\',\'1\')">Criar conta gratuita</a>' +
    '<a href="html/login.html" class="auth-gate-btn-login" onclick="localStorage.setItem(\'bes_cart_pending\',\'1\')">Já tenho conta · Entrar</a>';
  container.appendChild(gate);
  requestAnimationFrame(() => gate.classList.add('visible'));
  gate.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

export function adicionarAoCarrinho() {
  if (!state.comercioAtual || !state.comercioAtual.catalogo) return;
  if (!Auth.isLoggedIn()) { mostrarAuthGateModal(); return; }

  const itens = Object.entries(carrinhoModal)
    .filter(([, qtd]) => qtd > 0)
    .map(([idx, qtd]) => ({ produto: state.comercioAtual.catalogo[parseInt(idx)], qtd }));

  if (itens.length === 0) { mostrarToast('🛒 Selecione pelo menos um item!'); return; }

  itens.forEach(i => {
    Cart.add(state.comercioAtual.id, state.comercioAtual.nome, state.comercioAtual.whatsapp, i.produto, i.qtd);
  });

  mostrarToast('✅ ' + itens.length + ' item(ns) adicionado(s) ao carrinho!');
  carrinhoModal = {};
  state.comercioAtual.catalogo.forEach((_, idx) => {
    const el = document.getElementById('qtd-' + idx);
    if (el) el.textContent = '0';
  });
  atualizarResumoModal();
}

export function enviarPedidoWhatsApp() {
  if (!state.comercioAtual || !state.comercioAtual.catalogo) return;
  if (!Auth.isLoggedIn()) { mostrarAuthGateModal(); return; }

  const produtos = Object.entries(carrinhoModal)
    .filter(([, qtd]) => qtd > 0)
    .map(([idx, qtd]) => ({ produto: state.comercioAtual.catalogo[parseInt(idx)], qtd }));

  if (produtos.length === 0) { mostrarToast('🛒 Selecione pelo menos um item!'); return; }

  produtos.forEach(i => {
    Cart.add(state.comercioAtual.id, state.comercioAtual.nome, state.comercioAtual.whatsapp, i.produto, i.qtd);
  });
  carrinhoModal = {};
  state.comercioAtual.catalogo.forEach((_, idx) => {
    const el = document.getElementById('qtd-' + idx);
    if (el) el.textContent = '0';
  });
  atualizarResumoModal();
  fecharModal();
  abrirCheckout();
  mostrarToast('📋 Preencha seus dados e clique em "Enviar via WhatsApp".');
}

// ===== LIGHTBOX =====

export function abrirLightbox(idx) {
  if (!lightboxFotos.length) return;
  lightboxIdx = idx;
  _renderLightbox();
  document.getElementById('lightbox-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

export function fecharLightbox() {
  document.getElementById('lightbox-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

export function navLightbox(dir) {
  lightboxIdx = (lightboxIdx + dir + lightboxFotos.length) % lightboxFotos.length;
  _renderLightbox();
}

function _renderLightbox() {
  document.getElementById('lightbox-img').src = lightboxFotos[lightboxIdx];
  document.getElementById('lightbox-counter').textContent =
    (lightboxIdx + 1) + ' / ' + lightboxFotos.length;
}

// ===== AVALIAÇÃO =====

export function avaliar(val) {
  avaliacao = val;
  document.querySelectorAll('.review-star').forEach((s, i) => {
    s.classList.toggle('active', i < val);
  });
}

export function resetStars() {
  document.querySelectorAll('.review-star').forEach(s => s.classList.remove('active'));
}

export async function enviarAvaliacao() {
  if (avaliacao === 0) { mostrarToast('⭐ Selecione uma nota antes de enviar!'); return; }

  const comentario = document.querySelector('.review-input').value.trim();

  if (state.apiDisponivel && state.comercioAtual.slug) {
    try {
      const data = await enviarAvaliacaoApi(
        state.comercioAtual.slug, avaliacao, comentario, Auth.getToken()
      );
      state.comercioAtual.rating = data.mediaAtual;
      state.comercioAtual.totalAvaliacoes = data.totalAvaliacoes;
      document.getElementById('modal-stars-big').innerHTML =
        gerarStars(data.mediaAtual) +
        '<span class="modal-rating-big">' + escapeHTML(String(data.mediaAtual)) + '</span>' +
        '<span style="font-size:14px;color:#aaa;margin-left:8px;">(' + parseInt(data.totalAvaliacoes) + ' avaliações)</span>';
      mostrarToast('✅ Avaliação de ' + avaliacao + '★ enviada para ' + state.comercioAtual.nome + '!');
    } catch (err) {
      console.error('Erro ao enviar avaliação:', err);
      mostrarToast('❌ Erro ao enviar avaliação: ' + err.message);
      return;
    }
  } else {
    mostrarToast('✅ Avaliação de ' + avaliacao + '★ enviada para ' + state.comercioAtual.nome + '!');
  }

  resetStars();
  avaliacao = 0;
  document.querySelector('.review-input').value = '';
}
