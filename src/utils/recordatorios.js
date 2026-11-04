import { getMeta, avisoKey } from './localMeta'
import { parseFechaBoletin } from './fechas'
import { val } from './parseAvisos'

const SETTINGS_KEY = 'boletines-recordatorios'
const DISMISS_KEY = 'boletines-recordatorios-dismiss'

const DEFAULT_SETTINGS = {
  activos: true,
  citasHoy: true,
  limites: true,
  diasAvisoLimite: 3,
}

export function loadRecordatorioSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveRecordatorioSettings(patch) {
  const next = { ...loadRecordatorioSettings(), ...patch }
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
  } catch {}
  return next
}

export function dismissRecordatoriosHoy() {
  const hoy = new Date()
  const ymd = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
  try {
    localStorage.setItem(DISMISS_KEY, ymd)
  } catch {}
}

export function isRecordatoriosDismissedHoy() {
  try {
    const v = localStorage.getItem(DISMISS_KEY)
    if (!v) return false
    const hoy = new Date()
    const ymd = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
    return v === ymd
  } catch {
    return false
  }
}

function hoyYmd() {
  const hoy = new Date()
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
}

export function calcularRecordatorios(avisos, settings = loadRecordatorioSettings()) {
  const citasHoy = []
  const limitesVencidos = []
  const limitesProximos = []
  const hoy = hoyYmd()
  const seen = new Set()

  const lista = Array.isArray(avisos) ? avisos : []
  for (const a of lista) {
    const key = avisoKey(a)
    if (seen.has(key)) continue
    seen.add(key)

    const meta = getMeta(a)
    const nombre = val(a.cliente?.nombre) || `Aviso ${a.aviso || a.orden || ''}`

    if (settings.citasHoy && meta.citaFecha === hoy) {
      citasHoy.push({
        key,
        aviso: a,
        nombre,
        hora: meta.citaHora || '',
        cp: val(a.direccion?.codigo_postal) || '',
      })
    }

    if (settings.limites) {
      const lim = val(a.fechas?.limite_primera_visita)
      if (lim) {
        const d = parseFechaBoletin(lim)
        if (d) {
          const base = new Date()
          base.setHours(0, 0, 0, 0)
          const diff = Math.round((d - base) / 86400000)
          const item = {
            key,
            aviso: a,
            nombre,
            limite: lim,
            dias: diff,
            cp: val(a.direccion?.codigo_postal) || '',
          }
          if (diff < 0) limitesVencidos.push(item)
          else if (diff <= (settings.diasAvisoLimite ?? 3)) {
            limitesProximos.push(item)
          }
        }
      }
    }
  }

  citasHoy.sort((x, y) => (x.hora || '99:99').localeCompare(y.hora || '99:99'))
  limitesVencidos.sort((x, y) => x.dias - y.dias)
  limitesProximos.sort((x, y) => x.dias - y.dias)

  return { citasHoy, limitesVencidos, limitesProximos }
}

export function hayRecordatorios(rec) {
  return (
    rec.citasHoy.length > 0 ||
    rec.limitesVencidos.length > 0 ||
    rec.limitesProximos.length > 0
  )
}
