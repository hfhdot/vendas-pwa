import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getVisitas, getVendedores } from '../lib/supabaseQueries'

const TIPOS = [
  { key: '', label: 'Todos' },
  { key: 'presencial', label: 'Presencial' },
  { key: 'mensagem', label: 'Mensagem' },
  { key: 'telefonema', label: 'Telefonema' },
  { key: 'email', label: 'E-mail' },
]

const TIPO_COLORS = {
  presencial: 'bg-blue-100 text-blue-800',
  mensagem: 'bg-green-100 text-green-800',
  telefonema: 'bg-amber-100 text-amber-800',
  email: 'bg-purple-100 text-purple-800',
}

export default function SupervisorVisitas() {
  const [searchParams] = useSearchParams()
  const [visitas, setVisitas] = useState([])
  const [vendedores, setVendedores] = useState([])
  const [loading, setLoading] = useState(true)

  const [filtros, setFiltros] = useState({
    vendedor_id: searchParams.get('vendedor_id') || '',
    tipo: '',
    dateFrom: '',
    dateTo: '',
    retroativa: false,
  })

  useEffect(() => {
    getVendedores().then(setVendedores)
  }, [])

  useEffect(() => { carregar() }, [filtros])

  async function carregar() {
    setLoading(true)
    try {
      const params = {}
      if (filtros.vendedor_id) params.vendedorId = parseInt(filtros.vendedor_id)
      if (filtros.tipo) params.tipo = filtros.tipo
      if (filtros.dateFrom) params.dateFrom = new Date(filtros.dateFrom).toISOString()
      if (filtros.dateTo) params.dateTo = new Date(filtros.dateTo + 'T23:59:59').toISOString()
      if (filtros.retroativa) params.retroativa = true
      setVisitas(await getVisitas(params))
    } catch (err) {
      console.error('[Visitas]', err)
    }
    setLoading(false)
  }

  function updateFiltro(key, value) {
    setFiltros((f) => ({ ...f, [key]: value }))
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Visitas</h2>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow p-3 mb-4 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <select
            value={filtros.vendedor_id}
            onChange={(e) => updateFiltro('vendedor_id', e.target.value)}
            className="border border-slate-300 rounded-lg px-2 py-2 text-sm bg-white"
          >
            <option value="">Todos vendedores</option>
            {vendedores.map((v) => (
              <option key={v.Id} value={v.Id}>{v.Nome}</option>
            ))}
          </select>
          <select
            value={filtros.tipo}
            onChange={(e) => updateFiltro('tipo', e.target.value)}
            className="border border-slate-300 rounded-lg px-2 py-2 text-sm bg-white"
          >
            {TIPOS.map((t) => (
              <option key={t.key} value={t.key}>{t.label}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="date"
            value={filtros.dateFrom}
            onChange={(e) => updateFiltro('dateFrom', e.target.value)}
            className="border border-slate-300 rounded-lg px-2 py-2 text-sm"
            placeholder="De"
          />
          <input
            type="date"
            value={filtros.dateTo}
            onChange={(e) => updateFiltro('dateTo', e.target.value)}
            className="border border-slate-300 rounded-lg px-2 py-2 text-sm"
            placeholder="Até"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={filtros.retroativa}
            onChange={(e) => updateFiltro('retroativa', e.target.checked)}
            className="rounded"
          />
          Apenas retroativas
        </label>
      </div>

      <p className="text-xs text-slate-500 mb-2">{visitas.length} visitas encontradas</p>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="w-6 h-6 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : visitas.length === 0 ? (
        <p className="text-slate-400 text-center py-10">Nenhuma visita encontrada</p>
      ) : (
        <div className="space-y-2">
          {visitas.map((v) => {
            const data = new Date(v.data_visita)
            const dataStr = data.toLocaleDateString('pt-BR') + ' ' + data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

            return (
              <div
                key={v.id}
                className={`bg-white rounded-xl shadow p-4 ${v.retroativa ? 'border-l-4 border-amber-400' : ''}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium text-sm">{v.vendedor_nome || 'Vendedor'}</p>
                  <div className="flex items-center gap-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${TIPO_COLORS[v.tipo] || 'bg-slate-100 text-slate-700'}`}>
                      {v.tipo}
                    </span>
                    {v.retroativa && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Retro</span>
                    )}
                    {v.acionar_pos_vendas && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">PV</span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-slate-500">{dataStr}</p>
                <p className="text-xs text-slate-600 mt-1">
                  {v.cliente_nome || '—'} / {v.propriedade_nome || '—'}
                </p>
                {v.resumo && <p className="text-sm text-slate-700 mt-2">{v.resumo}</p>}
                {v.latitude && (
                  <p className="text-xs text-slate-400 mt-1">
                    GPS: {v.latitude?.toFixed(4)}, {v.longitude?.toFixed(4)}
                  </p>
                )}
                {!v.latitude && v.tipo === 'presencial' && (
                  <p className="text-xs text-red-500 mt-1 font-medium">Sem GPS</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
