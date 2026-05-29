// Cross-reference do catalogo curado (DESIGN) com a tabela `produtos` do Supabase
// para trazer estoque agregado e preco em runtime.

import { supabase } from './sync'

// Cache em memoria por sessao (evita refetch a cada navegacao)
const cache = new Map()

/**
 * Busca SKUs no Supabase que casam com o produto do catalogo curado.
 * Retorna agregado pronto pra UI.
 *
 * @param {object} produto - JSON do catalogo curado
 * @returns {Promise<{matched: boolean, sku_count: number, estoque_total: number,
 *                    valor_min: number|null, valor_max: number|null,
 *                    valor_medio: number|null, ambientes: string[],
 *                    atualizado_em: string|null, skus: Array}>}
 */
export async function getEstoqueProduto(produto) {
  const filtro = produto.filtro_supabase
  const modelos = produto.modelos_supabase || []

  if (!filtro || modelos.length === 0) {
    return { matched: false, sku_count: 0, estoque_total: 0, valor_min: null, valor_max: null, valor_medio: null, ambientes: [], atualizado_em: null, skus: [] }
  }

  const cacheKey = `${produto.id}|${modelos.join(',')}`
  if (cache.has(cacheKey)) return cache.get(cacheKey)

  try {
    let q = supabase
      .from('produtos')
      .select('codigo, modelo, estoque, valor_unitario, ambiente, atualizado_em, descricao')
      .in('modelo', modelos)
      .in('familia_nome', filtro.familia_nome)

    if (filtro.marca_like) {
      q = q.ilike('marca', `%${filtro.marca_like}%`)
    }

    const { data, error } = await q

    if (error) {
      console.error('[catalogo cross-ref]', error.message)
      return { matched: false, sku_count: 0, estoque_total: 0, valor_min: null, valor_max: null, valor_medio: null, ambientes: [], atualizado_em: null, skus: [] }
    }

    const skus = data || []
    const estoque_total = skus.reduce((s, r) => s + (Number(r.estoque) || 0), 0)
    const valores = skus.map((r) => Number(r.valor_unitario) || 0).filter((v) => v > 0)
    const valor_min = valores.length ? Math.min(...valores) : null
    const valor_max = valores.length ? Math.max(...valores) : null
    const valor_medio = valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : null
    const ambientes = [...new Set(skus.map((r) => r.ambiente).filter(Boolean))]
    const atualizado_em = skus
      .map((r) => r.atualizado_em)
      .filter(Boolean)
      .sort()
      .pop() || null

    const result = {
      matched: true,
      sku_count: skus.length,
      estoque_total,
      valor_min,
      valor_max,
      valor_medio,
      ambientes,
      atualizado_em,
      skus,
    }
    cache.set(cacheKey, result)
    return result
  } catch (err) {
    console.error('[catalogo cross-ref]', err)
    return { matched: false, sku_count: 0, estoque_total: 0, valor_min: null, valor_max: null, valor_medio: null, ambientes: [], atualizado_em: null, skus: [] }
  }
}

export function clearCache() {
  cache.clear()
}

