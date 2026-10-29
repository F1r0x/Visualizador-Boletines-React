export function parseFechaBoletin(str) {
  if (!str || typeof str !== 'string') return null
  const s = str.trim()
  let m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
  if (m) {
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]))
    return Number.isNaN(d.getTime()) ? null : d
  }
  m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

export function urgenciaFecha(str) {
  const d = parseFechaBoletin(str)
  if (!d) return null
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const diff = Math.round((d - hoy) / 86400000)
  if (diff < 0) return 'pasada'
  if (diff <= 3) return 'proxima'
  return 'ok'
}

export function formatoDuracion(inicioIso, finIso) {
  if (!inicioIso) return ''
  const start = new Date(inicioIso).getTime()
  const end = finIso ? new Date(finIso).getTime() : Date.now()
  if (Number.isNaN(start)) return ''
  const mins = Math.max(0, Math.round((end - start) / 60000))
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m} min`
  return `${h} h ${m} min`
}
