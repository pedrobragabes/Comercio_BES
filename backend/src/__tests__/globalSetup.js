// Roda uma vez antes de todos os testes, em processo separado
// Cria o schema do banco de testes via prisma db push
const { execSync } = require('child_process');
const path = require('path');

module.exports = async () => {
  const testDatabaseUrl = process.env.TEST_DATABASE_URL;
  if (!testDatabaseUrl || !/^postgres(ql)?:\/\//.test(testDatabaseUrl)) {
    throw new Error(
      'Defina TEST_DATABASE_URL com uma URL PostgreSQL isolada antes de rodar npm test.'
    );
  }

  // db push sem --force-reset: cria as tabelas se nao existirem,
  // sincroniza schema se existirem. Nao destrutivo.
  // A limpeza de dados e feita pelo cleanDatabase() em cada beforeEach.
  execSync('npx prisma db push', {
    cwd: path.join(__dirname, '..', '..'),
    env: {
      ...process.env,
      DATABASE_URL: testDatabaseUrl
    },
    stdio: 'pipe'
  });
};
