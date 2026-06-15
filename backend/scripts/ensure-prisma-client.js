const { spawnSync } = require('child_process');

function isPrismaClientReady() {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    prisma.$disconnect();
    return true;
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    const generatedClientMissing =
      message.includes('@prisma/client did not initialize yet') ||
      message.includes("Cannot find module '.prisma/client/default'");

    if (!generatedClientMissing) {
      throw error;
    }

    return false;
  }
}

if (isPrismaClientReady()) {
  console.log('Prisma Client pronto.');
  process.exit(0);
}

console.log('Prisma Client ausente. Gerando...');

const result = spawnSync('npx', ['prisma', 'generate'], {
  cwd: __dirname + '/..',
  stdio: 'inherit',
  shell: true
});

if (result.status !== 0) {
  process.exit(result.status || 1);
}
