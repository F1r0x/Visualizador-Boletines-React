/**
 * Gestión de recambios BSH — estados y almacén
 *
 * Estados:
 *   pedido        → facturado / pedido, aún no recibido físicamente
 *   recibido      → material recibido
 *   en_furgoneta  → stock propio (lo guardas)
 *   utilizado     → montado en un aviso / reparación
 *   a_devolver    → sobra, devolver a BSH a fin de mes
 *   consulta      → incidencia (no llegó, error, reclamación a BSH) — color rojizo
 */

const KEY = 'boletines-recambios-v1'
const MAX_ENTRIES = 2000

export const ESTADOS_RECAMBIO = [
  'pedido',
  'recibido',
  'en_furgoneta',
  'utilizado',
  'a_devolver',
  'consulta',
]

export const ESTADO_LABEL = {
  pedido: 'Pedido',
  recibido: 'Recibido',
  en_furgoneta: 'En furgoneta',
  utilizado: 'Utilizado',
  a_devolver: 'A devolver',
  consulta: 'Consulta',
}

export const ESTADO_COLOR = {
  pedido: '#0ea5e9',
  recibido: '#3b82f6',
  en_furgoneta: '#8b5cf6',
  utilizado: '#22c55e',
  a_devolver: '#f59e0b',
  consulta: '#ef4444',
}

export const TRANSICIONES = {
  pedido: ['recibido', 'consulta', 'en_furgoneta', 'a_devolver'],
  recibido: ['en_furgoneta', 'utilizado', 'a_devolver', 'consulta', 'pedido'],
  en_furgoneta: ['utilizado', 'a_devolver', 'recibido', 'consulta'],
  utilizado: ['en_furgoneta', 'a_devolver', 'recibido'],
  a_devolver: ['en_furgoneta', 'utilizado', 'recibido', 'consulta'],
  consulta: ['pedido', 'recibido', 'en_furgoneta', 'utilizado', 'a_devolver'],
}

export function puedeCambiarEstado(desde, hacia) {
  if (!desde || !hacia) return false
  if (desde === hacia) return true
  const allowed = TRANSICIONES[desde]
  return Array.isArray(allowed) && allowed.includes(hacia)
}

export function labelEstado(estado) {
  return ESTADO_LABEL[estado] || estado || '—'
}

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

export function listRecambios() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function saveAll(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_ENTRIES)))
  } catch (e) {
    console.warn('[recambios] No se pudo guardar', e)
    throw new Error('No hay espacio suficiente para guardar recambios.')
  }
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('boletines-recambios-changed', {
          detail: { count: list.length },
        })
      )
    }
  } catch {
    /* ignore */
  }
}

export function getRecambio(id) {
  return listRecambios().find((r) => r.id === id) || null
}

export function lineaKey(lin, facturaNum) {
  const fac = String(facturaNum || lin.factura || '').trim()
  const pos = String(lin.pos ?? '').trim()
  const mat = String(lin.material || '').trim()
  return `${fac}|${pos}|${mat}`
}

function normalizeAviso(v) {
  return String(v ?? '').replace(/\D/g, '')
}

export function importFromFacturaPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return { added: 0, skipped: 0, total: 0, items: [] }
  }

  const factura = payload.factura || {}
  const facturaNum = String(factura.numero || '')
  const fecha = factura.fecha || ''
  const albaran = factura.albaran || ''
  const lineasIn = Array.isArray(payload.lineas) ? payload.lineas : []

  const existing = listRecambios()
  const byKey = new Map(existing.map((r) => [r.key, r]))

  let added = 0
  let skipped = 0
  const now = new Date().toISOString()
  const nuevos = []

  for (const lin of lineasIn) {
    const key = lineaKey(lin, facturaNum)
    if (byKey.has(key)) {
      skipped++
      continue
    }

    const item = {
      id: uid(),
      key,
      factura: facturaNum,
      fecha_factura: fecha,
      albaran,
      pos: lin.pos ?? null,
      cantidad: Number(lin.cantidad) > 0 ? Number(lin.cantidad) : 1,
      material: String(lin.material || '').trim(),
      descripcion: String(lin.descripcion || '').trim(),
      peso_kg: lin.peso_kg ?? null,
      precio_unidad: lin.precio_unidad ?? null,
      valor_bruto: lin.valor_bruto ?? null,
      descuento_pct: lin.descuento_pct ?? null,
      descuento_importe: lin.descuento_importe ?? null,
      valor_neto: lin.valor_neto ?? null,
      pedido_bsh: lin.pedido_bsh || null,
      fecha_pedido: lin.fecha_pedido || fecha,
      pedido_cliente: lin.pedido_cliente || null,
      servicio: lin.servicio || null,
      aviso: normalizeAviso(lin.aviso) || null,
      pedido_sufijo: lin.pedido_sufijo || null,
      estado: ESTADOS_RECAMBIO.includes(lin.estado) ? lin.estado : 'pedido',
      utilizado_en_aviso: normalizeAviso(lin.utilizado_en_aviso || lin.aviso) || null,
      notas: lin.notas || '',
      creado: now,
      actualizado: now,
      historial_estados: [
        {
          estado: ESTADOS_RECAMBIO.includes(lin.estado) ? lin.estado : 'pedido',
          en: now,
          origen: 'import',
        },
      ],
    }

    byKey.set(key, item)
    nuevos.push(item)
    added++
  }

  if (added > 0) {
    const merged = [...nuevos, ...existing]
    saveAll(merged)
  }

  return {
    added,
    skipped,
    total: listRecambios().length,
    items: nuevos,
    factura: facturaNum,
  }
}

