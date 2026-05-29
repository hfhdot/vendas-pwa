import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { getProdutos, CATEGORIAS, getFotosLocais } from '../data/catalogo'
import { getEstoqueAtual, formatBRL } from '../lib/catalogoSupabase'
import PullToRefresh from '../components/PullToRefresh'

export default function Catalogo() {
  const [filtroCat, setFiltroCat] = useState('todos')
  const [busca, setBusca] = useState('')
  const [estoque, setEstoque] = useState([])
  const [loadingEstoque, setLoadingEstoque] = useState(true)
  const [aba, setAba] = useState('portfolio') // portfolio | estoque

  const produtos = useMemo(() => getProdutos(), [])

  useEffect(() => {
    let alive = true
    getEstoqueAtual().then((d) => {
      if (alive) {
        setEstoque(d)
        setLoadingEstoque(false)
      }
    })
    return () => { alive = false }
  }, [])

  const portfolioFiltrado = useMemo(() => {
    let arr = produtos
    if (filtroCat !== 'todos') arr = arr.filter((p) => p.categoria === filtroCat)
    if (busca) {
      const q = busca.toLowerCase()
      arr = arr.filter((p) =>
        p.titulo.toLowerCase().includes(q) ||
        p.subtitulo?.toLowerCase().includes(q) ||
        p.descricao?.toLowerCase().includes(q)
      )
    }
    return arr
  }, [produtos, filtroCat, busca])

  const estoqueFiltrado = useMemo(() => {
    if (!busca) return estoque
    const q = busca.toLowerCase()
    return estoque.filter((p) =>
      (p.descricao || '').toLowerCase().includes(q) ||
      (p.modelo || '').toLowerCase().includes(q) ||
      (p.marca || '').toLowerCase().includes(q)
    )
  }, [estoque, busca])

  return (
    <PullToRefresh onRefresh={async () => { await getEstoqueAtual({ force: true }).then(setEstoque) }}>
      <div>
        <div className="mb-3">
          <h2 className="text-xl font-bold">Catálogo</h2>
          <p className="text-sm text-slate-500">{produtos.length} no portfólio · {estoque.length} no estoque atual</p>
        </div>

        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome, modelo ou descrição..."
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-3"
        />

        {/* Abas: Portfolio Mahindra | Estoque atual */}
        <div className="flex gap-1 mb-3 border-b border-slate-200">
          <TabButton ativo={aba === 'portfolio'} onClick={() => setAba('portfolio')}>
            Portfólio Mahindra ({produtos.length})
          </TabButton>
          <TabButton ativo={aba === 'estoque'} onClick={() => setAba('estoque')}>
            Estoque atual ({estoque.length})
          </TabButton>
        </div>

        {aba === 'portfolio' && (
          <>
            <div className="flex gap-1 overflow-x-auto pb-2 mb-3">
              <Chip ativo={filtroCat === 'todos'} onClick={() => setFiltroCat('todos')}>
                Todos ({produtos.length})
              </Chip>
              {CATEGORIAS.map((c) => {
                const n = produtos.filter((p) => p.categoria === c.key).length
                return (
                  <Chip key={c.key} ativo={filtroCat === c.key} onClick={() => setFiltroCat(c.key)}>
                    {c.label} ({n})
                  </Chip>
                )
              })}
            </div>

            {portfolioFiltrado.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {portfolioFiltrado.map((p, i) => (
                  <CardPortfolio key={p.id} produto={p} index={i} />
                ))}
              </div>
            )}
          </>
        )}

        {aba === 'estoque' && (
          <>
            {loadingEstoque ? (
              <p className="text-sm text-slate-500 text-center py-8">Carregando estoque...</p>
            ) : estoqueFiltrado.length === 0 ? (
              <EmptyState texto="Nenhum produto em estoque" />
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {estoqueFiltrado.map((p, i) => (
                  <CardEstoque key={p.codigo_produto} produto={p} index={i} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </PullToRefresh>
  )
}

function TabButton({ ativo, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
        ativo ? 'border-blue-700 text-blue-700' : 'border-transparent text-slate-500'
      }`}
    >
      {children}
    </button>
  )
}

function Chip({ ativo, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs whitespace-nowrap border ${
        ativo
          ? 'bg-blue-700 text-white border-blue-700'
          : 'bg-white text-slate-600 border-slate-300'
      }`}
    >
      {children}
    </button>
  )
}

function EmptyState({ texto = 'Nenhum produto encontrado' }) {
  return (
    <div className="text-center py-12">
      <p className="text-4xl mb-3">🔍</p>
      <p className="text-slate-400">{texto}</p>
    </div>
  )
}

function CardPortfolio({ produto, index }) {
  const fotos = getFotosLocais(produto.id)
  return (
    <Link
      to={produto.id}
      className="bg-white rounded-xl shadow overflow-hidden animate-fade-in active:scale-[0.98] transition-transform"
      style={{ animationDelay: `${index * 0.03}s` }}
    >
      <div className="aspect-square bg-slate-100 flex items-center justify-center overflow-hidden">
        <img
          src={fotos.principal}
          alt={produto.titulo}
          className="w-full h-full object-contain"
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
            e.currentTarget.parentElement.innerHTML = '<span class="text-4xl">📷</span>'
          }}
        />
      </div>
      <div className="p-2">
        <p className="font-bold text-sm leading-tight">{produto.titulo}</p>
        {produto.subtitulo && (
          <p className="text-xs text-slate-500 mt-0.5">{produto.subtitulo}</p>
        )}
        {!produto.filtro_supabase && (
          <p className="text-[10px] text-amber-600 mt-1">Consultar estoque</p>
        )}
      </div>
    </Link>
  )
}

function CardEstoque({ produto, index }) {
  const titulo = (produto.descricao || '').slice(0, 60)
  return (
    <Link
      to={`sb-${produto.codigo_produto}`}
      className="bg-white rounded-xl shadow overflow-hidden animate-fade-in active:scale-[0.98] transition-transform"
      style={{ animationDelay: `${index * 0.03}s` }}
    >
      <div className="aspect-square bg-slate-100 flex items-center justify-center overflow-hidden">
        {produto.imagem_url ? (
          <img
            src={produto.imagem_url}
            alt={titulo}
            className="w-full h-full object-contain"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
              e.currentTarget.parentElement.innerHTML = '<span class="text-4xl">📷</span>'
            }}
          />
        ) : (
          <span className="text-4xl">📷</span>
        )}
      </div>
      <div className="p-2">
        <p className="font-bold text-sm leading-tight">{produto.modelo || titulo}</p>
        <p className="text-xs text-slate-500 mt-0.5">
          {produto.marca || '—'}
          {produto.n_variacoes > 1 && ` · ${produto.n_variacoes} variações`}
        </p>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] text-green-700 font-semibold">{produto.estoque_efetivo} un</span>
          {produto.preco_min > 0 ? (
            <span className="text-[10px] text-slate-700 font-medium">
              {produto.preco_min === produto.preco_max
                ? formatBRL(produto.preco_min)
                : `${formatBRL(produto.preco_min)}+`}
            </span>
          ) : (
            <span className="text-[10px] text-amber-600">consulte</span>
          )}
        </div>
      </div>
    </Link>
  )
}
