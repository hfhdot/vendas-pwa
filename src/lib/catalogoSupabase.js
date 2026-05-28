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
