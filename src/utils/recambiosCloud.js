import { supabase, isSupabaseConfigured } from '../lib/supabase'

export { isSupabaseConfigured }

function recambioToRow(r) {
  if (!r) return null
  const localId = String(r.id || '')
  if (!localId) return null
  return {
    local_id: localId,
    item_key: r.key || null,
    factura: r.factura || null,
    fecha_factura: r.fecha_factura || null,
    albaran: r.albaran || null,
    pos: r.pos != null ? Number(r.pos) : null,
    cantidad: r.cantidad != null ? Number(r.cantidad) : 1,
    material: r.material || null,
    descripcion: r.descripcion || null,
    peso_kg: r.peso_kg != null ? Number(r.peso_kg) : null,
    precio_unidad: r.precio_unidad != null ? Number(r.precio_unidad) : null,
    valor_bruto: r.valor_bruto != null ? Number(r.valor_bruto) : null,
    descuento_pct: r.descuento_pct != null ? Number(r.descuento_pct) : null,
    descuento_importe: r.descuento_importe != null ? Number(r.descuento_importe) : null,
    valor_neto: r.valor_neto != null ? Number(r.valor_neto) : null,
    pedido_bsh: r.pedido_bsh || null,
    fecha_pedido: r.fecha_pedido || null,
    pedido_cliente: r.pedido_cliente || null,
    servicio: r.servicio || null,
    aviso: r.aviso || null,
    pedido_sufijo: r.pedido_sufijo || null,
    estado: r.estado || 'pedido',
    utilizado_en_aviso: r.utilizado_en_aviso || null,
    notas: r.notas || '',
    historial_estados: Array.isArray(r.historial_estados) ? r.historial_estados : [],
    payload: r,
    updated_at: r.actualizado || new Date().toISOString(),
  }
}

function rowToRecambio(row) {
  if (!row) return null
  if (row.payload && typeof row.payload === 'object') {
    return {
      ...row.payload,
      id: row.local_id || row.payload.id,
      cloudId: row.id,
      actualizado: row.updated_at || row.payload.actualizado,
      creado: row.created_at || row.payload.creado,
    }
  }
  return {
    id: row.local_id,
    cloudId: row.id,
    key: row.item_key || null,
    factura: row.factura || null,
    fecha_factura: row.fecha_factura || null,
    albaran: row.albaran || null,
    pos: row.pos,
    cantidad: row.cantidad != null ? Number(row.cantidad) : 1,
    material: row.material || '',
    descripcion: row.descripcion || '',
    peso_kg: row.peso_kg,
    precio_unidad: row.precio_unidad,
    valor_bruto: row.valor_bruto,
    descuento_pct: row.descuento_pct,
    descuento_importe: row.descuento_importe,
    valor_neto: row.valor_neto,
    pedido_bsh: row.pedido_bsh || null,
    fecha_pedido: row.fecha_pedido || null,
    pedido_cliente: row.pedido_cliente || null,
    servicio: row.servicio || null,
    aviso: row.aviso || null,
    pedido_sufijo: row.pedido_sufijo || null,
    estado: row.estado || 'pedido',
    utilizado_en_aviso: row.utilizado_en_aviso || null,
    notas: row.notas || '',
    historial_estados: row.historial_estados || [],
    creado: row.created_at,
    actualizado: row.updated_at,
  }
}

export async function cloudUpsertRecambio(item) {
  if (!supabase) throw new Error('Supabase no configurado')
  const row = recambioToRow(item)
  if (!row) throw new Error('Recambio sin id')
  const { data, error } = await supabase
    .from('recambios')
    .upsert(row, { onConflict: 'local_id' })
    .select()
    .single()
  if (error) throw error
  return rowToRecambio(data)
}

export async function cloudUpsertRecambiosBatch(items = []) {
  if (!supabase) throw new Error('Supabase no configurado')
  const rows = (items || []).map(recambioToRow).filter(Boolean)
  if (!rows.length) return { upserted: 0 }
  const CHUNK = 80
  let upserted = 0
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK)
    const { error } = await supabase.from('recambios').upsert(chunk, { onConflict: 'local_id' })
    if (error) throw error
    upserted += chunk.length
  }
  return { upserted }
}

export async function cloudListRecambios(limit = 2000) {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('recambios')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data || []).map(rowToRecambio).filter(Boolean)
}

export async function cloudDeleteRecambio(localId) {
  if (!supabase || !localId) return
  const { error } = await supabase.from('recambios').delete().eq('local_id', localId)
  if (error) throw error
}

export async function cloudDeleteRecambiosByFactura(factura) {
  if (!supabase || !factura) return
  const { error } = await supabase.from('recambios').delete().eq('factura', String(factura))
  if (error) throw error
}

export async function cloudCountRecambios() {
  if (!supabase) return 0
  const { count, error } = await supabase
    .from('recambios')
    .select('*', { count: 'exact', head: true })
  if (error) throw error
  return count || 0
}
