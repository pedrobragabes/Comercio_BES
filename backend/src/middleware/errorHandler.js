// ===========================================
// Middleware - Error Handler
// ===========================================
function errorHandler(err, req, res, next) {
  console.error(`[ERRO] ${err.message}`);
  
  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack);
  }

  // Erros do Prisma
  if (err.code === 'P2002') {
    return res.status(409).json({
      error: 'Registro duplicado',
      campo: err.meta?.target?.[0] || 'desconhecido'
    });
  }

  if (err.code === 'P2025') {
    return res.status(404).json({
      error: 'Registro nao encontrado'
    });
  }

  const databaseUnavailableCodes = new Set(['P1000', 'P1001', 'P1002', 'P1008', 'P1017']);
  const databaseUnavailableMessage = /can't reach database|timed out|timeout|connect|authentication failed|PANIC: timer has gone away|PrismaClientRustPanicError/i.test(err.message || '');
  if (databaseUnavailableCodes.has(err.code) || databaseUnavailableMessage) {
    return res.status(503).json({
      error: 'Banco de dados indisponivel. Verifique DATABASE_URL e conectividade.'
    });
  }

  // Erro de validacao do JSON
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'JSON invalido no corpo da requisicao'
    });
  }

  // Erro do Multer (upload)
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      error: 'Arquivo muito grande. Maximo: 5MB'
    });
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      error: 'Campo de upload inesperado'
    });
  }

  // Erro generico
  const status = err.statusCode || 500;
  const message = (status === 500 && process.env.NODE_ENV === 'production')
    ? 'Erro interno do servidor'
    : err.message || 'Erro interno do servidor';
  res.status(status).json({ error: message });
}

module.exports = errorHandler;
