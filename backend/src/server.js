// ===========================================
// Comercio BES - Servidor Express
// ===========================================
require('./lib/loadEnv')();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');
const cookieParser = require('cookie-parser');

const errorHandler = require('./middleware/errorHandler');
const { getDatabaseHealth } = require('./lib/dbHealth');
const authRoutes = require('./routes/auth');
const comerciosRoutes = require('./routes/comercios');
const categoriasRoutes = require('./routes/categorias');
const avaliacoesRoutes = require('./routes/avaliacoes');
const uploadRoutes = require('./routes/upload');
const estatisticasRoutes = require('./routes/estatisticas');
const pedidosRoutes = require('./routes/pedidos');
const pagamentosRoutes = require('./routes/pagamentos');

const app = express();
app.set('trust proxy', 1);

const PORT = process.env.PORT || 3000;
const PROJECT_ROOT = path.join(__dirname, '..', '..');
const BACKEND_ROOT = path.join(__dirname, '..');
const BUILT_PUBLIC_ROOT = path.join(BACKEND_ROOT, 'public');
const FRONTEND_ROOT = fs.existsSync(path.join(BUILT_PUBLIC_ROOT, 'index.html'))
  ? BUILT_PUBLIC_ROOT
  : PROJECT_ROOT;
const SITE_USERNAME = process.env.SITE_USERNAME || 'comerciobes';
const SITE_PASSWORD = process.env.SITE_PASSWORD || '';

function privateSiteGate(req, res, next) {
  if (!SITE_PASSWORD || process.env.NODE_ENV === 'test') return next();
  if (req.path === '/api/pagamentos/webhook') return next();

  const header = req.headers.authorization || '';
  const [scheme, encoded] = header.split(' ');

  if (scheme === 'Basic' && encoded) {
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    const separatorIndex = decoded.indexOf(':');
    const username = decoded.slice(0, separatorIndex);
    const password = decoded.slice(separatorIndex + 1);

    if (username === SITE_USERNAME && password === SITE_PASSWORD) {
      return next();
    }
  }

  res.setHeader('WWW-Authenticate', 'Basic realm="Comercio BES homologacao", charset="UTF-8"');
  return res.status(401).send('Acesso privado de homologacao.');
}

// --- Middleware Global ---

// Seguranca
app.use(helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com", "https://sdk.mercadopago.com", "https://http2.mlstatic.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://unpkg.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://*.tile.openstreetmap.org", "https://res.cloudinary.com", "https://http2.mlstatic.com", "blob:"],
      connectSrc: ["'self'", "https://api.comerciobes.com.br", "https://unpkg.com", "https://api.mercadopago.com", "https://api.mercadolibre.com"],
      frameSrc: ["https://sdk.mercadopago.com", "https://*.mercadopago.com"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: []
    }
  },
  // Strict-Transport-Security
  hsts: {
    maxAge: 31536000, // 1 ano
    includeSubDomains: true,
    preload: true
  },
  // X-Frame-Options
  frameguard: { action: 'deny' },
  // X-Content-Type-Options: nosniff (habilitado por padrao no Helmet)
  noSniff: true,
  // Referrer-Policy
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  // X-XSS-Protection (legacy, mas ainda util)
  xssFilter: true,
  // Cross-Origin policies
  crossOriginResourcePolicy: { policy: "same-origin" },
  crossOriginOpenerPolicy: { policy: "same-origin" },
  crossOriginEmbedderPolicy: false // desabilitar para permitir carregamento de fontes/imagens externas
}));

// Permissions-Policy (Helmet nao configura isso por padrao)
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy',
    'camera=(), microphone=(), geolocation=(self), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()'
  );
  next();
});

// CORS
const envAllowedOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map(u => u.trim())
  .filter(Boolean);

const defaultProductionOrigins = [
  'https://comerciobes.com.br',
  'https://www.comerciobes.com.br',
  'https://api.comerciobes.com.br'
];

const allowedOrigins = process.env.NODE_ENV === 'production'
  ? Array.from(new Set([...defaultProductionOrigins, ...envAllowedOrigins]))
  : ['http://localhost:3000', 'http://localhost:5500', 'http://127.0.0.1:5500', 'http://localhost:8080'];

if (process.env.NODE_ENV === 'production' && envAllowedOrigins.length === 0) {
  console.warn('[CORS] FRONTEND_URL nao configurado. Usando allowlist padrao do dominio oficial.');
}

app.use(cors({
  origin: function (origin, callback) {
    // Permitir requests sem origin (curl, mobile apps, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    const corsError = new Error('Bloqueado pelo CORS');
    corsError.statusCode = 403;
    callback(corsError);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
}));

// Rate limiting (desabilitado em testes para nao interferir com volume de requests)
if (process.env.NODE_ENV !== 'test') {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // maximo 100 requisicoes por IP
    message: { error: 'Muitas requisicoes. Tente novamente em 15 minutos.' }
  });
  app.use('/api/', limiter);

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' }
  });
  app.use('/api/auth/', authLimiter);

  const avaliacoesLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: { error: 'Muitas avaliacoes enviadas. Tente novamente em 15 minutos.' }
  });
  app.use('/api/avaliacoes/', avaliacoesLimiter);

  const statsLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 60,
    message: { error: 'Muitos eventos registrados. Tente novamente em breve.' }
  });
  app.use('/api/estatisticas/registrar', statsLimiter);
}

