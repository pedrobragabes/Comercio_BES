// ===== COMÉRCIO BES — MERCHANTS MODULE =====
// Lojas cadastradas localmente (fallback sem API).

import { KEYS } from '../config.js';
import { storageGet, storageSet, gerarSlug } from './utils.js';

export const Merchants = {
  get() { return storageGet(KEYS.MERCHANTS) || []; },

  register(data) {
    const merchants = this.get();
    const loja = {
      id: 100 + merchants.length + 1,
      slug: gerarSlug(data.nome),
      nome: data.nome,
      categoria: data.categoria,
      tags: [data.categoria],
      emoji: data.emoji || '🏪',
      rating: 5.0,
      visitas: 0,
      recomendados: 0,
      aberto: true,
      endereco: data.endereco,
      lat: -21.9930 + (Math.random() - 0.5) * 0.005,
      lng: -48.3910 + (Math.random() - 0.5) * 0.005,
      tel: data.tel,
      whatsapp: data.whatsapp,
      horario: data.horario || 'A combinar',
      fotos: [data.emoji || '🏪'],
      promo: null,
      catalogo: null,
      _local: true
    };
    merchants.push(loja);
    storageSet(KEYS.MERCHANTS, merchants);
    return loja;
  }
};
