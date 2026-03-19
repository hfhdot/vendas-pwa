import { useState, useEffect } from 'react'
import { getAllRecords, saveRecord, deleteRecord, registrarLog } from '../lib/db'
import { TIPOS_PRODUTO, MARCAS } from '../lib/constants'
import PullToRefresh from '../components/PullToRefresh'
import ConfirmModal from '../components/ConfirmModal'

const STATUS_FUNIL = [
  { key: 'prospect', label: 'Prospect', color: 'bg-slate-100 text-slate-700' },
  { key: 'proposta_enviada', label: 'Proposta Enviada', color: 'bg-blue-100 text-blue-800' },
  { key: 'em_negociacao', label: 'Em Negociação', color: 'bg-yellow-100 text-yellow-800' },
  { key: 'fechado_ganho', label: 'Fechado (Ganho)', color: 'bg-green-100 text-green-800' },
  { key: 'fechado_perdido', label: 'Fechado (Perdido)', color: 'bg-red-100 text-red-800' },
]

const MOTIVOS_PERDA = [
  {
    key: 'preco',
    label: 'Preço',
    campos: [
      { key: 'valor_desejado', label: 'Valor que o cliente queria', tipo: 'number' },
      { key: 'diferenca_preco', label: 'Diferença de preço', tipo: 'text' },
    ],
  },
  {
    key: 'concorrencia',
    label: 'Concorrência',
    campos: [
      { key: 'nome_concorrente', label: 'Nome do concorrente', tipo: 'text' },
      { key: 'condicoes_oferecidas', label: 'Condições oferecidas', tipo: 'text' },
      { key: 'valor_concorrente', label: 'Valor oferecido (R$)', tipo: 'number' },
    ],
  },
  {
    key: 'sem_orcamento',
    label: 'Sem orçamento',
    campos: [
      { key: 'previsao_verba', label: 'Previsão de quando terá verba', tipo: 'text' },
    ],
  },
  {
    key: 'sem_interesse',
    label: 'Sem interesse',
    campos: [
      { key: 'motivo_desinteresse', label: 'Motivo do desinteresse', tipo: 'text' },
    ],
  },
  {
    key: 'prazo',
    label: 'Prazo',
    campos: [
      { key: 'prazo_necessario', label: 'Prazo que precisava', tipo: 'text' },
      { key: 'prazo_oferecido', label: 'Prazo que oferecemos', tipo: 'text' },
    ],
  },
  {
    key: 'produto_inadequado',
    label: 'Produto inadequado',
    campos: [
      { key: 'produto_necessario', label: 'O que ele precisava', tipo: 'text' },
    ],
  },
  {
    key: 'sem_retorno',
    label: 'Sem retorno',
    campos: [
      { key: 'tentativas_contato', label: 'Quantas tentativas de contato', tipo: 'number' },
      { key: 'ultima_tentativa', label: 'Data da última tentativa', tipo: 'date' },
    ],
  },
  {
    key: 'outro',
    label: 'Outro',
    campos: [
      { key: 'descricao', label: 'Detalhe o motivo', tipo: 'text' },
    ],
  },
]

const EMPTY = {
  cliente_id: '', propriedade_id: '', status: 'prospect',
  valor: '', data_fechamento_prevista: '', notas: '', produtos: [],
}

