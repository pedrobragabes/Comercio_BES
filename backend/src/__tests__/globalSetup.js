// Roda uma vez antes de todos os testes, em processo separado
// Cria o schema do banco de testes via prisma db push
const { execSync } = require('child_process');
const path = require('path');

// Roda uma vez antes de todos os testes, em processo separado
// Cria o schema do banco de testes via prisma db push
const { execSync } = require('child_process');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

module.exports = async () => {
  const testDatabaseUrl = process.env.TEST_DATABASE_URL;

  if (!testDatabaseUrl || !/^postgres(ql)?:\/\//.test(testDatabaseUrl)) {
    throw new Error(
      'Defina TEST_DATABASE_URL (ou configure em backend/.env) com uma URL PostgreSQL isolada antes de rodar npm test.'
    );
  }

  // Trava defensiva: evita rodar testes contra um DB não-teste por engano.
  let dbName = '';
  try {
    dbName = new URL(testDatabaseUrl).pathname.replace(/^\//, '');
  } catch (_) {}

  if (!/test/i.test(dbName)) {
    throw new Error('TEST_DATABASE_URL deve apontar para um banco de testes (ex.: sufixo "_test").');
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
