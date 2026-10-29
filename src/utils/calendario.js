import { getMeta } from './localMeta'
import { val } from './parseAvisos'

export function startOfWeek(date = new Date()) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

export function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

export function toYMD(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function formatDiaCorto(date) {
  return date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function formatDiaLargo(date) {
  return date.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

export function avisosDelDia(avisos, ymd) {
  const list = avisos
    .map((a) => ({ aviso: a, meta: getMeta(a) }))
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

export function avisosPorSemana(avisos, weekStart) {
  const map = {}
  for (let i = 0; i < 7; i++) {
    map[toYMD(addDays(weekStart, i))] = []
  }
  avisos.forEach((a) => {
    const meta = getMeta(a)
    if (meta.citaFecha && map[meta.citaFecha] !== undefined) {
      map[meta.citaFecha].push({ aviso: a, meta })
    }
  })
  Object.keys(map).forEach((k) => {
    map[k].sort((x, y) => (x.meta.citaHora || '99:99').localeCompare(y.meta.citaHora || '99:99'))
  })
  return map
}

export function labelAvisoCorto(a) {
  const nombre = val(a.cliente?.nombre) || `Aviso ${a.aviso || a.orden}`
  const tipo = val(a.aparato?.tipo) || ''
  return tipo ? `${nombre} · ${tipo}` : nombre
}
