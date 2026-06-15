// ===========================================
// Controller - Comercios
// ===========================================
const slugify = require('slugify');
const fs = require('fs');
const path = require('path');
const prisma = require('../lib/prisma');
const sanitize = require('../lib/sanitize');

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

// Formatar comercio para resposta (converte JSON strings em arrays)
function formatarComercio(c) {
  // Calcular rating medio das avaliacoes
  let rating = 0;
  if (c.avaliacoes && c.avaliacoes.length > 0) {
    const soma = c.avaliacoes.reduce((acc, a) => acc + a.nota, 0);
    rating = Math.round((soma / c.avaliacoes.length) * 10) / 10;
  }

  const resultado = {
    id: c.id,
    slug: c.slug,
    nome: c.nome,
    categoria: c.categoria?.nome || '',
    categoriaSlug: c.categoria?.slug || '',
    tags: safeParseJSON(c.tags, []),
    emoji: c.emoji,
    rating: rating,
    totalAvaliacoes: c.avaliacoes?.length || 0,
    visitas: c.visitas,
    recomendados: c.recomendados,
    aberto: c.aberto,
    descricao: c.descricao,
    endereco: c.endereco,
    lat: c.lat,
    lng: c.lng,
    tel: c.tel,
    whatsapp: c.whatsapp,
    horario: c.horario,
    fotos: safeParseJSON(c.fotos, []),
    promo: c.promocao ? {
      ativo: c.promocao.ativo,
      desc: c.promocao.descricao,
      preco: c.promocao.preco,
      original: c.promocao.original
    } : null,
    catalogo: c.produtos ? c.produtos.map(p => ({
      id: p.id,
      nome_produto: p.nome,
      descricao: p.descricao,
      preco: p.preco,
      imagem: p.imagem,
      disponivel: p.disponivel
    })) : null,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt
  };

  return resultado;
}

function safeParseJSON(str, fallback) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

function loadFallbackComercios() {
  const raw = fs.readFileSync(getDataJsonPath(), 'utf8');
  const data = JSON.parse(raw);
  return Array.isArray(data.comercios) ? data.comercios : [];
}

function normalizeCategoriaSlug(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace('roupa', 'moda');
}

function normalizeFallbackComercio(c) {
  const categoriaSlug = normalizeCategoriaSlug(c.categoriaSlug || c.categoria);
  return {
    ...c,
    categoriaSlug,
    totalAvaliacoes: c.totalAvaliacoes || 0,
    catalogo: c.catalogo || [],
    descricao: c.descricao || null,
    createdAt: c.createdAt || null,
    updatedAt: c.updatedAt || null,
  };
}

function filterFallbackComercios(comercios, query) {
  let result = comercios.map(normalizeFallbackComercio);

  if (query.busca) {
    const busca = String(query.busca).toLowerCase();
    result = result.filter(c => (
      c.nome?.toLowerCase().includes(busca) ||
      c.endereco?.toLowerCase().includes(busca) ||
      (c.tags || []).some(t => String(t).toLowerCase().includes(busca))
    ));
  }

  if (query.categoria) {
    const categoria = normalizeCategoriaSlug(query.categoria);
    result = result.filter(c => c.categoriaSlug === categoria);
  }

  if (query.aberto !== undefined) {
    result = result.filter(c => c.aberto === (query.aberto === 'true'));
  }

  const orderBy = query.orderBy || 'rating';
  result.sort((a, b) => {
    if (orderBy === 'nome') return String(a.nome).localeCompare(String(b.nome));
    if (orderBy === 'visitas') return (b.visitas || 0) - (a.visitas || 0);
    return (b.recomendados || 0) - (a.recomendados || 0);
  });

  return result;
}

function sendFallbackList(req, res, err) {
  console.warn(`[Comercios] Banco indisponivel; usando data.json: ${err.message}`);
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const take = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const filtered = filterFallbackComercios(loadFallbackComercios(), req.query);
  const skip = (page - 1) * take;
  res.set('X-Data-Source', 'data-json');
  return res.json({
    comercios: filtered.slice(skip, skip + take),
    paginacao: {
      total: filtered.length,
      pagina: page,
      porPagina: take,
      totalPaginas: Math.ceil(filtered.length / take)
    }
  });
}

function sendFallbackBySlug(req, res, err) {
  console.warn(`[Comercios] Banco indisponivel; usando data.json: ${err.message}`);
  const comercio = loadFallbackComercios()
    .map(normalizeFallbackComercio)
    .find(c => c.slug === req.params.slug);

  if (!comercio) {
    return res.status(404).json({ error: 'Comercio nao encontrado' });
  }

  res.set('X-Data-Source', 'data-json');
  return res.json(comercio);
}

