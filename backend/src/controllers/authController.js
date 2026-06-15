// ===========================================
// Controller - Autenticacao
// ===========================================
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const prisma = require('../lib/prisma');
const sanitize = require('../lib/sanitize');
const { getCapabilities } = require('../rbac/capabilities');
const {
  generateCsrfToken,
  generateRefreshToken,
  setAuthCookies,
  setCsrfCookie,
  clearAuthCookies,
} = require('../lib/authCookies');

// Validações
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CPF_REGEX = /^\d{11}$/;
const CNPJ_REGEX = /^\d{14}$/;
const JWT_PLACEHOLDER = 'trocar-por-uma-chave-secreta-longa-e-aleatoria';

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

function gerarAccessToken(user, extra = {}) {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === JWT_PLACEHOLDER) {
    console.error('[SEGURANCA] JWT_SECRET nao configurado!');
    if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET nao configurado');
  }
  return jwt.sign(
    { id: user.id, email: user.email, tipo: user.tipo, ...extra },
    secret,
    { expiresIn: '15m', algorithm: 'HS256' }
  );
}

function limparDocumento(doc) {
  if (!doc || typeof doc !== 'string') return null;
  return doc.replace(/\D/g, '');
}

function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.ip ||
    'unknown'
  );
}

// ---------------------------------------------------------------------------
// POST /api/auth/registro
// ---------------------------------------------------------------------------
async function registro(req, res, next) {
  try {
    const { nome, email, senha, tipo, telefone } = req.body;

    if (!nome || !email || !senha) {
      return res.status(400).json({ error: 'Nome, email e senha sao obrigatorios' });
    }
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: 'Formato de email invalido' });
    }
    if (senha.length < 6) {
      return res.status(400).json({ error: 'A senha deve ter no minimo 6 caracteres' });
    }

    const tipoPermitido = tipo === 'comerciante' ? 'comerciante' : 'cliente';

    const existente = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (existente) return res.status(409).json({ error: 'Email ja cadastrado' });

    const data = {
      nome: sanitize(nome),
      email: email.toLowerCase().trim(),
      senha: await bcrypt.hash(senha, 12),
      tipo: tipoPermitido,
      telefone: telefone ? sanitize(telefone) : null,
    };

    if (tipoPermitido === 'comerciante') {
      const { nomeFantasia, cpfCnpj, enderecoComercial, telefoneComercial } = req.body;
      if (!nomeFantasia) return res.status(400).json({ error: 'Nome fantasia do negocio e obrigatorio para comerciantes' });
      if (!cpfCnpj) return res.status(400).json({ error: 'CPF ou CNPJ e obrigatorio para comerciantes' });
      const docLimpo = limparDocumento(cpfCnpj);
      if (!CPF_REGEX.test(docLimpo) && !CNPJ_REGEX.test(docLimpo)) {
        return res.status(400).json({ error: 'CPF (11 digitos) ou CNPJ (14 digitos) invalido' });
      }
      data.nomeFantasia = sanitize(nomeFantasia);
      data.cpfCnpj = docLimpo;
      data.enderecoComercial = enderecoComercial ? sanitize(enderecoComercial) : null;
      data.telefoneComercial = telefoneComercial ? sanitize(telefoneComercial) : null;
    }

    if (tipoPermitido === 'cliente') {
      const { cpf } = req.body;
      if (cpf) {
        const cpfLimpo = limparDocumento(cpf);
        if (!CPF_REGEX.test(cpfLimpo)) return res.status(400).json({ error: 'CPF invalido (11 digitos)' });
        data.cpf = cpfLimpo;
      }
    }

    const user = await prisma.user.create({
      data,
      select: { id: true, nome: true, email: true, tipo: true, telefone: true, nomeFantasia: true, createdAt: true },
    });

    // Emite token legado (Bearer) para compat + cookies novos
    const accessToken = gerarAccessToken(user);
    const refreshToken = generateRefreshToken();
    const csrfToken = generateCsrfToken();

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: await bcrypt.hash(refreshToken, 10) },
    });

    setAuthCookies(res, accessToken, refreshToken, csrfToken);

    res.status(201).json({ message: 'Conta criada com sucesso', user, token: accessToken });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------
