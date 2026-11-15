const STORAGE_KEY = 'boletines-meta-v1'

export const ESTADOS = [
  'Pendiente',
  'En camino',
  'En curso',
  'Pieza pedida',
  'Terminado',
]

/** Aviso cerrado / realizado (no aparece en lista activa por defecto) */
export function isAvisoCompletado(metaOrEstado) {
  const e =
    typeof metaOrEstado === 'string'
      ? metaOrEstado
      : metaOrEstado?.estado || ''
  return String(e).toLowerCase() === 'terminado'
}

export const CHECKLIST_ITEMS = [
  'Llegada',
  'Diagnóstico',
  'Presupuesto',
  'Pieza',
  'Reparación',
  'Prueba',
  'Firma',
]

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
  } catch {
    /* quota or private mode */
  }
}

export const FRANJAS = ['Sin franja', 'Mañana', 'Tarde', 'Urgencia']

const DEFAULT_META = {
  estado: 'Pendiente',
  nota: '',
  checklist: {},
  inicioVisita: '',
  finVisita: '',
  piezas: [],
  /** YYYY-MM-DD */
  citaFecha: '',
  /** HH:MM */
  citaHora: '',
  /** Mañana | Tarde | Urgencia | '' */
  franja: '',
  /**
   * Origen de la cita:
   * - 'boletin' → hora/fecha del PDF (preferente)
   * - 'manual'  → elegida por el técnico
   * - ''        → sin cita
   */
  citaOrigen: '',
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

/** Elimina metadatos locales de un aviso */
export function deleteMeta(aviso) {
  const all = loadAll()
  const key = avisoKey(aviso)
  if (!key || !(key in all)) return
  delete all[key]
  saveAll(all)
}
