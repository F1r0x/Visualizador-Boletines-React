import { useState, useEffect, useRef, useMemo } from 'react'
import {
  listPreparaciones,
  createPreparacion,
  updatePreparacion,
  deletePreparacion,
  fileToDataUrlCompressed,
  makeEnlaceAdjunto,
  emptyPieza,
} from '../utils/preparaciones'
import {
  isSupabaseConfigured,
  cloudUpsertPreparacion,
  cloudSearchPreparaciones,
  cloudListPreparaciones,
  cloudDeletePreparacion,
} from '../utils/db'

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
  const [cloudBusy, setCloudBusy] = useState(false)
  const fileRef = useRef(null)

  const selected = draft || list.find((p) => p.id === selectedId) || null
  const refresh = () => setList(listPreparaciones())

  const marcasDisponibles = useMemo(() => {
    const s = new Set()
    list.forEach((p) => { if (p.marca?.trim()) s.add(p.marca.trim()) })
    return [...s].sort()
  }, [list])

  const tiposDisponibles = useMemo(() => {
    const s = new Set()
    list.forEach((p) => { if (p.tipo?.trim()) s.add(p.tipo.trim()) })
    return [...s].sort()
  }, [list])

  const listFiltrada = useMemo(() => {
    const q = filtroQ.trim().toLowerCase()
    return list.filter((p) => {
      if (filtroMarca && (p.marca || '') !== filtroMarca) return false
      if (filtroTipo && (p.tipo || '') !== filtroTipo) return false
      if (filtroModelo.trim() && !(p.modelo || '').toLowerCase().includes(filtroModelo.trim().toLowerCase())) return false
      if (!q) return true
      const blob = [p.titulo, p.marca, p.modelo, p.tipo, p.avisoRef, p.notas, ...(p.piezas || []).map((x) => `${x.ref} ${x.descripcion}`)].filter(Boolean).join(' ').toLowerCase()
      return blob.includes(q)
    })
  }, [list, filtroQ, filtroMarca, filtroTipo, filtroModelo])

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
    setDraft({ ...p, piezas: [...(p.piezas || [])], checklist: [...(p.checklist || [])], adjuntos: [...(p.adjuntos || [])] })
    setMsg('')
  }

  const patchDraft = (fields) => setDraft((d) => (d ? { ...d, ...fields } : d))

  const guardar = () => {
    if (!draft?.id) return
    setSaving(true)
    try {
      updatePreparacion(draft.id, {
        titulo: draft.titulo, marca: draft.marca, modelo: draft.modelo, tipo: draft.tipo,
        avisoRef: draft.avisoRef, notas: draft.notas,
        piezas: draft.piezas || [], checklist: draft.checklist || [], adjuntos: draft.adjuntos || [],
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

  const eliminar = async () => {
    if (!draft?.id) return
    if (!window.confirm('¿Eliminar esta preparación?')) return
    const id = draft.id
    deletePreparacion(id)
    setSelectedId(null)
    setDraft(null)
    refresh()
    if (isSupabaseConfigured) {
      try { await cloudDeletePreparacion(id) } catch {}
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
        titulo: draft.titulo, marca: draft.marca, modelo: draft.modelo, tipo: draft.tipo,
        avisoRef: draft.avisoRef, notas: draft.notas,
        piezas: draft.piezas || [], checklist: draft.checklist || [], adjuntos: draft.adjuntos || [],
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
      setMsg(remote.adjuntosTruncados
        ? 'Guardado en la nube (fotos muy grandes quedan solo en este dispositivo; los enlaces sí se sincronizan).'
        : 'Guardado en la nube. Podrás recuperarla en otros dispositivos.')
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
        q: filtroQ, marca: filtroMarca, tipo: filtroTipo, modelo: filtroModelo,
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

  const removePieza = (id) => patchDraft({ piezas: (draft.piezas || []).filter((x) => x.id !== id) })
  const toggleCheck = (id) => {
    patchDraft({
      checklist: (draft.checklist || []).map((c) => c.id === id ? { ...c, done: !c.done } : c),
    })
  }
  const addCheck = () => {
    const text = checkText.trim()
    if (!text) return
    patchDraft({
      checklist: [...(draft.checklist || []), { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, text, done: false }],
    })
    setCheckText('')
  }
  const removeCheck = (id) => patchDraft({ checklist: (draft.checklist || []).filter((c) => c.id !== id) })

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

  const removeAdjunto = (id) => patchDraft({ adjuntos: (draft.adjuntos || []).filter((a) => a.id !== id) })

  useEffect(() => { setList(listPreparaciones()) }, [])

  return (
    <div className="prep-wrap">
      <div className="prep-toolbar">
        <div>
          <h2 className="prep-title">Preparaciones</h2>
          <p className="prep-sub">
            Fichas individuales: modelo, piezas, fotos y notas. Guárdalas en la nube para consultarlas en cualquier dispositivo.
          </p>
        </div>
        <div className="prep-toolbar-actions">
          <button type="button" className="btn" onClick={openNew}>+ Nueva preparación</button>
          {isSupabaseConfigured && (
            <button type="button" className="btn btn-secondary" onClick={sincronizarTodas} disabled={cloudBusy}>Sync nube</button>
          )}
        </div>
      </div>

      <div className="prep-filters">
        <input type="search" className="search-input" placeholder="Buscar título, modelo, pieza, notas…" value={filtroQ} onChange={(e) => setFiltroQ(e.target.value)} />
        <select className="filter-select" value={filtroMarca} onChange={(e) => setFiltroMarca(e.target.value)}>
          <option value="">Todas las marcas</option>
          {marcasDisponibles.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select className="filter-select" value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
          <option value="">Todos los tipos</option>
          {tiposDisponibles.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input className="filter-select" placeholder="Modelo…" value={filtroModelo} onChange={(e) => setFiltroModelo(e.target.value)} />
        {isSupabaseConfigured && (
          <button type="button" className="btn-sm" onClick={buscarEnNube} disabled={cloudBusy} title="Buscar en Supabase e importar">Buscar en nube</button>
        )}
        {(filtroQ || filtroMarca || filtroTipo || filtroModelo) && (
          <button type="button" className="btn-sm" onClick={() => { setFiltroQ(''); setFiltroMarca(''); setFiltroTipo(''); setFiltroModelo('') }}>Limpiar</button>
        )}
      </div>

      {msg && (
        <div className={`status ${msg.includes('Error') || msg.includes('espacio') ? 'error' : 'success'}`}>{msg}</div>
      )}

      {!isSupabaseConfigured && (
        <p className="prep-hint">
          Para guardar en la nube: ejecuta <code>supabase/preparaciones.sql</code> en el SQL Editor de Supabase y configura las variables de entorno.
        </p>
      )}

      <div className="prep-layout">
        <aside className="prep-list-panel">
          {listFiltrada.length === 0 ? (
            <p className="hist-empty">{list.length === 0 ? 'Aún no hay preparaciones. Crea una para empezar.' : 'Ninguna ficha coincide con los filtros.'}</p>
          ) : (
            <ul className="prep-list">
              {listFiltrada.map((p) => (
                <li key={p.id}>
                  <button type="button" className={`prep-list-item ${selectedId === p.id ? 'active' : ''}`} onClick={() => openItem(p.id)}>
                    <span className="prep-list-name">{p.titulo || 'Sin título'}</span>
                    <span className="prep-list-meta">{[p.marca, p.modelo].filter(Boolean).join(' · ') || 'Sin modelo'}{p.piezas?.length ? ` · ${p.piezas.length} pieza(s)` : ''}</span>
                    <span className="prep-list-date">{formatFecha(p.actualizado)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="prep-detail">
          {!selected ? (
            <div className="empty-state"><p>Selecciona una preparación o crea una nueva.</p></div>
          ) : (
            <>
              <div className="prep-detail-actions">
                <button type="button" className="btn" onClick={guardar} disabled={saving}>{saving ? 'Guardando…' : 'Guardar local'}</button>
                {isSupabaseConfigured && (
                  <button type="button" className="btn btn-secondary" onClick={guardarEnNube} disabled={cloudBusy || saving}>{cloudBusy ? 'Nube…' : 'Guardar en nube'}</button>
                )}
                <button type="button" className="btn btn-secondary btn-delete-aviso" onClick={eliminar}>Eliminar</button>
              </div>

              <div className="prep-form">
                <label className="prep-field"><span>Título</span>
                  <input value={draft.titulo || ''} onChange={(e) => patchDraft({ titulo: e.target.value })} placeholder="Ej. Horno Bosch mando de funciones" />
                </label>
                <div className="prep-grid-3">
                  <label className="prep-field"><span>Marca</span>
                    <input value={draft.marca || ''} onChange={(e) => patchDraft({ marca: e.target.value })} placeholder="BOSCH, BALAY…" />
                  </label>
                  <label className="prep-field"><span>Modelo / KI</span>
                    <input value={draft.modelo || ''} onChange={(e) => patchDraft({ modelo: e.target.value })} placeholder="HRG6767S2/58" />
                  </label>
                  <label className="prep-field"><span>Tipo aparato</span>
                    <input value={draft.tipo || ''} onChange={(e) => patchDraft({ tipo: e.target.value })} placeholder="HORNO, VITRO…" />
                  </label>
                </div>
                <label className="prep-field"><span>Nº aviso (opcional)</span>
                  <input value={draft.avisoRef || ''} onChange={(e) => patchDraft({ avisoRef: e.target.value })} placeholder="903293" />
                </label>
                <label className="prep-field"><span>Notas / descripción</span>
                  <textarea rows={4} value={draft.notas || ''} onChange={(e) => patchDraft({ notas: e.target.value })} placeholder="Qué hay que hacer, trucos, síntomas…" />
                </label>

                <div className="prep-block">
                  <h3>Piezas a montar</h3>
                  <div className="piezas-add prep-piezas-add">
                    <input placeholder="Referencia" value={piezaRef} onChange={(e) => setPiezaRef(e.target.value)} />
                    <input placeholder="Descripción" value={piezaDesc} onChange={(e) => setPiezaDesc(e.target.value)} />
                    <input type="number" min={1} style={{ width: '4rem' }} value={piezaCant} onChange={(e) => setPiezaCant(e.target.value)} title="Cantidad" />
                    <button type="button" className="btn-sm" onClick={addPieza}>Añadir</button>
                  </div>
                  {(draft.piezas || []).length === 0 ? <p className="hist-empty">Sin piezas todavía.</p> : (
                    <ul className="piezas-list">
                      {(draft.piezas || []).map((pz) => (
                        <li key={pz.id}>
                          <span>{pz.cantidad > 1 ? `${pz.cantidad}× ` : ''}<strong>{pz.ref || '—'}</strong>{pz.descripcion ? ` · ${pz.descripcion}` : ''}</span>
                          <button type="button" className="btn-x" onClick={() => removePieza(pz.id)}>×</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="prep-block">
                  <h3>Checklist antes de salir</h3>
                  <ul className="checklist">
                    {(draft.checklist || []).map((c) => (
                      <li key={c.id} className="check-item-row">
                        <label className="check-item">
                          <input type="checkbox" checked={!!c.done} onChange={() => toggleCheck(c.id)} />
                          <span className={c.done ? 'done' : ''}>{c.text}</span>
                        </label>
                        <button type="button" className="btn-x" onClick={() => removeCheck(c.id)}>×</button>
                      </li>
                    ))}
                  </ul>
                  <div className="piezas-add">
                    <input placeholder="Nuevo ítem del checklist" value={checkText} onChange={(e) => setCheckText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCheck() } }} />
                    <button type="button" className="btn-sm" onClick={addCheck}>Añadir</button>
                  </div>
                </div>

                <div className="prep-block">
                  <h3>Fotos, manuales y enlaces</h3>
                  <div className="prep-adj-actions">
                    <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onPickImage} />
                    <button type="button" className="btn-sm" onClick={() => fileRef.current?.click()} disabled={saving}>📷 Añadir foto</button>
                  </div>
                  <div className="piezas-add prep-enlace-row">
                    <input placeholder="URL (Drive, YouTube, manual…)" value={enlaceUrl} onChange={(e) => setEnlaceUrl(e.target.value)} />
                    <input placeholder="Nombre (opcional)" value={enlaceNombre} onChange={(e) => setEnlaceNombre(e.target.value)} />
                    <button type="button" className="btn-sm" onClick={addEnlace}>Añadir enlace</button>
                  </div>
                  <p className="prep-hint">Las fotos se comprimen. Los vídeos grandes mejor como enlace.</p>
                  {(draft.adjuntos || []).length === 0 ? <p className="hist-empty">Sin adjuntos.</p> : (
                    <div className="prep-adjuntos">
                      {(draft.adjuntos || []).map((a) => (
                        <div key={a.id} className="prep-adj-card">
                          {a.tipo === 'imagen' && a.dataUrl ? (
                            <a href={a.dataUrl} target="_blank" rel="noopener noreferrer"><img src={a.dataUrl} alt={a.nombre} className="prep-thumb" /></a>
                          ) : (
                            <a className="prep-link-card" href={a.url} target="_blank" rel="noopener noreferrer">{a.tipo === 'video' ? '🎬' : '🔗'} {a.nombre || a.url}</a>
                          )}
                          <div className="prep-adj-foot">
                            <span className="prep-adj-name">{a.nombre}</span>
                            <button type="button" className="btn-x" onClick={() => removeAdjunto(a.id)} title="Quitar">×</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
