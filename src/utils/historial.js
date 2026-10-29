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
  } catch {
    /* quota */
  }
  return entry
}

export function deleteHistorialEntry(id) {
  const list = listHistorial().filter((e) => e.id !== id)
  try {
    localStorage.setItem(HIST_KEY, JSON.stringify(list))
  } catch {
    /* ignore */
  }
  return list
}

export function getHistorialEntry(id) {
  return listHistorial().find((e) => e.id === id) || null
}
