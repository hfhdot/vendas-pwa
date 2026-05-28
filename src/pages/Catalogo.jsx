import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { getProdutos, CATEGORIAS, getFotosLocais } from '../data/catalogo'
import PullToRefresh from '../components/PullToRefresh'

export default function Catalogo() {
  const [filtroCat, setFiltroCat] = useState('todos')
  const [busca, setBusca] = useState('')

  const produtos = useMemo(() => getProdutos(), [])

  const filtrados = useMemo(() => {
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

  return (
    <PullToRefresh onRefresh={async () => {}}>
      <div>
        <div className="mb-3">
          <h2 className="text-xl font-bold">Catálogo</h2>
          <p className="text-sm text-slate-500">Linha Mahindra · {produtos.length} produtos</p>
        </div>

        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou modelo..."
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-3"
        />

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

        {filtrados.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-slate-400">Nenhum produto encontrado</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtrados.map((p, i) => (
              <Card key={p.id} produto={p} index={i} />
            ))}
          </div>
        )}
      </div>
    </PullToRefresh>
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

function Card({ produto, index }) {
  const fotos = getFotosLocais(produto.id)
  return (
    <Link
      to={`/catalogo/${produto.id}`}
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
      <div className="p-3">
        <p className="font-bold text-xs leading-tight">{produto.titulo}</p>
        {produto.subtitulo && (
          <p className="text-[11px] text-slate-500 mt-0.5">{produto.subtitulo}</p>
        )}
        {!produto.filtro_supabase && (
          <p className="text-[10px] text-amber-600 mt-1">Consultar estoque</p>
        )}
      </div>
    </Link>
  )
}
