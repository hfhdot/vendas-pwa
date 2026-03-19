import { useState, useEffect } from 'react'
import { getKPIs } from '../lib/supabaseQueries'

export default function SupervisorOverview() {
  const [kpis, setKpis] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    try {
      setKpis(await getKPIs())
    } catch (err) {
      console.error('[Dashboard]', err)
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

  if (!kpis) return <p className="text-center text-slate-400 py-10">Erro ao carregar dados</p>

  const cards = [
    { label: 'Visitas Hoje', value: kpis.visitasHoje, color: 'bg-blue-600' },
    { label: 'Visitas Semana', value: kpis.visitasSemana, color: 'bg-blue-500' },
    { label: 'Visitas Mês', value: kpis.visitasMes, color: 'bg-blue-400' },
    { label: 'Pipeline', value: `R$ ${kpis.pipeline.toLocaleString('pt-BR')}`, color: 'bg-green-600' },
    { label: 'Fechados no Mês', value: kpis.negociosFechadosMes, color: 'bg-green-500' },
    { label: 'Retroativas', value: kpis.visitasRetroativas, color: kpis.visitasRetroativas > 0 ? 'bg-amber-500' : 'bg-slate-400' },
    { label: 'Pós Vendas Pendentes', value: kpis.posVendasPendentes, color: kpis.posVendasPendentes > 0 ? 'bg-orange-500' : 'bg-slate-400' },
    { label: 'Total Negócios', value: kpis.totalNegocios, color: 'bg-slate-600' },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Visão Geral</h2>
        <button
          onClick={carregar}
          className="text-sm text-slate-500 active:text-slate-700"
        >
          Atualizar
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {cards.map((card) => (
          <div key={card.label} className={`${card.color} text-white rounded-xl p-4`}>
            <p className="text-2xl font-bold">{card.value}</p>
            <p className="text-xs opacity-80 mt-1">{card.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
