import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { avisoKey, getMeta, setMeta } from './localMeta'
import { val } from './parseAvisos'

export { isSupabaseConfigured }

/** Guarda un lote de avisos (un boletín) en la nube */
export async function cloudSaveBatch({ nombre, avisos }) {
  if (!supabase) throw new Error('Supabase no configurado')
  const { data: batch, error: e1 } = await supabase
    .from('batches')
    .insert({ nombre: nombre || 'Boletín', count: (avisos || []).length })
    .select()
    .single()
  if (e1) throw e1

  const rows = (avisos || []).map((a, i) => ({
    batch_id: batch.id,
    aviso_key: avisoKey(a) || `idx-${i}`,
    payload: a,
  }))
  if (rows.length) {
    const { error: e2 } = await supabase.from('avisos').insert(rows)
    if (e2) throw e2
  }

  const metas = (avisos || []).map((a) => {
    const m = getMeta(a)
    return {
      aviso_key: avisoKey(a),
      estado: m.estado || 'Pendiente',
      nota: m.nota || '',
      checklist: m.checklist || {},
      inicio_visita: m.inicioVisita || null,
      fin_visita: m.finVisita || null,
      piezas: m.piezas || [],
      cita_fecha: m.citaFecha || '',
      cita_hora: m.citaHora || '',
      franja: m.franja || '',
      cita_origen: m.citaOrigen || '',
    }
  }).filter((r) => r.aviso_key)

  if (metas.length) {
    const { error: e3 } = await supabase
      .from('aviso_meta')
      .upsert(metas, { onConflict: 'aviso_key' })
    if (e3) throw e3
  }

  return batch
}

export async function cloudListBatches() {
  if (!supabase) throw new Error('Supabase no configurado')
  const { data, error } = await supabase
    .from('batches')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(40)
  if (error) throw error
  return data || []
}

export async function cloudLoadBatch(batchId) {
  if (!supabase) throw new Error('Supabase no configurado')
  const { data: avisos, error } = await supabase
    .from('avisos')
    .select('aviso_key, payload')
    .eq('batch_id', batchId)
  if (error) throw error

  const keys = (avisos || []).map((r) => r.aviso_key).filter(Boolean)
  let metaMap = {}
  if (keys.length) {
    const { data: metas } = await supabase
      .from('aviso_meta')
      .select('*')
      .in('aviso_key', keys)
    ;(metas || []).forEach((m) => {
      metaMap[m.aviso_key] = m
    })
  }

  return (avisos || []).map((row) => {
    const a = row.payload || {}
    const m = metaMap[row.aviso_key]
    if (m) {
      setMeta(a, {
        estado: m.estado || 'Pendiente',
        nota: m.nota || '',
        checklist: m.checklist || {},
        inicioVisita: m.inicio_visita || '',
        finVisita: m.fin_visita || '',
        piezas: m.piezas || [],
        citaFecha: m.cita_fecha || '',
        citaHora: m.cita_hora || '',
        franja: m.franja || '',
        citaOrigen: m.cita_origen || '',
      })
    }
    return a
  })
}

export async function cloudDeleteBatch(batchId) {
  if (!supabase) throw new Error('Supabase no configurado')
  const { error: e1 } = await supabase.from('avisos').delete().eq('batch_id', batchId)
  if (e1) throw e1
  const { error: e2 } = await supabase.from('batches').delete().eq('id', batchId)
  if (e2) throw e2
}

export async function cloudSyncMetas(avisos) {
  if (!supabase) throw new Error('Supabase no configurado')
  const metas = (avisos || []).map((a) => {
    const m = getMeta(a)
    return {
      aviso_key: avisoKey(a),
      estado: m.estado || 'Pendiente',
      nota: m.nota || '',
      checklist: m.checklist || {},
      inicio_visita: m.inicioVisita || null,
      fin_visita: m.finVisita || null,
      piezas: m.piezas || [],
      cita_fecha: m.citaFecha || '',
      cita_hora: m.citaHora || '',
      franja: m.franja || '',
      cita_origen: m.citaOrigen || '',
    }
  }).filter((r) => r.aviso_key)
  if (!metas.length) return
  const { error } = await supabase
    .from('aviso_meta')
    .upsert(metas, { onConflict: 'aviso_key' })
  if (error) throw error
}

export async function cloudSearchAvisos(query) {
  if (!supabase) throw new Error('Supabase no configurado')
  const q = String(query || '').trim()
  if (!q) return []
  const { data, error } = await supabase
    .from('avisos')
    .select('aviso_key, payload, batch_id, created_at')
    .or(
      `payload->>cliente.cs.{"nombre":"${q}"},payload->cliente->>nombre.ilike.%${q}%,payload->cliente->>nif.ilike.%${q}%,payload->direccion->>completa.ilike.%${q}%,payload->aparato->>modelo.ilike.%${q}%`
    )
    .limit(30)
  if (error) {
    const { data: all } = await supabase
      .from('avisos')
      .select('aviso_key, payload, batch_id, created_at')
      .order('created_at', { ascending: false })
      .limit(80)
    const low = q.toLowerCase()
    return (all || []).filter((row) => {
      const p = row.payload || {}
      const blob = [
        p.aviso, p.orden, p.cliente?.nombre, p.cliente?.nif,
        p.direccion?.completa, p.aparato?.modelo, p.aparato?.marca,
      ].filter(Boolean).join(' ').toLowerCase()
      return blob.includes(low)
    })
  }
  return data || []
}

