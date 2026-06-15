// ===== COMÉRCIO BES — API CLIENT =====
// Toda comunicação com o backend REST.
// Retorna dados — não manipula DOM, não altera estado global.

import { API_BASE } from '../config.js';
import { state } from './state.js';

export function registrarEstatistica(comercioId, tipo) {
  if (!state.apiDisponivel || !comercioId) return;
  fetch(API_BASE + '/estatisticas/registrar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ comercioId, tipo })
  }).catch(err => console.warn('[Stats] Falha ao registrar ' + tipo + ':', err.message));
}

export async function carregarComercios() {
  const res = await fetch(API_BASE + '/comercios?limit=100');
  if (!res.ok) throw new Error('API HTTP ' + res.status);
  return res.json();
}

export async function enviarAvaliacaoApi(slug, nota, comentario, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const res = await fetch(API_BASE + '/avaliacoes/' + slug, {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify({ nota, comentario: comentario || undefined })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro ao enviar avaliação');
  return data;
}