export function setEstadoRecambio(id, nuevoEstado, opts = {}) {
  if (!ESTADOS_RECAMBIO.includes(nuevoEstado)) {
    throw new Error(`Estado no válido: ${nuevoEstado}`)
  }

  const list = listRecambios()
  const i = list.findIndex((r) => r.id === id)
  if (i < 0) return null

  const actual = list[i]
  if (!puedeCambiarEstado(actual.estado, nuevoEstado)) {
    throw new Error(
      `No se puede pasar de «${labelEstado(actual.estado)}» a «${labelEstado(nuevoEstado)}»`
    )
  }

  const now = new Date().toISOString()
  const hist = Array.isArray(actual.historial_estados)
    ? [...actual.historial_estados]
    : []
  hist.push({
    estado: nuevoEstado,
    en: now,
    origen: opts.origen || 'manual',
    desde: actual.estado,
  })

  const patch = {
    estado: nuevoEstado,
    actualizado: now,
    historial_estados: hist,
  }

  if (opts.notas != null) patch.notas = String(opts.notas)

  if (nuevoEstado === 'utilizado') {
    const av =
      normalizeAviso(opts.aviso) ||
      normalizeAviso(actual.utilizado_en_aviso) ||
      normalizeAviso(actual.aviso) ||
      null
    patch.utilizado_en_aviso = av
  }

  list[i] = { ...actual, ...patch }
  saveAll(list)
  return list[i]
}

export function marcarEnFurgoneta(id, opts) {
  return setEstadoRecambio(id, 'en_furgoneta', opts)
}
export function marcarUtilizado(id, opts) {
  return setEstadoRecambio(id, 'utilizado', opts)
}
export function marcarADevolver(id, opts) {
  return setEstadoRecambio(id, 'a_devolver', opts)
}
export function marcarRecibido(id, opts) {
  return setEstadoRecambio(id, 'recibido', opts)
}
export function marcarPedido(id, opts) {
  return setEstadoRecambio(id, 'pedido', opts)
}
export function marcarConsulta(id, opts) {
  return setEstadoRecambio(id, 'consulta', opts)
}

export function updateRecambio(id, patch = {}) {
  const list = listRecambios()
  const i = list.findIndex((r) => r.id === id)
  if (i < 0) return null

  const allowed = ['notas', 'utilizado_en_aviso', 'descripcion']
  const clean = {}
  for (const k of allowed) {
    if (patch[k] != null) clean[k] = patch[k]
  }
  if (clean.utilizado_en_aviso != null) {
    clean.utilizado_en_aviso = normalizeAviso(clean.utilizado_en_aviso) || null
  }

  list[i] = {
    ...list[i],
    ...clean,
    actualizado: new Date().toISOString(),
  }
  saveAll(list)
  return list[i]
}

export function deleteRecambio(id) {
  const next = listRecambios().filter((r) => r.id !== id)
  saveAll(next)
  return next
}

export function deleteByFactura(facturaNum) {
  const fac = String(facturaNum || '').trim()
  if (!fac) return listRecambios()
  const next = listRecambios().filter((r) => r.factura !== fac)
  saveAll(next)
  return next
}

export function recambiosPorEstado(estado) {
  return listRecambios().filter((r) => r.estado === estado)
}

export function recambiosPorAviso(avisoOrNum) {
  const num = normalizeAviso(avisoOrNum)
  if (!num) return []
  return listRecambios().filter(
    (r) =>
      normalizeAviso(r.aviso) === num ||
      normalizeAviso(r.utilizado_en_aviso) === num
  )
}

export function recambiosPorFactura(facturaNum) {
  const fac = String(facturaNum || '').trim()
  if (!fac) return []
  return listRecambios().filter((r) => r.factura === fac)
}

export function recambiosPorMaterial(ref) {
  const m = String(ref || '').trim()
  if (!m) return []
  return listRecambios().filter((r) => r.material === m)
}

export function listadoADevolver() {
  return recambiosPorEstado('a_devolver')
}

export function listadoConsulta() {
  return recambiosPorEstado('consulta')
}