async function login(req, res, next) {
  try {
    const { email, senha } = req.body;
    if (!email || !senha) return res.status(400).json({ error: 'Email e senha sao obrigatorios' });

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user) return res.status(401).json({ error: 'Email ou senha incorretos' });

    const senhaValida = await bcrypt.compare(senha, user.senha);
    if (!senhaValida) return res.status(401).json({ error: 'Email ou senha incorretos' });

    const accessToken = gerarAccessToken(user);
    const refreshToken = generateRefreshToken();
    const csrfToken = generateCsrfToken();

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: await bcrypt.hash(refreshToken, 10) },
    });

    setAuthCookies(res, accessToken, refreshToken, csrfToken);

    const userData = {
      id: user.id, nome: user.nome, email: user.email,
      tipo: user.tipo, telefone: user.telefone,
    };
    if (user.tipo === 'comerciante') userData.nomeFantasia = user.nomeFantasia;

    res.json({ message: 'Login realizado com sucesso', user: userData, token: accessToken });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /api/auth/me  — payload completo de sessão
// ---------------------------------------------------------------------------
async function me(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true, nome: true, email: true, tipo: true,
        comercios: {
          select: { id: true, nome: true, slug: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!user) return res.status(401).json({ error: 'unauthenticated' });

    const capabilities = getCapabilities(user.tipo);
    const stores = user.tipo === 'comerciante'
      ? user.comercios.map(c => ({ id: c.id, nome: c.nome, slug: c.slug }))
      : [];
    const activeStoreId = req.user?.activeStoreId || (stores[0]?.id ?? null);

    // Emite novo csrf_token a cada chamada
    const csrfToken = generateCsrfToken();
    setCsrfCookie(res, csrfToken);

    res.json({
      user: { id: user.id, email: user.email, nome: user.nome, role: user.tipo },
      capabilities,
      stores,
      activeStoreId,
      csrfToken,
    });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// POST /api/auth/refresh — rotação de refresh token
// ---------------------------------------------------------------------------
async function refresh(req, res, next) {
  try {
    const oldRefreshToken = req.cookies?.refresh_token;
    if (!oldRefreshToken) {
      return res.status(401).json({ error: 'Refresh token ausente' });
    }

    // Encontrar usuário pelo hash (busca pelo campo novo)
    // Estratégia: buscar todos que têm hash (custo aceitável; pode indexar depois)
    const users = await prisma.user.findMany({
      where: { refreshTokenHash: { not: null } },
      select: { id: true, email: true, tipo: true, refreshTokenHash: true },
    });

    let matchedUser = null;
    for (const u of users) {
      if (u.refreshTokenHash && await bcrypt.compare(oldRefreshToken, u.refreshTokenHash)) {
        matchedUser = u;
        break;
      }
    }

    if (!matchedUser) {
      // Possível reuso de token rotacionado — invalida sessão inteira
      console.warn(`[AUTH] Refresh token invalido ou reutilizado`);
      return res.status(401).json({ error: 'Sessao invalida. Faca login novamente.' });
    }

    // Rotacionar
    const newAccessToken = gerarAccessToken(matchedUser);
    const newRefreshToken = generateRefreshToken();
    const newCsrfToken = generateCsrfToken();

    await prisma.user.update({
      where: { id: matchedUser.id },
      data: { refreshTokenHash: await bcrypt.hash(newRefreshToken, 10) },
    });

    setAuthCookies(res, newAccessToken, newRefreshToken, newCsrfToken);
    res.json({ message: 'Token renovado com sucesso' });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// POST /api/auth/logout
// ---------------------------------------------------------------------------
async function logout(req, res, next) {
  try {
    await prisma.user.update({
      where: { id: req.userId },
      data: { refreshTokenHash: null },
    });
    clearAuthCookies(res);
    res.json({ message: 'Logout realizado com sucesso' });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /api/auth/csrf — emite novo par de tokens CSRF
// ---------------------------------------------------------------------------
async function csrf(req, res) {
  const csrfToken = generateCsrfToken();
  setCsrfCookie(res, csrfToken);
  res.json({ csrfToken });
}

// ---------------------------------------------------------------------------
// PATCH /api/auth/active-store — troca loja ativa (comerciante multi-loja)
// ---------------------------------------------------------------------------
async function activeStore(req, res, next) {
  try {
    const { storeId } = req.body;
    if (!storeId) return res.status(400).json({ error: 'storeId e obrigatorio' });

    // Verifica ownership
    const store = await prisma.comercio.findFirst({
      where: { id: Number(storeId), ownerId: req.userId },
      select: { id: true, nome: true },
    });
    if (!store) return res.status(403).json({ error: 'Loja nao encontrada ou sem permissao' });

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    const newAccessToken = gerarAccessToken(user, { activeStoreId: store.id });
    const newRefreshToken = generateRefreshToken();
    const newCsrfToken = generateCsrfToken();

    await prisma.user.update({
      where: { id: req.userId },
      data: { refreshTokenHash: await bcrypt.hash(newRefreshToken, 10) },
    });

    setAuthCookies(res, newAccessToken, newRefreshToken, newCsrfToken);
    res.json({ message: 'Loja ativa atualizada', activeStoreId: store.id, storeName: store.nome });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /api/auth/perfil (mantido para compat)
// ---------------------------------------------------------------------------
async function perfil(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true, nome: true, email: true, tipo: true, telefone: true, avatar: true, createdAt: true,
        nomeFantasia: true, cpfCnpj: true, enderecoComercial: true, telefoneComercial: true, cpf: true,
        comercios: { select: { id: true, nome: true, slug: true, emoji: true, aberto: true } },
        enderecos: {
          select: { id: true, apelido: true, rua: true, numero: true, complemento: true, bairro: true, cidade: true, estado: true, cep: true, principal: true },
          orderBy: { principal: 'desc' },
        },
        pedidos: {
          select: { id: true, codigo: true, status: true, total: true, tipoEntrega: true, createdAt: true, comercio: { select: { nome: true, slug: true, emoji: true } } },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!user) return res.status(404).json({ error: 'Usuario nao encontrado' });
    res.json(user);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// PUT /api/auth/perfil (mantido para compat)
// ---------------------------------------------------------------------------
async function atualizarPerfil(req, res, next) {
  try {
    const { nome, telefone, avatar, senhaAtual, novaSenha } = req.body;
    const data = {};

    if (nome) data.nome = sanitize(nome);
    if (telefone !== undefined) data.telefone = telefone ? sanitize(telefone) : null;
    if (avatar !== undefined) data.avatar = avatar;

    const currentUser = await prisma.user.findUnique({ where: { id: req.userId } });

    if (currentUser.tipo === 'comerciante') {
      const { nomeFantasia, cpfCnpj, enderecoComercial, telefoneComercial } = req.body;
      if (nomeFantasia) data.nomeFantasia = sanitize(nomeFantasia);
      if (cpfCnpj) {
        const docLimpo = limparDocumento(cpfCnpj);
        if (!CPF_REGEX.test(docLimpo) && !CNPJ_REGEX.test(docLimpo)) {
          return res.status(400).json({ error: 'CPF ou CNPJ invalido' });
        }
        data.cpfCnpj = docLimpo;
      }
      if (enderecoComercial !== undefined) data.enderecoComercial = sanitize(enderecoComercial);
      if (telefoneComercial !== undefined) data.telefoneComercial = sanitize(telefoneComercial);
    }

    if (currentUser.tipo === 'cliente') {
      const { cpf } = req.body;
      if (cpf) {
        const cpfLimpo = limparDocumento(cpf);
        if (!CPF_REGEX.test(cpfLimpo)) return res.status(400).json({ error: 'CPF invalido' });
        data.cpf = cpfLimpo;
      }
    }

    if (novaSenha) {
      if (!senhaAtual) return res.status(400).json({ error: 'Informe a senha atual' });
      const senhaValida = await bcrypt.compare(senhaAtual, currentUser.senha);
      if (!senhaValida) return res.status(401).json({ error: 'Senha atual incorreta' });
      if (novaSenha.length < 6) return res.status(400).json({ error: 'A nova senha deve ter no minimo 6 caracteres' });
      data.senha = await bcrypt.hash(novaSenha, 12);
    }

    const user = await prisma.user.update({
      where: { id: req.userId },
      data,
      select: { id: true, nome: true, email: true, tipo: true, telefone: true, avatar: true, nomeFantasia: true, cpfCnpj: true, enderecoComercial: true, telefoneComercial: true, cpf: true },
    });

    res.json({ message: 'Perfil atualizado', user });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Endereços (mantidos para compat)
// ---------------------------------------------------------------------------
async function listarEnderecos(req, res, next) {
  try {
    const enderecos = await prisma.endereco.findMany({ where: { userId: req.userId }, orderBy: { principal: 'desc' } });
    res.json(enderecos);
  } catch (err) { next(err); }
}

async function criarEndereco(req, res, next) {
  try {
    const { apelido, rua, numero, complemento, bairro, cidade, estado, cep, principal } = req.body;
    if (!rua || !numero || !bairro || !cep) return res.status(400).json({ error: 'Rua, numero, bairro e CEP sao obrigatorios' });
    if (principal) await prisma.endereco.updateMany({ where: { userId: req.userId }, data: { principal: false } });
    const endereco = await prisma.endereco.create({
      data: {
        userId: req.userId, apelido: sanitize(apelido) || 'Casa',
        rua: sanitize(rua), numero: sanitize(numero),
        complemento: complemento ? sanitize(complemento) : null,
        bairro: sanitize(bairro), cidade: cidade ? sanitize(cidade) : 'Boa Esperança do Sul',
        estado: estado ? sanitize(estado) : 'SP', cep: sanitize(cep).replace(/\D/g, ''),
        principal: principal || false,
      }
    });
    res.status(201).json(endereco);
  } catch (err) { next(err); }
}

async function atualizarEndereco(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID invalido' });
    const endereco = await prisma.endereco.findFirst({ where: { id, userId: req.userId } });
    if (!endereco) return res.status(404).json({ error: 'Endereco nao encontrado' });
    const { apelido, rua, numero, complemento, bairro, cidade, estado, cep, principal } = req.body;
    const data = {};
    if (apelido) data.apelido = sanitize(apelido);
    if (rua) data.rua = sanitize(rua);
    if (numero) data.numero = sanitize(numero);
    if (complemento !== undefined) data.complemento = complemento ? sanitize(complemento) : null;
    if (bairro) data.bairro = sanitize(bairro);
    if (cidade) data.cidade = sanitize(cidade);
    if (estado) data.estado = sanitize(estado);
    if (cep) data.cep = sanitize(cep).replace(/\D/g, '');
    if (principal) {
      await prisma.endereco.updateMany({ where: { userId: req.userId }, data: { principal: false } });
      data.principal = true;
    }
    const updated = await prisma.endereco.update({ where: { id }, data });
    res.json(updated);
  } catch (err) { next(err); }
}

async function excluirEndereco(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID invalido' });
    const endereco = await prisma.endereco.findFirst({ where: { id, userId: req.userId } });
    if (!endereco) return res.status(404).json({ error: 'Endereco nao encontrado' });
    await prisma.endereco.delete({ where: { id } });
    res.json({ message: 'Endereco excluido' });
  } catch (err) { next(err); }
}

module.exports = {
  registro, login, perfil, atualizarPerfil,
  me, refresh, logout, csrf, activeStore,
  listarEnderecos, criarEndereco, atualizarEndereco, excluirEndereco,
};
