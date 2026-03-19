import { useState, useEffect } from 'react'
import { getAllRecords, getByIndex, getRecord, deleteRecord, saveRecord, registrarLog } from '../lib/db'
import { useCheckin } from '../hooks/useCheckin'
import PullToRefresh from '../components/PullToRefresh'
import ConfirmModal from '../components/ConfirmModal'
import AudioTextInput from '../components/AudioTextInput'
import { TIPOS_PRODUTO, MARCAS } from '../lib/constants'

const TIPO_LABELS = {
  presencial: 'Presencial',
  mensagem: 'Mensagem',
  telefonema: 'Telefonema',
  email: 'E-mail',
  // legado
  presenca: 'Presença',
  negociacao: 'Negociação',
}

const TIPO_COLORS = {
  presencial: 'bg-blue-100 text-blue-800',
  mensagem: 'bg-green-100 text-green-800',
  telefonema: 'bg-amber-100 text-amber-800',
  email: 'bg-purple-100 text-purple-800',
  presenca: 'bg-blue-100 text-blue-800',
  negociacao: 'bg-purple-100 text-purple-800',
}

export default function Visitas() {
  const { loading, erroGPS, gpsData, fotoPreview, iniciarCheckin, tirarFoto, salvarVisita, resetCheckin } = useCheckin()
  const [showForm, setShowForm] = useState(false)
  const [visitas, setVisitas] = useState([])
  const [clientes, setClientes] = useState([])
  const [propriedadesAll, setPropriedadesAll] = useState([])
  const [propriedadesFiltradas, setPropriedadesFiltradas] = useState([])
  const [pessoasDisp, setPessoasDisp] = useState([])
  const [maquinasDisp, setMaquinasDisp] = useState([])
  const [negocios, setNegocios] = useState([])
  const [sucesso, setSucesso] = useState(false)
  const [clienteSelecionado, setClienteSelecionado] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [showNovaPessoa, setShowNovaPessoa] = useState(false)
  const [novaPessoa, setNovaPessoa] = useState({ nome: '', cargo: '', telefone: '' })
  const [showNovaMaquina, setShowNovaMaquina] = useState(false)
  const [novaMaquina, setNovaMaquina] = useState({ tipo: 'Trator Novo', marca: 'New Holland', modelo: '', tamanho: '' })
  const [showNegocio, setShowNegocio] = useState(false)
  const [showNovoNegocio, setShowNovoNegocio] = useState(false)
  const [novoNegocio, setNovoNegocio] = useState({ valor: '', status: 'prospect', notas: '' })
  const [negocioVinculado, setNegocioVinculado] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [editForm, setEditForm] = useState(null)

  const [form, setForm] = useState({
    propriedade_id: '',
    tipo: 'presencial',
    negocio_id: '',
    pessoa_ids: [],
    maquina_ids: [],
    resumo: '',
    proximos_passos: '',
    data_proximo_contato: '',
    acionar_pos_vendas: false,
    data_visita: '',
  })

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setVisitas(await getAllRecords('visitas'))
    setClientes(await getAllRecords('clientes'))
    setPropriedadesAll(await getAllRecords('propriedades'))
    setNegocios(await getAllRecords('negocios'))
  }

  async function handleClienteChange(clienteId) {
    setClienteSelecionado(clienteId)
    setForm({ ...form, propriedade_id: '', pessoa_ids: [], maquina_ids: [] })
    setPessoasDisp([])
    setMaquinasDisp([])
    if (clienteId) {
      const props = await getByIndex('propriedades', 'cliente_dono_id', clienteId)
      setPropriedadesFiltradas(props)
    } else {
      setPropriedadesFiltradas([])
    }
  }

  async function handlePropChange(propId) {
    setForm({ ...form, propriedade_id: propId, pessoa_ids: [], maquina_ids: [] })
    if (propId) {
      setPessoasDisp(await getByIndex('pessoas', 'propriedade_id', propId))
      setMaquinasDisp(await getByIndex('maquinas', 'propriedade_id', propId))
    } else {
      setPessoasDisp([])
      setMaquinasDisp([])
    }
  }

  function toggleArray(arr, id) {
    return arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]
  }

  async function handleSubmit(e) {
    e.preventDefault()
    try {
      await salvarVisita(form)
      setSucesso(true)
      setShowForm(false)
      resetCheckin()
      setClienteSelecionado('')
      setPropriedadesFiltradas([])
      setNegocioVinculado(null)
      setForm({ propriedade_id: '', tipo: 'presencial', negocio_id: '', pessoa_ids: [], maquina_ids: [], resumo: '', proximos_passos: '', data_proximo_contato: '', acionar_pos_vendas: false, data_visita: '' })
      carregar()
      setTimeout(() => setSucesso(false), 3000)
    } catch (err) {
      alert(err.message)
    }
  }

  const tipoPresencial = form.tipo === 'presencial'

  function getLocalDatetime() {
    const now = new Date()
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  }

  function handleNovaVisita() {
    setForm((f) => ({ ...f, data_visita: getLocalDatetime() }))
    setShowForm(true)
    iniciarCheckin()
  }

  function podeEditar(visita) {
    const criacao = new Date(visita.created_at || visita.data_visita)
    return (Date.now() - criacao.getTime()) < 48 * 60 * 60 * 1000
  }

  function abrirEdicao(visita) {
    setEditTarget(visita)
    setEditForm({
      tipo: visita.tipo || 'presencial',
      resumo: visita.resumo || '',
      proximos_passos: visita.proximos_passos || '',
      data_proximo_contato: visita.data_proximo_contato || '',
      acionar_pos_vendas: visita.acionar_pos_vendas || false,
    })
  }

  async function handleSalvarEdicao() {
    if (!editTarget || !editForm) return

    const alteracoes = []
    if (editForm.tipo !== editTarget.tipo) alteracoes.push(`tipo: ${editTarget.tipo} → ${editForm.tipo}`)
    if (editForm.resumo !== (editTarget.resumo || '')) alteracoes.push('resumo alterado')
    if (editForm.proximos_passos !== (editTarget.proximos_passos || '')) alteracoes.push('próximos passos alterado')
    if (editForm.data_proximo_contato !== (editTarget.data_proximo_contato || '')) alteracoes.push('data próximo contato alterada')
    if (editForm.acionar_pos_vendas !== (editTarget.acionar_pos_vendas || false)) alteracoes.push(`pós vendas: ${editForm.acionar_pos_vendas ? 'acionado' : 'removido'}`)

    await saveRecord('visitas', {
      ...editTarget,
      ...editForm,
      status_sync: 'pending',
    })

    await registrarLog('alterar', 'visitas', editTarget.id, `Edição: ${alteracoes.join(', ') || 'sem alterações'}`)

    setEditTarget(null)
    setEditForm(null)
    carregar()
  }

  async function handleDelete() {
    if (deleteTarget) {
      await registrarLog('excluir', 'visitas', deleteTarget.id, `Visita ${deleteTarget.tipo}`)
      await deleteRecord('visitas', deleteTarget.id)
      setDeleteTarget(null)
      carregar()
    }
  }

  const visitasOrdenadas = [...visitas].sort((a, b) => new Date(b.data_visita) - new Date(a.data_visita))

  return (
    <PullToRefresh onRefresh={carregar}>
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Visitas</h2>
        {!showForm && (
          <button onClick={handleNovaVisita} className="bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
            + Check-in
          </button>
        )}
      </div>

      {sucesso && (
        <div className="bg-green-100 text-green-800 p-3 rounded-lg mb-4 text-sm font-medium">
          Visita registrada com sucesso!
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-4 mb-4 space-y-3">
          {/* GPS Status - obrigatório só para presencial */}
          {tipoPresencial ? (
            <div className={`p-3 rounded-lg text-sm ${gpsData ? 'bg-green-50 text-green-700' : erroGPS ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
              {loading && 'Obtendo localização...'}
              {gpsData && `GPS: ${gpsData.latitude.toFixed(5)}, ${gpsData.longitude.toFixed(5)} (±${gpsData.gps_accuracy.toFixed(0)}m)`}
              {erroGPS && `Erro GPS: ${erroGPS}`}
              {erroGPS && (
                <button type="button" onClick={iniciarCheckin} className="ml-2 underline">Tentar novamente</button>
              )}
            </div>
          ) : (
            <div className="p-3 rounded-lg text-sm bg-slate-50 text-slate-500">
              GPS opcional para {TIPO_LABELS[form.tipo]}
              {gpsData && ` — capturado: ${gpsData.latitude.toFixed(4)}, ${gpsData.longitude.toFixed(4)}`}
              {!gpsData && !loading && (
                <button type="button" onClick={iniciarCheckin} className="ml-2 text-blue-600 underline">Capturar GPS</button>
              )}
            </div>
          )}

          {/* Cliente */}
          <select
            value={clienteSelecionado}
            onChange={(e) => handleClienteChange(e.target.value)}
            required
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Selecione o cliente *</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>

          {/* Propriedade (filtrada pelo cliente) */}
          <select
            value={form.propriedade_id}
            onChange={(e) => handlePropChange(e.target.value)}
            required
            disabled={!clienteSelecionado}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm disabled:opacity-50 disabled:bg-slate-50"
          >
            <option value="">{clienteSelecionado ? 'Selecione a propriedade *' : 'Selecione um cliente primeiro'}</option>
            {propriedadesFiltradas.map((p) => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
          </select>

          {/* Tipo */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { key: 'presencial', label: 'Presencial' },
              { key: 'mensagem', label: 'Mensagem' },
              { key: 'telefonema', label: 'Telefonema' },
              { key: 'email', label: 'E-mail' },
            ].map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setForm({ ...form, tipo: t.key })}
                className={`py-2 rounded-lg text-sm font-medium border ${form.tipo === t.key ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-slate-600 border-slate-300'}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Data/hora da visita */}
          <div>
            <label className="block text-xs text-slate-500 mb-1">Data/hora da visita</label>
            <input
              type="datetime-local"
              value={form.data_visita}
              max={getLocalDatetime()}
              onChange={(e) => setForm({ ...form, data_visita: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
            {form.data_visita && (Date.now() - new Date(form.data_visita).getTime()) > 5 * 60 * 1000 && (
              <p className="text-xs text-amber-600 mt-1 font-medium">Esta visita será marcada como retroativa</p>
            )}
          </div>

          {/* Negócio (opcional) */}
          <div>
            {negocioVinculado ? (
              <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-green-800">Negócio vinculado</p>
                  <p className="text-xs text-green-600">
                    {negocioVinculado.notas || negocioVinculado.status}
                    {negocioVinculado.valor ? ` - R$ ${Number(negocioVinculado.valor).toLocaleString('pt-BR')}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setNegocioVinculado(null); setForm({ ...form, negocio_id: '' }) }}
                  className="text-green-600 text-lg px-1"
                >&times;</button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowNegocio(true)}
                className="w-full py-2.5 rounded-lg text-sm font-medium border border-slate-300 bg-white text-slate-600 active:bg-slate-50"
              >
                + Vincular Negócio
              </button>
            )}
          </div>

          {/* Pessoas */}
          {form.propriedade_id && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-slate-500">Com quem conversou:</p>
                <button
                  type="button"
                  onClick={() => setShowNovaPessoa(!showNovaPessoa)}
                  className="text-xs text-blue-600 font-medium"
                >
                  {showNovaPessoa ? 'Cancelar' : '+ Nova pessoa'}
                </button>
              </div>

              {/* Mini formulário nova pessoa */}
              {showNovaPessoa && (
                <div className="bg-slate-50 rounded-lg p-3 mb-2 space-y-2 animate-slide-up">
                  <input
                    value={novaPessoa.nome}
                    onChange={(e) => setNovaPessoa({ ...novaPessoa, nome: e.target.value })}
                    placeholder="Nome *"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={novaPessoa.cargo}
                      onChange={(e) => setNovaPessoa({ ...novaPessoa, cargo: e.target.value })}
                      placeholder="Cargo"
                      className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                    />
                    <input
                      value={novaPessoa.telefone}
                      onChange={(e) => setNovaPessoa({ ...novaPessoa, telefone: e.target.value })}
                      placeholder="Telefone"
                      inputMode="tel"
                      className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={!novaPessoa.nome.trim()}
                    onClick={async () => {
                      const pessoaId = await saveRecord('pessoas', {
                        propriedade_id: parseInt(form.propriedade_id),
                        nome: novaPessoa.nome,
                        vinculo: 'outro',
                        cargo: novaPessoa.cargo,
                        telefone: novaPessoa.telefone,
                        observacoes: '',
                        created_at: new Date().toISOString(),
                      })
                      await registrarLog('criar', 'pessoas', pessoaId, `Pessoa: ${novaPessoa.nome} (via visita)`)
                      // Recarregar pessoas da propriedade
                      const novasPessoas = await getByIndex('pessoas', 'propriedade_id', form.propriedade_id)
                      setPessoasDisp(novasPessoas)
                      // Já selecionar a pessoa criada
                      setForm((f) => ({ ...f, pessoa_ids: [...f.pessoa_ids, pessoaId] }))
                      setNovaPessoa({ nome: '', cargo: '', telefone: '' })
                      setShowNovaPessoa(false)
                    }}
                    className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                  >
                    Adicionar Pessoa
                  </button>
                </div>
              )}

              {pessoasDisp.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {pessoasDisp.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setForm({ ...form, pessoa_ids: toggleArray(form.pessoa_ids, p.id) })}
                      className={`px-3 py-1 rounded-full text-xs border ${form.pessoa_ids.includes(p.id) ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-slate-600 border-slate-300'}`}
                    >
                      {p.nome}
                    </button>
                  ))}
                </div>
              ) : (
                !showNovaPessoa && (
                  <p className="text-xs text-slate-400 italic">Nenhuma pessoa cadastrada nesta propriedade</p>
                )
              )}
            </div>
          )}

          {/* Máquinas */}
          {form.propriedade_id && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-slate-500">Máquinas tratadas:</p>
                <button
                  type="button"
                  onClick={() => setShowNovaMaquina(!showNovaMaquina)}
                  className="text-xs text-blue-600 font-medium"
                >
                  {showNovaMaquina ? 'Cancelar' : '+ Nova máquina'}
                </button>
              </div>

              {/* Mini formulário nova máquina */}
              {showNovaMaquina && (
                <div className="bg-slate-50 rounded-lg p-3 mb-2 space-y-2 animate-slide-up">
                  <select
                    value={novaMaquina.tipo}
                    onChange={(e) => setNovaMaquina({ ...novaMaquina, tipo: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    {TIPOS_PRODUTO.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <select
                    value={novaMaquina.marca}
                    onChange={(e) => setNovaMaquina({ ...novaMaquina, marca: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    {MARCAS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={novaMaquina.modelo}
                      onChange={(e) => setNovaMaquina({ ...novaMaquina, modelo: e.target.value })}
                      placeholder="Modelo *"
                      className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                    />
                    <input
                      value={novaMaquina.tamanho}
                      onChange={(e) => setNovaMaquina({ ...novaMaquina, tamanho: e.target.value })}
                      placeholder="Tamanho"
                      className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={!novaMaquina.modelo.trim()}
                    onClick={async () => {
                      const maqId = await saveRecord('maquinas', {
                        propriedade_id: parseInt(form.propriedade_id),
                        tipo: novaMaquina.tipo,
                        marca: novaMaquina.marca,
                        modelo: novaMaquina.modelo,
                        tamanho: novaMaquina.tamanho || null,
                        ano: null,
                        numero_serie: '',
                        horimetro: null,
                        estado: 'bom',
                        observacoes: '',
                        created_at: new Date().toISOString(),
                      })
                      await registrarLog('criar', 'maquinas', maqId, `Máquina: ${novaMaquina.marca} ${novaMaquina.modelo} (via visita)`)
                      const novasMaquinas = await getByIndex('maquinas', 'propriedade_id', form.propriedade_id)
                      setMaquinasDisp(novasMaquinas)
                      setForm((f) => ({ ...f, maquina_ids: [...f.maquina_ids, maqId] }))
                      setNovaMaquina({ tipo: 'Trator Novo', marca: 'New Holland', modelo: '', tamanho: '' })
                      setShowNovaMaquina(false)
                    }}
                    className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                  >
                    Adicionar Máquina
                  </button>
                </div>
              )}

              {maquinasDisp.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {maquinasDisp.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setForm({ ...form, maquina_ids: toggleArray(form.maquina_ids, m.id) })}
                      className={`px-3 py-1 rounded-full text-xs border ${form.maquina_ids.includes(m.id) ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-slate-600 border-slate-300'}`}
                    >
                      {m.marca} {m.modelo}
                    </button>
                  ))}
                </div>
              ) : (
                !showNovaMaquina && (
                  <p className="text-xs text-slate-400 italic">Nenhuma máquina cadastrada nesta propriedade</p>
                )
              )}

              {/* Acionar Pós Vendas - aparece quando tem máquina selecionada */}
              {form.maquina_ids.length > 0 && (
                <button
                  type="button"
                  onClick={() => setForm({ ...form, acionar_pos_vendas: !form.acionar_pos_vendas })}
                  className={`mt-2 w-full py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                    form.acionar_pos_vendas
                      ? 'bg-orange-500 text-white border-orange-500'
                      : 'bg-white text-orange-600 border-orange-300'
                  }`}
                >
                  {form.acionar_pos_vendas ? '✓ Pós Vendas será acionado' : 'Acionar Pós Vendas'}
                </button>
              )}
            </div>
          )}

          {/* Foto */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={tirarFoto}
              className="bg-slate-100 text-slate-700 px-4 py-2 rounded-lg text-sm"
            >
              Tirar Foto
            </button>
            {fotoPreview && (
              <img src={fotoPreview} alt="Preview" className="w-16 h-16 object-cover rounded-lg" />
            )}
          </div>

          {/* Resumo - texto ou áudio */}
          <div>
            <label className="block text-xs text-slate-500 mb-1">Resumo da visita</label>
            <AudioTextInput
              value={form.resumo}
              onChange={(val) => setForm({ ...form, resumo: val })}
              placeholder="Digite ou toque no 🎤 para gravar"
              rows={3}
            />
          </div>

          {/* Próximos passos - texto ou áudio */}
          <div>
            <label className="block text-xs text-slate-500 mb-1">Próximos passos</label>
            <AudioTextInput
              value={form.proximos_passos}
              onChange={(val) => setForm({ ...form, proximos_passos: val })}
              placeholder="Digite ou toque no 🎤 para gravar"
              rows={2}
            />
          </div>

          {/* Data do próximo contato */}
          <div>
            <label className="block text-xs text-slate-500 mb-1">Próximo contato planejado</label>
            <input
              type="date"
              value={form.data_proximo_contato || ''}
              onChange={(e) => setForm({ ...form, data_proximo_contato: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setShowForm(false); resetCheckin(); setClienteSelecionado(''); setPropriedadesFiltradas([]); setNegocioVinculado(null) }}
              className="flex-1 bg-slate-100 text-slate-600 py-2 rounded-lg text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={(tipoPresencial && !gpsData) || !form.propriedade_id}
              className="flex-1 bg-green-600 text-white py-2 rounded-lg font-medium text-sm disabled:opacity-50"
            >
              Registrar Visita
            </button>
          </div>
        </form>
      )}

      {/* Histórico */}
      {visitasOrdenadas.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-4xl mb-3">📍</p>
          <p className="text-slate-400">Nenhuma visita registrada</p>
          {!showForm && (
            <button onClick={handleNovaVisita} className="text-blue-700 text-sm mt-2 font-medium">
              Fazer primeiro check-in
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {visitasOrdenadas.map((v, i) => (
            <VisitaCard key={v.id} visita={v} index={i} onDelete={() => setDeleteTarget(v)} onEdit={() => abrirEdicao(v)} editavel={podeEditar(v)} />
          ))}
        </div>
      )}

      <ConfirmModal
        show={!!deleteTarget}
        title="Excluir visita"
        message="Tem certeza que deseja excluir esta visita? Essa ação não pode ser desfeita."
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Modal vincular/criar negócio */}
      {showNegocio && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4 pb-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm max-h-[80vh] flex flex-col animate-slide-up">
            <div className="p-4 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg">Vincular Negócio</h3>
                <button
                  type="button"
                  onClick={() => { setShowNegocio(false); setShowNovoNegocio(false) }}
                  className="text-slate-400 text-xl px-1"
                >&times;</button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {/* Botão criar novo */}
              {!showNovoNegocio ? (
                <button
                  type="button"
                  onClick={() => setShowNovoNegocio(true)}
                  className="w-full py-2.5 mb-3 rounded-lg text-sm font-medium border-2 border-dashed border-blue-300 text-blue-600 active:bg-blue-50"
                >
                  + Criar Novo Negócio
                </button>
              ) : (
                <div className="bg-blue-50 rounded-lg p-3 mb-3 space-y-2 animate-slide-up">
                  <p className="text-xs font-medium text-blue-800 mb-1">Novo negócio</p>
                  <input
                    value={novoNegocio.valor}
                    onChange={(e) => setNovoNegocio({ ...novoNegocio, valor: e.target.value })}
                    placeholder="Valor (R$)"
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                  />
                  <select
                    value={novoNegocio.status}
                    onChange={(e) => setNovoNegocio({ ...novoNegocio, status: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    <option value="prospect">Prospect</option>
                    <option value="proposta_enviada">Proposta Enviada</option>
                    <option value="em_negociacao">Em Negociação</option>
                  </select>
                  <textarea
                    value={novoNegocio.notas}
                    onChange={(e) => setNovoNegocio({ ...novoNegocio, notas: e.target.value })}
                    placeholder="Descrição / notas"
                    rows={2}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowNovoNegocio(false)}
                      className="flex-1 bg-slate-100 text-slate-600 py-2 rounded-lg text-sm"
                    >Cancelar</button>
                    <button
                      type="button"
                      onClick={async () => {
                        const vendedor = JSON.parse(localStorage.getItem('vendedor'))
                        const now = new Date().toISOString()
                        const negId = await saveRecord('negocios', {
                          vendedor_id: vendedor.id,
                          cliente_id: parseInt(clienteSelecionado),
                          propriedade_id: form.propriedade_id ? parseInt(form.propriedade_id) : null,
                          status: novoNegocio.status,
                          valor: novoNegocio.valor ? parseFloat(novoNegocio.valor) : null,
                          motivo_perda: null,
                          data_fechamento_prevista: null,
                          notas: novoNegocio.notas,
                          created_at: now,
                          updated_at: now,
                        })
                        await registrarLog('criar', 'negocios', negId, `Negócio: R$ ${novoNegocio.valor || '0'} (via visita)`)
                        const negCriado = { id: negId, ...novoNegocio, valor: novoNegocio.valor ? parseFloat(novoNegocio.valor) : null }
                        setNegocioVinculado(negCriado)
                        setForm((f) => ({ ...f, negocio_id: negId }))
                        setNovoNegocio({ valor: '', status: 'prospect', notas: '' })
                        setShowNovoNegocio(false)
                        setShowNegocio(false)
                        // Recarregar negócios
                        carregar()
                      }}
                      className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium"
                    >Criar e Vincular</button>
                  </div>
                </div>
              )}

              {/* Lista de negócios existentes */}
              {negocios.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs text-slate-500 font-medium">Negócios existentes:</p>
                  {negocios.filter((n) => !n.status.startsWith('fechado_perdido')).map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => {
                        setNegocioVinculado(n)
                        setForm((f) => ({ ...f, negocio_id: n.id }))
                        setShowNegocio(false)
                        setShowNovoNegocio(false)
                      }}
                      className="w-full text-left p-3 rounded-lg border border-slate-200 bg-white active:bg-slate-50"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{n.notas || n.status}</p>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          {n.status === 'prospect' ? 'Prospect' : n.status === 'proposta_enviada' ? 'Proposta' : n.status === 'em_negociacao' ? 'Negociando' : n.status}
                        </span>
                      </div>
                      {n.valor && <p className="text-sm text-green-700 font-bold mt-1">R$ {Number(n.valor).toLocaleString('pt-BR')}</p>}
                    </button>
                  ))}
                </div>
              ) : (
                !showNovoNegocio && (
                  <p className="text-sm text-slate-400 text-center py-4">Nenhum negócio cadastrado</p>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de edição */}
      {editTarget && editForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4 pb-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm max-h-[85vh] flex flex-col animate-slide-up">
            <div className="p-4 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg">Editar Visita</h3>
                <button onClick={() => { setEditTarget(null); setEditForm(null) }} className="text-slate-400 text-xl px-1">&times;</button>
              </div>
              <p className="text-xs text-slate-500">
                Criada em {new Date(editTarget.created_at || editTarget.data_visita).toLocaleString('pt-BR')}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {/* Tipo */}
              <div>
                <label className="block text-xs text-slate-500 mb-1">Tipo</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'presencial', label: 'Presencial' },
                    { key: 'mensagem', label: 'Mensagem' },
                    { key: 'telefonema', label: 'Telefonema' },
                    { key: 'email', label: 'E-mail' },
                  ].map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setEditForm({ ...editForm, tipo: t.key })}
                      className={`py-2 rounded-lg text-sm font-medium border ${editForm.tipo === t.key ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-slate-600 border-slate-300'}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Resumo */}
              <div>
                <label className="block text-xs text-slate-500 mb-1">Resumo da visita</label>
                <AudioTextInput
                  value={editForm.resumo}
                  onChange={(val) => setEditForm({ ...editForm, resumo: val })}
                  placeholder="Resumo da visita"
                  rows={3}
                />
              </div>

              {/* Próximos passos */}
              <div>
                <label className="block text-xs text-slate-500 mb-1">Próximos passos</label>
                <AudioTextInput
                  value={editForm.proximos_passos}
                  onChange={(val) => setEditForm({ ...editForm, proximos_passos: val })}
                  placeholder="Próximos passos"
                  rows={2}
                />
              </div>

              {/* Data próximo contato */}
              <div>
                <label className="block text-xs text-slate-500 mb-1">Próximo contato planejado</label>
                <input
                  type="date"
                  value={editForm.data_proximo_contato || ''}
                  onChange={(e) => setEditForm({ ...editForm, data_proximo_contato: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>

              {/* Pós Vendas */}
              <button
                type="button"
                onClick={() => setEditForm({ ...editForm, acionar_pos_vendas: !editForm.acionar_pos_vendas })}
                className={`w-full py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                  editForm.acionar_pos_vendas
                    ? 'bg-orange-500 text-white border-orange-500'
                    : 'bg-white text-orange-600 border-orange-300'
                }`}
              >
                {editForm.acionar_pos_vendas ? '✓ Pós Vendas acionado' : 'Acionar Pós Vendas'}
              </button>
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

function VisitaCard({ visita, index, onDelete, onEdit, editavel }) {
  const [propNome, setPropNome] = useState('')
  const [clienteNome, setClienteNome] = useState('')

  useEffect(() => {
    getRecord('propriedades', visita.propriedade_id).then((p) => {
      if (p) {
        setPropNome(p.nome)
        getRecord('clientes', p.cliente_dono_id).then((c) => {
          if (c) setClienteNome(c.nome)
        })
      }
    })
  }, [visita.propriedade_id])

  const data = new Date(visita.data_visita)
  const dataStr = data.toLocaleDateString('pt-BR') + ' ' + data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="bg-white rounded-xl shadow p-4 animate-fade-in" style={{ animationDelay: `${index * 0.03}s` }}>
      <div className="flex items-center justify-between mb-1">
        <div>
          <p className="font-medium text-sm">{clienteNome || '...'}</p>
          <p className="text-xs text-slate-500">{propNome || '...'}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full ${TIPO_COLORS[visita.tipo] || 'bg-slate-100 text-slate-700'}`}>
            {TIPO_LABELS[visita.tipo] || visita.tipo}
          </span>
          {editavel && (
            <button onClick={onEdit} className="text-slate-400 hover:text-blue-600 text-sm px-1">✎</button>
          )}
          <button onClick={onDelete} className="text-slate-300 hover:text-red-500 text-lg px-1">&times;</button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <p className="text-xs text-slate-500">{dataStr}</p>
        {visita.retroativa && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">Retroativa</span>
        )}
        {visita.acionar_pos_vendas && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">Pós Vendas</span>
        )}
      </div>
      {visita.resumo && <p className="text-sm text-slate-700 mt-2">{visita.resumo}</p>}
      {visita.proximos_passos && <p className="text-xs text-slate-500 mt-1">Próximos: {visita.proximos_passos}</p>}
      {visita.data_proximo_contato && (
        <p className="text-xs text-blue-600 mt-1 font-medium">
          Contato planejado: {new Date(visita.data_proximo_contato + 'T00:00:00').toLocaleDateString('pt-BR')}
        </p>
      )}
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-slate-400">
          {visita.latitude?.toFixed(4)}, {visita.longitude?.toFixed(4)}
        </span>
        <span className={`w-2 h-2 rounded-full ${visita.status_sync === 'synced' ? 'bg-green-500' : 'bg-yellow-500'}`} />
      </div>
    </div>
  )
}
