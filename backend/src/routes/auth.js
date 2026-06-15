// ===========================================
// Rotas - Autenticacao
// ===========================================
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { auth, csrfGuard } = require('../middleware/auth');
const ctrl = require('../controllers/authController');

// Rate limit específico para login: 5 tentativas por minuto por IP
const loginLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minuto
    max: 5,
    skipSuccessfulRequests: false,
    message: { error: 'Muitas tentativas de login. Tente novamente em 1 minuto.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// --- Públicas ---
router.post('/registro', ctrl.registro);
router.post('/login', loginLimiter, ctrl.login);

// --- Sessão: novo endpoint principal ---
router.get('/me', auth, ctrl.me);

// --- Refresh (sem auth middleware — o cookie é a autenticação) ---
router.post('/refresh', ctrl.refresh);

// --- Logout ---
router.post('/logout', ctrl.logout);

// --- CSRF ---
router.get('/csrf', ctrl.csrf);

// --- Troca de loja ativa (comerciante multi-loja) ---
router.patch('/active-store', auth, csrfGuard, ctrl.activeStore);

// --- Perfil (mantido para compat legada) ---
router.get('/perfil', auth, ctrl.perfil);
router.put('/perfil', auth, ctrl.atualizarPerfil);

// --- Endereços de entrega ---
router.get('/enderecos', auth, ctrl.listarEnderecos);
router.post('/enderecos', auth, ctrl.criarEndereco);
router.put('/enderecos/:id', auth, ctrl.atualizarEndereco);
router.delete('/enderecos/:id', auth, ctrl.excluirEndereco);

module.exports = router;
