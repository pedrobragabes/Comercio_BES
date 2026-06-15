// ===========================================
// Seed - Importar dados do data.json
// ===========================================
// Uso: node src/seed.js

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// Mapeamento de categorias do data.json
const categoriasMap = {
  'restaurante': { nome: 'Restaurante', slug: 'restaurante', emoji: '🍽️' },
  'farmacia': { nome: 'Farmacia', slug: 'farmacia', emoji: '💊' },
  'pet': { nome: 'Pet Shop', slug: 'pet', emoji: '🐾' },
  'mecanica': { nome: 'Mecanica', slug: 'mecanica', emoji: '🔧' },
  'barbearia': { nome: 'Barbearia', slug: 'barbearia', emoji: '💈' },
  'supermercado': { nome: 'Supermercado', slug: 'supermercado', emoji: '🛒' },
  'roupa': { nome: 'Moda', slug: 'moda', emoji: '👗' },
  'salao': { nome: 'Salao', slug: 'salao', emoji: '💅' },
  'padaria': { nome: 'Padaria', slug: 'padaria', emoji: '🍞' },
  'gas': { nome: 'Gas', slug: 'gas', emoji: '🔥' },
  'material': { nome: 'Material de Construcao', slug: 'material', emoji: '🏗️' }
};

function normalizeCategoriaKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

