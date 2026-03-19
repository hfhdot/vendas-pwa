import { useState, useEffect } from 'react'
import { getVisitas, getMetricasPorVendedor } from '../lib/supabaseQueries'

export default function SupervisorAlertas() {
  const [alertas, setAlertas] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    try {
      const [visitas, vendedores] = await Promise.all([
        getVisitas({}),
        getMetricasPorVendedor(),
      ])

      const lista = []

      // 1. Visitas presenciais sem GPS
      const semGPS = visitas.filter((v) => v.tipo === 'presencial' && !v.latitude)
      semGPS.forEach((v) => {
        lista.push({
          tipo: 'sem_gps',
          severidade: 'alta',
          titulo: 'Visita presencial sem GPS',
          detalhe: `${v.vendedor_nome || 'Vendedor'} - ${new Date(v.data_visita).toLocaleDateString('pt-BR')}`,
          subtexto: v.propriedade_nome || '',
        })
      })

      // 2. Visitas retroativas
      const retroativas = visitas.filter((v) => v.retroativa)
      retroativas.forEach((v) => {
        lista.push({
          tipo: 'retroativa',
          severidade: 'media',
          titulo: 'Visita retroativa',
          detalhe: `${v.vendedor_nome || 'Vendedor'} - ${new Date(v.data_visita).toLocaleDateString('pt-BR')}`,
          subtexto: v.resumo || '',
        })
      })

      // 3. Vendedores sem visitas há mais de 3 dias
      vendedores.forEach((v) => {
        if (!v.ultimaVisita) {
          lista.push({
            tipo: 'inativo',
            severidade: 'alta',
            titulo: 'Vendedor sem nenhuma visita',
            detalhe: v.nome,
            subtexto: '',
          })
          return
        }
        const dias = Math.floor((Date.now() - new Date(v.ultimaVisita).getTime()) / (1000 * 60 * 60 * 24))
        if (dias > 3) {
          lista.push({
            tipo: 'inativo',
            severidade: dias > 7 ? 'alta' : 'media',
            titulo: `${dias} dias sem visita`,
            detalhe: v.nome,
            subtexto: `Última: ${new Date(v.ultimaVisita).toLocaleDateString('pt-BR')}`,
          })
        }
      })

      setAlertas(lista)
    } catch (err) {
      console.error('[Alertas]', err)
    }
    setLoading(false)
  }

  const CORES = {
    alta: 'border-l-red-500 bg-red-50',
    media: 'border-l-amber-500 bg-amber-50',
    baixa: 'border-l-blue-500 bg-blue-50',
  }

  const ICONES = {
    sem_gps: '📡',
    retroativa: '🕐',
    inativo: '⚠️',
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const alertasAlta = alertas.filter((a) => a.severidade === 'alta')
  const alertasMedia = alertas.filter((a) => a.severidade === 'media')

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Alertas</h2>
        <span className="text-sm text-slate-500">{alertas.length} alertas</span>
      </div>

      {alertas.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-4xl mb-3">✅</p>
          <p className="text-slate-400">Nenhum alerta no momento</p>
        </div>
      ) : (
        <div className="space-y-4">
          {alertasAlta.length > 0 && (
            <div>
              <p className="text-xs font-bold text-red-600 mb-2 uppercase">Alta prioridade ({alertasAlta.length})</p>
              <div className="space-y-2">
                {alertasAlta.map((a, i) => (
                  <div key={i} className={`rounded-xl shadow p-4 border-l-4 ${CORES[a.severidade]}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span>{ICONES[a.tipo]}</span>
                      <p className="font-medium text-sm">{a.titulo}</p>
                    </div>
                    <p className="text-sm text-slate-700">{a.detalhe}</p>
                    {a.subtexto && <p className="text-xs text-slate-500 mt-1">{a.subtexto}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {alertasMedia.length > 0 && (
            <div>
              <p className="text-xs font-bold text-amber-600 mb-2 uppercase">Média prioridade ({alertasMedia.length})</p>
              <div className="space-y-2">
                {alertasMedia.map((a, i) => (
                  <div key={i} className={`rounded-xl shadow p-4 border-l-4 ${CORES[a.severidade]}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span>{ICONES[a.tipo]}</span>
                      <p className="font-medium text-sm">{a.titulo}</p>
                    </div>
                    <p className="text-sm text-slate-700">{a.detalhe}</p>
                    {a.subtexto && <p className="text-xs text-slate-500 mt-1">{a.subtexto}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
