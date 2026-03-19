import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getByIndex, saveRecord, getRecord, deleteRecord, registrarLog } from '../lib/db'
import PullToRefresh from '../components/PullToRefresh'
import ConfirmModal from '../components/ConfirmModal'

const EMPTY = {
  nome: '', endereco: '', cidade: '', estado: '',
  area_hectares: '', culturas: '', observacoes: '',
}

export default function Propriedades() {
  const { clienteId } = useParams()
  const navigate = useNavigate()
  const [props, setProps] = useState([])
  const [cliente, setCliente] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [deleteTarget, setDeleteTarget] = useState(null)

  useEffect(() => { carregar() }, [clienteId])

  async function carregar() {
    setProps(await getByIndex('propriedades', 'cliente_dono_id', clienteId))
    setCliente(await getRecord('clientes', clienteId))
  }

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const culturas = form.culturas
      ? form.culturas.split(',').map((c) => c.trim()).filter(Boolean)
      : []

    await saveRecord('propriedades', {
      cliente_dono_id: parseInt(clienteId),
      nome: form.nome,
      endereco: form.endereco,
      cidade: form.cidade,
      estado: form.estado,
      area_hectares: form.area_hectares ? parseFloat(form.area_hectares) : null,
      culturas,
      latitude: null,
      longitude: null,
      observacoes: form.observacoes,
      created_at: new Date().toISOString(),
    })
    await registrarLog('criar', 'propriedades', null, `Propriedade: ${form.nome}`)
    setForm(EMPTY)
    setShowForm(false)
    carregar()
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
      <button onClick={() => navigate(-1)} className="text-blue-700 text-sm mb-2 active:text-blue-900">&larr; Voltar</button>

      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold">Propriedades</h2>
          {cliente && <p className="text-sm text-slate-500">de {cliente.nome}</p>}
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium active:bg-blue-800"
        >
          {showForm ? 'Cancelar' : '+ Nova'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-4 mb-4 space-y-3 animate-slide-up">
          <input name="nome" value={form.nome} onChange={handleChange} required placeholder="Nome da propriedade *" className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm" />
          <input name="endereco" value={form.endereco} onChange={handleChange} placeholder="Endereço" className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm" />
          <div className="grid grid-cols-3 gap-2">
            <input name="cidade" value={form.cidade} onChange={handleChange} placeholder="Cidade" className="col-span-2 border border-slate-300 rounded-lg px-3 py-2.5 text-sm" />
            <input name="estado" value={form.estado} onChange={handleChange} placeholder="UF" maxLength={2} className="border border-slate-300 rounded-lg px-3 py-2.5 text-sm uppercase" />
          </div>
          <input name="area_hectares" value={form.area_hectares} onChange={handleChange} placeholder="Área (hectares)" type="number" step="0.01" inputMode="decimal" className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm" />
          <input name="culturas" value={form.culturas} onChange={handleChange} placeholder="Culturas (separar por vírgula)" className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm" />
          <textarea name="observacoes" value={form.observacoes} onChange={handleChange} placeholder="Observações" rows={2} className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm" />
          <button type="submit" className="w-full bg-green-600 text-white py-2.5 rounded-lg font-medium text-sm active:bg-green-700">Salvar Propriedade</button>
        </form>
      )}

      {props.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-4xl mb-3">🏡</p>
          <p className="text-slate-400">Nenhuma propriedade cadastrada</p>
          <button onClick={() => setShowForm(true)} className="text-blue-700 text-sm mt-2 font-medium">
            Cadastrar primeira propriedade
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {props.map((p, i) => (
            <div key={p.id} className="bg-white rounded-xl shadow p-4 animate-fade-in" style={{ animationDelay: `${i * 0.03}s` }}>
              <div className="flex items-center justify-between mb-1">
                <p className="font-medium">{p.nome}</p>
                <button onClick={() => setDeleteTarget(p)} className="text-slate-300 hover:text-red-500 text-lg px-1">&times;</button>
              </div>
              <p className="text-xs text-slate-500">
                {[p.cidade, p.estado].filter(Boolean).join(' - ')}
                {p.area_hectares ? ` · ${p.area_hectares} ha` : ''}
              </p>
              {p.culturas?.length > 0 && (
                <div className="flex gap-1 mt-2 flex-wrap">
                  {p.culturas.map((c) => (
                    <span key={c} className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full">{c}</span>
                  ))}
                </div>
              )}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => navigate(`/pessoas/${p.id}`)}
                  className="flex-1 bg-blue-50 text-blue-700 py-2 rounded-lg text-xs font-medium active:bg-blue-100"
                >
                  👥 Pessoas
                </button>
                <button
                  onClick={() => navigate(`/maquinas/${p.id}`)}
                  className="flex-1 bg-amber-50 text-amber-700 py-2 rounded-lg text-xs font-medium active:bg-amber-100"
                >
                  🚜 Máquinas
                </button>
              </div>
            </div>
          ))}
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