// Includes comuns para queries
const includeCompleto = {
  categoria: true,
  produtos: { orderBy: { ordem: 'asc' } },
  promocao: true,
  avaliacoes: { select: { nota: true } }
};

// GET /api/comercios
async function listar(req, res, next) {
  try {
    const {
      busca,
      categoria,
      aberto,
      orderBy = 'rating',
      page = 1,
      limit = 20
    } = req.query;

    const where = {};

    // Filtro por busca (nome, tags)
    if (busca) {
      where.OR = [
        { nome: { contains: busca } },
        { tags: { contains: busca } },
        { endereco: { contains: busca } }
      ];
    }

    // Filtro por categoria
    if (categoria) {
      where.categoria = { slug: categoria };
    }

    // Filtro por status aberto/fechado
    if (aberto !== undefined) {
      where.aberto = aberto === 'true';
    }

    // Ordenacao
    let orderByClause = {};
    switch (orderBy) {
      case 'nome':
        orderByClause = { nome: 'asc' };
        break;
      case 'visitas':
        orderByClause = { visitas: 'desc' };
        break;
      case 'recente':
        orderByClause = { createdAt: 'desc' };
        break;
      case 'rating':
      default:
        orderByClause = { recomendados: 'desc' }; // Aproximacao; rating real e calculado
        break;
    }

    const skip = (Math.max(1, parseInt(page, 10) || 1) - 1) * Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const take = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    const [comercios, total] = await Promise.all([
      prisma.comercio.findMany({
        where,
        include: includeCompleto,
        orderBy: orderByClause,
        skip,
        take
      }),
      prisma.comercio.count({ where })
    ]);

    res.json({
      comercios: comercios.map(formatarComercio),
      paginacao: {
        total,
        pagina: Math.max(1, parseInt(page, 10) || 1),
        porPagina: take,
        totalPaginas: Math.ceil(total / take)
      }
    });
  } catch (err) {
    return sendFallbackList(req, res, err);
  }
}

// GET /api/comercios/:slug
async function buscarPorSlug(req, res, next) {
  try {
    const comercio = await prisma.comercio.findUnique({
      where: { slug: req.params.slug },
      include: {
        ...includeCompleto,
        avaliacoes: {
          include: { user: { select: { id: true, nome: true } } },
          orderBy: { createdAt: 'desc' },
          take: 20
        }
      }
    });

    if (!comercio) {
      return res.status(404).json({ error: 'Comercio nao encontrado' });
    }

    res.json(formatarComercio(comercio));
  } catch (err) {
    return sendFallbackBySlug(req, res, err);
  }
}

// POST /api/comercios
async function criar(req, res, next) {
  try {
    const {
      nome, categoriaId, tags, emoji, descricao,
      aberto, endereco, lat, lng, tel, whatsapp,
      horario, fotos
    } = req.body;

    if (!nome || !categoriaId || !endereco || !whatsapp || !horario) {
      return res.status(400).json({
        error: 'nome, categoriaId, endereco, whatsapp e horario sao obrigatorios'
      });
    }

    // Validar whatsapp - apenas digitos
    const whatsappLimpo = whatsapp.replace(/\D/g, '');
    if (whatsappLimpo.length < 10 || whatsappLimpo.length > 15) {
      return res.status(400).json({ error: 'Numero de WhatsApp invalido' });
    }

    // Verificar se categoria existe
    const catId = parseInt(categoriaId, 10);
    if (isNaN(catId)) {
      return res.status(400).json({ error: 'categoriaId invalido' });
    }

    const categoria = await prisma.categoria.findUnique({
      where: { id: catId }
    });
    if (!categoria) {
      return res.status(400).json({ error: 'Categoria nao encontrada' });
    }

    const slug = slugify(nome, { lower: true, strict: true });

    // Verificar slug unico
    const slugExistente = await prisma.comercio.findUnique({ where: { slug } });
    if (slugExistente) {
      return res.status(409).json({ error: 'Ja existe um comercio com nome similar' });
    }

    const comercio = await prisma.comercio.create({
      data: {
        slug,
        nome: sanitize(nome),
        categoriaId: catId,
        tags: JSON.stringify(tags || []),
        emoji: sanitize(emoji) || categoria.emoji || '',
        descricao: sanitize(descricao) || null,
        aberto: aberto !== undefined ? aberto : true,
        endereco: sanitize(endereco),
        lat: parseFloat(lat) || 0,
        lng: parseFloat(lng) || 0,
        tel: sanitize(tel) || null,
        whatsapp: whatsappLimpo,
        horario: sanitize(horario),
        fotos: JSON.stringify(fotos || []),
        ownerId: req.userId
      },
      include: includeCompleto
    });

    res.status(201).json({
      message: 'Comercio criado com sucesso',
      comercio: formatarComercio(comercio)
    });
  } catch (err) {
    next(err);
  }
}

