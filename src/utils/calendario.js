import { getMeta } from './localMeta'
import { val, parseHorarioBoletin } from './parseAvisos'

function metaCita(a) {
  const m = getMeta(a)
  if (m.citaHora) return m
  const h = parseHorarioBoletin(a.horario)
  if (h.inicio) return { ...m, citaHora: h.inicio }
  return m
}

export function startOfWeek(date = new Date()) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

export function startOfMonth(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), 1)
  d.setHours(0, 0, 0, 0)
  return d
}

export function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

export function addMonths(date, n) {
  const d = new Date(date.getFullYear(), date.getMonth() + n, 1)
  d.setHours(0, 0, 0, 0)
  return d
}

export function toYMD(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function formatDiaCorto(date) {
  return date.toLocaleDateString('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

export function formatDiaLargo(date) {
  return date.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

export function formatMesAnio(date) {
  const s = date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function celdasDelMes(monthStart) {
  const first = startOfMonth(monthStart)
  const gridStart = startOfWeek(first)
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
}

export function avisosDelDia(avisos, ymd) {
  const list = avisos
    .map((a) => ({ aviso: a, meta: metaCita(a) }))
    .filter(({ meta }) => meta.citaFecha === ymd)

  list.sort((x, y) => {
    const hx = x.meta.citaHora || '99:99'
    const hy = y.meta.citaHora || '99:99'
    if (hx !== hy) return hx.localeCompare(hy)
    const cpx = val(x.aviso.direccion?.codigo_postal) || ''
    const cpy = val(y.aviso.direccion?.codigo_postal) || ''
    return cpx.localeCompare(cpy)
  })
  return list
}

export function avisosPorFechas(avisos, ymdList) {
  const set = new Set(ymdList)
  const map = {}
  ymdList.forEach((k) => {
    map[k] = []
  })
  avisos.forEach((a) => {
    const meta = metaCita(a)
    if (meta.citaFecha && set.has(meta.citaFecha)) {
      map[meta.citaFecha].push({ aviso: a, meta })
    }
  })
  Object.keys(map).forEach((k) => {
    map[k].sort((x, y) =>
      (x.meta.citaHora || '99:99').localeCompare(y.meta.citaHora || '99:99')
    )
  })
  return map
}

export function avisosPorSemana(avisos, weekStart) {
  const ymds = Array.from({ length: 7 }, (_, i) => toYMD(addDays(weekStart, i)))
  return avisosPorFechas(avisos, ymds)
}

export function avisosSinCita(avisos) {
  return avisos
    .map((a) => ({ aviso: a, meta: metaCita(a) }))
    .filter(({ meta }) => !meta.citaFecha)
    .sort((x, y) => {
      const ax = String(x.aviso.aviso || x.aviso.orden || '')
      const ay = String(y.aviso.aviso || y.aviso.orden || '')
      return ax.localeCompare(ay)
    })
}

export function labelAvisoCorto(a) {
  const nombre = val(a.cliente?.nombre) || `Aviso ${a.aviso || a.orden}`
  const tipo = val(a.aparato?.tipo) || ''
  return tipo ? `${nombre} · ${tipo}` : nombre
}

export function mapsRutaUrl(items) {
  const dirs = items
    .map(({ aviso: a }) => {
      const d = val(a.direccion?.completa)
      const cp = val(a.direccion?.codigo_postal)
      return [d, cp].filter(Boolean).join(', ')
    })
    .filter(Boolean)
  if (!dirs.length) return null
  if (dirs.length === 1) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dirs[0])}`
  }
  const origin = encodeURIComponent(dirs[0])
  const destination = encodeURIComponent(dirs[dirs.length - 1])
  const waypoints = dirs
    .slice(1, -1)
    .map((d) => encodeURIComponent(d))
    .join('|')
  let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`
  if (waypoints) url += `&waypoints=${waypoints}`
  return url
}

export function estadoClass(estado) {
  return 'est-' + String(estado || 'Pendiente').toLowerCase().replace(/\s+/g, '-')
}
