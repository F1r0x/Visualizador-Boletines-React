/**
 * Sincronización automática nube-first.
 * - Local = caché / modo offline
 * - Nube = fuente de verdad entre dispositivos
 * - Si no hay red, se encola y se sube al recuperar conexión
 * - Conflictos: last-write-wins + fusión de piezas/checklist/adjuntos
 */

import { isSupabaseConfigured, cloudUpsertPreparacion, cloudSyncMeta, cloudSaveBatch } from './db'
import { listPreparaciones, getPreparacion, updatePreparacion } from './preparaciones'
import { isOnline } from './offlineCache'

const QUEUE_KEY = 'boletines-sync-queue-v1'
const DEBOUNCE_MS = 900

function loadQueue() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    if (!raw) return { preps: [], meta: false, batches: [] }
    const q = JSON.parse(raw)
    return {
      preps: Array.isArray(q.preps) ? q.preps : [],
      meta: !!q.meta,
      batches: Array.isArray(q.batches) ? q.batches : [],
    }
  } catch {
    return { preps: [], meta: false, batches: [] }
  }
}

function saveQueue(q) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q))
  } catch {}
}

function enqueuePrep(id) {
  if (!id) return
  const q = loadQueue()
  if (!q.preps.includes(id)) q.preps.push(id)
  saveQueue(q)
}

function enqueueMeta() {
  const q = loadQueue()
  q.meta = true
  saveQueue(q)
}

function enqueueBatch(nombre, avisos) {
  if (!avisos?.length) return
  const q = loadQueue()
  q.batches.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    nombre: nombre || `Boletín ${new Date().toLocaleString('es-ES')}`,
    avisos,
  })
  q.batches = q.batches.slice(-5)
  saveQueue(q)
}

const timers = { prep: new Map(), meta: null }

export function schedulePrepCloudSync(prepOrId) {
  const id = typeof prepOrId === 'string' ? prepOrId : prepOrId?.id
  if (!id || !isSupabaseConfigured) return
  enqueuePrep(id)
  const prev = timers.prep.get(id)
  if (prev) clearTimeout(prev)
  timers.prep.set(
    id,
    setTimeout(() => {
      timers.prep.delete(id)
      flushPrep(id)
    }, DEBOUNCE_MS)
  )
}

async function flushPrep(id) {
  if (!isSupabaseConfigured) return { ok: false, reason: 'no-config' }
  if (!isOnline()) return { ok: false, reason: 'offline' }

  const prep = getPreparacion(id)
  if (!prep) {
    const q = loadQueue()
    q.preps = q.preps.filter((x) => x !== id)
    saveQueue(q)
    return { ok: true }
  }
  try {
    const saved = await cloudUpsertPreparacion(prep)
    if (saved && saved._conflict?.winner === 'remote') {
      try {
        updatePreparacion(id, {
          titulo: saved.titulo,
          marca: saved.marca,
          modelo: saved.modelo,
          tipo: saved.tipo,
          avisoRef: saved.avisoRef,
          citaFecha: saved.citaFecha || '',
          citaHora: saved.citaHora || '',
          notas: saved.notas,
          piezas: saved.piezas || [],
          checklist: saved.checklist || [],
          adjuntos: saved.adjuntos || [],
          completada: !!saved.completada,
          completadaEn: saved.completadaEn || '',
          actualizado: saved.actualizado,
        })
      } catch {}
      if (typeof window !== 'undefined' && saved._conflict) {
        window.dispatchEvent(
          new CustomEvent('boletines-conflict-resolved', {
            detail: {
              tipo: 'preparacion',
              id,
              winner: saved._conflict.winner,
              summary: saved._conflict.summary,
            },
          })
        )
      }
    }
    const q = loadQueue()
    q.preps = q.preps.filter((x) => x !== id)
    saveQueue(q)
    return { ok: true, conflict: saved?._conflict }
  } catch (err) {
    console.warn('[autoSync prep]', err?.message || err)
    return { ok: false, error: err }
  }
}