// Body parsing
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Cookie parsing (necessário para cookie httpOnly de auth)
app.use(cookieParser());

// Request logging
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Ambiente privado de homologacao. Defina SITE_PASSWORD para ativar.
app.use(privateSiteGate);

// --- Redirecionamento de rotas legadas ---
app.use(['/admin', '/painel'], (req, res) => {
  res.redirect(301, '/minha-conta');
});

// --- Painel Unico: Minha Conta (SPA vanilla)
// A SPA carrega para todos e valida sessao via /api/auth/me.
app.use(
  '/minha-conta',
  express.static(path.join(BACKEND_ROOT, 'minha-conta'))
);
app.get('/minha-conta/*', (req, res) => {
  res.sendFile(path.join(BACKEND_ROOT, 'minha-conta', 'index.html'));
});

// --- Frontend Principal (Se acessado pela porta 3000) ---
app.get('/', (req, res) => res.sendFile(path.join(FRONTEND_ROOT, 'index.html')));
app.get('/index.html', (req, res) => res.sendFile(path.join(FRONTEND_ROOT, 'index.html')));
app.get('/manifest.json', (req, res) => res.sendFile(path.join(FRONTEND_ROOT, 'manifest.json')));
app.get('/sw.js', (req, res) => res.sendFile(path.join(FRONTEND_ROOT, 'sw.js')));
app.get('/login', (req, res) => res.redirect(301, '/html/login.html'));
app.get('/cadastro', (req, res) => res.redirect(301, '/html/cadastro.html'));

// Servir estáticos da raiz do projeto (index.html, css/, js/, etc.)
const publicStaticOptions = {
  dotfiles: 'deny',
  index: false,
  maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0
};

// Servir somente assets publicos. Nao exponha backend/, docs/, .env ou codigo-fonte interno.
app.use('/css', express.static(path.join(FRONTEND_ROOT, 'css'), publicStaticOptions));
app.use('/js', express.static(path.join(FRONTEND_ROOT, 'js'), publicStaticOptions));
app.use('/html', express.static(path.join(FRONTEND_ROOT, 'html'), publicStaticOptions));
app.use('/icons', express.static(path.join(FRONTEND_ROOT, 'icons'), publicStaticOptions));
app.use('/images', express.static(path.join(FRONTEND_ROOT, 'images'), publicStaticOptions));
app.use('/data', express.static(path.join(FRONTEND_ROOT, 'data'), publicStaticOptions));

// Servir uploads locais (com cross-origin resource policy para imagens)
app.use('/uploads', (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.join(__dirname, '..', 'uploads')));

// --- Rotas da API ---
app.use('/api/auth', authRoutes);
app.use('/api/admin', require('./routes/admin'));
app.use('/api/comercios', comerciosRoutes);
app.use('/api/categorias', categoriasRoutes);
app.use('/api/avaliacoes', avaliacoesRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/estatisticas', estatisticasRoutes);
app.use('/api/pedidos', pedidosRoutes);
app.use('/api/pagamentos', pagamentosRoutes);

// Rota raiz da API
app.get('/api', (req, res) => {
  res.json({
    nome: 'Comercio BES API',
    versao: '2.0.0',
    descricao: 'API REST do guia comercial de Boa Esperanca do Sul',
    endpoints: {
      auth: '/api/auth',
      comercios: '/api/comercios',
      categorias: '/api/categorias',
      avaliacoes: '/api/avaliacoes',
      pedidos: '/api/pedidos',
      pagamentos: '/api/pagamentos',
      upload: '/api/upload',
      estatisticas: '/api/estatisticas',
      health: '/api/health',
      admin: '/admin',
      painel: '/painel'
    }
  });
});

// Health check com diagnostico seguro do banco
app.get('/api/health', async (req, res, next) => {
  try {
    const db = await getDatabaseHealth();
    res.status(db.ok ? 200 : 503).json({
      status: db.ok ? 'ok' : 'degraded',
      api: 'ok',
      database: db.database,
      elapsedMs: db.elapsedMs,
      databaseUrl: db.databaseUrl,
      ...(db.ok ? {} : { code: db.code, error: db.error }),
    });
  } catch (err) {
    next(err);
  }
});

// --- Error Handler ---
app.use(errorHandler);

// --- Iniciar Servidor ---
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n=== Comercio BES API ===`);
    console.log(`Servidor rodando em http://localhost:${PORT}`);
    console.log(`API:    http://localhost:${PORT}/api`);
    console.log(`Painel: http://localhost:${PORT}/minha-conta`);
    console.log(`Env:    ${process.env.NODE_ENV || 'development'}`);
    console.log(`========================\n`);
  });
}

module.exports = app;
