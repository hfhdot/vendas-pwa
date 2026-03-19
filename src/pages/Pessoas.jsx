import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getByIndex, saveRecord, getRecord, deleteRecord, registrarLog } from '../lib/db'
import { maskTelefone } from '../lib/masks'
import PullToRefresh from '../components/PullToRefresh'
import ConfirmModal from '../components/ConfirmModal'

const VINCULOS = ['proprietario', 'familiar', 'funcionario', 'gerente', 'outro']
const VINCULO_LABEL = { proprietario: 'Proprietário', familiar: 'Familiar', funcionario: 'Funcionário', gerente: 'Gerente', outro: 'Outro' }
const EMPTY = { nome: '', vinculo: 'proprietario', cargo: '', telefone: '', observacoes: '' }

export default function Pessoas() {
  const { propriedadeId } = useParams()
  const navigate = useNavigate()
  const [pessoas, setPessoas] = useState([])
  const [propriedade, setPropriedade] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [deleteTarget, setDeleteTarget] = useState(null)

  useEffect(() => { carregar() }, [propriedadeId])

  async function carregar() {
    setPessoas(await getByIndex('pessoas', 'propriedade_id', propriedadeId))
    setPropriedade(await getRecord('propriedades', propriedadeId))
  }

  function handleChange(e) {
    let { name, value } = e.target
    if (name === 'telefone') value = maskTelefone(value)
    setForm({ ...form, [name]: value })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const pessoaId = await saveRecord('pessoas', {
      propriedade_id: parseInt(propriedadeId),
      ...form,
      created_at: new Date().toISOString(),
    })
    await registrarLog('criar', 'pessoas', pessoaId, `Pessoa: ${form.nome}`)
    setForm(EMPTY)
    setShowForm(false)
    carregar()
  }

  async function handleDelete() {
    if (deleteTarget) {
      await registrarLog('excluir', 'pessoas', deleteTarget.id, `Pessoa: ${deleteTarget.nome}`)
      await deleteRecord('pessoas', deleteTarget.id)
      setDeleteTarget(null)
      carregar()
    }
  }

  return (
    <PullToRefresh onRefresh={carregar}>
      <button onClick={() => navigate(-1)} className="text-blue-700 text-sm mb-2 active:text-blue-900">&larr; Voltar</button>

      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold">Pessoas</h2>
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
          <input name="nome" value={form.nome} onChange={handleChange} required placeholder="Nome *" className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm" />
          <select name="vinculo" value={form.vinculo} onChange={handleChange} className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-white">
            {VINCULOS.map((v) => (
              <option key={v} value={v}>{VINCULO_LABEL[v]}</option>
            ))}
          </select>
          <input name="cargo" value={form.cargo} onChange={handleChange} placeholder="Cargo" className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm" />
          <input name="telefone" value={form.telefone} onChange={handleChange} placeholder="Telefone" inputMode="tel" className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm" />
          <textarea name="observacoes" value={form.observacoes} onChange={handleChange} placeholder="Observações" rows={2} className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm" />
          <button type="submit" className="w-full bg-green-600 text-white py-2.5 rounded-lg font-medium text-sm active:bg-green-700">Salvar Pessoa</button>
        </form>
      )}

      {pessoas.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-4xl mb-3">👥</p>
          <p className="text-slate-400">Nenhuma pessoa cadastrada</p>
          <button onClick={() => setShowForm(true)} className="text-blue-700 text-sm mt-2 font-medium">
            Cadastrar primeira pessoa
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {pessoas.map((p, i) => (
            <div key={p.id} className="bg-white rounded-xl shadow p-4 animate-fade-in" style={{ animationDelay: `${i * 0.03}s` }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{p.nome}</p>
                  <p className="text-xs text-slate-500">
                    {VINCULO_LABEL[p.vinculo] || p.vinculo}
                    {p.cargo ? ` · ${p.cargo}` : ''}
                  </p>
                  {p.telefone && <p className="text-xs text-blue-600 mt-1">{p.telefone}</p>}
                </div>
                <button onClick={() => setDeleteTarget(p)} className="text-slate-300 hover:text-red-500 text-lg px-1">&times;</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        show={!!deleteTarget}
        title="Excluir pessoa"
        message={`Excluir "${deleteTarget?.nome}"?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </PullToRefresh>
  )
}
