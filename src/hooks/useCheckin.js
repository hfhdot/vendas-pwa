import { useState } from 'react'
import { capturarGPS } from '../lib/gps'
import { capturarFoto } from '../lib/camera'
import { saveRecord, saveFotoPendente, registrarLog } from '../lib/db'

export function useCheckin() {
  const [loading, setLoading] = useState(false)
  const [erroGPS, setErroGPS] = useState(null)
  const [gpsData, setGpsData] = useState(null)
  const [fotoBlob, setFotoBlob] = useState(null)
  const [fotoPreview, setFotoPreview] = useState(null)

  async function iniciarCheckin() {
    setLoading(true)
    setErroGPS(null)
    try {
      setGpsData(await capturarGPS())
    } catch (err) {
      setErroGPS(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function tirarFoto() {
    try {
      const blob = await capturarFoto()
      setFotoBlob(blob)
      setFotoPreview(URL.createObjectURL(blob))
    } catch {
      // usuario cancelou
    }
  }

  async function salvarVisita(form) {
    const tipoPresencial = form.tipo === 'presencial'
    if (tipoPresencial && !gpsData) throw new Error('GPS ainda não obtido.')
    const vendedor = JSON.parse(localStorage.getItem('vendedor'))

    const dataVisita = form.data_visita
      ? new Date(form.data_visita).toISOString()
      : new Date().toISOString()
    const isRetroativa = form.data_visita
      ? (Date.now() - new Date(form.data_visita).getTime()) > 5 * 60 * 1000
      : false

    const visita = {
      vendedor_id: vendedor.id,
      propriedade_id: parseInt(form.propriedade_id),
      tipo: form.tipo,
      negocio_id: form.negocio_id ? parseInt(form.negocio_id) : null,
      pessoa_ids: (form.pessoa_ids || []).map(Number),
      maquina_ids: (form.maquina_ids || []).map(Number),
      data_visita: dataVisita,
      retroativa: isRetroativa,
      latitude: gpsData?.latitude || null,
      longitude: gpsData?.longitude || null,
      gps_accuracy: gpsData?.gps_accuracy || null,
      foto_path: null,
      resumo: form.resumo,
      proximos_passos: form.proximos_passos,
      data_proximo_contato: form.data_proximo_contato || null,
      acionar_pos_vendas: form.acionar_pos_vendas || false,
      created_at: new Date().toISOString(),
    }

    const id = await saveRecord('visitas', visita)
    const logDetalhe = `Visita ${visita.tipo}${isRetroativa ? ' [RETROATIVA]' : ''}${visita.acionar_pos_vendas ? ' [PÓS VENDAS]' : ''} - ${visita.resumo || 'sem resumo'}`
    await registrarLog('criar', 'visitas', id, logDetalhe)
    if (visita.acionar_pos_vendas) {
      await registrarLog('criar', 'pos_vendas', id, `Pós Vendas acionado via visita - máquinas: ${visita.maquina_ids.join(', ')}`)
    }
    if (fotoBlob) await saveFotoPendente(id, fotoBlob)
    return { ...visita, id }
  }

  function resetCheckin() {
    setGpsData(null)
    setErroGPS(null)
    setFotoBlob(null)
    setFotoPreview(null)
  }

  return { loading, erroGPS, gpsData, fotoPreview, iniciarCheckin, tirarFoto, salvarVisita, resetCheckin }
}
