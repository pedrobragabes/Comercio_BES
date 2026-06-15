// ===== COMÉRCIO BES — RENDER: FAVORITES =====

import { Favorites } from '../modules/favorites.js';
import { escapeHTML } from '../modules/utils.js';
import { mostrarToast } from '../modules/ui.js';
import { fecharContaMenu } from '../modules/auth-ui.js';
import { state } from '../modules/state.js';
import { criarCard, renderizarCards } from './cards.js';
import { filtrarPorCategoria } from '../modules/search.js';

export function renderFavoritos() {
  const section = document.getElementById('favoritos');
  if (!section) return;
  const favIds = Favorites.get();
  const favComercios = state.comercios.filter(c => favIds.includes(c.id));
  const grid = document.getElementById('favoritos-grid');
  const empty = document.getElementById('favoritos-empty');
  const count = document.getElementById('favoritos-count');

  if (favComercios.length === 0) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    section.style.display = favIds.length > 0 || section.style.display === 'block' ? 'block' : 'none';
  } else {
    empty.style.display = 'none';
    grid.innerHTML = favComercios.map(criarCard).join('');
    section.style.display = 'block';
  }
  if (count) count.textContent = favComercios.length + (favComercios.length === 1 ? ' loja' : ' lojas');
}

export function abrirFavoritos() {
  fecharContaMenu();
  const section = document.getElementById('favoritos');
  if (!section) return;
  renderFavoritos();
  section.style.display = 'block';
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function fecharFavoritos() {
  const section = document.getElementById('favoritos');
  if (section) section.style.display = 'none';
}

export function toggleFavoritoModal() {
  if (!state.comercioAtual) return;
  const added = Favorites.toggle(state.comercioAtual.id);
  const btn = document.getElementById('modal-fav');
  if (btn) {
    btn.textContent = added ? '♥' : '♡';
    btn.classList.toggle('active', added);
  }
  mostrarToast(added ? '❤️ Adicionado aos favoritos!' : '💔 Removido dos favoritos.');
  renderizarCards(filtrarPorCategoria(state.categoriaAtiva));
  renderFavoritos();
}

export function toggleFavoritoCard(lojaId, btn) {
  const added = Favorites.toggle(lojaId);
  btn.textContent = added ? '♥' : '♡';
  btn.classList.toggle('active', added);
  mostrarToast(added ? '❤️ Adicionado aos favoritos!' : '💔 Removido dos favoritos.');
  renderFavoritos();
}
