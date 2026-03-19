import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAllRecords, saveRecord, deleteRecord, getByIndex, registrarLog } from '../lib/db'
import { maskCPFouCNPJ, maskTelefone } from '../lib/masks'
import PullToRefresh from '../components/PullToRefresh'
import ConfirmModal from '../components/ConfirmModal'

const EMPTY_CLIENTE = { nome: '', documento: '', telefone: '', email: '', observacoes: '' }

export default function Clientes() {
  const navigate = useNavigate()
  const [propriedades, setPropriedades] = useState([])
  const [clientes, setClientes] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_CLIENTE)
  const [busca, setBusca] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [expandedDono, setExpandedDono] = useState(null)
  const [agenda, setAgenda] = useState({ atrasados: [], hoje: [], semana: [] })
  const [showAgenda, setShowAgenda] = useState(true)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    const props = await getAllRecords('propriedades')
    const cls = await getAllRecords('clientes')
    setPropriedades(props)
    setClientes(cls)
    await carregarAgenda(props, cls)
  }

  async function carregarAgenda(props, cls) {
    const visitas = await getAllRecords('visitas')
    const hojeStr = new Date().toISOString().slice(0, 10)
    const fimSemana = new Date(hojeStr + 'T00:00:00')
    fimSemana.setDate(fimSemana.getDate() + 7)
    const fimSemanaStr = fimSemana.toISOString().slice(0, 10)

    // Pegar último contato agendado por propriedade
    const propContatos = {}
    for (const v of visitas) {
      if (!v.data_proximo_contato) continue
      if (!propContatos[v.propriedade_id] || v.data_proximo_contato > propContatos[v.propriedade_id].data_proximo_contato) {
        propContatos[v.propriedade_id] = v
      }
    }

    const clienteMap = Object.fromEntries(cls.map((c) => [c.id, c]))
    const atrasados = []
    const hoje = []
    const semana = []

    for (const p of props) {
      const contato = propContatos[p.id]
      if (!contato) continue
      const data = contato.data_proximo_contato
      const item = { prop: p, cliente: clienteMap[p.cliente_dono_id] || null, data, visita: contato }
      if (data < hojeStr) atrasados.push(item)
      else if (data === hojeStr) hoje.push(item)
      else if (data <= fimSemanaStr) semana.push(item)
    }

    atrasados.sort((a, b) => a.data.localeCompare(b.data))
    semana.sort((a, b) => a.data.localeCompare(b.data))
    setAgenda({ atrasados, hoje, semana })
  }

  // Agrupar propriedades: donos com +1 prop ficam agrupados
  const clienteMap = Object.fromEntries(clientes.map((c) => [c.id, c]))

  // Filtrar por busca
  const filtradas = propriedades.filter((p) => {
    const termo = busca.toLowerCase()
    if (!termo) return true
    const nome = (p.nome || '').toLowerCase()
    const cidade = (p.cidade || '').toLowerCase()
    const dono = clienteMap[p.cliente_dono_id]
    const nomeDono = dono ? dono.nome.toLowerCase() : ''
    return nome.includes(termo) || cidade.includes(termo) || nomeDono.includes(termo)
  })

  // Separar: propriedades de donos com múltiplas props vs singles
  const donoCount = {}
  for (const p of filtradas) {
    if (p.cliente_dono_id) {
      donoCount[p.cliente_dono_id] = (donoCount[p.cliente_dono_id] || 0) + 1
    }
  }

  const singles = [] // propriedades cujo dono tem só 1 (ou sem dono)
  const grupos = {} // cliente_dono_id -> [props]
  for (const p of filtradas) {
    if (p.cliente_dono_id && donoCount[p.cliente_dono_id] > 1) {
      if (!grupos[p.cliente_dono_id]) grupos[p.cliente_dono_id] = []
      grupos[p.cliente_dono_id].push(p)
    } else {
      singles.push(p)
    }
  }

  // Montar lista final: singles + grupos intercalados alfabeticamente
  const listaFinal = []
  for (const p of singles) {
    listaFinal.push({ type: 'single', prop: p, dono: clienteMap[p.cliente_dono_id] || null })
  }
  for (const [donoId, props] of Object.entries(grupos)) {
    listaFinal.push({ type: 'group', donoId: parseInt(donoId), dono: clienteMap[parseInt(donoId)], props })
  }
  listaFinal.sort((a, b) => {
    const nomeA = a.type === 'single' ? (a.prop.nome || '') : (a.dono?.nome || '')
    const nomeB = b.type === 'single' ? (b.prop.nome || '') : (b.dono?.nome || '')
    return nomeA.localeCompare(nomeB)
  })

  function handleChange(e) {
    let { name, value } = e.target
    if (name === 'documento') value = maskCPFouCNPJ(value)
    if (name === 'telefone') value = maskTelefone(value)
    setForm({ ...form, [name]: value })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const vendedor = JSON.parse(localStorage.getItem('vendedor'))
    const clienteId = await saveRecord('clientes', {
      vendedor_id: vendedor.id,
      ...form,
      created_at: new Date().toISOString(),
    })
    await registrarLog('criar', 'clientes', clienteId, `Cliente: ${form.nome}`)
    setForm(EMPTY_CLIENTE)
    setShowForm(false)
    await carregar()
  }

  async function handleDelete() {
    if (deleteTarget) {
      await registrarLog('excluir', 'propriedades', deleteTarget.id, `Propriedade: ${deleteTarget.nome}`)
      await deleteRecord('propriedades', deleteTarget.id)
      setDeleteTarget(null)
      carregar()
    }
  }

  return (
    <PullToRefresh onRefresh={carregar}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Clientes</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium active:bg-blue-800"
        >
          {showForm ? 'Cancelar' : '+ Novo'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-4 mb-4 space-y-3 animate-slide-up">
          <input name="nome" value={form.nome} onChange={handleChange} required placeholder="Nome do cliente/dono *" className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm" />
          <input name="documento" value={form.documento} onChange={handleChange} placeholder="CPF / CNPJ" inputMode="numeric" className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm" />
          <input name="telefone" value={form.telefone} onChange={handleChange} placeholder="Telefone" inputMode="tel" className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm" />
          <input name="email" value={form.email} onChange={handleChange} placeholder="E-mail" type="email" className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm" />
          <textarea name="observacoes" value={form.observacoes} onChange={handleChange} placeholder="Observações" rows={2} className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm" />
          <button type="submit" className="w-full bg-green-600 text-white py-2.5 rounded-lg font-medium text-sm active:bg-green-700">Salvar Cliente</button>
        </form>
      )}

      {/* Agenda de contatos */}
      {(agenda.atrasados.length > 0 || agenda.hoje.length > 0 || agenda.semana.length > 0) && (
        <div className="mb-4">
          <button onClick={() => setShowAgenda(!showAgenda)} className="flex items-center justify-between w-full mb-2">
            <p className="text-xs font-bold text-slate-500 uppercase">
              Agenda de contatos
              {agenda.atrasados.length > 0 && (
                <span className="ml-2 px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                  {agenda.atrasados.length} atrasado{agenda.atrasados.length > 1 ? 's' : ''}
                </span>
              )}
            </p>
            <span className="text-xs text-slate-400">{showAgenda ? '▲' : '▼'}</span>
          </button>
          {showAgenda && (
            <div className="space-y-2 animate-slide-up">
              {agenda.atrasados.map((item) => (
                <AgendaCard key={`a-${item.prop.id}`} item={item} tipo="atrasado" navigate={navigate} />
              ))}
              {agenda.hoje.map((item) => (
                <AgendaCard key={`h-${item.prop.id}`} item={item} tipo="hoje" navigate={navigate} />
              ))}
              {agenda.semana.map((item) => (
                <AgendaCard key={`s-${item.prop.id}`} item={item} tipo="semana" navigate={navigate} />
              ))}
            </div>
          )}
        </div>
      )}

      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar propriedade, cidade ou dono..."
        className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm mb-3"
      />

      {listaFinal.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-4xl mb-3">🏡</p>
          <p className="text-slate-400">{busca ? 'Nenhum resultado' : 'Nenhuma propriedade cadastrada'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {listaFinal.map((item, i) => {
            if (item.type === 'single') {
              return (
                <PropCard
                  key={item.prop.id}
                  prop={item.prop}
                  dono={item.dono}
                  index={i}
                  navigate={navigate}
                  onDelete={() => setDeleteTarget(item.prop)}
                />
              )
            }
            // Grupo: dono com múltiplas propriedades
            const isExpanded = expandedDono === item.donoId
            return (
              <div key={`g-${item.donoId}`} className="animate-fade-in" style={{ animationDelay: `${i * 0.03}s` }}>
                <button
                  onClick={() => setExpandedDono(isExpanded ? null : item.donoId)}
                  className="w-full bg-blue-50 rounded-xl shadow p-4 flex items-center justify-between active:bg-blue-100"
                >
                  <div className="text-left">
                    <p className="font-medium text-sm">{item.dono?.nome || 'Sem dono'}</p>
                    <p className="text-xs text-blue-600">{item.props.length} propriedades</p>
                  </div>
                  <span className="text-blue-400 text-sm">{isExpanded ? '▲' : '▼'}</span>
                </button>
                {isExpanded && (
                  <div className="ml-3 mt-1 space-y-1 border-l-2 border-blue-200 pl-3 animate-slide-up">
                    {item.props.map((p) => (
                      <PropCard
                        key={p.id}
                        prop={p}
                        dono={null}
                        index={0}
                        navigate={navigate}
                        onDelete={() => setDeleteTarget(p)}
                        compact
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <ConfirmModal
        show={!!deleteTarget}
        title="Excluir propriedade"
        message={`Excluir "${deleteTarget?.nome}"? Pessoas e máquinas vinculadas também serão perdidas.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </PullToRefresh>
  )
}

function PropCard({ prop, dono, index, navigate, onDelete, compact }) {
  return (
    <div
      className={`bg-white rounded-xl shadow flex items-center justify-between card-touch animate-fade-in ${compact ? 'p-3' : 'p-4'}`}
      style={!compact ? { animationDelay: `${index * 0.03}s` } : undefined}
    >
      <div className="flex-1 min-w-0" onClick={() => navigate(`/pessoas/${prop.id}`)}>
        <p className={`font-medium truncate ${compact ? 'text-sm' : ''}`}>{prop.nome}</p>
        <p className="text-xs text-slate-500 truncate">
          {[prop.cidade, prop.estado].filter(Boolean).join(' - ')}
          {dono ? ` · ${dono.nome}` : ''}
        </p>
      </div>
      <div className="flex items-center gap-2 ml-2 shrink-0">
        <button
          onClick={() => navigate(`/maquinas/${prop.id}`)}
          className="text-[10px] text-amber-600 px-1.5 py-0.5 rounded border border-amber-200"
        >
          Máq.
        </button>
        <span className={`w-2 h-2 rounded-full ${prop.status_sync === 'synced' ? 'bg-green-500' : 'bg-yellow-500'}`} />
        <button onClick={onDelete} className="text-slate-300 hover:text-red-500 text-lg px-1">&times;</button>
        <span className="text-slate-400" onClick={() => navigate(`/pessoas/${prop.id}`)}>&rsaquo;</span>
      </div>
    </div>
  )
}

function AgendaCard({ item, tipo, navigate }) {
  const dataContato = new Date(item.data + 'T00:00:00')
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const dias = Math.round((dataContato - hoje) / (1000 * 60 * 60 * 24))

  let diasLabel
  if (dias === 0) diasLabel = 'Hoje'
  else if (dias === 1) diasLabel = 'Amanhã'
  else if (dias < 0) diasLabel = `${Math.abs(dias)}d atrás`
  else diasLabel = `em ${dias}d`

  const cores = {
    atrasado: 'bg-red-50 border-l-4 border-red-400',
    hoje: 'bg-blue-50 border-l-4 border-blue-400',
    semana: 'bg-white border-l-4 border-slate-300',
  }
  const corDias = {
    atrasado: 'text-red-600',
    hoje: 'text-blue-600',
    semana: 'text-slate-600',
  }

  return (
    <div
      onClick={() => navigate(`/pessoas/${item.prop.id}`)}
      className={`rounded-xl shadow p-3 cursor-pointer active:opacity-80 ${cores[tipo]}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{item.prop.nome}</p>
          <p className="text-xs text-slate-500 truncate">
            {item.cliente?.nome ? `${item.cliente.nome} · ` : ''}{item.visita?.proximos_passos || ''}
          </p>
        </div>
        <div className="text-right ml-3 shrink-0">
          <p className={`text-xs font-bold ${corDias[tipo]}`}>{diasLabel}</p>
          <p className="text-[10px] text-slate-400">{dataContato.toLocaleDateString('pt-BR')}</p>
        </div>
      </div>
    </div>
  )
}
