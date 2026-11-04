import { avisoKey } from './localMeta'

const HIST_KEY = 'boletines-historial-v1'
const MAX_ENTRIES = 15

export function listHistorial() {
  try {
    const raw = localStorage.getItem(HIST_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

/** Une boletín actual + historial sin duplicar (clave aviso/orden). */
export function mergeAvisosParaCalendario(avisosActuales = [], historial = []) {
  const map = new Map()
  const add = (a) => {
    if (!a) return
    const k = avisoKey(a)
    if (!k) {
      map.set(`_anon_${map.size}`, a)
      return
    }
    if (!map.has(k)) map.set(k, a)
  }
  for (const a of avisosActuales) add(a)
  for (const entry of historial) {
    for (const a of entry.avisos || []) add(a)
  }
  return [...map.values()]
}

export function removeAvisoFromHistorial(aviso) {
  const key = avisoKey(aviso)
  if (!key) return listHistorial()
  const list = listHistorial()
    .map((entry) => {
      const avisos = (entry.avisos || []).filter((a) => avisoKey(a) !== key)
      return { ...entry, avisos, count: avisos.length }
    })
    .filter((e) => e.count > 0)
  try {
    localStorage.setItem(HIST_KEY, JSON.stringify(list))
  } catch {}
  return list
}

export function saveHistorialEntry({ nombre, avisos }) {
  if (!avisos?.length) return
  const entry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    nombre: nombre || `Boletín ${new Date().toLocaleString('es-ES')}`,
    fecha: new Date().toISOString(),
    count: avisos.length,
    avisos,
  }
  const list = listHistorial().filter((e) => e.nombre !== entry.nombre)
  list.unshift(entry)
  try {
    localStorage.setItem(HIST_KEY, JSON.stringify(list.slice(0, MAX_ENTRIES)))
  } catch {}
  return entry
}

export function deleteHistorialEntry(id) {
  const list = listHistorial().filter((e) => e.id !== id)
  try {
    localStorage.setItem(HIST_KEY, JSON.stringify(list))
  } catch {}
  return list
}

export function getHistorialEntry(id) {
  return listHistorial().find((e) => e.id === id) || null
}
