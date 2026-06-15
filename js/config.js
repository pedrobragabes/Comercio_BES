// ===== COMÉRCIO BES — CONFIGURAÇÃO GLOBAL =====
// Primeiro módulo carregado. Sem dependências.

// ===== API =====
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '']);
const PROD_HOSTS = new Set(['comerciobes.com.br', 'www.comerciobes.com.br']);
const IS_PROD_HOST = PROD_HOSTS.has(window.location.hostname);
const configuredApiBase = window.BES_API_BASE;

export const API_BASE = configuredApiBase
  ? configuredApiBase.replace(/\/$/, '')
  : IS_PROD_HOST
    ? 'https://api.comerciobes.com.br/api'
    : (window.location.port === '3000'
        ? window.location.origin + '/api'
        : 'http://localhost:3000/api');

// Em dev local, permite fallback para data/data.json quando API estiver offline.
// Em ambientes remotos, evita mascarar problemas de integração.
export const ENABLE_DATA_FALLBACK = window.location.protocol === 'file:' || LOCAL_HOSTS.has(window.location.hostname);

// ===== STORAGE KEYS =====
export const KEYS = {
  SESSION:   'bes_sessao',
  CART:      'bes_carrinho',
  ORDERS:    'bes_pedidos',
  FAVORITES: 'bes_favoritos',
  MERCHANTS: 'bes_merchants',
  API_TOKEN: 'bes_api_token'
};

// ===== PAGINAÇÃO =====
export const ITEMS_POR_PAGINA = 8;

// ===== GOOGLE MAPS =====
// Obtenha sua chave em: https://console.cloud.google.com → APIs → Maps Embed API
// Restrinja a chave pelo domínio do site nas configurações da API.
// Deixe vazio para usar OpenStreetMap (gratuito, sem chave).
export const GOOGLE_MAPS_KEY = '';
