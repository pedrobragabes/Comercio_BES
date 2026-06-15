// ===========================================
// Controller - Categorias
// ===========================================
const fs = require('fs');
const path = require('path');
const prisma = require('../lib/prisma');

const dataJsonCandidates = [
  path.join(__dirname, '..', '..', 'public', 'data', 'data.json'),
  path.join(__dirname, '..', '..', '..', 'data', 'data.json')
];

function getDataJsonPath() {
  const found = dataJsonCandidates.find(candidate => fs.existsSync(candidate));
  if (!found) {
    throw new Error('data.json nao encontrado para fallback publico');
  }
  return found;
}

const categoriasBase = {
  restaurante: { nome: 'Restaurante', slug: 'restaurante', emoji: '🍽️' },
  farmacia: { nome: 'Farmacia', slug: 'farmacia', emoji: '💊' },
  pet: { nome: 'Pet Shop', slug: 'pet', emoji: '🐾' },
  mecanica: { nome: 'Mecanica', slug: 'mecanica', emoji: '🔧' },
  barbearia: { nome: 'Barbearia', slug: 'barbearia', emoji: '💈' },
  supermercado: { nome: 'Supermercado', slug: 'supermercado', emoji: '🛒' },
  moda: { nome: 'Moda', slug: 'moda', emoji: '👗' },
  salao: { nome: 'Salao', slug: 'salao', emoji: '💅' },
  padaria: { nome: 'Padaria', slug: 'padaria', emoji: '🍞' },
  gas: { nome: 'Gas', slug: 'gas', emoji: '🔥' },
  material: { nome: 'Material de Construcao', slug: 'material', emoji: '🏗️' }
};

const categoriaAliases = {
  'farmacia': 'farmacia',
  'farmácia': 'farmacia',
  'gas': 'gas',
  'gás': 'gas',
  'mecanica': 'mecanica',
  'mecânica': 'mecanica',
  'salao': 'salao',
  'salão': 'salao',
  'roupa': 'moda',
  'moda': 'moda',
  'material': 'material',
  'material de construcao': 'material',
  'material de construção': 'material'
};

function normalizeCategoriaSlug(value) {
  const raw = String(value || '').toLowerCase().trim();
  const ascii = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return categoriaAliases[raw] || categoriaAliases[ascii] || ascii;
}

function fallbackCategorias() {
  const raw = fs.readFileSync(getDataJsonPath(), 'utf8');
  const data = JSON.parse(raw);
  const counts = new Map();

  for (const comercio of data.comercios || []) {
    const slug = normalizeCategoriaSlug(comercio.categoriaSlug || comercio.categoria);
    counts.set(slug, (counts.get(slug) || 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([slug, totalComercios], index) => ({
      id: index + 1,
      nome: categoriasBase[slug]?.nome || slug,
      slug,
      emoji: categoriasBase[slug]?.emoji || '',
      totalComercios
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

// GET /api/categorias
async function listar(req, res, next) {
  try {
    const categorias = await prisma.categoria.findMany({
      include: {
        _count: {
          select: { comercios: true }
        }
      },
      orderBy: { nome: 'asc' }
    });

    res.json(categorias.map(c => ({
      id: c.id,
      nome: c.nome,
      slug: c.slug,
      emoji: c.emoji,
      totalComercios: c._count.comercios
    })));
  } catch (err) {
    console.warn(`[Categorias] Banco indisponivel; usando data.json: ${err.message}`);
    res.set('X-Data-Source', 'data-json');
    res.json(fallbackCategorias());
  }
}

// POST /api/categorias (admin only)
async function criar(req, res, next) {
  try {
    const { nome, slug, emoji } = req.body;

    if (!nome || !slug) {
      return res.status(400).json({ error: 'nome e slug sao obrigatorios' });
    }

    const categoria = await prisma.categoria.create({
      data: { nome, slug, emoji: emoji || '' }
    });

    res.status(201).json({ message: 'Categoria criada', categoria });
  } catch (err) {
    next(err);
  }
}

// PUT /api/categorias/:id (admin only)
async function atualizar(req, res, next) {
  try {
    const { nome, slug, emoji } = req.body;
    const data = {};

    if (nome !== undefined) data.nome = nome;
    if (slug !== undefined) data.slug = slug;
    if (emoji !== undefined) data.emoji = emoji;

    const categoria = await prisma.categoria.update({
      where: { id: parseInt(req.params.id) },
      data
    });

    res.json({ message: 'Categoria atualizada', categoria });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/categorias/:id (admin only)
async function excluir(req, res, next) {
  try {
    // Verificar se ha comercios nesta categoria
    const count = await prisma.comercio.count({
      where: { categoriaId: parseInt(req.params.id) }
    });

    if (count > 0) {
      return res.status(400).json({
        error: `Nao e possivel excluir: ${count} comercios usam esta categoria`
      });
    }

    await prisma.categoria.delete({
      where: { id: parseInt(req.params.id) }
    });

    res.json({ message: 'Categoria excluida' });
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, criar, atualizar, excluir };
