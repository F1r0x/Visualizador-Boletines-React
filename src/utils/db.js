import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { avisoKey, getMeta, setMeta } from './localMeta'
import { val } from './parseAvisos'

export { isSupabaseConfigured }

export async function cloudSaveBatch(nombre, avisos) {
  if (!supabase || !avisos?.length) {
    throw new Error('Supabase no configurado o sin avisos')
  }

  const { data: batch, error: e1 } = await supabase
    .from('batches')
    .insert({
      nombre: nombre || `Boletín ${new Date().toLocaleString('es-ES')}`,
      avisos_count: avisos.length,
    })
    .select()
    .single()

  if (e1) throw e1

  const rows = avisos.map((a) => ({
    batch_id: batch.id,
    aviso_key: avisoKey(a),
    orden: a.orden != null ? String(a.orden) : null,
    payload: a,
  }))

  const { error: e2 } = await supabase.from('avisos').insert(rows)
  if (e2) throw e2

  const metas = avisos.map((a) => {
    const m = getMeta(a)
    return {
      aviso_key: avisoKey(a),
      estado: m.estado || 'Pendiente',
      nota: m.nota || '',
      checklist: m.checklist || {},
      inicio_visita: m.inicioVisita || '',
      fin_visita: m.finVisita || '',
      piezas: m.piezas || [],
      cita_fecha: m.citaFecha || '',
      cita_hora: m.citaHora || '',
      franja: m.franja || '',
      updated_at: new Date().toISOString(),
    }
  })

  const { error: e3 } = await supabase
    .from('aviso_meta')
    .upsert(metas, { onConflict: 'aviso_key' })
  if (e3) throw e3

  return batch
}

export async function cloudListBatches() {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('batches')
    .select('id, nombre, created_at, avisos_count')
    .order('created_at', { ascending: false })
    .limit(30)
  if (error) throw error
  return data || []
}

export async function cloudLoadBatch(batchId) {
  if (!supabase) throw new Error('Supabase no configurado')

  const { data: rows, error } = await supabase
    .from('avisos')
    .select('aviso_key, payload')
    .eq('batch_id', batchId)

  if (error) throw error

  const avisos = (rows || []).map((r) => r.payload)
  const keys = (rows || []).map((r) => r.aviso_key).filter(Boolean)

  if (keys.length) {
    const { data: metas } = await supabase
      .from('aviso_meta')
      .select('*')
      .in('aviso_key', keys)

    ;(metas || []).forEach((m) => {
      const aviso = avisos.find((a) => avisoKey(a) === m.aviso_key)
      if (!aviso) return
      setMeta(aviso, {
        estado: m.estado || 'Pendiente',
        nota: m.nota || '',
        checklist: m.checklist || {},
        inicioVisita: m.inicio_visita || '',
        finVisita: m.fin_visita || '',
        piezas: m.piezas || [],
        citaFecha: m.cita_fecha || '',
        citaHora: m.cita_hora || '',
        franja: m.franja || '',
      })
    })
  }

  return avisos
}

export async function cloudSyncMeta(avisos) {
  if (!supabase || !avisos?.length) return
  const metas = avisos.map((a) => {
    const m = getMeta(a)
    return {
      aviso_key: avisoKey(a),
      estado: m.estado || 'Pendiente',
      nota: m.nota || '',
      checklist: m.checklist || {},
      inicio_visita: m.inicioVisita || '',
      fin_visita: m.finVisita || '',
      piezas: m.piezas || [],
      cita_fecha: m.citaFecha || '',
      cita_hora: m.citaHora || '',
      franja: m.franja || '',
      updated_at: new Date().toISOString(),
    }
  })
  const { error } = await supabase
    .from('aviso_meta')
    .upsert(metas, { onConflict: 'aviso_key' })
  if (error) throw error
}

