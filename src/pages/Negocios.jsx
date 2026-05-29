import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
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

const HORIZONTES = [
  { key: 'todos', label: 'Todos' },
  { key: 'atrasado', label: 'Atrasados' },
  { key: 'proximos_30', label: 'Próx. 30 dias' },
  { key: 'proximos_90', label: 'Próx. 90 dias' },
  { key: 'distante', label: 'Mais distantes' },
  { key: 'sem_data', label: 'Sem data' },
]

function classificarHorizonte(negocio, hoje) {
  if (!negocio.data_fechamento_prevista) return 'sem_data'
  const prevista = new Date(negocio.data_fechamento_prevista)
  prevista.setHours(0, 0, 0, 0)
  const diffDias = Math.floor((prevista - hoje) / 86400000)
  if (diffDias < 0) {
    return negocio.status && !negocio.status.startsWith('fechado') ? 'atrasado' : 'distante'
  }
  if (diffDias <= 30) return 'proximos_30'
  if (diffDias <= 90) return 'proximos_90'
  return 'distante'
}

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

export default function Negocios() {
  const [negocios, setNegocios] = useState([])
  const [clientes, setClientes] = useState([])
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [filtroHorizonte, setFiltroHorizonte] = useState('todos')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [editForm, setEditForm] = useState(null)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setNegocios(await getAllRecords('negocios'))
    setClientes(await getAllRecords('clientes'))
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

  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const negociosComHorizonte = negocios.map((n) => ({ ...n, _horizonte: classificarHorizonte(n, hoje) }))

  let negociosFiltrados = negociosComHorizonte
    .filter((n) => filtroStatus === 'todos' || n.status === filtroStatus)
    .filter((n) => filtroHorizonte === 'todos' || n._horizonte === filtroHorizonte)

  if (filtroHorizonte !== 'todos' && filtroHorizonte !== 'sem_data') {
    negociosFiltrados = [...negociosFiltrados].sort((a, b) => {
      if (!a.data_fechamento_prevista) return 1
      if (!b.data_fechamento_prevista) return -1
      return new Date(a.data_fechamento_prevista) - new Date(b.data_fechamento_prevista)
    })
  }

  const totalValor = negocios
    .filter((n) => !n.status.startsWith('fechado_perdido'))
    .reduce((acc, n) => acc + (n.valor || 0), 0)

  const clienteMap = Object.fromEntries(clientes.map((c) => [c.id, c.nome]))

  return (
    <PullToRefresh onRefresh={carregar}>
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-bold">Negócios</h2>
        <p className="text-sm text-slate-500">Pipeline: R$ {totalValor.toLocaleString('pt-BR')}</p>
        <p className="text-xs text-slate-400 mt-1">Novos negócios são criados ao registrar uma visita.</p>
      </div>

      {/* Filtros (status + horizonte) num único scroll horizontal */}
      <div className="flex gap-1 overflow-x-auto pb-2 mb-3 items-center">
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

        <span className="w-px h-5 bg-slate-300 mx-1 shrink-0" aria-hidden="true" />

        {HORIZONTES.map((h) => {
          const count = h.key === 'todos'
            ? negociosComHorizonte.length
            : negociosComHorizonte.filter((n) => n._horizonte === h.key).length
          const ativo = filtroHorizonte === h.key
          const isAtrasado = h.key === 'atrasado'
          const baseClass = ativo
            ? (isAtrasado ? 'bg-red-600 text-white border-red-600' : 'bg-slate-700 text-white border-slate-700')
            : (isAtrasado && count > 0 ? 'bg-red-50 text-red-700 border-red-200' : 'bg-white text-slate-600 border-slate-300')
          return (
            <button
              key={h.key}
              onClick={() => setFiltroHorizonte(h.key)}
              className={`px-3 py-1 rounded-full text-xs whitespace-nowrap border ${baseClass}`}
            >
              {h.label} ({count})
            </button>
          )
        })}
      </div>

      {negociosFiltrados.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-4xl mb-3">💰</p>
          <p className="text-slate-400">{filtroStatus === 'todos' && filtroHorizonte === 'todos' ? 'Nenhum negócio cadastrado' : 'Nenhum negócio neste filtro'}</p>
          {filtroStatus === 'todos' && filtroHorizonte === 'todos' && (
            <Link to="/visitas" className="text-blue-700 text-sm mt-2 font-medium inline-block">
              Registrar uma visita →
            </Link>
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
                  <p className={`text-xs mt-1 flex items-center gap-1.5 ${n._horizonte === 'atrasado' ? 'text-red-600 font-medium' : 'text-slate-400'}`}>
                    Previsão: {new Date(n.data_fechamento_prevista).toLocaleDateString('pt-BR')}
                    {n._horizonte === 'atrasado' && (
                      <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-semibold">Atrasado</span>
                    )}
                  </p>
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
