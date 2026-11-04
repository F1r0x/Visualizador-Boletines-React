import { getMeta, setMeta } from './localMeta'
import { parseHorarioBoletin, limpiarCampo } from './parseAvisos'

export function parseFechaBoletin(raw) {
  const s = limpiarCampo(raw)
  if (!s) return ''
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const m = s.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/)
  if (!m) return ''
  let [, d, mo, y] = m
  if (y.length === 2) y = Number(y) > 50 ? `19${y}` : `20${y}`
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function addMinutes(hhmm, mins) {
  const [h, m] = hhmm.split(':').map(Number)
  const total = h * 60 + m + mins
  const nh = Math.floor(total / 60) % 24
  const nm = total % 60
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`
}

function minutesBetween(a, b) {
  const [h1, m1] = a.split(':').map(Number)
  const [h2, m2] = b.split(':').map(Number)
  return h2 * 60 + m2 - (h1 * 60 + m1)
}

function hoyYmd() {
  const hoy = new Date()
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
}

/** Fecha de agenda del PDF (cabecera Fecha:04-11-2026) */
export function fechaAgendaDelLote(avisos) {
  for (const a of avisos) {
    const f =
      parseFechaBoletin(a.fecha_encabezado) || parseFechaBoletin(a.fecha)
    if (f) return f
  }
  return ''
}

export function extraerHorarioDeTexto(texto) {
  if (!texto) return ''
  const m = String(texto).match(
    /HORAS?\s*:\s*(\d{1,2}:\d{2}\s*[-–—aA]\s*\d{1,2}:\d{2}|\d{1,2}:\d{2})/i
  )
  return m ? m[1].trim() : ''
}

/**
 * Al cargar un boletín:
 * - TODOS → citaFecha = día de la agenda del PDF
 * - Con HORAS → citaHora + citaOrigen: 'boletin' (preferente)
 * - Varios en misma franja → reparte horas
 */
export function aplicarCitasDesdeHorario(avisos, { forzar = false } = {}) {
  if (!Array.isArray(avisos) || !avisos.length) return avisos

  const fechaAgenda = fechaAgendaDelLote(avisos) || hoyYmd()

  const lista = avisos.map((a) => {
    let horario = limpiarCampo(a.horario)
    if (!horario && a.texto_original) {
      horario = extraerHorarioDeTexto(a.texto_original)
    }
    return {
      ...a,
      horario: horario || a.horario || '',
      fecha_encabezado: limpiarCampo(a.fecha_encabezado) || fechaAgenda,
    }
  })

  const grupos = new Map()
  const sinHora = []

  lista.forEach((a, idx) => {
    const h = parseHorarioBoletin(a.horario)
    if (!h.inicio) {
      sinHora.push(a)
      return
    }
    const key = h.texto || h.inicio
    if (!grupos.has(key)) grupos.set(key, [])
    grupos.get(key).push({ a, idx, h })
  })

  grupos.forEach((items) => {
    const { h } = items[0]
    const inicio = h.inicio
    const fin = h.fin || addMinutes(inicio, 60 * Math.max(items.length, 1))
    const span = Math.max(minutesBetween(inicio, fin), 60)
    const step =
      items.length <= 1 ? 0 : Math.max(30, Math.floor(span / items.length))

    items.forEach(({ a }, i) => {
      const meta = getMeta(a)
      // Respetar citas manuales del técnico (salvo forzar = PDF nuevo)
      if (!forzar && meta.citaOrigen === 'manual' && meta.citaFecha) return

      const hora = i === 0 ? inicio : addMinutes(inicio, step * i)
      setMeta(a, {
        citaFecha: fechaAgenda,
        citaHora: hora,
        citaOrigen: 'boletin',
      })
    })
  })

  // Sin HORAS: solo día de la agenda
  sinHora.forEach((a) => {
    const meta = getMeta(a)
    if (!forzar && meta.citaOrigen === 'manual' && meta.citaFecha) return
    setMeta(a, {
      citaFecha: fechaAgenda,
      ...(forzar && !meta.citaHora ? { citaHora: '', citaOrigen: '' } : {}),
    })
  })

  return lista
}
