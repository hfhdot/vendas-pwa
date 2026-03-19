const DB_NAME = 'vendas-offline'
const DB_VERSION = 5
const STORES = ['clientes', 'propriedades', 'pessoas', 'maquinas', 'visitas', 'negocios']

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = (e) => {
      const db = e.target.result

      // Remover stores antigos se existirem
      ;[...STORES, 'logs', 'fotos_pendentes'].forEach((name) => {
        if (db.objectStoreNames.contains(name)) {
          db.deleteObjectStore(name)
        }
      })

      // Recriar com autoIncrement (bigint compatível)
      STORES.forEach((name) => {
        const store = db.createObjectStore(name, { keyPath: 'id', autoIncrement: true })
        store.createIndex('status_sync', 'status_sync', { unique: false })

        if (name === 'propriedades') store.createIndex('cliente_dono_id', 'cliente_dono_id')
        if (name === 'pessoas') store.createIndex('propriedade_id', 'propriedade_id')
        if (name === 'maquinas') store.createIndex('propriedade_id', 'propriedade_id')
        if (name === 'visitas') store.createIndex('propriedade_id', 'propriedade_id')
        if (name === 'negocios') store.createIndex('cliente_id', 'cliente_id')
      })

      db.createObjectStore('fotos_pendentes', { keyPath: 'visita_id' })

      // Logs de auditoria
      const logStore = db.createObjectStore('logs', { keyPath: 'id', autoIncrement: true })
      logStore.createIndex('status_sync', 'status_sync', { unique: false })
      logStore.createIndex('entidade', 'entidade')
      logStore.createIndex('entidade_id', 'entidade_id')
    }

    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function saveRecord(store, record) {
  const db = await openDB()
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readwrite')
    const objStore = tx.objectStore(store)
    const data = { ...record, status_sync: record.status_sync || 'pending' }

    // Se tem id, usa put (update). Se não, usa add (insert com autoIncrement)
    const req = data.id ? objStore.put(data) : objStore.add(data)
    req.onsuccess = () => res(req.result) // retorna o id gerado
    req.onerror = () => rej(req.error)
  })
}

export async function getAllRecords(store) {
  const db = await openDB()
  return new Promise((res, rej) => {
    const req = db.transaction(store, 'readonly').objectStore(store).getAll()
    req.onsuccess = () => res(req.result)
    req.onerror = () => rej(req.error)
  })
}

export async function getRecord(store, id) {
  const db = await openDB()
  return new Promise((res, rej) => {
    const numId = typeof id === 'string' ? parseInt(id) : id
    const req = db.transaction(store, 'readonly').objectStore(store).get(numId)
    req.onsuccess = () => res(req.result)
    req.onerror = () => rej(req.error)
  })
}

export async function deleteRecord(store, id) {
  const db = await openDB()
  return new Promise((res, rej) => {
    const numId = typeof id === 'string' ? parseInt(id) : id
    const req = db.transaction(store, 'readwrite').objectStore(store).delete(numId)
    req.onsuccess = () => res()
    req.onerror = () => rej(req.error)
  })
}

export async function getByIndex(store, indexName, value) {
  const db = await openDB()
  return new Promise((res, rej) => {
    const numValue = typeof value === 'string' ? parseInt(value) : value
    const req = db.transaction(store, 'readonly')
      .objectStore(store)
      .index(indexName)
      .getAll(numValue)
    req.onsuccess = () => res(req.result)
    req.onerror = () => rej(req.error)
  })
}

export async function getPendingRecords(store) {
  const db = await openDB()
  return new Promise((res, rej) => {
    const req = db.transaction(store, 'readonly')
      .objectStore(store).index('status_sync').getAll('pending')
    req.onsuccess = () => res(req.result)
    req.onerror = () => rej(req.error)
  })
}

export async function markAsSynced(store, id) {
  const db = await openDB()
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readwrite')
    const objStore = tx.objectStore(store)
    const get = objStore.get(id)
    get.onsuccess = () => {
      const r = get.result
      if (r) { r.status_sync = 'synced'; objStore.put(r).onsuccess = () => res() }
    }
    get.onerror = () => rej(get.error)
  })
}

export async function saveFotoPendente(visita_id, blob) {
  const db = await openDB()
  return new Promise((res, rej) => {
    const req = db.transaction('fotos_pendentes', 'readwrite')
      .objectStore('fotos_pendentes').put({ visita_id, blob })
    req.onsuccess = () => res()
    req.onerror = () => rej(req.error)
  })
}

export async function getFotosPendentes() {
  const db = await openDB()
  return new Promise((res, rej) => {
    const req = db.transaction('fotos_pendentes', 'readonly')
      .objectStore('fotos_pendentes').getAll()
    req.onsuccess = () => res(req.result)
    req.onerror = () => rej(req.error)
  })
}

export async function deleteFotoPendente(visita_id) {
  const db = await openDB()
  return new Promise((res, rej) => {
    const req = db.transaction('fotos_pendentes', 'readwrite')
      .objectStore('fotos_pendentes').delete(visita_id)
    req.onsuccess = () => res()
    req.onerror = () => rej(req.error)
  })
}

export async function updateFotoPath(visita_id, foto_path) {
  const db = await openDB()
  return new Promise((res, rej) => {
    const tx = db.transaction('visitas', 'readwrite')
    const store = tx.objectStore('visitas')
    const get = store.get(visita_id)
    get.onsuccess = () => {
      const r = get.result
      if (r) { r.foto_path = foto_path; store.put(r).onsuccess = () => res() }
    }
    get.onerror = () => rej(get.error)
  })
}

// ============================================
// LOGS DE AUDITORIA
// ============================================

// acao: 'criar' | 'alterar' | 'excluir'
// entidade: 'clientes' | 'propriedades' | 'pessoas' | 'maquinas' | 'visitas' | 'negocios'
export async function registrarLog(acao, entidade, entidade_id, detalhes) {
  const db = await openDB()
  const vendedor = JSON.parse(localStorage.getItem('vendedor') || '{}')
  return new Promise((res, rej) => {
    const req = db.transaction('logs', 'readwrite')
      .objectStore('logs')
      .add({
        acao,
        entidade,
        entidade_id,
        vendedor_id: vendedor.id || null,
        vendedor_nome: vendedor.nome || '',
        detalhes: detalhes || '',
        data_hora: new Date().toISOString(),
        status_sync: 'pending',
      })
    req.onsuccess = () => res(req.result)
    req.onerror = () => rej(req.error)
  })
}

export async function getLogs() {
  const db = await openDB()
  return new Promise((res, rej) => {
    const req = db.transaction('logs', 'readonly').objectStore('logs').getAll()
    req.onsuccess = () => res(req.result)
    req.onerror = () => rej(req.error)
  })
}
