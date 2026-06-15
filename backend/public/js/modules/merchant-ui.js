// ===== COMÉRCIO BES — MERCHANT UI MODULE =====

import { Auth } from './auth.js';
import { Merchants } from './merchants.js';
import { mostrarToast } from './ui.js';
import { abrirAuth } from './auth-ui.js';
import { state } from './state.js';

export function abrirCadastroLoja(e) {
  if (e) e.preventDefault();
  if (!Auth.isLoggedIn()) {
    mostrarToast('👤 Faça login para cadastrar sua loja.');
    abrirAuth();
    return;
  }
  document.getElementById('merchant-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

export function fecharCadastroLoja(e) {
  if (e && e.target !== document.getElementById('merchant-overlay')) return;
  document.getElementById('merchant-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

export function salvarCadastroLoja(e) {
  if (e) e.preventDefault();

  const nome = document.getElementById('loja-nome').value.trim();
  const categoria = document.getElementById('loja-categoria').value;
  const endereco = document.getElementById('loja-endereco').value.trim();
  const tel = document.getElementById('loja-tel').value.trim();
  const whatsapp = document.getElementById('loja-whatsapp').value.trim();
  const horario = document.getElementById('loja-horario').value.trim();
  const emoji = document.getElementById('loja-emoji').value.trim();

  if (!nome || !categoria || !endereco || !tel || !whatsapp) {
    mostrarToast('⚠️ Preencha todos os campos obrigatórios.');
    return false;
  }

  const loja = Merchants.register({ nome, categoria, endereco, tel, whatsapp, horario, emoji });
  state.comercios.push(loja);
  // renderTudo é chamada via window.renderTudo (definida em app.js)
  window.renderTudo();

  fecharCadastroLoja();
  mostrarToast('✅ Loja "' + nome + '" cadastrada com sucesso!');
  document.getElementById('merchant-form').reset();
  return false;
}