export function scheduleMetaCloudSync(avisos) {
  if (!isSupabaseConfigured) return
  enqueueMeta()
  if (timers.meta) clearTimeout(timers.meta)
  timers.meta = setTimeout(async () => {
    timers.meta = null
    if (!isOnline()) return
    try {
      if (avisos?.length) await cloudSyncMeta(avisos)
      const q = loadQueue()
      q.meta = false
      saveQueue(q)
    } catch (err) {
      console.warn('[autoSync meta]', err?.message || err)
    }
  }, DEBOUNCE_MS)
}

export async function autoSaveBatch(nombre, avisos) {
  if (!avisos?.length || !isSupabaseConfigured) return { ok: false, reason: 'skip' }
  if (!isOnline()) {
    enqueueBatch(nombre, avisos)
    return { ok: false, reason: 'offline', queued: true }
  }
  try {
    const batch = await cloudSaveBatch(nombre, avisos)
    return { ok: true, batch }
  } catch (err) {
    console.warn('[autoSync batch]', err?.message || err)
    enqueueBatch(nombre, avisos)
    return { ok: false, error: err, queued: true }
  }
}

export async function flushSyncQueue(opts = {}) {
  if (!isSupabaseConfigured || !isOnline()) {
    return { flushed: false, reason: !isOnline() ? 'offline' : 'no-config' }
  }
  const q = loadQueue()
  const results = { preps: 0, batches: 0, meta: false, errors: [] }

  for (const id of [...q.preps]) {
    const r = await flushPrep(id)
    if (r.ok) results.preps += 1
    else if (r.error) results.errors.push(String(r.error?.message || r.error))
  }

  if (q.batches.length) {
    const remaining = []
    for (const b of q.batches) {
      try {
        await cloudSaveBatch(b.nombre, b.avisos)
        results.batches += 1
      } catch (err) {
        remaining.push(b)
        results.errors.push(err?.message || String(err))
      }
    }
    const q2 = loadQueue()
    q2.batches = remaining
    saveQueue(q2)
  }

  if (q.meta && opts.avisos?.length) {
    try {
      await cloudSyncMeta(opts.avisos)
      const q3 = loadQueue()
      q3.meta = false
      saveQueue(q3)
      results.meta = true
    } catch (err) {
      results.errors.push(err?.message || String(err))
    }
  }

  return { flushed: true, ...results }
}

export async function syncAllPreparacionesNow() {
  if (!isSupabaseConfigured || !isOnline()) return { ok: false }
  const list = listPreparaciones()
  let n = 0
  for (const p of list) {
    try {
      await cloudUpsertPreparacion(p)
      n += 1
    } catch (err) {
      console.warn('[autoSync all preps]', err?.message || err)
    }
  }
  const q = loadQueue()
  q.preps = []
  saveQueue(q)
  return { ok: true, count: n }
}

export function pendingSyncCount() {
  const q = loadQueue()
  return q.preps.length + q.batches.length + (q.meta ? 1 : 0)
}

export function startAutoSyncListeners(getAvisos) {
  if (typeof window === 'undefined') return () => {}

  const onOnline = () => {
    const avisos = typeof getAvisos === 'function' ? getAvisos() : []
    flushSyncQueue({ avisos }).then((r) => {
      if (r.flushed && (r.preps || r.batches || r.meta)) {
        window.dispatchEvent(
          new CustomEvent('boletines-sync-flushed', { detail: r })
        )
      }
    })
  }

  const onPrep = (ev) => {
    const id = ev.detail?.id || ev.detail?.despues?.id || ev.detail?.antes?.id
    if (id) schedulePrepCloudSync(id)
  }

  const onMeta = () => {
    const avisos = typeof getAvisos === 'function' ? getAvisos() : []
    scheduleMetaCloudSync(avisos)
  }

  window.addEventListener('online', onOnline)
  window.addEventListener('boletines-prep-changed', onPrep)
  window.addEventListener('boletines-meta-changed', onMeta)

  if (isOnline()) onOnline()

  return () => {
    window.removeEventListener('online', onOnline)
    window.removeEventListener('boletines-prep-changed', onPrep)
    window.removeEventListener('boletines-meta-changed', onMeta)
  }
}
