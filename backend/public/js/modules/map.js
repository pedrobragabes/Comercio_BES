// ===== COMÉRCIO BES — MAP MODULE =====
// Renderiza mapa Leaflet. Funções chamadas via window.* nos popups inline.

import { escapeHTML } from './utils.js';
import { registrarEstatistica } from './api.js';
import { state } from './state.js';

export function renderMapa() {
  const mapEl = document.getElementById('leaflet-map');
  if (!mapEl || state.comercios.length === 0) return;
  if (state.mapa) { state.mapa.remove(); state.mapa = null; }

  state.mapa = L.map('leaflet-map').setView([-21.9932, -48.3910], 15);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19
  }).addTo(state.mapa);

  state.comercios.forEach(c => {
    if (!c.lat || !c.lng) return;

    let cor = '#aaa';
    if (c.aberto && c.promo && c.promo.ativo) { cor = '#EA580C'; }
    else if (c.aberto) { cor = '#10B981'; }

    const icon = L.divIcon({
      className: 'mapa-marker',
      html: '<div class="marker-pin" style="background:' + cor + '"><span>' + escapeHTML(c.emoji) + '</span></div>',
      iconSize: [40, 48],
      iconAnchor: [20, 48],
      popupAnchor: [0, -48]
    });

    const statusBadge = c.aberto
      ? '<span style="color:#10B981;font-weight:700;">✓ Aberto</span>'
      : '<span style="color:#ff4444;font-weight:700;">✗ Fechado</span>';

    const promoLine = (c.promo && c.promo.ativo)
      ? '<div style="margin-top:6px;font-size:12px;color:#EA580C;">🔥 ' + escapeHTML(c.promo.desc) + ' — ' + escapeHTML(c.promo.preco) + '</div>'
      : '';

    const popup = '<div class="map-popup">' +
      '<div style="font-size:24px;text-align:center;margin-bottom:6px;">' + escapeHTML(c.emoji) + '</div>' +
      '<div style="font-family:\'Plus Jakarta Sans\',sans-serif;font-weight:700;font-size:15px;text-align:center;">' + escapeHTML(c.nome) + '</div>' +
      '<div style="font-size:12px;color:#888;text-align:center;margin:4px 0;">' + escapeHTML(c.categoria).toUpperCase() + ' · ⭐ ' + escapeHTML(String(c.rating)) + '</div>' +
      '<div style="font-size:13px;text-align:center;margin:4px 0;">📍 ' + escapeHTML(c.endereco) + '</div>' +
      '<div style="font-size:13px;text-align:center;">' + statusBadge + '</div>' +
      promoLine +
      '<div style="display:flex;gap:6px;margin-top:10px;">' +
        '<button onclick="abrirModal(' + parseInt(c.id) + ')" style="flex:1;background:#0A0A0A;color:#fff;border:none;padding:8px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">Ver perfil</button>' +
        '<a href="https://wa.me/' + encodeURIComponent(c.whatsapp) + '" target="_blank" rel="noopener noreferrer" onclick="registrarEstatistica(' + parseInt(c.id) + ',\'whatsapp_click\')" style="flex:1;background:#25D366;color:#fff;border:none;padding:8px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;text-decoration:none;text-align:center;">💬 WhatsApp</a>' +
      '</div></div>';

    L.marker([c.lat, c.lng], { icon }).addTo(state.mapa).bindPopup(popup);
  });
}
