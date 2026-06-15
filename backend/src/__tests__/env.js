// Carregado pelo Jest antes de qualquer modulo ser importado
// Garante que os testes usam um banco PostgreSQL isolado
process.env.NODE_ENV = 'test';
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}
process.env.JWT_SECRET = 'jest-test-secret-key-nao-usar-em-producao';
process.env.FRONTEND_URL = 'http://localhost:8080';
process.env.PORT = '3001';
