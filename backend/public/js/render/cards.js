// ===== COMÉRCIO BES — RENDER: CARDS =====
// Circular com modules/search.js — seguro (só em function bodies).

import { ITEMS_POR_PAGINA } from '../config.js';
import { escapeHTML, gerarStars, formatCurrency } from '../modules/utils.js';
import { Favorites } from '../modules/favorites.js';
import { observarLazyImages } from '../modules/ui.js';
import { state } from '../modules/state.js';
import { filtrarPorCategoria } from '../modules/search.js';

export function criarCard(c) {
  const stars = gerarStars(c.rating);
  const openBadge = c.aberto
    ? '<span class="store-open">✓ Aberto</span>'
    : '<span class="store-open store-closed">✗ Fechado</span>';
  const destaqueBadge = c.destaque ? '<span class="store-destaque">Destaque</span>' : '';
  const temCatalogo = c.catalogo && c.catalogo.length > 0;
  const isFav = Favorites.isFav(c.id);
  const heroFoto = (c.fotos || []).find(f => f.startsWith('http') || f.startsWith('/'));
  const imgStyle = heroFoto ? ' style="background-image:url(' + heroFoto + ');background-size:cover;background-position:center;"' : '';

  return '<div class="store-card' + (c.destaque ? ' store-card-destaque' : '') + '" onclick="abrirModal(' + parseInt(c.id) + ')">' +
    '<div class="store-img"' + imgStyle + '>' +
      (heroFoto ? '' : '<span>' + escapeHTML(c.emoji) + '</span>') +
      destaqueBadge +
      openBadge +
    '</div>' +
    '<div class="store-body">' +
      '<div class="store-cat">' + escapeHTML(c.categoria).toUpperCase() + '</div>' +
      '<div class="store-name-row">' +
        '<div class="store-name">' + escapeHTML(c.nome) + '</div>' +
        '<button class="card-fav ' + (isFav ? 'active' : '') + '" onclick="event.stopPropagation(); toggleFavoritoCard(' + parseInt(c.id) + ', this)" aria-label="Favoritar">' + (isFav ? '♥' : '♡') + '</button>' +
      '</div>' +
      '<div class="store-addr">' + escapeHTML(c.endereco) + '</div>' +
      '<div class="store-stars">' + stars +
        '<span class="store-rating-num">' + escapeHTML(String(c.rating)) + '</span>' +
        '<span class="store-reviews">(' + parseInt(c.visitas) + ' visitas)</span>' +
      '</div>' +
      '<div class="store-actions">' +
        '<a class="btn-whats" href="https://wa.me/' + encodeURIComponent(c.whatsapp) + '?text=' + encodeURIComponent('Olá! Encontrei seu comércio no Comércio BES. Gostaria de mais informações!') + '" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation(); registrarEstatistica(' + parseInt(c.id) + ',\'whatsapp_click\')">WhatsApp</a>' +
        (temCatalogo ? '<button class="btn-catalogo" onclick="event.stopPropagation(); abrirModal(' + parseInt(c.id) + ')">Cardápio</button>' : '') +
        '<button class="btn-perfil" onclick="event.stopPropagation(); abrirModal(' + parseInt(c.id) + ')">Ver</button>' +
      '</div>' +
    '</div>' +
  '</div>';
}

export function renderizarCards(lista) {
  const totalPaginas = Math.ceil(lista.length / ITEMS_POR_PAGINA);
  if (state.paginaAtual > totalPaginas) state.paginaAtual = totalPaginas || 1;
  const inicio = (state.paginaAtual - 1) * ITEMS_POR_PAGINA;
  const paginados = lista.slice(inicio, inicio + ITEMS_POR_PAGINA);
  const grid = document.getElementById('main-grid');
  grid.innerHTML = paginados.map(criarCard).join('');
  grid.classList.add('fade-in');
  setTimeout(() => grid.classList.remove('fade-in'), 400);
  renderPaginacao(totalPaginas);
  observarLazyImages();
}

export function renderPaginacao(totalPaginas) {
  const container = document.getElementById('pagination');
  if (!container || totalPaginas <= 1) {
    if (container) container.innerHTML = '';
    return;
  }
  let html = '';
  html += '<button class="page-btn" ' + (state.paginaAtual <= 1 ? 'disabled' : '') + ' onclick="irPagina(' + (state.paginaAtual - 1) + ')">← Anterior</button>';
  for (let i = 1; i <= totalPaginas; i++) {
    html += '<button class="page-num ' + (i === state.paginaAtual ? 'active' : '') + '" onclick="irPagina(' + i + ')">' + i + '</button>';
  }
  html += '<button class="page-btn" ' + (state.paginaAtual >= totalPaginas ? 'disabled' : '') + ' onclick="irPagina(' + (state.paginaAtual + 1) + ')">Próxima →</button>';
  container.innerHTML = html;
}

export function irPagina(n) {
  state.paginaAtual = n;
  renderizarCards(filtrarPorCategoria(state.categoriaAtiva));
  document.querySelector('.listings-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
