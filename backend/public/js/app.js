// ===== COMÉRCIO BES — APP ENTRY POINT =====
// Único arquivo carregado via <script type="module">.
// Importa todos os módulos, expõe handlers globais e inicializa a app.

import { state } from './modules/state.js';
import { API_BASE } from './config.js';
import { ENABLE_DATA_FALLBACK } from './config.js';
import { aplicarTema, toggleDarkMode, initNavScroll } from './modules/theme.js';
import {
  mostrarToast, mostrarSkeleton, atualizarAnoRodape,
  observarLazyImages, configurarPWAInstall,
  toggleMobileMenu, fecharMobileMenu,
  instalarPWA, fecharBannerPWA
} from './modules/ui.js';
import { carregarComercios, registrarEstatistica } from './modules/api.js';
import { Cart } from './modules/cart.js';
import {
  toggleCarrinhoDrawer, fecharCarrinhoDrawer,
  renderCarrinhoDrawer, cartUpdateQtd, cartRemove
} from './modules/cart.js';
import { Merchants } from './modules/merchants.js';
import { renderizarCards, criarCard, irPagina } from './render/cards.js';
import { renderPromos, renderRanking } from './render/promotions.js';
import { renderMapa } from './modules/map.js';
import {
  renderFavoritos, abrirFavoritos, fecharFavoritos,
  toggleFavoritoModal, toggleFavoritoCard
} from './render/favorites.js';
import {
  abrirModal, fecharModal,
  alterarQtdModal, adicionarAoCarrinho, enviarPedidoWhatsApp,
  avaliar, enviarAvaliacao,
  abrirLightbox, fecharLightbox, navLightbox
} from './render/modal.js';
import {
  abrirAuth, fecharAuth, trocarAuthTab,
  fazerLogin, fazerCadastro, fazerLogout,
  trocarTipoConta, atualizarNavUser,
  toggleContaMenu, fecharContaMenu
} from './modules/auth-ui.js';
import { Auth } from './modules/auth.js';
import {
  abrirCheckout, fecharCheckout,
  confirmarPedido, confirmarPedidoWhatsApp, enviarTudoWhatsApp
} from './modules/checkout.js';
import { abrirPedidos, fecharPedidos } from './render/orders-ui.js';
import { abrirCadastroLoja, fecharCadastroLoja, salvarCadastroLoja } from './modules/merchant-ui.js';
import {
  filtrarCategoria, filtrarBusca, setSearch,
  ordenar, mostrarRanking
} from './modules/search.js';

// ===== WINDOW BINDINGS (inline onclick handlers no HTML) =====
// Tudo aqui é chamado de strings HTML geradas dinamicamente ou de atributos onclick no HTML estático.

Object.assign(window, {
  Auth,
  // Navegação / menus
  toggleDarkMode, toggleMobileMenu, fecharMobileMenu,
  toggleContaMenu, fecharContaMenu,
  abrirFavoritos, fecharFavoritos,
  toggleCarrinhoDrawer, fecharCarrinhoDrawer,

  // Auth
  abrirAuth, fecharAuth, trocarAuthTab,
  fazerLogin, fazerCadastro, fazerLogout, trocarTipoConta,

  // Busca / filtros
  filtrarBusca, setSearch, filtrarCategoria, ordenar, mostrarRanking,

  // Loja
  abrirCadastroLoja, fecharCadastroLoja, salvarCadastroLoja,

  // Modal de perfil
  abrirModal, fecharModal,
  toggleFavoritoModal, toggleFavoritoCard,
  alterarQtdModal, adicionarAoCarrinho, enviarPedidoWhatsApp,
  avaliar, enviarAvaliacao,
  copiarLinkLoja,  // definida abaixo neste arquivo

  // Lightbox de fotos
  abrirLightbox, fecharLightbox, navLightbox,

  // Carrinho / checkout
  cartUpdateQtd, cartRemove,
  abrirCheckout, fecharCheckout, enviarTudoWhatsApp,
  confirmarPedido, confirmarPedidoWhatsApp,

  // Pedidos
  abrirPedidos, fecharPedidos,

  // API (usado em popups do mapa e cards gerados)
  registrarEstatistica,
  mostrarToast,

  // Paginação
  irPagina,

  // PWA
  instalarPWA, fecharBannerPWA,

  // Render global (usado por merchant-ui.js)
  renderTudo
});

// ===== INICIALIZAÇÃO =====

async function carregarDados() {
  mostrarSkeleton();

  try {
    const apiData = await carregarComercios();
    state.comercios = apiData.comercios || [];
    state.apiDisponivel = true;
    console.log('[ComércioBES] API conectada — ' + state.comercios.length + ' comércios carregados');
  } catch (apiErr) {
    state.apiDisponivel = false;

    if (!ENABLE_DATA_FALLBACK) {
      console.error('[ComércioBES] API indisponível e fallback de mock desabilitado:', apiErr.message);
      mostrarToast('⚠️ Não foi possível carregar os dados da API.');
      return;
    }

    console.warn('[ComércioBES] API indisponível, usando data.json:', apiErr.message);
    try {
      const res = await fetch('data/data.json');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      state.comercios = data.comercios;
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
      mostrarToast('⚠️ Erro ao carregar comércios. Tente recarregar a página.');
      return;
    }
  }

  // Merge lojas locais (cadastradas sem API)
  const locais = Merchants.get();
  locais.forEach(l => {
    if (!state.comercios.find(c => c.id === l.id)) state.comercios.push(l);
  });
}

async function inicializar() {
  aplicarTema();
  initNavScroll();
  await carregarDados();
  atualizarAnoRodape();
  Cart.updateBadge();
  atualizarNavUser();
  verificarDeepLink();
  renderTudo();
  renderFavoritos();
  configurarPWAInstall();
  observarLazyImages();
}

function renderTudo() {
  state.paginaAtual = 1;
  // Destaques primeiro, depois ordem original
  const ordenados = [...state.comercios].sort((a, b) => (b.destaque ? 1 : 0) - (a.destaque ? 1 : 0));
  renderizarCards(ordenados);
  renderPromos();
  renderRanking('rating');
  renderMapa();
}

function verificarDeepLink() {
  const params = new URLSearchParams(window.location.search);
  const lojaSlug = params.get('loja');
  if (!lojaSlug) return;
  const loja = state.comercios.find(c => c.slug === lojaSlug);
  if (loja) abrirModal(loja.id);
}

function copiarLinkLoja(slug) {
  const url = window.location.origin + window.location.pathname + '?loja=' + slug;
  const c = state.comercios.find(x => x.slug === slug);
  if (c) registrarEstatistica(c.id, 'compartilhamento');
  navigator.clipboard.writeText(url).then(() => {
    mostrarToast('🔗 Link copiado! Compartilhe com quem quiser.');
  }).catch(() => {
    mostrarToast('🔗 Link: ' + url);
  });
}

// ===== TECLADO =====

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    fecharModal();
    fecharCarrinhoDrawer();
    fecharAuth();
    fecharCadastroLoja();
    fecharCheckout();
    fecharPedidos();
  }
});

// ===== BOOT =====
inicializar();
