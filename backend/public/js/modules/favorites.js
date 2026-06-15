// ===== COMÉRCIO BES — FAVORITES MODULE =====

import { KEYS } from '../config.js';
import { storageGet, storageSet } from './utils.js';

export const Favorites = {
  get() { return storageGet(KEYS.FAVORITES) || []; },

  toggle(lojaId) {
    let favs = this.get();
    const idx = favs.indexOf(lojaId);
    if (idx >= 0) {
      favs.splice(idx, 1);
    } else {
      favs.push(lojaId);
    }
    storageSet(KEYS.FAVORITES, favs);
    return idx < 0;
  },

  isFav(lojaId) { return this.get().includes(lojaId); }
};
