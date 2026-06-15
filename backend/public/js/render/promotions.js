// ===== COMÉRCIO BES — RENDER: PROMOTIONS =====

import { escapeHTML } from '../modules/utils.js';
import { state } from '../modules/state.js';

export function renderPromos() {
  const promos = state.comercios.filter(c => c.promo && c.promo.ativo);
  document.getElementById('promos-grid').innerHTML = promos.map(c =>
    '<div class="promo-card" onclick="abrirModal(' + parseInt(c.id) + ')">' +
      '<div class="promo-badge">🔥 Promoção</div>' +
      '<div class="promo-store">' + escapeHTML(c.emoji) + ' ' + escapeHTML(c.nome) + '</div>' +
      '<div class="promo-desc">' + escapeHTML(c.promo.desc) + '</div>' +
      '<div><span class="promo-price">' + escapeHTML(c.promo.preco) + '</span>' +
      '<span class="promo-original">' + escapeHTML(c.promo.original) + '</span></div>' +
    '</div>'
  ).join('');
}

export function renderRanking(tipo) {
  let ordenados = [...state.comercios];
  if (tipo === 'rating') ordenados.sort((a, b) => b.rating - a.rating);
  if (tipo === 'visitas') ordenados.sort((a, b) => b.visitas - a.visitas);
  if (tipo === 'recomendados') ordenados.sort((a, b) => b.recomendados - a.recomendados);
  ordenados = ordenados.slice(0, 8);

  document.getElementById('ranking-list').innerHTML = ordenados.map((c, i) => {
    const cls = i === 0 ? 'top1' : i === 1 ? 'top2' : i === 2 ? 'top3' : '';
    const val = tipo === 'rating' ? escapeHTML(String(c.rating)) + ' ⭐'
      : tipo === 'visitas' ? parseInt(c.visitas) + ' visitas'
      : parseInt(c.recomendados) + ' ❤️';
    return '<div class="ranking-item" onclick="abrirModal(' + parseInt(c.id) + ')">' +
      '<div class="rank-num ' + cls + '">' + (i + 1) + '°</div>' +
      '<div class="rank-emoji">' + escapeHTML(c.emoji) + '</div>' +
      '<div class="rank-info"><div class="rank-name">' + escapeHTML(c.nome) + '</div>' +
      '<div class="rank-cat">' + escapeHTML(c.categoria.charAt(0).toUpperCase() + c.categoria.slice(1)) + '</div></div>' +
      '<div class="rank-score"><strong>' + val + '</strong><span>ranking</span></div></div>';
  }).join('');
}
