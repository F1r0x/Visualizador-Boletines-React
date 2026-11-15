/**
 * Resolución de conflictos multi-dispositivo (nube ↔ local).
 *
 * Estrategia:
 * 1. Last-write-wins por `actualizado` / `updated_at`
 * 2. Fusión segura de colecciones (piezas, checklist, adjuntos) sin perder ítems
 * 3. Campos escalares: gana la versión más reciente
 * 4. Si timestamps iguales o muy cercanos (< 2s): fusión campo a campo
 */

const CLOSE_MS = 2000

function ts(v) {
  if (!v) return 0
  const n = new Date(v).getTime()
  return Number.isFinite(n) ? n : 0
}

function isNewer(a, b) {
  return ts(a) > ts(b)
}

function nearlyEqual(a, b) {
  return Math.abs(ts(a) - ts(b)) <= CLOSE_MS
}

function itemKey(item, fields = ['id', 'ref', 'text', 'url']) {
  if (!item || typeof item !== 'object') return String(item)
  for (const f of fields) {
    if (item[f] != null && String(item[f]).trim() !== '') {
      return `${f}:${String(item[f]).trim().toLowerCase()}`
    }
  }
  return JSON.stringify(item)
}

export function mergeArraysByKey(localArr, remoteArr, opts = {}) {
  const local = Array.isArray(localArr) ? localArr : []
  const remote = Array.isArray(remoteArr) ? remoteArr : []
  const preferLocal = opts.preferLocal !== false
  const keyFn = opts.keyFn || ((x) => itemKey(x))

  const map = new Map()
  const order = []

  const put = (item, preferThis) => {
    if (!item) return
    const k = keyFn(item)
    if (!map.has(k)) {
      map.set(k, item)
      order.push(k)
      return
    }
    const prev = map.get(k)
    if (item.dataUrl && !prev.dataUrl) {
      map.set(k, { ...prev, ...item })
      return
    }
    if (prev.dataUrl && !item.dataUrl) {
      map.set(k, { ...item, ...prev, dataUrl: prev.dataUrl })
      return
    }
    if (typeof item.done === 'boolean' || typeof prev.done === 'boolean') {
      map.set(k, {
        ...prev,
        ...item,
        done: !!(prev.done || item.done),
        text: item.text || prev.text,
      })
      return
    }
    map.set(k, preferThis ? { ...prev, ...item } : { ...item, ...prev })
  }

  if (preferLocal) {
    remote.forEach((x) => put(x, false))
    local.forEach((x) => put(x, true))
  } else {
    local.forEach((x) => put(x, false))
    remote.forEach((x) => put(x, true))
  }

  return order.map((k) => map.get(k))
}

export function resolvePreparacionConflict(local, remote) {
  if (!local && remote) {
    return { winner: 'remote', result: remote, conflict: false, summary: 'Solo existía en la nube' }
  }
  if (local && !remote) {
    return { winner: 'local', result: local, conflict: false, summary: 'Solo existía en local' }
  }
  if (!local && !remote) {
    return { winner: 'local', result: null, conflict: false, summary: 'Vacío' }
  }

  const localTs = local.actualizado || local.updated_at || local.creado
  const remoteTs = remote.actualizado || remote.updated_at || remote.creado

  const localWins = isNewer(localTs, remoteTs)
  const remoteWins = isNewer(remoteTs, localTs)
  const close = nearlyEqual(localTs, remoteTs)

  const scalarFields = [
    'titulo', 'marca', 'modelo', 'tipo', 'avisoRef',
    'citaFecha', 'citaHora', 'notas', 'completada',
  ]
  let diverged = false
  for (const f of scalarFields) {
    if (String(local[f] ?? '') !== String(remote[f] ?? '')) {
      diverged = true
      break
    }
  }
  if (
    JSON.stringify(local.piezas || []) !== JSON.stringify(remote.piezas || []) ||
    JSON.stringify(local.checklist || []) !== JSON.stringify(remote.checklist || [])
  ) {
    diverged = true
  }

  const preferLocal = localWins || (!remoteWins && close)
  const base = preferLocal ? { ...remote, ...local } : { ...local, ...remote }

  base.piezas = mergeArraysByKey(local.piezas, remote.piezas, {
    preferLocal,
    keyFn: (p) =>
      itemKey(p, ['id', 'ref']) + '|' + String(p?.descripcion || '').toLowerCase(),
  })
  base.checklist = mergeArraysByKey(local.checklist, remote.checklist, {
    preferLocal,
    keyFn: (c) => itemKey(c, ['id', 'text']),
  })
  base.adjuntos = mergeArraysByKey(local.adjuntos, remote.adjuntos, {
    preferLocal,
    keyFn: (a) => itemKey(a, ['id', 'url', 'nombre']),
  })

  if (local.completada || remote.completada) {
    if (preferLocal) {
      base.completada = !!local.completada
      base.completadaEn = local.completadaEn || remote.completadaEn || ''
      base.cerradaPorAviso = !!local.cerradaPorAviso
    } else {
      base.completada = !!remote.completada
      base.completadaEn = remote.completadaEn || local.completadaEn || ''
      base.cerradaPorAviso = !!remote.cerradaPorAviso
    }
  }

  base.actualizado =
    preferLocal && localWins
      ? localTs
      : remoteWins
        ? remoteTs
        : localTs || remoteTs || new Date().toISOString()

  base.id = local.id || remote.id
  if (remote.cloudId) base.cloudId = remote.cloudId

  const conflict = diverged && close
  const winner = conflict ? 'merged' : preferLocal ? 'local' : 'remote'
  const summary = conflict
    ? 'Conflicto cercano en el tiempo: se han fusionado piezas, checklist y adjuntos'
    : preferLocal
      ? 'Versión local más reciente'
      : 'Versión de la nube más reciente'

  return { winner, result: base, conflict, summary }
}

export function resolveMetaMap(localMap, remoteMap) {
  const local = localMap && typeof localMap === 'object' ? localMap : {}
  const remote = remoteMap && typeof remoteMap === 'object' ? remoteMap : {}
  const keys = new Set([...Object.keys(local), ...Object.keys(remote)])
  const out = {}
  const conflicts = []

  for (const key of keys) {
    const L = local[key]
    const R = remote[key]
    if (L && !R) {
      out[key] = L
      continue
    }
    if (R && !L) {
      out[key] = R
      continue
    }
    const lTs = L._updatedAt || L.updatedAt || 0
    const rTs = R._updatedAt || R.updatedAt || 0
    const preferLocal = isNewer(lTs, rTs) || (!isNewer(rTs, lTs) && nearlyEqual(lTs, rTs))
    const base = preferLocal ? { ...R, ...L } : { ...L, ...R }
    const cl = {}
    Object.assign(cl, preferLocal ? (R.checklist || {}) : (L.checklist || {}))
    Object.assign(cl, preferLocal ? (L.checklist || {}) : (R.checklist || {}))
    base.checklist = cl
    base.piezas = mergeArraysByKey(L.piezas, R.piezas, { preferLocal })
    base._updatedAt =
      preferLocal && isNewer(lTs, rTs)
        ? lTs
        : isNewer(rTs, lTs)
          ? rTs
          : L._updatedAt || R._updatedAt || new Date().toISOString()
    out[key] = base
    if (nearlyEqual(lTs, rTs) && JSON.stringify(L) !== JSON.stringify(R)) {
      conflicts.push(key)
    }
  }

  return { result: out, conflicts }
}

export function compareUpdated(a, b) {
  const da = ts(a)
  const db = ts(b)
  if (da === db) return 0
  return da < db ? -1 : 1
}