export function listadoPedidosPendientes() {
  return recambiosPorEstado('pedido')
}

export function listadoStock({ incluirRecibidos = false } = {}) {
  return listRecambios().filter((r) =>
    incluirRecibidos
      ? r.estado === 'en_furgoneta' || r.estado === 'recibido' || r.estado === 'pedido'
      : r.estado === 'en_furgoneta'
  )
}

export function stockPorMaterial(filtroEstado = null) {
  const list = filtroEstado
    ? recambiosPorEstado(filtroEstado)
    : listRecambios()

  const map = new Map()
  for (const r of list) {
    const k = r.material || 'sin_ref'
    if (!map.has(k)) {
      map.set(k, {
        material: r.material,
        descripcion: r.descripcion,
        cantidad: 0,
        valor_neto: 0,
        por_estado: {},
        items: [],
      })
    }
    const g = map.get(k)
    g.cantidad += r.cantidad || 1
    g.valor_neto = Math.round((g.valor_neto + (r.valor_neto || 0)) * 100) / 100
    g.por_estado[r.estado] = (g.por_estado[r.estado] || 0) + (r.cantidad || 1)
    g.items.push(r)
  }
  return [...map.values()].sort((a, b) =>
    String(a.material).localeCompare(String(b.material))
  )
}

export function statsRecambios() {
  const list = listRecambios()
  const by = {
    pedido: 0,
    recibido: 0,
    en_furgoneta: 0,
    utilizado: 0,
    a_devolver: 0,
    consulta: 0,
  }
  let valorStock = 0
  let valorDevolver = 0
  let valorConsulta = 0
  for (const r of list) {
    if (by[r.estado] != null) by[r.estado] += r.cantidad || 1
    if (r.estado === 'en_furgoneta' || r.estado === 'recibido' || r.estado === 'pedido') {
      valorStock += r.valor_neto || 0
    }
    if (r.estado === 'a_devolver') valorDevolver += r.valor_neto || 0
    if (r.estado === 'consulta') valorConsulta += r.valor_neto || 0
  }
  return {
    total: list.length,
    ...by,
    valor_stock: Math.round(valorStock * 100) / 100,
    valor_a_devolver: Math.round(valorDevolver * 100) / 100,
    valor_consulta: Math.round(valorConsulta * 100) / 100,
  }
}

export function accionesDisponibles(recambio) {
  const estado = recambio?.estado || 'pedido'
  const destinos = TRANSICIONES[estado] || []
  return destinos.map((e) => ({
    estado: e,
    label: labelEstado(e),
    color: ESTADO_COLOR[e],
  }))
}

function tsOf(r) {
  const t = Date.parse(r?.actualizado || r?.creado || '')
  return Number.isFinite(t) ? t : 0
}

/** Sustituye todo el listado local (p. ej. tras merge con la nube). */
export function replaceAllRecambios(list) {
  const arr = Array.isArray(list) ? list : []
  saveAll(arr)
  return listRecambios()
}

/**
 * Fusiona listados local + remoto.
 * Misma `id` o mismo `key` (factura|pos|material) → gana el más reciente por `actualizado`.
 */
export function mergeRecambiosLists(localList, remoteList) {
  const local = Array.isArray(localList) ? localList : []
  const remote = Array.isArray(remoteList) ? remoteList : []
  const byId = new Map()
  const byKey = new Map()

  const consider = (item) => {
    if (!item || !item.id) return
    const prevId = byId.get(item.id)
    if (!prevId || tsOf(item) >= tsOf(prevId)) {
      byId.set(item.id, item)
    }
    if (item.key) {
      const prevK = byKey.get(item.key)
      if (!prevK || tsOf(item) >= tsOf(prevK)) {
        byKey.set(item.key, item)
      }
    }
  }

  for (const r of remote) consider(r)
  for (const r of local) consider(r)

  const winners = new Map()
  for (const item of byId.values()) {
    if (item.key && byKey.has(item.key)) {
      const kWin = byKey.get(item.key)
      if (kWin.id !== item.id) {
        if (tsOf(kWin) >= tsOf(item)) continue
      }
    }
    winners.set(item.id, item)
  }
  for (const item of byKey.values()) {
    if (!winners.has(item.id)) {
      const clash = [...winners.values()].find((w) => w.key && w.key === item.key)
      if (clash) {
        if (tsOf(item) > tsOf(clash)) {
          winners.delete(clash.id)
          winners.set(item.id, item)
        }
      } else {
        winners.set(item.id, item)
      }
    }
  }

  return [...winners.values()].sort((a, b) => tsOf(b) - tsOf(a))
}

export function applyRemoteRecambios(remoteList) {
  const merged = mergeRecambiosLists(listRecambios(), remoteList)
  saveAll(merged)
  return {
    total: merged.length,
    remote: Array.isArray(remoteList) ? remoteList.length : 0,
    local: listRecambios().length,
  }
}
