import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getProdutoById } from '../data/catalogo'
import { getEstoqueProduto, formatBRL, frescorEstoque } from '../lib/catalogoSupabase'

export default function CatalogoDetalhe() {
  const { id } = useParams()
  const produto = getProdutoById(id)
  const [estoque, setEstoque] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!produto) {
      setLoading(false)
      return
    }
    let alive = true
    getEstoqueProduto(produto).then((data) => {
      if (alive) {
        setEstoque(data)
        setLoading(false)
      }
    })
    return () => { alive = false }
  }, [produto?.id])

  if (!produto) {
    return (
      <div className="text-center py-12">
        <p className="text-4xl mb-3">❓</p>
        <p className="text-slate-400">Produto não encontrado</p>
        <Link to="/catalogo" className="text-blue-700 text-sm mt-3 inline-block">← Voltar ao catálogo</Link>
      </div>
    )
  }

  const fotoPrincipal = `/catalogo/fotos/${produto.id}/foto-principal.webp`

  return (
    <div className="pb-4">
      <Link to="/catalogo" className="text-blue-700 text-sm inline-block mb-2">← Catálogo</Link>

      <div className="bg-white rounded-xl shadow overflow-hidden mb-3 animate-fade-in">
        <div className="aspect-video bg-slate-100 flex items-center justify-center">
          <img
            src={fotoPrincipal}
            alt={produto.titulo}
            className="w-full h-full object-contain"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
              e.currentTarget.parentElement.innerHTML = '<span class="text-6xl">📷</span>'
            }}
          />
        </div>
        <div className="p-4">
          <h2 className="text-xl font-bold leading-tight">{produto.titulo}</h2>
          {produto.subtitulo && (
            <p className="text-sm text-slate-500 mt-0.5">{produto.subtitulo}</p>
          )}
          <span className="inline-block mt-2 text-[10px] uppercase tracking-wider bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
            {produto.categoria}
          </span>
        </div>
      </div>

      {/* Estoque e preco do Supabase */}
      <div className="bg-white rounded-xl shadow p-4 mb-3 animate-fade-in" style={{ animationDelay: '0.05s' }}>
        {loading ? (
          <p className="text-sm text-slate-400">Consultando estoque...</p>
        ) : !estoque?.matched ? (
          <div>
            <p className="text-sm text-amber-700 font-medium">Consulte disponibilidade e preço</p>
            <p className="text-xs text-slate-500 mt-1">Este produto não tem SKU mapeado no sistema. Confirme com o supervisor.</p>
          </div>
        ) : estoque.sku_count === 0 ? (
          <div>
            <p className="text-sm text-slate-700 font-medium">Sem estoque registrado</p>
            <p className="text-xs text-slate-500 mt-1">Nenhum SKU encontrado para {produto.modelos_supabase.join(', ')}.</p>
          </div>
        ) : (
          <div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-2xl font-bold text-green-700">{estoque.estoque_total}</span>
              <span className="text-xs text-slate-500">em estoque</span>
            </div>
            {estoque.valor_medio > 0 && (
              <p className="text-sm text-slate-700">
                {estoque.valor_min === estoque.valor_max
                  ? formatBRL(estoque.valor_medio)
                  : `${formatBRL(estoque.valor_min)} – ${formatBRL(estoque.valor_max)}`}
              </p>
            )}
            {estoque.ambientes.length > 0 && (
              <p className="text-xs text-slate-500 mt-1">
                Onde está: {estoque.ambientes.join(', ')}
              </p>
            )}
            <p className={`text-xs mt-1 ${frescorEstoque(estoque.atualizado_em).color}`}>
              {frescorEstoque(estoque.atualizado_em).label}
            </p>
          </div>
        )}
      </div>

      {/* Descricao */}
      {produto.descricao && (
        <div className="bg-white rounded-xl shadow p-4 mb-3 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <p className="text-sm text-slate-700 leading-relaxed">{produto.descricao}</p>
        </div>
      )}

      {/* Argumentos de venda */}
      {produto.argumentos_de_venda?.length > 0 && (
        <div className="bg-white rounded-xl shadow p-4 mb-3 animate-fade-in" style={{ animationDelay: '0.15s' }}>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Por que vender</h3>
          <ul className="space-y-1.5">
            {produto.argumentos_de_venda.map((arg, i) => (
              <li key={i} className="text-sm text-slate-700 flex gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <span>{arg}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Especificacoes */}
      {produto.especificacoes && Object.keys(produto.especificacoes).length > 0 && (
        <div className="bg-white rounded-xl shadow p-4 mb-3 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Especificações</h3>
          <dl className="grid grid-cols-1 gap-x-3 gap-y-1.5">
            {Object.entries(produto.especificacoes)
              .filter(([, v]) => v && v !== '')
              .map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-slate-100 pb-1.5">
                  <dt className="text-xs text-slate-500 capitalize">{k.replace(/_/g, ' ')}</dt>
                  <dd className="text-xs text-slate-700 font-medium text-right ml-2">{v}</dd>
                </div>
              ))}
          </dl>
        </div>
      )}

      {/* Folheto / ficha tecnica */}
      {produto.ficha_tecnica?.url_storage && (
        <a
          href={produto.ficha_tecnica.url_storage}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full bg-blue-700 text-white text-center py-3 rounded-xl font-medium text-sm active:bg-blue-800 animate-fade-in"
          style={{ animationDelay: '0.25s' }}
        >
          📄 Abrir folheto técnico
        </a>
      )}

      {/* Link pro site oficial */}
      {produto.url_site && (
        <a
          href={produto.url_site}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full bg-slate-100 text-slate-700 text-center py-2.5 rounded-xl text-xs mt-2 active:bg-slate-200 animate-fade-in"
          style={{ animationDelay: '0.3s' }}
        >
          Ver no site Mahindra ↗
        </a>
      )}
    </div>
  )
}