export default function Negocios() {
  const [negocios, setNegocios] = useState([])
  const [clientes, setClientes] = useState([])
  const [propriedades, setPropriedades] = useState([])
  const [propsCliente, setPropsCliente] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [editForm, setEditForm] = useState(null)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setNegocios(await getAllRecords('negocios'))
    setClientes(await getAllRecords('clientes'))
    setPropriedades(await getAllRecords('propriedades'))
  }

  function handleChange(e) {
    const { name, value } = e.target
    setForm({ ...form, [name]: value })

    if (name === 'cliente_id') {
      setPropsCliente(propriedades.filter((p) => p.cliente_dono_id === parseInt(value)))
      setForm((f) => ({ ...f, cliente_id: value, propriedade_id: '' }))
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const vendedor = JSON.parse(localStorage.getItem('vendedor'))
    const now = new Date().toISOString()

    await saveRecord('negocios', {
      vendedor_id: vendedor.id,
      cliente_id: parseInt(form.cliente_id),
      propriedade_id: form.propriedade_id ? parseInt(form.propriedade_id) : null,
      status: form.status,
      valor: form.valor ? parseFloat(form.valor) : null,
      motivo_perda: null,
      data_fechamento_prevista: form.data_fechamento_prevista || null,
      notas: form.notas,
      produtos: form.produtos || [],
      created_at: now,
      updated_at: now,
    })
    await registrarLog('criar', 'negocios', null, `Negócio: R$ ${form.valor || '0'} - ${form.status} - Produtos: ${(form.produtos || []).join(', ') || 'nenhum'}`)
    setForm(EMPTY)
    setShowForm(false)
    carregar()
  }

  async function atualizarStatus(negocio, novoStatus) {
    await saveRecord('negocios', {
      ...negocio,
      status: novoStatus,
      updated_at: new Date().toISOString(),
    })
    await registrarLog('alterar', 'negocios', negocio.id, `Status: ${negocio.status} → ${novoStatus}`)
    carregar()
  }

  async function handleDelete() {
    if (deleteTarget) {
      await registrarLog('excluir', 'negocios', deleteTarget.id, `Negócio: R$ ${deleteTarget.valor || '0'}`)
      await deleteRecord('negocios', deleteTarget.id)
      setDeleteTarget(null)
      carregar()
    }
  }

  function parseMotivo(motivo_perda) {
    if (!motivo_perda) return { categoria: '', detalhes: {} }
    try {
      return JSON.parse(motivo_perda)
    } catch {
      return { categoria: 'outro', detalhes: { descricao: motivo_perda } }
    }
  }

  function abrirEdicao(negocio) {
    setEditTarget(negocio)
    const motivo = parseMotivo(negocio.motivo_perda)
    setEditForm({
      status: negocio.status,
      valor: negocio.valor || '',
      notas: negocio.notas || '',
      produtos: negocio.produtos || [],
      data_fechamento_prevista: negocio.data_fechamento_prevista || '',
      motivo_categoria: motivo.categoria || '',
      motivo_detalhes: motivo.detalhes || {},
    })
  }

  async function handleSalvarEdicao() {
    if (!editTarget || !editForm) return

    const alteracoes = []
    if (editForm.status !== editTarget.status) alteracoes.push(`status: ${editTarget.status} → ${editForm.status}`)
    if (String(editForm.valor) !== String(editTarget.valor || '')) alteracoes.push(`valor: R$ ${editTarget.valor || 0} → R$ ${editForm.valor || 0}`)
    if (editForm.notas !== (editTarget.notas || '')) alteracoes.push('notas alteradas')
    if (editForm.data_fechamento_prevista !== (editTarget.data_fechamento_prevista || '')) alteracoes.push('previsão alterada')

    // Montar motivo de perda estruturado
    let motivo_perda = null
    if (editForm.status === 'fechado_perdido' && editForm.motivo_categoria) {
      motivo_perda = JSON.stringify({
        categoria: editForm.motivo_categoria,
        detalhes: editForm.motivo_detalhes,
      })
      const motivoLabel = MOTIVOS_PERDA.find((m) => m.key === editForm.motivo_categoria)?.label || editForm.motivo_categoria
      alteracoes.push(`motivo perda: ${motivoLabel}`)
    }

    await saveRecord('negocios', {
      ...editTarget,
      status: editForm.status,
      valor: editForm.valor ? parseFloat(editForm.valor) : null,
      notas: editForm.notas,
      produtos: editForm.produtos || [],
      data_fechamento_prevista: editForm.data_fechamento_prevista || null,
      motivo_perda,
      updated_at: new Date().toISOString(),
      status_sync: 'pending',
    })

    await registrarLog('alterar', 'negocios', editTarget.id, `Edição: ${alteracoes.join(', ') || 'sem alterações'}`)
    setEditTarget(null)
    setEditForm(null)
    carregar()
  }

  const negociosFiltrados = filtroStatus === 'todos'
    ? negocios
    : negocios.filter((n) => n.status === filtroStatus)

  const totalValor = negocios
    .filter((n) => !n.status.startsWith('fechado_perdido'))
    .reduce((acc, n) => acc + (n.valor || 0), 0)

  const clienteMap = Object.fromEntries(clientes.map((c) => [c.id, c.nome]))

  return (
    <PullToRefresh onRefresh={carregar}>
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold">Negócios</h2>
          <p className="text-sm text-slate-500">Pipeline: R$ {totalValor.toLocaleString('pt-BR')}</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          {showForm ? 'Cancelar' : '+ Novo'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-4 mb-4 space-y-3 animate-slide-up">
          <select name="cliente_id" value={form.cliente_id} onChange={handleChange} required className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
            <option value="">Selecione o cliente *</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>

          {propsCliente.length > 0 && (
            <select name="propriedade_id" value={form.propriedade_id} onChange={handleChange} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
              <option value="">Propriedade (opcional)</option>
              {propsCliente.map((p) => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          )}

          <select name="status" value={form.status} onChange={handleChange} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
            {STATUS_FUNIL.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>

          {/* Produtos */}
          <ProdutosEditor
            produtos={form.produtos}
            onChange={(prods) => setForm({ ...form, produtos: prods })}
          />

          <input name="valor" value={form.valor} onChange={handleChange} placeholder="Valor (R$)" type="number" step="0.01" inputMode="decimal" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <input name="data_fechamento_prevista" value={form.data_fechamento_prevista} onChange={handleChange} type="date" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <textarea name="notas" value={form.notas} onChange={handleChange} placeholder="Notas" rows={2} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <button type="submit" className="w-full bg-green-600 text-white py-2 rounded-lg font-medium text-sm">Salvar Negócio</button>
        </form>
      )}

      {/* Filtro por status */}
      <div className="flex gap-1 overflow-x-auto pb-2 mb-3">
        <button
          onClick={() => setFiltroStatus('todos')}
          className={`px-3 py-1 rounded-full text-xs whitespace-nowrap border ${filtroStatus === 'todos' ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-slate-600 border-slate-300'}`}
        >
          Todos ({negocios.length})
        </button>
        {STATUS_FUNIL.map((s) => {
          const count = negocios.filter((n) => n.status === s.key).length
          return (
            <button
              key={s.key}
              onClick={() => setFiltroStatus(s.key)}
              className={`px-3 py-1 rounded-full text-xs whitespace-nowrap border ${filtroStatus === s.key ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-slate-600 border-slate-300'}`}
            >
              {s.label} ({count})
            </button>
          )
        })}
      </div>

      {negociosFiltrados.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-4xl mb-3">💰</p>
          <p className="text-slate-400">{filtroStatus === 'todos' ? 'Nenhum negócio cadastrado' : 'Nenhum negócio neste status'}</p>
          {filtroStatus === 'todos' && (
            <button onClick={() => setShowForm(true)} className="text-blue-700 text-sm mt-2 font-medium">
              Criar primeiro negócio
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {negociosFiltrados.map((n, i) => {
            const statusInfo = STATUS_FUNIL.find((s) => s.key === n.status)
            return (
              <div key={n.id} className="bg-white rounded-xl shadow p-4 animate-fade-in" style={{ animationDelay: `${i * 0.03}s` }}>
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium text-sm">{clienteMap[n.cliente_id] || '...'}</p>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusInfo?.color}`}>
                      {statusInfo?.label}
                    </span>
                    <button onClick={() => abrirEdicao(n)} className="text-slate-400 hover:text-blue-600 text-sm px-1">✎</button>
                    <button onClick={() => setDeleteTarget(n)} className="text-slate-300 hover:text-red-500 text-lg px-1">&times;</button>
                  </div>
                </div>
                {n.valor && <p className="text-lg font-bold text-green-700">R$ {n.valor.toLocaleString('pt-BR')}</p>}
                {n.produtos?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {n.produtos.map((p, idx) => {
                      const label = typeof p === 'string' ? p : `${p.tipo} · ${p.marca}${p.modelo ? ' ' + p.modelo : ''}`
                      return <span key={idx} className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{label}</span>
                    })}
                  </div>
                )}
                {n.notas && <p className="text-sm text-slate-600 mt-1">{n.notas}</p>}
                {n.data_fechamento_prevista && (
                  <p className="text-xs text-slate-400 mt-1">Previsão: {new Date(n.data_fechamento_prevista).toLocaleDateString('pt-BR')}</p>
                )}
                {n.motivo_perda && (() => {
                  const m = parseMotivo(n.motivo_perda)
                  const motivoLabel = MOTIVOS_PERDA.find((x) => x.key === m.categoria)?.label || m.categoria
                  const detalhesStr = Object.entries(m.detalhes || {})
                    .filter(([, v]) => v)
                    .map(([, v]) => v)
                    .join(' · ')
                  return (
                    <div className="mt-1">
                      <p className="text-xs text-red-600 font-medium">Motivo: {motivoLabel}</p>
                      {detalhesStr && <p className="text-xs text-red-400">{detalhesStr}</p>}
                    </div>
                  )
                })()}

                {/* Ações rápidas de mudança de status */}
                {!n.status.startsWith('fechado') && (
                  <div className="flex gap-1 mt-3 flex-wrap">
                    {STATUS_FUNIL.filter((s) => s.key !== n.status).map((s) => (
                      <button
                        key={s.key}
                        onClick={() => {
                          if (s.key === 'fechado_perdido') {
                            // Abre edição com status pré-selecionado para preencher motivo
                            setEditTarget(n)
                            const motivo = parseMotivo(n.motivo_perda)
                            setEditForm({
                              status: 'fechado_perdido',
                              valor: n.valor || '',
                              notas: n.notas || '',
                              data_fechamento_prevista: n.data_fechamento_prevista || '',
                              motivo_categoria: motivo.categoria || '',
                              motivo_detalhes: motivo.detalhes || {},
                            })
                          } else {
                            atualizarStatus(n, s.key)
                          }
                        }}
                        className="text-xs px-2 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-50"
                      >
                        {s.label}
                      </button>
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
        title="Excluir negócio"
        message={`Excluir este negócio${deleteTarget?.valor ? ` de R$ ${deleteTarget.valor.toLocaleString('pt-BR')}` : ''}? Essa ação não pode ser desfeita.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Modal de edição */}
      {editTarget && editForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4 pb-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm max-h-[85vh] flex flex-col animate-slide-up">
            <div className="p-4 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg">Editar Negócio</h3>
                <button onClick={() => { setEditTarget(null); setEditForm(null) }} className="text-slate-400 text-xl px-1">&times;</button>
              </div>
              <p className="text-xs text-slate-500">{clienteMap[editTarget.cliente_id] || 'Cliente'}</p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {/* Status */}
              <div>
                <label className="block text-xs text-slate-500 mb-1">Status</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                >
                  {STATUS_FUNIL.map((s) => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>
              </div>

              {/* Valor */}
              <div>
                <label className="block text-xs text-slate-500 mb-1">Valor (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={editForm.valor}
                  onChange={(e) => setEditForm({ ...editForm, valor: e.target.value })}
                  placeholder="0,00"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>

              {/* Previsão de fechamento */}
              <div>
                <label className="block text-xs text-slate-500 mb-1">Previsão de fechamento</label>
                <input
                  type="date"
                  value={editForm.data_fechamento_prevista}
                  onChange={(e) => setEditForm({ ...editForm, data_fechamento_prevista: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>

              {/* Produtos */}
              <ProdutosEditor
                produtos={editForm.produtos || []}
                onChange={(prods) => setEditForm({ ...editForm, produtos: prods })}
              />

              {/* Notas */}
              <div>
                <label className="block text-xs text-slate-500 mb-1">Notas</label>
                <textarea
                  value={editForm.notas}
                  onChange={(e) => setEditForm({ ...editForm, notas: e.target.value })}
                  placeholder="Notas sobre o negócio"
                  rows={3}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>

              {/* Motivo de perda (se status for fechado_perdido) */}
              {editForm.status === 'fechado_perdido' && (
                <div className="space-y-2">
                  <label className="block text-xs text-slate-500 mb-1">Motivo da perda</label>
                  <select
                    value={editForm.motivo_categoria}
                    onChange={(e) => setEditForm({ ...editForm, motivo_categoria: e.target.value, motivo_detalhes: {} })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    <option value="">Selecione o motivo *</option>
                    {MOTIVOS_PERDA.map((m) => (
                      <option key={m.key} value={m.key}>{m.label}</option>
                    ))}
                  </select>

                  {/* Sub-campos dinâmicos */}
                  {editForm.motivo_categoria && (() => {
                    const motivo = MOTIVOS_PERDA.find((m) => m.key === editForm.motivo_categoria)
                    if (!motivo) return null
                    return (
                      <div className="bg-red-50 rounded-lg p-3 space-y-2 animate-slide-up">
                        <p className="text-xs font-medium text-red-700">Detalhes - {motivo.label}</p>
                        {motivo.campos.map((campo) => (
                          <div key={campo.key}>
                            <label className="block text-[10px] text-red-500 mb-0.5">{campo.label}</label>
                            <input
                              type={campo.tipo === 'number' ? 'number' : campo.tipo === 'date' ? 'date' : 'text'}
                              inputMode={campo.tipo === 'number' ? 'decimal' : undefined}
                              value={editForm.motivo_detalhes[campo.key] || ''}
                              onChange={(e) => setEditForm({
                                ...editForm,
                                motivo_detalhes: { ...editForm.motivo_detalhes, [campo.key]: e.target.value },
                              })}
                              className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm bg-white"
                            />
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 flex gap-2">
              <button
                onClick={() => { setEditTarget(null); setEditForm(null) }}
                className="flex-1 bg-slate-100 text-slate-600 py-2.5 rounded-lg font-medium text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvarEdicao}
                className="flex-1 bg-blue-700 text-white py-2.5 rounded-lg font-medium text-sm active:bg-blue-800"
              >
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </PullToRefresh>
  )
}

function ProdutosEditor({ produtos, onChange }) {
  const [showAdd, setShowAdd] = useState(false)
  const [novo, setNovo] = useState({ tipo: '', marca: '', modelo: '' })

  function addProduto() {
    if (!novo.tipo) return
    onChange([...produtos, { ...novo }])
    setNovo({ tipo: '', marca: '', modelo: '' })
    setShowAdd(false)
  }

  function removeProduto(idx) {
    onChange(produtos.filter((_, i) => i !== idx))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-slate-500">Produtos ({produtos.length})</p>
        <button type="button" onClick={() => setShowAdd(!showAdd)} className="text-xs text-blue-600 font-medium">
          {showAdd ? 'Cancelar' : '+ Adicionar'}
        </button>
      </div>

      {/* Formulário adicionar */}
      {showAdd && (
        <div className="bg-slate-50 rounded-lg p-3 mb-2 space-y-2 animate-slide-up">
          <select
            value={novo.tipo}
            onChange={(e) => setNovo({ ...novo, tipo: e.target.value })}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="">Selecione o tipo *</option>
            {TIPOS_PRODUTO.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          {novo.tipo && (
            <>
              <select
                value={novo.marca}
                onChange={(e) => setNovo({ ...novo, marca: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="">Marca (opcional)</option>
                {MARCAS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>

              <input
                value={novo.modelo}
                onChange={(e) => setNovo({ ...novo, modelo: e.target.value })}
                placeholder="Modelo (opcional)"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />

              <button
                type="button"
                onClick={addProduto}
                className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-medium"
              >
                Adicionar Produto
              </button>
            </>
          )}
        </div>
      )}

      {/* Lista de produtos adicionados */}
      {produtos.length > 0 && (
        <div className="space-y-1">
          {produtos.map((p, idx) => {
            const label = typeof p === 'string' ? p : `${p.tipo}${p.marca ? ' · ' + p.marca : ''}${p.modelo ? ' ' + p.modelo : ''}`
            return (
              <div key={idx} className="flex items-center justify-between bg-blue-50 rounded-lg px-3 py-2">
                <p className="text-xs text-blue-800">{label}</p>
                <button type="button" onClick={() => removeProduto(idx)} className="text-blue-400 hover:text-red-500 text-sm px-1">&times;</button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
