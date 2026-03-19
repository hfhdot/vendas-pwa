import { createClient } from '@supabase/supabase-js'
import {
  getAllRecords, getPendingRecords, markAsSynced, saveRecord,
  getFotosPendentes, deleteFotoPendente, updateFotoPath, getLogs,
} from './db'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// Mapeamento: IndexedDB store -> Supabase table
const TABLE_MAP = {
  clientes: 'clientes_vendas',
  propriedades: 'Clientes',
  pessoas: 'pessoas',
  maquinas: 'maquinas',
  negocios: 'negocios',
  visitas: 'visitas',
}

// Ordem respeita FKs
const SYNC_ORDER = ['clientes', 'propriedades', 'pessoas', 'maquinas', 'negocios', 'visitas']

// Callbacks para notificar a UI
let onSyncStatusChange = null
export function setSyncCallback(cb) { onSyncStatusChange = cb }

function notify(status, detail) {
  if (onSyncStatusChange) onSyncStatusChange({ status, detail })
}

// ============================================
// PUSH: IndexedDB (pending) → Supabase
// ============================================

function mapForPush(store, record) {
  const { id, status_sync, ...clean } = record

  if (store === 'propriedades') {
    // IndexedDB "propriedades" → Supabase "Clientes"
    const mapped = { ...clean }
    if (mapped.nome) {
      mapped.nome_fantasia = mapped.nome
      delete mapped.nome
    }
    return mapped
  }

  return clean
}

async function pushRecords() {
  let totalPushed = 0

  for (const store of SYNC_ORDER) {
    const pending = await getPendingRecords(store)
    if (pending.length === 0) continue

    const supaTable = TABLE_MAP[store]
    notify('pushing', `Enviando ${pending.length} ${store}...`)

    for (const record of pending) {
      try {
        const mapped = mapForPush(store, record)

        // Tentar insert primeiro (registro novo criado offline)
        const { data, error } = await supabase
          .from(supaTable)
          .insert(mapped)
          .select()

        if (error) {
          if (error.code === '23505') {
            // Registro já existe - tentar update
            const { error: upErr } = await supabase
              .from(supaTable)
              .update(mapped)
              .eq('id', record.id)
            if (upErr) {
              console.error(`[Push] ${store} update:`, upErr.message)
              continue
            }
          } else {
            console.error(`[Push] ${store}:`, error.message)
            continue
          }
        }

        await markAsSynced(store, record.id)
        totalPushed++
      } catch (err) {
        console.error(`[Push] ${store}:`, err)
      }
    }
  }

  // Push logs de auditoria
  try {
    const logs = await getLogs()
    const pendingLogs = logs.filter((l) => l.status_sync === 'pending')
    for (const log of pendingLogs) {
      const { id, status_sync, ...clean } = log
      const { error } = await supabase.from('audit_logs_vendas').insert(clean)
      if (!error) await markAsSynced('logs', id)
    }
  } catch (err) {
    console.error('[Push] logs:', err)
  }

  return totalPushed
}

async function pushFotos() {
  const fotos = await getFotosPendentes()
  for (const { visita_id, blob } of fotos) {
    try {
      const path = `visitas/${visita_id}.jpg`
      notify('pushing', 'Enviando foto...')

      const { error } = await supabase.storage
        .from('fotos-visitas')
        .upload(path, blob, { contentType: 'image/jpeg', upsert: true })
      if (error) throw error

      await updateFotoPath(visita_id, path)

      // Atualizar foto_path na tabela visitas do Supabase
      await supabase
        .from('visitas')
        .update({ foto_path: path })
        .eq('id', visita_id)

      await deleteFotoPendente(visita_id)
    } catch (err) {
      console.error('[Push] foto:', err)
    }
  }
}

// ============================================
// PULL: Supabase → IndexedDB
// ============================================

function mapForPull(store, record) {
  if (store === 'propriedades') {
    // Supabase "Clientes" → IndexedDB "propriedades"
    return {
      id: record.id,
      cliente_dono_id: record.cliente_dono_id,
      nome: record.nome_fantasia || record.razao_social || '',
      endereco: record.endereco || '',
      cidade: record.cidade || '',
      estado: record.estado || '',
      area_hectares: record.area_hectares,
      culturas: record.culturas || [],
      latitude: record.latitude,
      longitude: record.longitude,
      observacoes: record.observacoes || '',
      created_at: record.created_at,
      status_sync: 'synced',
    }
  }

  return { ...record, status_sync: 'synced' }
}

async function pullRecords() {
  let totalPulled = 0

  for (const store of SYNC_ORDER) {
    const supaTable = TABLE_MAP[store]
    notify('pulling', `Baixando ${store}...`)

    try {
      const { data, error } = await supabase
        .from(supaTable)
        .select('*')

      if (error) {
        console.error(`[Pull] ${store}:`, error.message)
        continue
      }

      if (!data || data.length === 0) continue

      // Salvar cada registro no IndexedDB (com status synced)
      for (const record of data) {
        const mapped = mapForPull(store, record)
        await saveRecord(store, mapped)
      }

      totalPulled += data.length
    } catch (err) {
      console.error(`[Pull] ${store}:`, err)
    }
  }

  return totalPulled
}

// ============================================
// SYNC ALL: Push primeiro, depois Pull
// ============================================

let isSyncing = false

export async function syncAll() {
  if (isSyncing || !navigator.onLine) return

  // Verificar se tem sessão autenticada
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    console.log('[Sync] Sem sessão autenticada, pulando sync')
    return
  }
  isSyncing = true

  try {
    notify('syncing', 'Sincronizando...')

    // 1. Push: enviar pendentes locais para o Supabase
    const pushed = await pushRecords()
    await pushFotos()

    // 2. Pull: baixar dados do Supabase para o IndexedDB
    const pulled = await pullRecords()

    notify('done', `Sync OK: ${pushed} enviados, ${pulled} baixados`)
    console.log(`[Sync] Push: ${pushed}, Pull: ${pulled}`)
  } catch (err) {
    notify('error', err.message)
    console.error('[Sync] erro geral:', err)
  } finally {
    isSyncing = false
    // Limpar status após 3 segundos
    setTimeout(() => notify('idle', ''), 3000)
  }
}

export async function pullOnly() {
  if (!navigator.onLine) return
  notify('pulling', 'Baixando dados...')
  try {
    const pulled = await pullRecords()
    notify('done', `${pulled} registros baixados`)
    setTimeout(() => notify('idle', ''), 3000)
  } catch (err) {
    notify('error', err.message)
  }
}

export async function pushOnly() {
  if (!navigator.onLine) return
  notify('pushing', 'Enviando dados...')
  try {
    const pushed = await pushRecords()
    await pushFotos()
    notify('done', `${pushed} registros enviados`)
    setTimeout(() => notify('idle', ''), 3000)
  } catch (err) {
    notify('error', err.message)
  }
}

// Contagem de pendentes
export async function countPending() {
  let total = 0
  for (const store of SYNC_ORDER) {
    const pending = await getPendingRecords(store)
    total += pending.length
  }
  return total
}

export function initSyncListener() {
  window.addEventListener('online', () => syncAll())
  // Sync inicial se online
  if (navigator.onLine) syncAll()
}
