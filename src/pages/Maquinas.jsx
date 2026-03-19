import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getByIndex, saveRecord, getRecord, deleteRecord, registrarLog } from '../lib/db'
import PullToRefresh from '../components/PullToRefresh'
import ConfirmModal from '../components/ConfirmModal'

import { TIPOS_PRODUTO, MARCAS } from '../lib/constants'
const ESTADOS = ['otimo', 'bom', 'regular', 'critico']
const ESTADO_LABELS = { otimo: 'Ótimo', bom: 'Bom', regular: 'Regular', critico: 'Crítico' }
const ESTADO_COLORS = { otimo: 'bg-green-100 text-green-800', bom: 'bg-blue-100 text-blue-800', regular: 'bg-yellow-100 text-yellow-800', critico: 'bg-red-100 text-red-800' }

const EMPTY = {
  tipo: 'Trator Novo', marca: 'New Holland', modelo: '', tamanho: '', ano: '', numero_serie: '',
  horimetro: '', estado: 'bom', observacoes: '',
}

export default function Maquinas() {
  const { propriedadeId } = useParams()
  const navigate = useNavigate()
  const [maquinas, setMaquinas] = useState([])
  const [propriedade, setPropriedade] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [deleteTarget, setDeleteTarget] = useState(null)

  useEffect(() => { carregar() }, [propriedadeId])

  async function carregar() {
    setMaquinas(await getByIndex('maquinas', 'propriedade_id', propriedadeId))
    setPropriedade(await getRecord('propriedades', propriedadeId))
  }

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    await saveRecord('maquinas', {
      propriedade_id: parseInt(propriedadeId),
      tipo: form.tipo,
      marca: form.marca,
      modelo: form.modelo,
      tamanho: form.tamanho || null,
      ano: form.ano ? parseInt(form.ano) : null,
      numero_serie: form.numero_serie,
      horimetro: form.horimetro ? parseInt(form.horimetro) : null,
      estado: form.estado,
      observacoes: form.observacoes,
      created_at: new Date().toISOString(),
    })
    await registrarLog('criar', 'maquinas', null, `Máquina: ${form.marca} ${form.modelo}`)
    setForm(EMPTY)
    setShowForm(false)
    carregar()
  }

  async function handleDelete() {
    if (deleteTarget) {
      await registrarLog('excluir', 'maquinas', deleteTarget.id, `Máquina: ${deleteTarget.marca} ${deleteTarget.modelo}`)
      await deleteRecord('maquinas', deleteTarget.id)
      setDeleteTarget(null)
      carregar()
    }
  }

  return (
    <PullToRefresh onRefresh={carregar}>
      <button onClick={() => navigate(-1)} className="text-blue-700 text-sm mb-2 active:text-blue-900">&larr; Voltar</button>

      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold">Máquinas</h2>
          {propriedade && <p className="text-sm text-slate-500">{propriedade.nome}</p>}
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
          <select name="tipo" value={form.tipo} onChange={handleChange} className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-white">
            {TIPOS_PRODUTO.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select name="marca" value={form.marca} onChange={handleChange} className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-white">
            {MARCAS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input name="modelo" value={form.modelo} onChange={handleChange} placeholder="Modelo" className="border border-slate-300 rounded-lg px-3 py-2.5 text-sm" />
            <input name="tamanho" value={form.tamanho} onChange={handleChange} placeholder="Tamanho" className="border border-slate-300 rounded-lg px-3 py-2.5 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input name="ano" value={form.ano} onChange={handleChange} placeholder="Ano" type="number" inputMode="numeric" className="border border-slate-300 rounded-lg px-3 py-2.5 text-sm" />
            <input name="numero_serie" value={form.numero_serie} onChange={handleChange} placeholder="Nº Série" className="border border-slate-300 rounded-lg px-3 py-2.5 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input name="horimetro" value={form.horimetro} onChange={handleChange} placeholder="Horímetro (h)" type="number" inputMode="numeric" className="border border-slate-300 rounded-lg px-3 py-2.5 text-sm" />
            <select name="estado" value={form.estado} onChange={handleChange} className="border border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-white">
              {ESTADOS.map((e) => (
                <option key={e} value={e}>{ESTADO_LABELS[e]}</option>
              ))}
            </select>
          </div>
          <textarea name="observacoes" value={form.observacoes} onChange={handleChange} placeholder="Observações" rows={2} className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm" />
          <button type="submit" className="w-full bg-green-600 text-white py-2.5 rounded-lg font-medium text-sm active:bg-green-700">Salvar Máquina</button>
        </form>
      )}

      {maquinas.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-4xl mb-3">🚜</p>
          <p className="text-slate-400">Nenhuma máquina cadastrada</p>
          <button onClick={() => setShowForm(true)} className="text-blue-700 text-sm mt-2 font-medium">
            Cadastrar primeira máquina
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {maquinas.map((m, i) => (
            <div key={m.id} className="bg-white rounded-xl shadow p-4 animate-fade-in" style={{ animationDelay: `${i * 0.03}s` }}>
              <div className="flex items-center justify-between mb-1">
                <p className="font-medium">{m.marca} {m.modelo}</p>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${ESTADO_COLORS[m.estado]}`}>
                    {ESTADO_LABELS[m.estado]}
                  </span>
                  <button onClick={() => setDeleteTarget(m)} className="text-slate-300 hover:text-red-500 text-lg px-1">&times;</button>
                </div>
              </div>
              <p className="text-xs text-slate-500">
                {m.tipo}
                {m.tamanho ? ` · ${m.tamanho}` : ''}
                {m.ano ? ` · ${m.ano}` : ''}
                {m.horimetro ? ` · ${m.horimetro}h` : ''}
              </p>
              {m.numero_serie && <p className="text-xs text-slate-400 mt-1">S/N: {m.numero_serie}</p>}
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        show={!!deleteTarget}
        title="Excluir máquina"
        message={`Excluir "${deleteTarget?.marca} ${deleteTarget?.modelo}"?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </PullToRefresh>
  )
}
