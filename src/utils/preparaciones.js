const KEY = 'boletines-preparaciones-v1'
const MAX_ENTRIES = 40
const MAX_IMG_BYTES = 450_000

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function listPreparaciones() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function saveAll(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_ENTRIES)))
  } catch (e) {
    console.warn('No se pudo guardar preparaciones (¿espacio?)', e)
    throw new Error(
      'No hay espacio suficiente. Reduce el tamaño de las fotos o elimina preparaciones antiguas.'
    )
  }
}

export function getPreparacion(id) {
  return listPreparaciones().find((p) => p.id === id) || null
}

export function createPreparacion(partial = {}) {
  const now = new Date().toISOString()
  const item = {
    id: uid(),
    titulo: partial.titulo || 'Nueva preparación',
    marca: partial.marca || '',
    modelo: partial.modelo || '',
    tipo: partial.tipo || '',
    avisoRef: partial.avisoRef || '',
    notas: partial.notas || '',
    piezas: Array.isArray(partial.piezas) ? partial.piezas : [],
    checklist: Array.isArray(partial.checklist)
      ? partial.checklist
      : [
          { id: uid(), text: 'Pieza preparada / en furgoneta', done: false },
          { id: uid(), text: 'Herramientas necesarias', done: false },
          { id: uid(), text: 'Manual / esquema revisado', done: false },
        ],
    adjuntos: Array.isArray(partial.adjuntos) ? partial.adjuntos : [],
    creado: now,
    actualizado: now,
  }
  const list = [item, ...listPreparaciones()]
  saveAll(list)
  return item
}

export function updatePreparacion(id, patch) {
  const list = listPreparaciones()
  const i = list.findIndex((p) => p.id === id)
  if (i < 0) return null
  list[i] = {
    ...list[i],
    ...patch,
    id: list[i].id,
    creado: list[i].creado,
    actualizado: new Date().toISOString(),
  }
  saveAll(list)
  return list[i]
}

export function deletePreparacion(id) {
  const list = listPreparaciones().filter((p) => p.id !== id)
  saveAll(list)
  return list
}

export function fileToDataUrlCompressed(file, maxSide = 1280, quality = 0.72) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type?.startsWith('image/')) {
      reject(new Error('Solo se admiten imágenes'))
      return
    }
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Imagen no válida'))
      img.onload = () => {
        let { width, height } = img
        const scale = Math.min(1, maxSide / Math.max(width, height))
        width = Math.round(width * scale)
        height = Math.round(height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        let q = quality
        let dataUrl = canvas.toDataURL('image/jpeg', q)
        while (dataUrl.length > MAX_IMG_BYTES && q > 0.35) {
          q -= 0.08
          dataUrl = canvas.toDataURL('image/jpeg', q)
        }
        if (dataUrl.length > MAX_IMG_BYTES * 1.4) {
          reject(
            new Error(
              'La imagen sigue siendo demasiado grande. Usa una foto más ligera.'
            )
          )
          return
        }
        resolve({
          id: uid(),
          tipo: 'imagen',
          nombre: file.name || 'foto.jpg',
          mime: 'image/jpeg',
          dataUrl,
          size: dataUrl.length,
        })
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

export function makeEnlaceAdjunto(url, nombre = '') {
  const u = String(url || '').trim()
  if (!u) throw new Error('Indica una URL')
  return {
    id: uid(),
    tipo: /youtu\.?be|vimeo|video/i.test(u) ? 'video' : 'enlace',
    nombre: nombre || u.slice(0, 60),
    url: u,
  }
}

export function emptyPieza() {
  return { id: uid(), ref: '', descripcion: '', cantidad: 1 }
}
