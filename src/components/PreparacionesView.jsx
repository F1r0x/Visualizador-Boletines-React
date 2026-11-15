import { useState, useEffect, useRef, useMemo } from 'react'
import {
  listPreparaciones,
  createPreparacion,
  updatePreparacion,
  deletePreparacion,
  fileToDataUrlCompressed,
  makeEnlaceAdjunto,
  emptyPieza,
  isPrepCompletada,
  setPreparacionCompletada,
} from '../utils/preparaciones'
import {
  isSupabaseConfigured,
  cloudUpsertPreparacion,
  cloudSearchPreparaciones,
  cloudListPreparaciones,
  cloudDeletePreparacion,
} from '../utils/db'
import LazyImage from './LazyImage'

function formatFecha(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function mergeCloudIntoLocal(cloudPrep) {
  const local = listPreparaciones().find((p) => p.id === cloudPrep.id)
  const adjuntosCloud = cloudPrep.adjuntos || []
  let adjuntos = adjuntosCloud
  if (local?.adjuntos?.length) {
    const byId = new Map(local.adjuntos.map((a) => [a.id, a]))
    adjuntos = adjuntosCloud.map((a) => {
      if (a.localOnly && byId.get(a.id)?.dataUrl) return byId.get(a.id)
      return a
    })
    for (const a of local.adjuntos) {
      if (!adjuntos.some((x) => x.id === a.id)) adjuntos.push(a)
    }
  }
  const saved = updatePreparacion(cloudPrep.id, {
    titulo: cloudPrep.titulo,
    marca: cloudPrep.marca,
    modelo: cloudPrep.modelo,
    tipo: cloudPrep.tipo,
    avisoRef: cloudPrep.avisoRef,
    notas: cloudPrep.notas,
    piezas: cloudPrep.piezas || [],
    checklist: cloudPrep.checklist || [],
    adjuntos,
    completada: !!cloudPrep.completada,
    completadaEn: cloudPrep.completadaEn || '',
  })
  if (!saved) {
    const list = listPreparaciones()
    const item = {
      id: cloudPrep.id,
      titulo: cloudPrep.titulo || 'Preparación',
      marca: cloudPrep.marca || '',
      modelo: cloudPrep.modelo || '',
      tipo: cloudPrep.tipo || '',
      avisoRef: cloudPrep.avisoRef || '',
      notas: cloudPrep.notas || '',
      piezas: cloudPrep.piezas || [],
      checklist: cloudPrep.checklist || [],
      adjuntos,
      completada: !!cloudPrep.completada,
      completadaEn: cloudPrep.completadaEn || '',
      creado: cloudPrep.creado || new Date().toISOString(),
      actualizado: cloudPrep.actualizado || new Date().toISOString(),
    }
    try {
      localStorage.setItem(
        'boletines-preparaciones-v1',
        JSON.stringify([item, ...list].slice(0, 40))
      )
    } catch {}
    return item
  }
  return saved
}

export default function PreparacionesView() {
  const [list, setList] = useState(() => listPreparaciones())
  const [selectedId, setSelectedId] = useState(null)
  const [draft, setDraft] = useState(null)
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)
  const [enlaceUrl, setEnlaceUrl] = useState('')
  const [enlaceNombre, setEnlaceNombre] = useState('')
  const [piezaRef, setPiezaRef] = useState('')
  const [piezaDesc, setPiezaDesc] = useState('')
  const [piezaCant, setPiezaCant] = useState(1)
  const [checkText, setCheckText] = useState('')
  const [filtroQ, setFiltroQ] = useState('')
  const [filtroMarca, setFiltroMarca] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroModelo, setFiltroModelo] = useState('')
  const [filtroActividad, setFiltroActividad] = useState('activas')
  const [cloudBusy, setCloudBusy] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(null)
  const fileRef = useRef(null)
  const touchStartX = useRef(null)

  const selected = draft || list.find((p) => p.id === selectedId) || null
  const refresh = () => setList(listPreparaciones())

  const galleryImages = useMemo(() => {
    const listAdj = draft?.adjuntos || []
    return listAdj
      .filter((a) => a.tipo === 'imagen' && a.dataUrl)
      .map((a) => ({ id: a.id, src: a.dataUrl, nombre: a.nombre || 'Foto' }))
  }, [draft?.adjuntos])

  const lightboxItem =
    lightboxIndex != null && galleryImages[lightboxIndex]
      ? galleryImages[lightboxIndex]
      : null

  const openGalleryAt = (adjuntoId) => {
    const idx = galleryImages.findIndex((g) => g.id === adjuntoId)
    setLightboxIndex(idx >= 0 ? idx : 0)
  }

  const galleryPrev = () => {
    if (!galleryImages.length) return
    setLightboxIndex((i) =>
      i == null ? 0 : (i - 1 + galleryImages.length) % galleryImages.length
    )
  }

  const galleryNext = () => {
    if (!galleryImages.length) return
    setLightboxIndex((i) => (i == null ? 0 : (i + 1) % galleryImages.length))
  }

  useEffect(() => {
    if (lightboxIndex == null) return
    const onKey = (e) => {
      if (e.key === 'Escape') setLightboxIndex(null)
      if (e.key === 'ArrowLeft') galleryPrev()
      if (e.key === 'ArrowRight') galleryNext()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [lightboxIndex, galleryImages.length])

  useEffect(() => {
    if (lightboxIndex == null) return
    if (!galleryImages.length) {
      setLightboxIndex(null)
      return
    }
    if (lightboxIndex >= galleryImages.length) {
      setLightboxIndex(galleryImages.length - 1)
    }
  }, [galleryImages.length, lightboxIndex])

  const marcasDisponibles = useMemo(() => {
    const s = new Set()
    list.forEach((p) => {
      if (p.marca?.trim()) s.add(p.marca.trim())
    })
    return [...s].sort()
  }, [list])

  const tiposDisponibles = useMemo(() => {
    const s = new Set()
    list.forEach((p) => {
      if (p.tipo?.trim()) s.add(p.tipo.trim())
    })
    return [...s].sort()
  }, [list])

  const listFiltrada = useMemo(() => {
    const q = filtroQ.trim().toLowerCase()
    return list.filter((p) => {
      const done = isPrepCompletada(p)
      if (filtroActividad === 'activas' && done) return false
      if (filtroActividad === 'completadas' && !done) return false
      if (filtroMarca && (p.marca || '') !== filtroMarca) return false
      if (filtroTipo && (p.tipo || '') !== filtroTipo) return false
      if (
        filtroModelo.trim() &&
        !(p.modelo || '').toLowerCase().includes(filtroModelo.trim().toLowerCase())
      )
        return false
      if (!q) return true
      const blob = [
        p.titulo,
        p.marca,
        p.modelo,
        p.tipo,
        p.avisoRef,
        p.notas,
        ...(p.piezas || []).map((x) => `${x.ref} ${x.descripcion}`),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return blob.includes(q)
    })
  }, [list, filtroQ, filtroMarca, filtroTipo, filtroModelo, filtroActividad])

  const openNew = () => {
    const item = createPreparacion({ titulo: 'Nueva preparación' })
    refresh()
    setSelectedId(item.id)
    setDraft({ ...item })
    setMsg('Preparación creada. Completa los datos.')
  }

  const openItem = (id) => {
    const p = listPreparaciones().find((x) => x.id === id)
    if (!p) return
    setSelectedId(id)
    setDraft({
      ...p,
      piezas: [...(p.piezas || [])],
      checklist: [...(p.checklist || [])],
      adjuntos: [...(p.adjuntos || [])],
    })
    setMsg('')
  }

  const patchDraft = (fields) => setDraft((d) => (d ? { ...d, ...fields } : d))

  const guardar = () => {
    if (!draft?.id) return
    setSaving(true)
    try {
      updatePreparacion(draft.id, {
        titulo: draft.titulo,
        marca: draft.marca,
        modelo: draft.modelo,
        tipo: draft.tipo,
        avisoRef: draft.avisoRef,
        citaFecha: draft.citaFecha || '',
        citaHora: draft.citaHora || '',
        notas: draft.notas,
        piezas: draft.piezas || [],
        checklist: draft.checklist || [],
        adjuntos: draft.adjuntos || [],
        completada: !!draft.completada,
        completadaEn: draft.completadaEn || '',
      })
      refresh()
      setMsg('Guardado local.')
      setTimeout(() => setMsg(''), 2000)
    } catch (e) {
      setMsg(e.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const toggleCompletada = () => {
    if (!draft?.id) return
    const next = !isPrepCompletada(draft)
    const updated = setPreparacionCompletada(draft.id, next)
    if (updated) {
      setDraft({
        ...updated,
        piezas: [...(updated.piezas || [])],
        checklist: [...(updated.checklist || [])],
        adjuntos: [...(updated.adjuntos || [])],
      })
      refresh()
      setMsg(next ? 'Ficha marcada como realizada.' : 'Ficha reabierta (activa).')
      setTimeout(() => setMsg(''), 2500)
    }
  }

  const eliminar = async () => {
    if (!draft?.id) return
    if (!window.confirm('¿Eliminar esta preparación?')) return
    const id = draft.id
    deletePreparacion(id)
    setSelectedId(null)
    setDraft(null)
    refresh()
    if (isSupabaseConfigured) {
      try {
        await cloudDeletePreparacion(id)
      } catch {}
    }
    setMsg('Eliminada.')
  }

  const guardarEnNube = async () => {
    if (!draft?.id) return
    if (!isSupabaseConfigured) {
      setMsg('Configura Supabase para guardar en la nube.')
      return
    }
    try {
      updatePreparacion(draft.id, {
        titulo: draft.titulo,
        marca: draft.marca,
        modelo: draft.modelo,
        tipo: draft.tipo,
        avisoRef: draft.avisoRef,
        citaFecha: draft.citaFecha || '',
        citaHora: draft.citaHora || '',
        notas: draft.notas,
        piezas: draft.piezas || [],
        checklist: draft.checklist || [],
        adjuntos: draft.adjuntos || [],
        completada: !!draft.completada,
        completadaEn: draft.completadaEn || '',
      })
      refresh()
    } catch (e) {
      setMsg(e.message || 'Error al guardar local')
      return
    }
    setCloudBusy(true)
    setMsg('Subiendo a la nube…')
    try {
      const actual = listPreparaciones().find((p) => p.id === draft.id) || draft
      const remote = await cloudUpsertPreparacion(actual)
      setMsg(
        remote.adjuntosTruncados
          ? 'Guardado en la nube (fotos grandes solo en este dispositivo).'
          : 'Guardado en la nube.'
      )
    } catch (e) {
      setMsg(`Error nube: ${e.message}`)
    } finally {
      setCloudBusy(false)
    }
  }

  const buscarEnNube = async () => {
    if (!isSupabaseConfigured) {
      setMsg('Configura Supabase para buscar en la nube.')
      return
    }
    setCloudBusy(true)
    setMsg('Buscando en la nube…')
    try {
      const results = await cloudSearchPreparaciones({
        q: filtroQ,
        marca: filtroMarca,
        tipo: filtroTipo,
        modelo: filtroModelo,
      })
      if (!results.length) {
        setMsg('No hay resultados en la nube con esos filtros.')
        return
      }
      for (const r of results) mergeCloudIntoLocal(r)
      refresh()
      setMsg(`Importadas / actualizadas ${results.length} ficha(s) desde la nube.`)
    } catch (e) {
      setMsg(`Error búsqueda nube: ${e.message}`)
    } finally {
      setCloudBusy(false)
    }
  }

  const sincronizarTodas = async () => {
    if (!isSupabaseConfigured) {
      setMsg('Configura Supabase primero.')
      return
    }
    setCloudBusy(true)
    try {
      const remotas = await cloudListPreparaciones(80)
      for (const r of remotas) mergeCloudIntoLocal(r)
      const locales = listPreparaciones()
      for (const p of locales) await cloudUpsertPreparacion(p)
      refresh()
      setMsg(`Sincronizado: ${remotas.length} desde nube · ${locales.length} locales subidas.`)
    } catch (e) {
      setMsg(`Error sync: ${e.message}`)
    } finally {
      setCloudBusy(false)
    }
  }

  const addPieza = () => {
    const ref = piezaRef.trim()
    const desc = piezaDesc.trim()
    if (!ref && !desc) return
    const p = emptyPieza()
    p.ref = ref
    p.descripcion = desc
    p.cantidad = Number(piezaCant) || 1
    patchDraft({ piezas: [...(draft.piezas || []), p] })
    setPiezaRef('')
    setPiezaDesc('')
    setPiezaCant(1)
  }

  const removePieza = (id) =>
    patchDraft({ piezas: (draft.piezas || []).filter((x) => x.id !== id) })

  const toggleCheck = (id) => {
    patchDraft({
      checklist: (draft.checklist || []).map((c) =>
        c.id === id ? { ...c, done: !c.done } : c
      ),
    })
  }

  const addCheck = () => {
    const text = checkText.trim()
    if (!text) return
    patchDraft({
      checklist: [
        ...(draft.checklist || []),
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          text,
          done: false,
        },
      ],
    })
    setCheckText('')
  }

  const removeCheck = (id) =>
    patchDraft({ checklist: (draft.checklist || []).filter((c) => c.id !== id) })

  const onPickImage = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !draft) return
    setSaving(true)
    setMsg('Comprimiendo imagen…')
    try {
      const adj = await fileToDataUrlCompressed(file)
      patchDraft({ adjuntos: [...(draft.adjuntos || []), adj] })
      setMsg('Foto añadida (recuerda Guardar).')
    } catch (err) {
      setMsg(err.message || 'Error con la imagen')
    } finally {
      setSaving(false)
    }
  }

  const addEnlace = () => {
    try {
      const adj = makeEnlaceAdjunto(enlaceUrl, enlaceNombre)
      patchDraft({ adjuntos: [...(draft.adjuntos || []), adj] })
      setEnlaceUrl('')
      setEnlaceNombre('')
      setMsg('Enlace añadido (recuerda Guardar).')
    } catch (err) {
      setMsg(err.message)
    }
  }

  const removeAdjunto = (id) =>
    patchDraft({ adjuntos: (draft.adjuntos || []).filter((a) => a.id !== id) })

  useEffect(() => {
    setList(listPreparaciones())
  }, [])

  return (
    <div className="prep-wrap">
      <div className="prep-toolbar">
        <div>
          <h2 className="prep-title">Preparaciones</h2>
          <p className="prep-sub">
            Fichas: modelo, piezas, fotos y notas. Usa «Marcar realizada» al terminar.
          </p>
        </div>
        <div className="prep-toolbar-actions">
          <button type="button" className="btn" onClick={openNew}>
            + Nueva preparación
          </button>
          {isSupabaseConfigured && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={sincronizarTodas}
              disabled={cloudBusy}
            >
              Sync nube
            </button>
          )}
        </div>
      </div>

      <div className="prep-filters">
        <select
          className="filter-select"
          value={filtroActividad}
          onChange={(e) => setFiltroActividad(e.target.value)}
          title="Activas o realizadas"
        >
          <option value="activas">Solo activas</option>
          <option value="completadas">Solo realizadas</option>
          <option value="todas">Todas</option>
        </select>
        <input
          type="search"
          className="search-input"
          placeholder="Buscar título, modelo, pieza, notas…"
          value={filtroQ}
          onChange={(e) => setFiltroQ(e.target.value)}
        />
        <select
          className="filter-select"
          value={filtroMarca}
          onChange={(e) => setFiltroMarca(e.target.value)}
        >
          <option value="">Todas las marcas</option>
          {marcasDisponibles.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <select
          className="filter-select"
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
        >
          <option value="">Todos los tipos</option>
          {tiposDisponibles.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input
          className="filter-select"
          placeholder="Modelo…"
          value={filtroModelo}
          onChange={(e) => setFiltroModelo(e.target.value)}
        />
        {isSupabaseConfigured && (
          <button
            type="button"
            className="btn-sm"
            onClick={buscarEnNube}
            disabled={cloudBusy}
          >
            Buscar en nube
          </button>
        )}
        {(filtroQ || filtroMarca || filtroTipo || filtroModelo) && (
          <button
            type="button"
            className="btn-sm"
            onClick={() => {
              setFiltroQ('')
              setFiltroMarca('')
              setFiltroTipo('')
              setFiltroModelo('')
            }}
          >
            Limpiar
          </button>
        )}
      </div>

      {msg && (
        <div
          className={`status ${
            msg.includes('Error') || msg.includes('espacio') ? 'error' : 'success'
          }`}
        >
          {msg}
        </div>
      )}

      <div className="prep-layout">
        <aside className="prep-list-panel">
          {listFiltrada.length === 0 ? (
            <p className="hist-empty">
              {list.length === 0
                ? 'Aún no hay preparaciones. Crea una para empezar.'
                : 'Ninguna ficha coincide con los filtros.'}
            </p>
          ) : (
            <ul className="prep-list">
              {listFiltrada.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className={`prep-list-item ${selectedId === p.id ? 'active' : ''}`}
                    onClick={() => openItem(p.id)}
                  >
                    <span className="prep-list-name">
                      {p.titulo || 'Sin título'}
                      {isPrepCompletada(p) && (
                        <span className="prep-badge-done"> · Hecha</span>
                      )}
                    </span>
                    <span className="prep-list-meta">
                      {[p.marca, p.modelo].filter(Boolean).join(' · ') || 'Sin modelo'}
                      {p.avisoRef ? ` · Av. ${p.avisoRef}` : ''}
                      {p.piezas?.length ? ` · ${p.piezas.length} pieza(s)` : ''}
                    </span>
                    <span className="prep-list-date">{formatFecha(p.actualizado)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="prep-detail">
          {!selected ? (
            <div className="empty-state">
              <p>Selecciona una preparación o crea una nueva.</p>
            </div>
          ) : (
            <>
              <div className="prep-detail-actions">
                <button type="button" className="btn" onClick={guardar} disabled={saving}>
                  {saving ? 'Guardando…' : 'Guardar local'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={toggleCompletada}
                  title={
                    isPrepCompletada(draft)
                      ? 'Volver a activar esta ficha'
                      : 'Marcar como realizada y archivarla'
                  }
                >
                  {isPrepCompletada(draft) ? 'Reabrir ficha' : 'Marcar realizada'}
                </button>
                {isPrepCompletada(draft) && (
                  <span className="prep-status-done">
                    Realizada
                    {draft.completadaEn ? ` · ${formatFecha(draft.completadaEn)}` : ''}
                  </span>
                )}
                {isSupabaseConfigured && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={guardarEnNube}
                    disabled={cloudBusy || saving}
                  >
                    {cloudBusy ? 'Nube…' : 'Guardar en nube'}
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-secondary btn-delete-aviso"
                  onClick={eliminar}
                >
                  Eliminar
                </button>
              </div>

              <div className="prep-form">
                <label className="prep-field">
                  <span>Título</span>
                  <input
                    value={draft.titulo || ''}
                    onChange={(e) => patchDraft({ titulo: e.target.value })}
                    placeholder="Ej. Horno Bosch mando de funciones"
                  />
                </label>
                <div className="prep-grid-3">
                  <label className="prep-field">
                    <span>Marca</span>
                    <input
                      value={draft.marca || ''}
                      onChange={(e) => patchDraft({ marca: e.target.value })}
                      placeholder="BOSCH, BALAY…"
                    />
                  </label>
                  <label className="prep-field">
                    <span>Modelo</span>
                    <input
                      value={draft.modelo || ''}
                      onChange={(e) => patchDraft({ modelo: e.target.value })}
                    />
                  </label>
                  <label className="prep-field">
                    <span>Tipo</span>
                    <input
                      value={draft.tipo || ''}
                      onChange={(e) => patchDraft({ tipo: e.target.value })}
                      placeholder="Horno, vitro…"
                    />
                  </label>
                </div>
                <div className="prep-grid-3">
                  <label className="prep-field">
                    <span>Nº aviso (vínculo)</span>
                    <input
                      value={draft.avisoRef || ''}
                      onChange={(e) => patchDraft({ avisoRef: e.target.value })}
                      placeholder="903293"
                    />
                  </label>
                  <label className="prep-field">
                    <span>Fecha cita</span>
                    <input
                      type="date"
                      value={draft.citaFecha || ''}
                      onChange={(e) => patchDraft({ citaFecha: e.target.value })}
                    />
                  </label>
                  <label className="prep-field">
                    <span>Hora</span>
                    <input
                      type="time"
                      value={draft.citaHora || ''}
                      onChange={(e) => patchDraft({ citaHora: e.target.value })}
                    />
                  </label>
                </div>
                <label className="prep-field">
                  <span>Notas</span>
                  <textarea
                    rows={4}
                    value={draft.notas || ''}
                    onChange={(e) => patchDraft({ notas: e.target.value })}
                    placeholder="Detalles de la reparación…"
                  />
                </label>

                <div className="prep-section">
                  <h3>Piezas</h3>
                  <ul className="prep-piezas">
                    {(draft.piezas || []).map((pz) => (
                      <li key={pz.id} className="pieza-row">
                        <span>
                          {pz.ref && <strong>{pz.ref}</strong>} {pz.descripcion}{' '}
                          {pz.cantidad > 1 ? `×${pz.cantidad}` : ''}
                        </span>
                        <button type="button" className="btn-x" onClick={() => removePieza(pz.id)}>
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="prep-add-row">
                    <input
                      placeholder="Ref."
                      value={piezaRef}
                      onChange={(e) => setPiezaRef(e.target.value)}
                    />
                    <input
                      placeholder="Descripción"
                      value={piezaDesc}
                      onChange={(e) => setPiezaDesc(e.target.value)}
                    />
                    <input
                      type="number"
                      min={1}
                      style={{ width: '4rem' }}
                      value={piezaCant}
                      onChange={(e) => setPiezaCant(e.target.value)}
                    />
                    <button type="button" className="btn-sm" onClick={addPieza}>
                      + Pieza
                    </button>
                  </div>
                </div>

                <div className="prep-section">
                  <h3>Checklist</h3>
                  <ul className="prep-checklist">
                    {(draft.checklist || []).map((c) => (
                      <li key={c.id} className="check-item-row">
                        <label>
                          <input
                            type="checkbox"
                            checked={!!c.done}
                            onChange={() => toggleCheck(c.id)}
                          />
                          <span>{c.text}</span>
                        </label>
                        <button type="button" className="btn-x" onClick={() => removeCheck(c.id)}>
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="prep-add-row">
                    <input
                      placeholder="Nuevo punto…"
                      value={checkText}
                      onChange={(e) => setCheckText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addCheck()}
                    />
                    <button type="button" className="btn-sm" onClick={addCheck}>
                      + Ítem
                    </button>
                  </div>
                </div>

                <div className="prep-section">
                  <h3>Fotos y enlaces</h3>
                  <div className="prep-adjuntos">
                    {(draft.adjuntos || []).map((a) =>
                      a.tipo === 'imagen' && a.dataUrl ? (
                        <button
                          key={a.id}
                          type="button"
                          className="prep-thumb"
                          onClick={() => openGalleryAt(a.id)}
                        >
                          <LazyImage src={a.dataUrl} alt={a.nombre || 'foto'} />
                        </button>
                      ) : (
                        <div key={a.id} className="prep-link-row">
                          <a href={a.url} target="_blank" rel="noreferrer">
                            {a.nombre || a.url}
                          </a>
                          <button
                            type="button"
                            className="btn-x"
                            onClick={() => removeAdjunto(a.id)}
                          >
                            ×
                          </button>
                        </div>
                      )
                    )}
                  </div>
                  <div className="prep-add-row">
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={onPickImage}
                    />
                    <button
                      type="button"
                      className="btn-sm"
                      onClick={() => fileRef.current?.click()}
                      disabled={saving}
                    >
                      + Foto
                    </button>
                    <input
                      placeholder="URL manual / vídeo"
                      value={enlaceUrl}
                      onChange={(e) => setEnlaceUrl(e.target.value)}
                    />
                    <input
                      placeholder="Nombre"
                      value={enlaceNombre}
                      onChange={(e) => setEnlaceNombre(e.target.value)}
                    />
                    <button type="button" className="btn-sm" onClick={addEnlace}>
                      + Enlace
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      {lightboxItem && (
        <div
          className="prep-lightbox"
          onClick={() => setLightboxIndex(null)}
          onTouchStart={(e) => {
            touchStartX.current = e.changedTouches[0]?.clientX
          }}
          onTouchEnd={(e) => {
            const x = e.changedTouches[0]?.clientX
            if (touchStartX.current == null || x == null) return
            const d = x - touchStartX.current
            if (d > 50) galleryPrev()
            if (d < -50) galleryNext()
            touchStartX.current = null
          }}
        >
          <button
            type="button"
            className="prep-lightbox-close"
            onClick={() => setLightboxIndex(null)}
          >
            ×
          </button>
          {galleryImages.length > 1 && (
            <>
              <button
                type="button"
                className="prep-lightbox-nav prev"
                onClick={(e) => {
                  e.stopPropagation()
                  galleryPrev()
                }}
              >
                ‹
              </button>
              <button
                type="button"
                className="prep-lightbox-nav next"
                onClick={(e) => {
                  e.stopPropagation()
                  galleryNext()
                }}
              >
                ›
              </button>
            </>
          )}
          <img
            src={lightboxItem.src}
            alt={lightboxItem.nombre}
            onClick={(e) => e.stopPropagation()}
          />
          <div className="prep-lightbox-caption">
            {lightboxItem.nombre} ({(lightboxIndex || 0) + 1}/{galleryImages.length})
          </div>
        </div>
      )}
    </div>
  )
}