export function formatBRL(v) {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

export function frescorEstoque(atualizado_em) {
  if (!atualizado_em) return { label: '—', color: 'text-slate-400' }
  const ms = Date.now() - new Date(atualizado_em).getTime()
  const dias = Math.floor(ms / 86400000)
  if (dias < 1) return { label: 'Atualizado hoje', color: 'text-green-600' }
  if (dias < 7) return { label: `Atualizado ${dias}d atrás`, color: 'text-green-600' }
  if (dias < 30) return { label: `Atualizado ${dias}d atrás`, color: 'text-amber-600' }
  return { label: `Atualizado ${dias}d atrás`, color: 'text-red-600' }
}

// ====================================================================
// ESTOQUE ATUAL: produtos diretos do Supabase (ambiente=patio)
// + overrides de admin (preço/estoque manual + visibilidade)
// ====================================================================

let estoqueAtualCache = null
let overridesCache = null

/**
 * Busca produtos do "Estoque atual" — ambiente=patio, ativos, não arquivados,
 * não-peças. Faz merge com a tabela catalogo_overrides para preço/estoque
 * sobrescritos manualmente pelo admin.
 */
export async function getEstoqueAtual({ force = false } = {}) {
  if (!force && estoqueAtualCache) return estoqueAtualCache

  const [produtosRes, overridesRes] = await Promise.all([
    supabase
      .from('produtos')
      .select('codigo_produto, codigo, descricao, marca, modelo, familia_nome, estoque, valor_unitario, imagem_url, ambiente, atualizado_em')
      .eq('ambiente', 'patio')
      .eq('inativo', false)
      .eq('arquivado', false)
      .neq('familia_nome', 'Peças')
      .order('familia_nome', { ascending: true })
      .order('descricao', { ascending: true }),
    supabase
      .from('catalogo_overrides')
      .select('*'),
  ])

  if (produtosRes.error) {
    console.error('[Estoque atual]', produtosRes.error.message)
    return []
  }

  const overrides = {}
  if (!overridesRes.error && overridesRes.data) {
    for (const o of overridesRes.data) overrides[o.codigo_produto] = o
  }
  overridesCache = overrides

  const merged = (produtosRes.data || []).map((p) => {
    const ov = overrides[p.codigo_produto]
    return {
      ...p,
      preco_efetivo: ov?.preco_override != null ? Number(ov.preco_override) : Number(p.valor_unitario) || 0,
      estoque_efetivo: ov?.estoque_override != null ? Number(ov.estoque_override) : Number(p.estoque) || 0,
      visivel: ov?.visivel !== false,
      tem_override: !!ov,
      override: ov || null,
    }
  })

  // Filtra invisíveis e zerados (não mostra produto sem estoque na vitrine)
  const visiveis = merged.filter((p) => p.visivel && p.estoque_efetivo > 0)

  // Agrupa por modelo (case-insensitive). Modelo vazio = item individual.
  const grupos = new Map()  // key -> { items: [], total: ... }
  for (const p of visiveis) {
    const modeloNorm = (p.modelo || '').trim().toUpperCase()
    const key = modeloNorm ? `m:${modeloNorm}` : `i:${p.codigo_produto}`
    if (!grupos.has(key)) grupos.set(key, [])
    grupos.get(key).push(p)
  }

  // Cada grupo vira 1 card. Atributos agregados.
  const resultado = []
  for (const items of grupos.values()) {
    const primario = items[0]                                       // pra rota /catalogo/sb-{id}
    const estoque_total = items.reduce((s, x) => s + x.estoque_efetivo, 0)
    const precos = items.map((x) => x.preco_efetivo).filter((v) => v > 0)
    const preco_min = precos.length ? Math.min(...precos) : 0
    const preco_max = precos.length ? Math.max(...precos) : 0
    const imagem_url = items.map((x) => x.imagem_url).find((u) => !!u) || null
    resultado.push({
      ...primario,
      estoque_efetivo: estoque_total,       // soma do grupo
      preco_efetivo: preco_min || 0,        // referência (card mostra faixa via preco_min/max)
      preco_min,
      preco_max,
      imagem_url,
      n_variacoes: items.length,
      grupo_codigos: items.map((x) => x.codigo_produto),
    })
  }

  estoqueAtualCache = resultado
  return estoqueAtualCache
}

/**
 * Busca 1 produto do Estoque atual por codigo_produto.
 * Aceita string ou number.
 */
export async function getEstoqueAtualById(codigoProduto) {
  const id = Number(codigoProduto)
  const lista = await getEstoqueAtual()
  return lista.find((p) => p.codigo_produto === id) || null
}

/**
 * Lista TODOS produtos do escopo (inclui invisíveis) — pra tela admin.
 */
export async function getProdutosAdmin() {
  const { data, error } = await supabase
    .from('produtos')
    .select('codigo_produto, codigo, descricao, marca, modelo, familia_nome, estoque, valor_unitario, imagem_url, atualizado_em')
    .eq('ambiente', 'patio')
    .eq('inativo', false)
    .eq('arquivado', false)
    .neq('familia_nome', 'Peças')
    .order('descricao', { ascending: true })
  if (error) throw error

  const { data: overridesData } = await supabase.from('catalogo_overrides').select('*')
  const overrides = {}
  for (const o of (overridesData || [])) overrides[o.codigo_produto] = o

  return (data || []).map((p) => ({
    ...p,
    override: overrides[p.codigo_produto] || null,
  }))
}

/**
 * Upsert de override (admin).
 */
export async function salvarOverride(codigoProduto, fields, supervisorId) {
  const payload = {
    codigo_produto: codigoProduto,
    ...fields,
    updated_at: new Date().toISOString(),
    updated_by: supervisorId,
  }
  const { error } = await supabase
    .from('catalogo_overrides')
    .upsert(payload, { onConflict: 'codigo_produto' })
  if (error) throw error
  // Limpa cache pra próximas leituras pegarem o valor novo
  estoqueAtualCache = null
  overridesCache = null
}

export function clearEstoqueCache() {
  estoqueAtualCache = null
  overridesCache = null
}
