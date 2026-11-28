import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  listRecambios,
  importFromFacturaPayload,
  setEstadoRecambio,
  updateRecambio,
  deleteRecambio,
  deleteByFactura,
  statsRecambios,
  listadoADevolver,
  listadoConsulta,
  accionesDisponibles,
  ESTADOS_RECAMBIO,
  ESTADO_LABEL,
  ESTADO_COLOR,
  labelEstado,
  applyRemoteRecambios,
} from '../utils/recambios'
import {
  isSupabaseConfigured,
  cloudUpsertRecambiosBatch,
  cloudListRecambios,
  cloudDeleteRecambio,
  cloudDeleteRecambiosByFactura,
} from '../utils/recambiosCloud'

function formatMoney(n) {
  if (n == null || Number.isNaN(Number(n))) return '—'
  return Number(n).toLocaleString('es-ES', {
    style: 'currency',
    currency: 'EUR',
  })
}

function formatFecha(s) {
  if (!s) return ''
  if (/^\d{2}\.\d{2}\.\d{4}/.test(s)) return s
  try {
    return new Date(s).toLocaleString('es-ES')
  } catch {
    return String(s)
  }
}

export default function RecambiosView({ onChange }) {
  const [tick, setTick] = useState(0)
  const [importText, setImportText] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const [error, setError] = useState('')
  const [cloudBusy, setCloudBusy] = useState(false)
  const [cloudMsg, setCloudMsg] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroAviso, setFiltroAviso] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [vistaStock, setVistaStock] = useState(false)
  const [notasDraft, setNotasDraft] = useState('')

  const refresh = useCallback(() => {
    setTick((t) => t + 1)
    onChange?.()
  }, [onChange])

  const pushToCloud = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setCloudMsg('Supabase no configurado (variables de entorno).')
      return
    }
    setCloudBusy(true)
    setCloudMsg('')
    setError('')
    try {
      const items = listRecambios()
      const res = await cloudUpsertRecambiosBatch(items)
      setCloudMsg(`Nube: guardados ${res.upserted} recambio(s).`)
      refresh()
    } catch (e) {
      setError(`Error nube: ${e.message || e}`)
    } finally {
      setCloudBusy(false)
    }
  }, [refresh])

  const pullFromCloud = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setCloudMsg('Supabase no configurado (variables de entorno).')
      return
    }
    setCloudBusy(true)
    setCloudMsg('')
    setError('')
    try {
      const remote = await cloudListRecambios()
      const res = applyRemoteRecambios(remote)
      setCloudMsg(
        `Nube: cargados ${res.remote} · total local tras fusionar ${res.total}.`
      )
      refresh()
    } catch (e) {
      setError(`Error nube: ${e.message || e}`)
    } finally {
      setCloudBusy(false)
    }
  }, [refresh])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!isSupabaseConfigured()) return
      try {
        const remote = await cloudListRecambios()
        if (cancelled) return
        if (remote.length) {
          applyRemoteRecambios(remote)
          setTick((t) => t + 1)
          setCloudMsg(`Sincronizado desde nube: ${remote.length} recambio(s).`)
        }
      } catch (e) {
        if (!cancelled) console.warn('[recambios pull]', e)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const onEv = () => setTick((t) => t + 1)
    window.addEventListener('boletines-recambios-changed', onEv)
    return () => window.removeEventListener('boletines-recambios-changed', onEv)
  }, [])

  const all = useMemo(() => listRecambios(), [tick])
  const stats = useMemo(() => statsRecambios(), [tick])
  const aDevolver = useMemo(() => listadoADevolver(), [tick])
  const enConsulta = useMemo(() => listadoConsulta(), [tick])

  const avisosDisponibles = useMemo(() => {
    const set = new Set()
    all.forEach((r) => {
      if (r.aviso) set.add(r.aviso)
      if (r.utilizado_en_aviso) set.add(r.utilizado_en_aviso)
    })
    return [...set].sort()
  }, [all])

  const facturasDisponibles = useMemo(() => {
    const set = new Set(all.map((r) => r.factura).filter(Boolean))
    return [...set].sort().reverse()
  }, [all])

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return all.filter((r) => {
      if (filtroEstado && r.estado !== filtroEstado) return false
      if (filtroAviso) {
        const a = filtroAviso
        if (r.aviso !== a && r.utilizado_en_aviso !== a) return false
      }
      if (q) {
        const blob = [
          r.material,
          r.descripcion,
          r.aviso,
          r.utilizado_en_aviso,
          r.factura,
          r.pedido_bsh,
          r.notas,
          ESTADO_LABEL[r.estado],
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!blob.includes(q)) return false
      }
      return true
    })
  }, [all, filtroEstado, filtroAviso, busqueda])

  const selected = useMemo(
    () => all.find((r) => r.id === selectedId) || null,
    [all, selectedId]
  )

  useEffect(() => {
    setNotasDraft(selected?.notas || '')
  }, [selected?.id, selected?.notas])

  const onImport = () => {
    setError('')
    setImportMsg('')
    try {
      const data = JSON.parse(importText)
      const payload = Array.isArray(data) ? data[0] : data
      const res = importFromFacturaPayload(payload)
      setImportMsg(
        `Importados ${res.added} · omitidos ${res.skipped} (duplicados) · total ${res.total}` +
          (res.factura ? ` · factura ${res.factura}` : '')
      )
      setImportText('')
      setShowImport(false)
      refresh()
      if (isSupabaseConfigured() && res.added > 0) {
        cloudUpsertRecambiosBatch(listRecambios())
          .then((r) => setCloudMsg(`Nube: subidos ${r.upserted} tras importar.`))
          .catch((e) => setError(`Error nube: ${e.message || e}`))
      }
    } catch (e) {
      setError(e.message || String(e))
    }
  }

  const cambiarEstado = (id, estado) => {
    setError('')
    try {
      setEstadoRecambio(id, estado)
      refresh()
      if (isSupabaseConfigured()) {
        cloudUpsertRecambiosBatch(listRecambios()).catch((e) =>
          console.warn('[recambios auto-push]', e)
        )
      }
    } catch (e) {
      setError(e.message || String(e))
    }
  }

  const guardarNotas = () => {
    if (!selected) return
    updateRecambio(selected.id, { notas: notasDraft })
    refresh()
    if (isSupabaseConfigured()) {
      cloudUpsertRecambiosBatch(listRecambios()).catch((e) =>
        console.warn('[recambios auto-push]', e)
      )
    }
  }

  const onDelete = (id) => {
    if (!window.confirm('¿Eliminar este recambio del listado local y de la nube?')) return
    deleteRecambio(id)
    if (selectedId === id) setSelectedId(null)
    refresh()
    if (isSupabaseConfigured()) {
      cloudDeleteRecambio(id).catch((e) =>
        console.warn('[recambios cloud delete]', e)
      )
    }
  }

  const onDeleteFactura = (fac) => {
    if (!window.confirm(`¿Eliminar todos los recambios de la factura ${fac} (local y nube)?`)) return
    deleteByFactura(fac)
    setSelectedId(null)
    refresh()
    if (isSupabaseConfigured()) {
      cloudDeleteRecambiosByFactura(fac).catch((e) =>
        console.warn('[recambios cloud delete factura]', e)
      )
    }
  }

  return (
    <div className="rec-wrap">
      <div className="rec-toolbar">
        <div>
          <h2 className="rec-title">Recambios / almacén</h2>
          <p className="rec-sub">
            Facturas BSH · estados: Pedido → Recibido → Furgoneta / Utilizado / Devolver · Consulta
            (incidencia)
          </p>
        </div>
        <div className="rec-toolbar-actions">
          <button type="button" className="btn-sm" onClick={() => setShowImport((v) => !v)}>
            {showImport ? 'Cerrar import' : 'Importar JSON factura'}
          </button>
          <button
            type="button"
            className={`btn-sm${vistaStock ? ' primary' : ''}`}
            onClick={() => setVistaStock((v) => !v)}
          >
            {vistaStock ? 'Ver listado' : 'Vista stock'}
          </button>
          <button
            type="button"
            className="btn-sm primary"
            disabled={cloudBusy || !isSupabaseConfigured()}
            onClick={pushToCloud}
            title="Guardar todos los recambios en Supabase"
          >
            {cloudBusy ? 'Sincronizando…' : 'Guardar en nube'}
          </button>
          <button
            type="button"
            className="btn-sm"
            disabled={cloudBusy || !isSupabaseConfigured()}
            onClick={pullFromCloud}
            title="Cargar y fusionar recambios desde Supabase"
          >
            Cargar de nube
          </button>
        </div>
      </div>

      <div className="rec-stats">
        <button
          type="button"
          className={`rec-stat${filtroEstado === '' ? ' active' : ''}`}
          onClick={() => setFiltroEstado('')}
        >
          <span className="num">{stats.total}</span>
          <span className="label">Total</span>
        </button>
        {ESTADOS_RECAMBIO.map((e) => (
          <button
            key={e}
            type="button"
            className={`rec-stat${filtroEstado === e ? ' active' : ''}`}
            style={{ borderColor: ESTADO_COLOR[e] }}
            onClick={() => setFiltroEstado(filtroEstado === e ? '' : e)}
          >
            <span className="num" style={{ color: ESTADO_COLOR[e] }}>
              {stats[e] || 0}
            </span>
            <span className="label">{ESTADO_LABEL[e]}</span>
          </button>
        ))}
        <div className="rec-stat rec-stat-money">
          <span className="num" style={{ color: ESTADO_COLOR.a_devolver }}>
            {formatMoney(stats.valor_a_devolver)}
          </span>
          <span className="label">A devolver €</span>
        </div>
      </div>

      {error && <div className="rec-error">{error}</div>}
      {cloudMsg && <div className="rec-import-msg">{cloudMsg}</div>}

      {showImport && (
        <div className="rec-import">
          <p className="rec-import-hint">
            Pega el JSON de respuesta del webhook de facturas (objeto con factura +
            lineas).
          </p>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={8}
            placeholder='{ "factura": {...}, "lineas": [...] }'
          />
          <div className="rec-import-actions">
            <button type="button" className="btn-sm primary" onClick={onImport}>
              Importar
            </button>
            {importMsg && <span className="rec-import-msg">{importMsg}</span>}
          </div>
        </div>
      )}

      <div className="rec-filters">
        <input
          type="search"
          className="search-input"
          placeholder="Buscar material, aviso, factura…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <select
          className="filter-select"
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
        >
          <option value="">Todos los estados</option>
          {ESTADOS_RECAMBIO.map((e) => (
            <option key={e} value={e}>
              {ESTADO_LABEL[e]}
            </option>
          ))}
        </select>
        <select
          className="filter-select"
          value={filtroAviso}
          onChange={(e) => setFiltroAviso(e.target.value)}
        >
          <option value="">Todos los avisos</option>
          {avisosDisponibles.map((a) => (
            <option key={a} value={a}>
              Aviso {a}
            </option>
          ))}
        </select>
        {(filtroEstado || filtroAviso || busqueda) && (
          <button
            type="button"
            className="btn-sm"
            onClick={() => {
              setFiltroEstado('')
              setFiltroAviso('')
              setBusqueda('')
            }}
          >
            Limpiar
          </button>
        )}
      </div>

      {aDevolver.length > 0 && filtroEstado !== 'a_devolver' && (
        <div className="rec-banner-devolver">
          <strong>{aDevolver.length}</strong> pieza(s) marcadas para devolver a BSH ·{' '}
          {formatMoney(stats.valor_a_devolver)}
          <button
            type="button"
            className="btn-sm"
            onClick={() => {
              setFiltroEstado('a_devolver')
              setVistaStock(false)
            }}
          >
            Ver listado
          </button>
        </div>
      )}

      {enConsulta.length > 0 && filtroEstado !== 'consulta' && (
        <div className="rec-banner-consulta">
          <strong>{enConsulta.length}</strong> pieza(s) en consulta / incidencia ·{' '}
          {formatMoney(stats.valor_consulta || 0)}
          <button
            type="button"
            className="btn-sm"
            onClick={() => {
              setFiltroEstado('consulta')
              setVistaStock(false)
            }}
          >
            Ver incidencias
          </button>
        </div>
      )}

      {vistaStock ? (
        <div className="rec-stock">
          <p className="rec-sub">Agrupado por referencia de material</p>
          {filtrados.length === 0 ? (
            <div className="rec-empty">No hay piezas con los filtros actuales.</div>
          ) : (
            <ul className="rec-stock-list">
              {(() => {
                const map = new Map()
                for (const r of filtrados) {
                  const k = r.material || 'sin_ref'
                  if (!map.has(k)) {
                    map.set(k, {
                      material: r.material,
                      descripcion: r.descripcion,
                      cantidad: 0,
                      valor: 0,
                      estados: {},
                    })
                  }
                  const g = map.get(k)
                  g.cantidad += r.cantidad || 1
                  g.valor += r.valor_neto || 0
                  g.estados[r.estado] = (g.estados[r.estado] || 0) + (r.cantidad || 1)
                }
                return [...map.values()].map((g) => (
                  <li key={g.material}>
                    <div className="rec-stock-main">
                      <strong>{g.material}</strong>
                      <span className="rec-qty">×{g.cantidad}</span>
                    </div>
                    <div className="rec-stock-meta">
                      {g.descripcion} · {formatMoney(g.valor)}
                      <br />
                      {Object.entries(g.estados)
                        .map(([e, c]) => `${labelEstado(e)}: ${c}`)
                        .join(' · ')}
                    </div>
                  </li>
                ))
              })()}
            </ul>
          )}
        </div>
      ) : (
        <div className="rec-layout">
          <div className="rec-list-panel">
            {filtrados.length === 0 ? (
              <div className="rec-empty">
                {all.length === 0
                  ? 'Aún no hay recambios. Importa el JSON de una factura BSH.'
                  : 'Ningún recambio coincide con los filtros.'}
              </div>
            ) : (
              <ul className="rec-list">
                {filtrados.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      className={`rec-list-item${selectedId === r.id ? ' active' : ''}`}
                      onClick={() => setSelectedId(r.id)}
                    >
                      <div className="rec-list-top">
                        <span
                          className="rec-badge"
                          style={{ background: ESTADO_COLOR[r.estado] || '#666' }}
                        >
                          {labelEstado(r.estado)}
                        </span>
                        <span className="rec-mat">{r.material || '—'}</span>
                        {r.aviso && <span className="rec-aviso">Aviso {r.aviso}</span>}
                      </div>
                      <p className="rec-desc">{r.descripcion || 'Sin descripción'}</p>
                      <p className="rec-list-meta">
                        {formatMoney(r.valor_neto)} · Fact. {r.factura || '—'}
                        {r.pedido_bsh ? ` · Ped. ${r.pedido_bsh}` : ''}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rec-detail">
            {!selected ? (
              <div className="rec-empty">Selecciona una pieza para ver el detalle y cambiar el estado.</div>
            ) : (
              <>
                <div className="rec-detail-header">
                  <div>
                    <h3 className="rec-detail-title">
                      {selected.material}{' '}
                      <span
                        className="rec-badge"
                        style={{ background: ESTADO_COLOR[selected.estado] || '#666' }}
                      >
                        {labelEstado(selected.estado)}
                      </span>
                    </h3>
                    <p className="rec-desc">{selected.descripcion}</p>
                  </div>
                  <button
                    type="button"
                    className="btn-sm btn-danger"
                    onClick={() => onDelete(selected.id)}
                  >
                    Eliminar
                  </button>
                </div>

                <dl className="rec-dl">
                  <dt>Cantidad</dt>
                  <dd>{selected.cantidad}</dd>
                  <dt>Valor neto</dt>
                  <dd>{formatMoney(selected.valor_neto)}</dd>
                  <dt>Factura</dt>
                  <dd>{selected.factura || '—'}</dd>
                  <dt>Pedido BSH</dt>
                  <dd>{selected.pedido_bsh || '—'}</dd>
                  <dt>Aviso</dt>
                  <dd>{selected.aviso || selected.utilizado_en_aviso || '—'}</dd>
                  <dt>Fecha factura</dt>
                  <dd>{selected.fecha_factura || '—'}</dd>
                </dl>

                <div className="rec-actions">
                  <div className="rec-actions-label">Cambiar estado</div>
                  <div className="rec-actions-btns">
                    {accionesDisponibles(selected).map((a) => (
                      <button
                        key={a.estado}
                        type="button"
                        className="btn-sm"
                        style={{ borderColor: a.color, color: a.color }}
                        onClick={() => cambiarEstado(selected.id, a.estado)}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rec-field">
                  <label htmlFor="rec-notas">Notas</label>
                  <textarea
                    id="rec-notas"
                    value={notasDraft}
                    onChange={(e) => setNotasDraft(e.target.value)}
                    onBlur={guardarNotas}
                    placeholder="Incidencia, seguimiento con BSH, ubicación…"
                  />
                </div>

                {Array.isArray(selected.historial_estados) && selected.historial_estados.length > 0 && (
                  <div className="rec-hist">
                    <h4>Historial de estados</h4>
                    <ul>
                      {[...selected.historial_estados].reverse().map((h, i) => (
                        <li key={i}>
                          <span
                            className="rec-badge"
                            style={{ background: ESTADO_COLOR[h.estado] || '#666' }}
                          >
                            {labelEstado(h.estado)}
                          </span>
                          <span className="rec-hist-date">{formatFecha(h.en)}</span>
                          {h.origen && <span className="rec-hist-origen">{h.origen}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {facturasDisponibles.length > 0 && (
        <div className="rec-facturas">
          <h4>Facturas importadas</h4>
          <ul>
            {facturasDisponibles.map((f) => {
              const n = all.filter((r) => r.factura === f).length
              return (
                <li key={f}>
                  <span>
                    {f} · {n} línea(s)
                  </span>
                  <button
                    type="button"
                    className="btn-sm btn-danger"
                    onClick={() => onDeleteFactura(f)}
                  >
                    Quitar
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