export async function cloudStats() {
  if (!supabase) return null
  const { count: nAvisos } = await supabase
    .from('avisos')
    .select('*', { count: 'exact', head: true })
  const { data: metas } = await supabase.from('aviso_meta').select('estado')
  const byEstado = {}
  ;(metas || []).forEach((m) => {
    const e = m.estado || 'Pendiente'
    byEstado[e] = (byEstado[e] || 0) + 1
  })
  return { nAvisos: nAvisos || 0, byEstado }
}

function preparacionToRow(prep) {
  let truncados = false
  let adjuntos = prep.adjuntos || []
  const MAX = 350_000
  const size = JSON.stringify(adjuntos).length
  if (size > MAX) {
    truncados = true
    adjuntos = adjuntos.map((a) => {
      if (a.tipo === 'imagen' && a.dataUrl) {
        return {
          id: a.id,
          tipo: 'imagen',
          nombre: a.nombre || 'foto',
          mime: a.mime,
          localOnly: true,
        }
      }
      return a
    })
  }
  return {
    local_id: prep.id,
    titulo: prep.titulo || '',
    marca: prep.marca || '',
    modelo: prep.modelo || '',
    tipo: prep.tipo || '',
    aviso_ref: prep.avisoRef || '',
    cita_fecha: prep.citaFecha || '',
    cita_hora: prep.citaHora || '',
    notas: prep.notas || '',
    piezas: prep.piezas || [],
    checklist: prep.checklist || [],
    adjuntos,
    adjuntos_truncados: truncados,
    completada: !!prep.completada,
    completada_en: prep.completadaEn || null,
    cerrada_por_aviso: !!prep.cerradaPorAviso,
    updated_at: new Date().toISOString(),
  }
}

function rowToPreparacion(row) {
  return {
    id: row.local_id || row.id,
    cloudId: row.id,
    titulo: row.titulo || '',
    marca: row.marca || '',
    modelo: row.modelo || '',
    tipo: row.tipo || '',
    avisoRef: row.aviso_ref || '',
    citaFecha: row.cita_fecha || '',
    citaHora: row.cita_hora || '',
    notas: row.notas || '',
    piezas: row.piezas || [],
    checklist: row.checklist || [],
    adjuntos: row.adjuntos || [],
    adjuntosTruncados: !!row.adjuntos_truncados,
    completada: !!row.completada,
    completadaEn: row.completada_en || '',
    cerradaPorAviso: !!row.cerrada_por_aviso,
    creado: row.created_at,
    actualizado: row.updated_at,
  }
}

export async function cloudUpsertPreparacion(prep) {
  if (!supabase) throw new Error('Supabase no configurado')
  const row = preparacionToRow(prep)
  const { data, error } = await supabase
    .from('preparaciones')
    .upsert(row, { onConflict: 'local_id' })
    .select()
    .single()
  if (error) throw error
  return rowToPreparacion(data)
}

export async function cloudListPreparaciones() {
  if (!supabase) throw new Error('Supabase no configurado')
  const { data, error } = await supabase
    .from('preparaciones')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(80)
  if (error) throw error
  return (data || []).map(rowToPreparacion)
}

export async function cloudSearchPreparaciones(filters = {}) {
  if (!supabase) throw new Error('Supabase no configurado')
  let q = supabase.from('preparaciones').select('*').order('updated_at', { ascending: false }).limit(40)
  if (filters.marca) q = q.eq('marca', filters.marca)
  if (filters.tipo) q = q.eq('tipo', filters.tipo)
  if (filters.modelo) q = q.ilike('modelo', `%${filters.modelo}%`)
  if (filters.aviso) q = q.ilike('aviso_ref', `%${filters.aviso}%`)
  if (filters.q) {
    const qq = filters.q
    q = q.or(
      `titulo.ilike.%${qq}%,marca.ilike.%${qq}%,modelo.ilike.%${qq}%,tipo.ilike.%${qq}%,aviso_ref.ilike.%${qq}%,notas.ilike.%${qq}%`
    )
  }
  const { data, error } = await q
  if (error) throw error
  return (data || []).map(rowToPreparacion)
}

export async function cloudDeletePreparacion(localId) {
  if (!supabase) throw new Error('Supabase no configurado')
  const { error } = await supabase.from('preparaciones').delete().eq('local_id', localId)
  if (error) throw error
}
