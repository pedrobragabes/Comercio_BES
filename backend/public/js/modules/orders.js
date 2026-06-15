// ===== COMÉRCIO BES — ORDERS MODULE =====

import { KEYS } from '../config.js';
import { storageGet, storageSet } from './utils.js';

export const Orders = {
  get() { return storageGet(KEYS.ORDERS) || []; },

  create(orderData) {
    const orders = this.get();
    const order = {
      id: 'PED-' + Date.now().toString(36).toUpperCase(),
      ...orderData,
      status: 'pendente',
      criadoEm: new Date().toISOString()
    };
    orders.unshift(order);
    storageSet(KEYS.ORDERS, orders);
    return order;
  }
};
