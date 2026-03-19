import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMetricasPorVendedor } from '../lib/supabaseQueries'

export default function SupervisorVendedores() {
  const navigate = useNavigate()
  const [vendedores, setVendedores] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    try {
      setVendedores(await getMetricasPorVendedor())
    } catch (err) {
      console.error('[Vendedores]', err)
    }
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Vendedores</h2>

      {vendedores.length === 0 ? (
        <p className="text-slate-400 text-center py-10">Nenhum vendedor encontrado</p>
      ) : (
        <div className="space-y-3">
          {vendedores.map((v) => {
            const diasSemVisita = v.ultimaVisita
              ? Math.floor((Date.now() - new Date(v.ultimaVisita).getTime()) / (1000 * 60 * 60 * 24))
              : null

            return (
              <div
                key={v.id}
                onClick={() => navigate(`/supervisor/visitas?vendedor_id=${v.id}`)}
                className="bg-white rounded-xl shadow p-4 active:bg-slate-50 cursor-pointer"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="font-bold text-sm">{v.nome}</p>
                  {diasSemVisita !== null && diasSemVisita > 3 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                      {diasSemVisita}d sem visita
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-4 gap-2 text-center">
                  <div>
                    <p className="text-lg font-bold text-blue-600">{v.visitasSemana}</p>
                    <p className="text-[10px] text-slate-500">Semana</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-slate-700">{v.totalVisitas}</p>
                    <p className="text-[10px] text-slate-500">Total</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-green-600">
                      {v.pipeline > 0 ? `${(v.pipeline / 1000).toFixed(0)}k` : '0'}
                    </p>
                    <p className="text-[10px] text-slate-500">Pipeline</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-amber-600">{v.retroativas}</p>
                    <p className="text-[10px] text-slate-500">Retro.</p>
                  </div>
                </div>

                {v.ultimaVisita && (
                  <p className="text-xs text-slate-400 mt-2">
                    Última: {new Date(v.ultimaVisita).toLocaleDateString('pt-BR')}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
