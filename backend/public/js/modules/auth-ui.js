// ===== COMÉRCIO BES — AUTH UI MODULE =====
// Overlay de login/cadastro + menu de conta na navbar.

import { Auth } from './auth.js';
import { escapeHTML } from './utils.js';
import { mostrarToast } from './ui.js';

let tipoContaRegistro = 'usuario';

// ===== AUTH OVERLAY =====

export function abrirAuth() {
  document.getElementById('auth-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

export function fecharAuth(e) {
  if (e && e.target !== document.getElementById('auth-overlay')) return;
  document.getElementById('auth-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

export function trocarAuthTab(tab, btn) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('auth-form-login').style.display = tab === 'login' ? 'flex' : 'none';
  document.getElementById('auth-form-cadastro').style.display = tab === 'cadastro' ? 'flex' : 'none';
  document.getElementById('auth-title').textContent = tab === 'login' ? '👤 Entrar' : '✨ Criar Conta';
}

export async function fazerLogin(e) {
  if (e) e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const senha = document.getElementById('login-senha').value;
  if (!email || !senha) { mostrarToast('⚠️ Preencha e-mail e senha.'); return false; }

  const result = await Auth.login(email, senha);
  if (!result.ok) { mostrarToast('❌ ' + result.msg); return false; }

  mostrarToast('✅ Bem-vindo(a), ' + result.user.nome + '!');
  fecharAuth();
  atualizarNavUser();
  document.getElementById('login-email').value = '';
  document.getElementById('login-senha').value = '';
  return false;
}

export function trocarTipoConta(tipo) {
  tipoContaRegistro = tipo === 'lojista' ? 'lojista' : 'usuario';
  document.getElementById('tipo-cliente-btn').classList.toggle('active', tipo !== 'lojista');
  document.getElementById('tipo-lojista-btn').classList.toggle('active', tipo === 'lojista');
  document.getElementById('campos-lojista').style.display = tipo === 'lojista' ? 'block' : 'none';
  document.getElementById('reg-submit-btn').textContent = tipo === 'lojista' ? 'Criar Conta Lojista' : 'Criar Conta';
}

export async function fazerCadastro(e) {
  if (e) e.preventDefault();
  const nome = document.getElementById('reg-nome').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const tel = document.getElementById('reg-tel').value.trim();
  const senha = document.getElementById('reg-senha').value;

  if (!nome || !email || !senha) { mostrarToast('⚠️ Preencha todos os campos obrigatórios.'); return false; }
  if (senha.length < 6) { mostrarToast('⚠️ A senha deve ter pelo menos 6 caracteres.'); return false; }

  let dadosLoja = null;
  if (tipoContaRegistro === 'lojista') {
    dadosLoja = {
      nome: document.getElementById('reg-loja-nome').value.trim(),
      whatsapp: document.getElementById('reg-loja-whatsapp').value.trim()
    };
  }

  const result = await Auth.register(nome, email, tel, senha, tipoContaRegistro, dadosLoja);
  if (!result.ok) { mostrarToast('❌ ' + result.msg); return false; }

  mostrarToast(tipoContaRegistro === 'lojista'
    ? '✅ Conta lojista criada! Bem-vindo(a), ' + nome + '!'
    : '✅ Conta criada! Bem-vindo(a), ' + nome + '!');
  fecharAuth();
  atualizarNavUser();
  ['reg-nome', 'reg-email', 'reg-tel', 'reg-senha'].forEach(id => {
    document.getElementById(id).value = '';
  });
  if (tipoContaRegistro === 'lojista') {
    document.getElementById('reg-loja-nome').value = '';
    document.getElementById('reg-loja-whatsapp').value = '';
  }
  tipoContaRegistro = 'usuario';
  trocarTipoConta('cliente');
  return false;
}

export function fazerLogout() {
  Auth.logout();
  atualizarNavUser();
  fecharContaMenu();
  mostrarToast('👋 Você saiu da sua conta.');
}

// ===== NAVBAR: menu de conta =====

export function atualizarNavUser() {
  const navLogin = document.getElementById('nav-login');
  const navUserBtns = document.getElementById('nav-user-btns');
  const usernameEl = document.getElementById('conta-username');

  if (Auth.isLoggedIn()) {
    const user = Auth.getUser();
    const nome = user ? user.nome.split(' ')[0] : 'Usuário';
    if (navLogin) navLogin.style.display = 'none';
    if (navUserBtns) navUserBtns.style.display = 'flex';
    if (usernameEl) usernameEl.textContent = escapeHTML(nome);
  } else {
    if (navLogin) navLogin.style.display = '';
    if (navUserBtns) navUserBtns.style.display = 'none';
  }
}

export function toggleContaMenu() {
  const dropdown = document.getElementById('conta-dropdown');
  if (!dropdown) return;
  dropdown.classList.toggle('open');

  if (dropdown.classList.contains('open')) {
    setTimeout(() => {
      document.addEventListener('click', fecharContaMenuOutside, { once: true });
    }, 0);
  }
}

export function fecharContaMenu() {
  const dropdown = document.getElementById('conta-dropdown');
  if (dropdown) dropdown.classList.remove('open');
}

function fecharContaMenuOutside(e) {
  const wrapper = document.querySelector('.nav-account-wrapper');
  if (wrapper && !wrapper.contains(e.target)) fecharContaMenu();
}
