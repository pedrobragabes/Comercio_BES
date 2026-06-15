// ===== COMÉRCIO BES — SEARCH MODULE =====
// Filtros, busca e ordenação. Circular com render/cards.js — seguro (só em function bodies).

import { state } from './state.js';
import { renderizarCards, criarCard } from '../render/cards.js';
import { renderRanking } from '../render/promotions.js';

// ===== FILTROS PUROS =====

// Destaques sempre primeiro, depois mantém a ordem original
function comDestaquesPrimeiro(lista) {
  return [...lista].sort((a, b) => (b.destaque ? 1 : 0) - (a.destaque ? 1 : 0));
}

export function filtrarPorCategoria(cat) {
  const base = cat === 'todos'
    ? state.comercios
    : state.comercios.filter(c => c.categoria === cat || c.tags.includes(cat));
  return comDestaquesPrimeiro(base);
}

export function buscarPorTermo(termo) {
  const q = termo.toLowerCase().trim();
  if (!q) return [];
  return state.comercios.filter(c =>
    c.nome.toLowerCase().includes(q) ||
    c.categoria.toLowerCase().includes(q) ||
    c.tags.some(t => t.toLowerCase().includes(q))
  );
}

// ===== BUSCA UI =====

export function filtrarBusca(q) {
  const resultsSection = document.getElementById('search-results');
  const noResults = document.getElementById('no-results');
  const grid = document.getElementById('results-grid');

  q = q.trim();
  if (!q) { resultsSection.style.display = 'none'; return; }

  resultsSection.style.display = 'block';
  document.getElementById('search-term').textContent = q.toUpperCase();
  document.getElementById('results-header').style.display = 'block';

  const encontrados = buscarPorTermo(q);
  if (encontrados.length === 0) {
    grid.innerHTML = '';
    noResults.style.display = 'block';
    document.getElementById('no-results-term').textContent = q;
  } else {
    noResults.style.display = 'none';
    grid.innerHTML = encontrados.map(criarCard).join('');
  }
  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function setSearch(val) {
  document.getElementById('search-input').value = val;
  filtrarBusca(val);
}

// ===== CATEGORIA =====

export function filtrarCategoria(cat, el) {
  document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  state.categoriaAtiva = cat;
  state.paginaAtual = 1;
  renderizarCards(filtrarPorCategoria(cat));
  const titulo = cat === 'todos' ? '🏪 Todos os Comércios'
    : 'Categoria: ' + cat.charAt(0).toUpperCase() + cat.slice(1);
  document.getElementById('listings-title').textContent = titulo;
  document.querySelector('.listings-section').scrollIntoView({ behavior: 'smooth' });
}

// ===== ORDENAÇÃO =====

export function ordenar(tipo) {
  let lista = filtrarPorCategoria(state.categoriaAtiva);
  if (tipo === 'rating') lista.sort((a, b) => (b.destaque ? 1 : 0) - (a.destaque ? 1 : 0) || b.rating - a.rating);
  if (tipo === 'nome') lista.sort((a, b) => (b.destaque ? 1 : 0) - (a.destaque ? 1 : 0) || a.nome.localeCompare(b.nome));
  if (tipo === 'visitas') lista.sort((a, b) => (b.destaque ? 1 : 0) - (a.destaque ? 1 : 0) || b.visitas - a.visitas);
  state.paginaAtual = 1;
  renderizarCards(lista);
}

export function mostrarRanking(tipo, el) {
  document.querySelectorAll('.ranking-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  renderRanking(tipo);
}
