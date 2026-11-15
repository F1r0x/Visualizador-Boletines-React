import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { avisoKey, getMeta, setMeta } from './localMeta'
import { val } from './parseAvisos'

export { isSupabaseConfigured }

/**
 * Guarda un lote de avisos + meta en Supabase.
 * Acepta cloudSaveBatch(nombre, avisos) o cloudSaveBatch({ nombre, avisos }).
 */
export async function cloudSaveBatch(nombreOrOpts, maybeAvisos) {
  if (!supabase) throw new Error('Supabase no configurado')

  let nombre
  let avisos
  if (nombreOrOpts && typeof nombreOrOpts === 'object' && !Array.isArray(nombreOrOpts)) {
    nombre = nombreOrOpts.nombre
    avisos = nombreOrOpts.avisos
  } else {
    nombre = nombreOrOpts
    avisos = maybeAvisos
  }
  if (!avisos?.length) throw new Error('Supabase no configurado o sin avisos')

  const { data: batch, error: e1 } = await supabase
    .from('batches')
    .insert({
      nombre: nombre || `Boletín ${new Date().toLocaleString('es-ES')}`,
      avisos_count: avisos.length,
    })
    .select()
    .single()
  if (e1) throw e1

  const rows = avisos.map((a, i) => ({
    batch_id: batch.id,
    aviso_key: avisoKey(a) || `idx-${i}`,
    orden: a.orden != null ? String(a.orden) : null,
    payload: a,
  }))
  const { error: e2 } = await supabase.from('avisos').insert(rows)
  if (e2) throw e2

  const metas = avisos
    .map((a) => {
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
    .filter((r) => r.aviso_key)
  if (metas.length) {
    const { error: e3 } = await supabase
      .from('aviso_meta')
      .upsert(metas, { onConflict: 'aviso_key' })
    if (e3) throw e3
  }
  return batch
}

export async function cloudListBatches() {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('batches')
    .select('id, nombre, created_at, avisos_count')
    .order('created_at', { ascending: false })
    .limit(40)
  if (error) throw error
  return data || []
}

export async function cloudDeleteBatch(batchId) {
  if (!supabase) throw new Error('Supabase no configurado')
  if (!batchId) throw new Error('Falta el id del lote')
  const { error: e1 } = await supabase.from('avisos').delete().eq('batch_id', batchId)
  if (e1) throw e1
  const { error: e2 } = await supabase.from('batches').delete().eq('id', batchId)
  if (e2) throw e2
}

export async function cloudLoadBatch(batchId) {
  if (!supabase) throw new Error('Supabase no configurado')
  const { data: rows, error } = await supabase
    .from('avisos')
    .select('aviso_key, payload')
    .eq('batch_id', batchId)
  if (error) throw error

  const avisos = (rows || []).map((r) => r.payload || {})
  const keys = (rows || []).map((r) => r.aviso_key).filter(Boolean)
  if (keys.length) {
    const { data: metas } = await supabase
      .from('aviso_meta')
      .select('*')
      .in('aviso_key', keys)
    ;(metas || []).forEach((m) => {
      const a = avisos.find((x) => avisoKey(x) === m.aviso_key)
      if (!a) return
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
    })
  }
  return avisos
}

/** Sincroniza meta de los avisos actuales */
export async function cloudSyncMeta(avisos) {
  if (!supabase || !avisos?.length) return
  const metas = avisos
    .map((a) => {
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
    .filter((r) => r.aviso_key)
  if (!metas.length) return
  const { error } = await supabase
    .from('aviso_meta')
    .upsert(metas, { onConflict: 'aviso_key' })
  if (error) throw error
}

/** Alias de compatibilidad */
export async function cloudSyncMetas(avisos) {
  return cloudSyncMeta(avisos)
}

/** Historial de clientes / búsqueda */
export async function cloudSearchClientes(query) {
  if (!supabase || !query?.trim()) return []
  const q = query.trim()
  const { data, error } = await supabase
    .from('avisos')
    .select('aviso_key, payload, created_at, batch_id')
    .or(
      `payload->cliente->>nombre.ilike.%${q}%,payload->cliente->>nif.ilike.%${q}%,payload->direccion->>completa.ilike.%${q}%,payload->aparato->>modelo.ilike.%${q}%`
    )
    .order('created_at', { ascending: false })
    .limit(40)

  if (error) {
    const { data: all, error: e2 } = await supabase
      .from('avisos')
      .select('aviso_key, payload, created_at, batch_id')
      .order('created_at', { ascending: false })
      .limit(80)
    if (e2) throw e2
    const low = q.toLowerCase()
    return (all || []).filter((row) => {
      const p = row.payload || {}
      const blob = [
        p.aviso,
        p.orden,
        p.cliente?.nombre,
        p.cliente?.nif,
        p.direccion?.completa,
        p.aparato?.modelo,
        p.aparato?.marca,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return blob.includes(low)
    })
  }
  return data || []
}

export async function cloudSearchAvisos(query) {
  return cloudSearchClientes(query)
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
    nAvisos: nAvisos || 0,
    byEstado: porEstado,
  }
}

export function labelCliente(payload) {
  return (
    val(payload?.cliente?.nombre) ||
    `Aviso ${payload?.aviso || payload?.orden || ''}`
  )
}

// ——— Preparaciones ———

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
  if (filters.marca?.trim()) query = query.ilike('marca', `%${filters.marca.trim()}%`)
  if (filters.tipo?.trim()) query = query.ilike('tipo', `%${filters.tipo.trim()}%`)
  if (filters.modelo?.trim()) query = query.ilike('modelo', `%${filters.modelo.trim()}%`)
  if (filters.aviso) query = query.ilike('aviso_ref', `%${filters.aviso}%`)
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
  const { error } = await supabase.from('preparaciones').delete().eq('local_id', localId)
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

// —— Auditoría en nube ——

function auditRowToEntry(row) {
  if (!row) return null
  return {
    id: row.local_id || row.id,
    cloudId: row.id,
    ts: row.created_at,
    tipo: row.tipo || 'sistema',
    accion: row.accion || '',
    ref: row.ref || '',
    resumen: row.resumen || '',
    detalle: row.detalle || '',
    antes: row.antes ?? null,
    despues: row.despues ?? null,
    fuente: 'nube',
    userId: row.user_id || null,
  }
}

export async function cloudLogAuditoria(item) {
  if (!supabase || !item) return null
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const row = {
      local_id: item.id || null,
      created_at: item.ts || new Date().toISOString(),
      tipo: item.tipo || 'sistema',
      accion: item.accion || '',
      ref: item.ref != null ? String(item.ref) : '',
      resumen: item.resumen || '',
      detalle: item.detalle || '',
      antes: item.antes ?? null,
      despues: item.despues ?? null,
      user_id: user?.id || null,
      origen:
        typeof navigator !== 'undefined'
          ? navigator.userAgent?.slice(0, 120) || ''
          : '',
    }
    const { data, error } = await supabase.from('auditoria').insert(row).select().single()
    if (error) {
      console.warn('[auditoria nube]', error.message)
      return null
    }
    return auditRowToEntry(data)
  } catch (err) {
    console.warn('[auditoria nube]', err?.message || err)
    return null
  }
}

export async function cloudListAuditoria({ limit = 100, tipo = '', q = '' } = {}) {
  if (!supabase) return []
  let query = supabase
    .from('auditoria')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (tipo) query = query.eq('tipo', tipo)
  if (q?.trim()) {
    const needle = q.trim()
    query = query.or(
      `ref.ilike.%${needle}%,resumen.ilike.%${needle}%,detalle.ilike.%${needle}%,accion.ilike.%${needle}%`
    )
  }
  const { data, error } = await query
  if (error) {
    console.warn('[auditoria nube list]', error.message)
    throw error
  }
  return (data || []).map(auditRowToEntry).filter(Boolean)
}

export async function cloudClearAuditoria() {
  if (!supabase) throw new Error('Supabase no configurado')
  const { error } = await supabase
    .from('auditoria')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')
  if (error) throw error
  return true
}
