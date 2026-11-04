import { getMeta, avisoKey } from './localMeta'
import { val } from './parseAvisos'

const CACHE_KEY = 'boletines-offline-v1'

function hoyYmd() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Guarda un snapshot de avisos + meta relevante para uso sin red.
 * Prioriza citas de hoy; si no hay, guarda el lote actual completo (máx. 80).
 */
export function guardarCacheOffline(avisos) {
  if (!Array.isArray(avisos) || avisos.length === 0) return null
  const hoy = hoyYmd()
  const enriquecidos = avisos.map((a) => {
    const meta = getMeta(a)
    return {
      ...a,
      _meta: {
        estado: meta.estado,
        nota: meta.nota,
        citaFecha: meta.citaFecha,
        citaHora: meta.citaHora,
        citaOrigen: meta.citaOrigen,
        franja: meta.franja,
      },
    }
  })

  const delHoy = enriquecidos.filter((a) => a._meta?.citaFecha === hoy)
  const payload = {
    savedAt: new Date().toISOString(),
    fechaAgenda: hoy,
    count: enriquecidos.length,
    countHoy: delHoy.length,
    avisos: (delHoy.length > 0 ? delHoy : enriquecidos).slice(0, 80),
  }

  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload))
  } catch (e) {
    console.warn('Cache offline llena o no disponible', e)
    try {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ ...payload, avisos: delHoy.slice(0, 40) })
      )
    } catch {}
  }
  return payload
}

export function cargarCacheOffline() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data?.avisos?.length) return null
    return data
  } catch {
    return null
  }
}

export function aplicarMetaDesdeCache(avisos) {
  if (!Array.isArray(avisos)) return avisos
  return avisos.map(({ _meta, ...rest }) => rest)
}

export function infoCacheOffline() {
  const c = cargarCacheOffline()
  if (!c) return null
  return {
    savedAt: c.savedAt,
    fechaAgenda: c.fechaAgenda,
    count: c.avisos?.length || 0,
    countHoy: c.countHoy || 0,
  }
}

export function isOnline() {
  return typeof navigator === 'undefined' ? true : navigator.onLine
}