async function seed() {
  console.log('=== Iniciando seed do banco de dados ===\n');

  // 1. Criar usuario admin padrao
  console.log('1. Criando usuario admin...');
  const senhaAdmin = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@comerciobes.com' },
    update: {},
    create: {
      nome: 'Administrador',
      email: 'admin@comerciobes.com',
      senha: senhaAdmin,
      tipo: 'admin'
    }
  });
  console.log(`   Admin criado: ${admin.email}`);

  // 2. Criar usuario comerciante demo
  console.log('2. Criando usuario comerciante demo...');
  const senhaDemo = await bcrypt.hash('demo123', 12);
  const comerciante = await prisma.user.upsert({
    where: { email: 'comerciante@demo.com' },
    update: {},
    create: {
      nome: 'Comerciante Demo',
      email: 'comerciante@demo.com',
      senha: senhaDemo,
      tipo: 'comerciante'
    }
  });
  console.log(`   Comerciante demo: ${comerciante.email}`);

  // 3. Criar categorias
  console.log('3. Criando categorias...');
  const categoriasCriadas = {};
  for (const [key, cat] of Object.entries(categoriasMap)) {
    const categoria = await prisma.categoria.upsert({
      where: { slug: cat.slug },
      update: { nome: cat.nome, emoji: cat.emoji },
      create: cat
    });
    categoriasCriadas[key] = categoria;
    console.log(`   [OK] ${cat.nome} (${cat.emoji})`);
  }

  // 4. Ler data.json
  console.log('\n4. Importando comercios do data.json...');
  const dataPath = path.join(__dirname, '..', '..', 'data', 'data.json');
  
  if (!fs.existsSync(dataPath)) {
    console.error('   ERRO: data/data.json nao encontrado!');
    console.error(`   Esperado em: ${dataPath}`);
    return;
  }

  const rawData = fs.readFileSync(dataPath, 'utf-8');
  const data = JSON.parse(rawData);

  // 5. Importar comercios
  for (const c of data.comercios) {
    const categoriaKey = normalizeCategoriaKey(c.categoria);
    const categoria = categoriasCriadas[categoriaKey];

    if (!categoria) {
      console.warn(`   [SKIP] Categoria '${categoriaKey}' nao mapeada para: ${c.nome}`);
      continue;
    }

    // Criar ou atualizar comercio
    const comercio = await prisma.comercio.upsert({
      where: { slug: c.slug },
      update: {
        nome: c.nome,
        categoriaId: categoria.id,
        tags: JSON.stringify(c.tags || []),
        emoji: c.emoji || '',
        aberto: c.aberto,
        endereco: c.endereco,
        lat: c.lat,
        lng: c.lng,
        tel: c.tel || null,
        whatsapp: c.whatsapp,
        horario: c.horario,
        fotos: JSON.stringify(c.fotos || []),
        visitas: c.visitas || 0,
        recomendados: c.recomendados || 0,
        ownerId: admin.id
      },
      create: {
        slug: c.slug,
        nome: c.nome,
        categoriaId: categoria.id,
        tags: JSON.stringify(c.tags || []),
        emoji: c.emoji || '',
        aberto: c.aberto,
        endereco: c.endereco,
        lat: c.lat,
        lng: c.lng,
        tel: c.tel || null,
        whatsapp: c.whatsapp,
        horario: c.horario,
        fotos: JSON.stringify(c.fotos || []),
        visitas: c.visitas || 0,
        recomendados: c.recomendados || 0,
        ownerId: admin.id
      }
    });

    console.log(`   [OK] ${comercio.nome} (${categoria.nome})`);

    // 5a. Importar promocao
    if (c.promo && c.promo.ativo) {
      await prisma.promocao.upsert({
        where: { comercioId: comercio.id },
        update: {
          ativo: true,
          descricao: c.promo.desc,
          preco: c.promo.preco,
          original: c.promo.original
        },
        create: {
          comercioId: comercio.id,
          ativo: true,
          descricao: c.promo.desc,
          preco: c.promo.preco,
          original: c.promo.original
        }
      });
      console.log(`        + Promo: ${c.promo.desc}`);
    }

    // 5b. Importar catalogo de produtos
    if (c.catalogo && c.catalogo.length > 0) {
      // Limpar produtos existentes e reimportar
      await prisma.produto.deleteMany({ where: { comercioId: comercio.id } });

      for (let i = 0; i < c.catalogo.length; i++) {
        const prod = c.catalogo[i];
        await prisma.produto.create({
          data: {
            comercioId: comercio.id,
            nome: prod.nome_produto,
            descricao: prod.descricao || '',
            preco: prod.preco,
            ordem: i
          }
        });
      }
      console.log(`        + ${c.catalogo.length} produtos no catalogo`);
    }

    // 5c. Criar avaliacoes demo (baseadas no rating original)
    const avaliacoesCount = await prisma.avaliacao.count({
      where: { comercioId: comercio.id }
    });

    if (avaliacoesCount === 0 && c.rating) {
      // Criar 3-5 avaliacoes demo para simular o rating original
      const numAvaliacoes = Math.floor(Math.random() * 3) + 3; // 3 a 5
      for (let i = 0; i < numAvaliacoes; i++) {
        // Variar nota ao redor do rating original
        const variacao = (Math.random() - 0.5) * 1; // -0.5 a +0.5
        let nota = Math.round(c.rating + variacao);
        nota = Math.max(1, Math.min(5, nota));

        await prisma.avaliacao.create({
          data: {
            comercioId: comercio.id,
            userId: admin.id,
            nota,
            comentario: null
          }
        });
      }
      console.log(`        + ${numAvaliacoes} avaliacoes demo`);
    }
  }

  // Resumo
  const counts = await Promise.all([
    prisma.user.count(),
    prisma.categoria.count(),
    prisma.comercio.count(),
    prisma.produto.count(),
    prisma.promocao.count(),
    prisma.avaliacao.count()
  ]);

  console.log('\n=== Seed concluido com sucesso! ===');
  console.log(`   Usuarios:    ${counts[0]}`);
  console.log(`   Categorias:  ${counts[1]}`);
  console.log(`   Comercios:   ${counts[2]}`);
  console.log(`   Produtos:    ${counts[3]}`);
  console.log(`   Promocoes:   ${counts[4]}`);
  console.log(`   Avaliacoes:  ${counts[5]}`);
  console.log('\n   Admin e comerciante demo criados. Senhas não são exibidas no log.\n');
}

seed()
  .catch(e => {
    console.error('Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
