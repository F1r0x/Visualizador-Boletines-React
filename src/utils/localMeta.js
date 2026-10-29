const STORAGE_KEY = 'boletines-meta-v1'

export const ESTADOS = [
  'Pendiente',
  'En camino',
  'En curso',
  'Pieza pedida',
  'Terminado',
]

export const CHECKLIST_ITEMS = [
  'Llegada',
  'Diagnóstico',
  'Presupuesto',
  'Pieza',
  'Reparación',
  'Prueba',
  'Firma',
]

export const FRANJAS = ['Sin franja', 'Mañana', 'Tarde', 'Urgencia']

export function avisoKey(aviso) {
  return String(aviso?.aviso ?? aviso?.orden ?? '')
}

function loadAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveAll(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {}
}

const DEFAULT_META = {
  estado: 'Pendiente',
  nota: '',
  checklist: {},
  inicioVisita: '',
  finVisita: '',
  piezas: [],
  citaFecha: '',
  citaHora: '',
  franja: '',
}

export function getMeta(aviso) {
  const all = loadAll()
  const key = avisoKey(aviso)
  return { ...DEFAULT_META, ...(all[key] || {}) }
}

export function setMeta(aviso, patch) {
  const all = loadAll()
  const key = avisoKey(aviso)
  if (!key) return
  all[key] = { ...getMeta(aviso), ...patch }
  saveAll(all)
  return all[key]
}