export async function cloudSearchClientes(query) {
  if (!supabase || !query?.trim()) return []
  const q = query.trim()
  const { data: all, error: e2 } = await supabase
    .from('avisos')
    .select('aviso_key, payload, created_at')
    .order('created_at', { ascending: false })
    .limit(200)
  if (e2) throw e2
  const lower = q.toLowerCase()
  return (all || [])
    .filter((r) => {
      const p = r.payload || {}
      const blob = [
        p.cliente?.nombre,
        p.cliente?.nif,
        p.direccion?.completa,
        p.direccion?.codigo_postal,
        p.aparato?.modelo,
        p.aparato?.marca,
        p.aviso,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return blob.includes(lower)
    })
    .slice(0, 40)
}

export async function cloudStats() {
  if (!supabase) return null
  const { count: nAvisos } = await supabase
    .from('avisos')
    .select('*', { count: 'exact', head: true })
  const { count: nBatches } = await supabase
    .from('batches')
    .select('*', { count: 'exact', head: true })
  const { data: metas } = await supabase.from('aviso_meta').select('estado')
  const porEstado = {}
  ;(metas || []).forEach((m) => {
    const e = m.estado || 'Pendiente'
    porEstado[e] = (porEstado[e] || 0) + 1
  })
  return {
    avisos: nAvisos || 0,
    batches: nBatches || 0,
    porEstado,
  }
}

export function labelCliente(payload) {
  return (
    val(payload?.cliente?.nombre) ||
    `Aviso ${payload?.aviso || payload?.orden || ''}`
  )
}

// ——— Preparaciones (fichas de reparación) ———

const PREP_ADJ_MAX = 900_000

function preparacionToRow(prep) {
  let adjuntos = Array.isArray(prep.adjuntos) ? prep.adjuntos : []
  let truncados = false
  const size = JSON.stringify(adjuntos).length
  if (size > PREP_ADJ_MAX) {
    adjuntos = adjuntos.map((a) => {
      if (a?.tipo === 'imagen' && a.dataUrl) {
        truncados = true
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
    creado: row.created_at,
    actualizado: row.updated_at,
  }
}

export async function cloudUpsertPreparacion(prep) {
  if (!supabase) throw new Error('Supabase no configurado')
  if (!prep?.id) throw new Error('Preparación sin id')
  const row = preparacionToRow(prep)
  const { data, error } = await supabase
    .from('preparaciones')
    .upsert(row, { onConflict: 'local_id' })
    .select()
    .single()
  if (error) throw error
  return rowToPreparacion(data)
}

export async function cloudListPreparaciones(limit = 80) {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('preparaciones')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data || []).map(rowToPreparacion)
}

export async function cloudSearchPreparaciones(filters = {}) {
  if (!supabase) return []
  let query = supabase
    .from('preparaciones')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(60)

  if (filters.marca?.trim()) {
    query = query.ilike('marca', `%${filters.marca.trim()}%`)
  }
  if (filters.tipo?.trim()) {
    query = query.ilike('tipo', `%${filters.tipo.trim()}%`)
  }
  if (filters.modelo?.trim()) {
    query = query.ilike('modelo', `%${filters.modelo.trim()}%`)
  }

  const q = filters.q?.trim()
  if (q) {
    query = query.or(
      `titulo.ilike.%${q}%,marca.ilike.%${q}%,modelo.ilike.%${q}%,tipo.ilike.%${q}%,aviso_ref.ilike.%${q}%,notas.ilike.%${q}%`
    )
  }

  const { data, error } = await query
  if (error) throw error
  return (data || []).map(rowToPreparacion)
}

export async function cloudDeletePreparacion(localId) {
  if (!supabase || !localId) return
  const { error } = await supabase
    .from('preparaciones')
    .delete()
    .eq('local_id', localId)
  if (error) throw error
}

export async function cloudGetPreparacion(localId) {
  if (!supabase || !localId) return null
  const { data, error } = await supabase
    .from('preparaciones')
    .select('*')
    .eq('local_id', localId)
    .maybeSingle()
  if (error) throw error
  return data ? rowToPreparacion(data) : null
}