// PUT /api/comercios/:slug
async function atualizar(req, res, next) {
  try {
    const comercioExistente = await prisma.comercio.findUnique({
      where: { slug: req.params.slug }
    });

    if (!comercioExistente) {
      return res.status(404).json({ error: 'Comercio nao encontrado' });
    }

    // Verificar permissao: dono ou admin
    if (req.userTipo !== 'admin' && comercioExistente.ownerId !== req.userId) {
      return res.status(403).json({ error: 'Sem permissao para editar este comercio' });
    }

    const {
      nome, categoriaId, tags, emoji, descricao,
      aberto, endereco, lat, lng, tel, whatsapp,
      horario, fotos
    } = req.body;

    const data = {};
    if (nome !== undefined) {
      data.nome = sanitize(nome);
      data.slug = slugify(nome, { lower: true, strict: true });
    }
    if (categoriaId !== undefined) {
      const catId = parseInt(categoriaId, 10);
      if (!isNaN(catId)) data.categoriaId = catId;
    }
    if (tags !== undefined) data.tags = JSON.stringify(tags);
    if (emoji !== undefined) data.emoji = sanitize(emoji);
    if (descricao !== undefined) data.descricao = sanitize(descricao);
    if (aberto !== undefined) data.aberto = aberto;
    if (endereco !== undefined) data.endereco = sanitize(endereco);
    if (lat !== undefined) data.lat = parseFloat(lat);
    if (lng !== undefined) data.lng = parseFloat(lng);
    if (tel !== undefined) data.tel = sanitize(tel);
    if (whatsapp !== undefined) {
      const whatsappLimpo = String(whatsapp).replace(/\D/g, '');
      if (whatsappLimpo.length >= 10 && whatsappLimpo.length <= 15) {
        data.whatsapp = whatsappLimpo;
      }
    }
    if (horario !== undefined) data.horario = sanitize(horario);
    if (fotos !== undefined) data.fotos = JSON.stringify(fotos);

    const comercio = await prisma.comercio.update({
      where: { slug: req.params.slug },
      data,
      include: includeCompleto
    });

    res.json({
      message: 'Comercio atualizado',
      comercio: formatarComercio(comercio)
    });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/comercios/:slug
async function excluir(req, res, next) {
  try {
    const comercio = await prisma.comercio.findUnique({
      where: { slug: req.params.slug }
    });

    if (!comercio) {
      return res.status(404).json({ error: 'Comercio nao encontrado' });
    }

    // Verificar permissao: dono ou admin
    if (req.userTipo !== 'admin' && comercio.ownerId !== req.userId) {
      return res.status(403).json({ error: 'Sem permissao para excluir este comercio' });
    }

    await prisma.comercio.delete({ where: { slug: req.params.slug } });

    res.json({ message: 'Comercio excluido com sucesso' });
  } catch (err) {
    next(err);
  }
}

// --- Produtos (catalogo) ---

// POST /api/comercios/:slug/produtos
async function adicionarProduto(req, res, next) {
  try {
    const comercio = await prisma.comercio.findUnique({
      where: { slug: req.params.slug }
    });

    if (!comercio) {
      return res.status(404).json({ error: 'Comercio nao encontrado' });
    }

    if (req.userTipo !== 'admin' && comercio.ownerId !== req.userId) {
      return res.status(403).json({ error: 'Sem permissao' });
    }

    const { nome, descricao, preco, imagem, disponivel, ordem } = req.body;

    if (!nome || preco === undefined) {
      return res.status(400).json({ error: 'nome e preco sao obrigatorios' });
    }

    const produto = await prisma.produto.create({
      data: {
        comercioId: comercio.id,
        nome: sanitize(nome),
        descricao: sanitize(descricao) || '',
        preco: parseFloat(preco),
        imagem: imagem || null,
        disponivel: disponivel !== undefined ? disponivel : true,
        ordem: parseInt(ordem, 10) || 0
      }
    });

    res.status(201).json({ message: 'Produto adicionado', produto });
  } catch (err) {
    next(err);
  }
}

// PUT /api/comercios/:slug/produtos/:produtoId
async function atualizarProduto(req, res, next) {
  try {
    const comercio = await prisma.comercio.findUnique({
      where: { slug: req.params.slug }
    });

    if (!comercio) {
      return res.status(404).json({ error: 'Comercio nao encontrado' });
    }

    if (req.userTipo !== 'admin' && comercio.ownerId !== req.userId) {
      return res.status(403).json({ error: 'Sem permissao' });
    }

    const produtoId = parseInt(req.params.produtoId, 10);
    if (isNaN(produtoId)) {
      return res.status(400).json({ error: 'produtoId invalido' });
    }

    // Verificar que o produto pertence a este comercio (prevenir IDOR)
    const produtoExistente = await prisma.produto.findFirst({
      where: { id: produtoId, comercioId: comercio.id }
    });
    if (!produtoExistente) {
      return res.status(404).json({ error: 'Produto nao encontrado neste comercio' });
    }

    const { nome, descricao, preco, imagem, disponivel, ordem } = req.body;
    const data = {};

    if (nome !== undefined) data.nome = sanitize(nome);
    if (descricao !== undefined) data.descricao = sanitize(descricao);
    if (preco !== undefined) data.preco = parseFloat(preco);
    if (imagem !== undefined) data.imagem = imagem;
    if (disponivel !== undefined) data.disponivel = disponivel;
    if (ordem !== undefined) data.ordem = parseInt(ordem, 10) || 0;

    const produto = await prisma.produto.update({
      where: { id: produtoId },
      data
    });

    res.json({ message: 'Produto atualizado', produto });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/comercios/:slug/produtos/:produtoId
async function excluirProduto(req, res, next) {
  try {
    const comercio = await prisma.comercio.findUnique({
      where: { slug: req.params.slug }
    });

    if (!comercio) {
      return res.status(404).json({ error: 'Comercio nao encontrado' });
    }

    if (req.userTipo !== 'admin' && comercio.ownerId !== req.userId) {
      return res.status(403).json({ error: 'Sem permissao' });
    }

    const produtoId = parseInt(req.params.produtoId, 10);
    if (isNaN(produtoId)) {
      return res.status(400).json({ error: 'produtoId invalido' });
    }

    // Verificar que o produto pertence a este comercio (prevenir IDOR)
    const produtoExistente = await prisma.produto.findFirst({
      where: { id: produtoId, comercioId: comercio.id }
    });
    if (!produtoExistente) {
      return res.status(404).json({ error: 'Produto nao encontrado neste comercio' });
    }

    await prisma.produto.delete({
      where: { id: produtoId }
    });

    res.json({ message: 'Produto excluido' });
  } catch (err) {
    next(err);
  }
}

// --- Promocoes ---

// PUT /api/comercios/:slug/promocao
async function definirPromocao(req, res, next) {
  try {
    const comercio = await prisma.comercio.findUnique({
      where: { slug: req.params.slug }
    });

    if (!comercio) {
      return res.status(404).json({ error: 'Comercio nao encontrado' });
    }

    if (req.userTipo !== 'admin' && comercio.ownerId !== req.userId) {
      return res.status(403).json({ error: 'Sem permissao' });
    }

    const { ativo, descricao, preco, original } = req.body;

    if (!descricao || !preco || !original) {
      return res.status(400).json({ error: 'descricao, preco e original sao obrigatorios' });
    }

    const promocao = await prisma.promocao.upsert({
      where: { comercioId: comercio.id },
      create: {
        comercioId: comercio.id,
        ativo: ativo !== undefined ? ativo : true,
        descricao: sanitize(descricao),
        preco: sanitize(preco),
        original: sanitize(original)
      },
      update: {
        ativo: ativo !== undefined ? ativo : true,
        descricao: sanitize(descricao),
        preco: sanitize(preco),
        original: sanitize(original)
      }
    });

    res.json({ message: 'Promocao atualizada', promocao });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/comercios/:slug/promocao
async function removerPromocao(req, res, next) {
  try {
    const comercio = await prisma.comercio.findUnique({
      where: { slug: req.params.slug }
    });

    if (!comercio) {
      return res.status(404).json({ error: 'Comercio nao encontrado' });
    }

    if (req.userTipo !== 'admin' && comercio.ownerId !== req.userId) {
      return res.status(403).json({ error: 'Sem permissao' });
    }

    await prisma.promocao.deleteMany({
      where: { comercioId: comercio.id }
    });

    res.json({ message: 'Promocao removida' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listar, buscarPorSlug, criar, atualizar, excluir,
  adicionarProduto, atualizarProduto, excluirProduto,
  definirPromocao, removerPromocao
};
