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
  accionesDisponibles,
  ESTADOS_RECAMBIO,
  ESTADO_LABEL,
  ESTADO_COLOR,
  labelEstado,
} from '../utils/recambios'

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
    return new Date(s).toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return s
  }
}

export default function RecambiosView({ onChange }) {
  const [tick, setTick] = useState(0)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroAviso, setFiltroAviso] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [vistaStock, setVistaStock] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const [importMsg, setImportMsg] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [error, setError] = useState('')

  const refresh = useCallback(() => {
    setTick((t) => t + 1)
    onChange?.()
  }, [onChange])

  useEffect(() => {
    const onEv = () => setTick((t) => t + 1)
    window.addEventListener('boletines-recambios-changed', onEv)
    return () => window.removeEventListener('boletines-recambios-changed', onEv)
  }, [])

  const all = useMemo(() => listRecambios(), [tick])
  const stats = useMemo(() => statsRecambios(), [tick])
  const aDevolver = useMemo(() => listadoADevolver(), [tick])

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
          r.factura,
          r.pedido_bsh,
          r.notas,
        ]
          .join(' ')
          .toLowerCase()
        if (!blob.includes(q)) return false
      }
      return true
    })
  }, [all, filtroEstado, filtroAviso, busqueda])

  const stockGrouped = useMemo(() => {
    if (!vistaStock) return []
    const vivos = all.filter(
      (r) => r.estado === 'en_furgoneta' || r.estado === 'recibido'
    )
    const map = new Map()
    for (const r of vivos) {
      const k = r.material || 'sin_ref'
      if (!map.has(k)) {
        map.set(k, {
          material: r.material,
          descripcion: r.descripcion,
          cantidad: 0,
          valor_neto: 0,
          items: [],
        })
      }
      const g = map.get(k)
      g.cantidad += r.cantidad || 1
      g.valor_neto = Math.round((g.valor_neto + (r.valor_neto || 0)) * 100) / 100
      g.items.push(r)
    }
    return [...map.values()].sort((a, b) =>
      String(a.material).localeCompare(String(b.material))
    )
  }, [all, vistaStock])

  const selected = selectedId
    ? all.find((r) => r.id === selectedId) || null
    : null

  const cambiarEstado = (id, estado) => {
    setError('')
    try {
      setEstadoRecambio(id, estado, { origen: 'ui' })
      refresh()
    } catch (e) {
      setError(e.message || 'No se pudo cambiar el estado')
    }
  }

  const guardarNotas = (id, notas) => {
    updateRecambio(id, { notas })
    refresh()
  }

  const eliminar = (id) => {
    if (!window.confirm('¿Eliminar este recambio del inventario local?')) return
    deleteRecambio(id)
    if (selectedId === id) setSelectedId(null)
    refresh()
  }

  const importar = () => {
    setImportMsg('')
    setError('')
    try {
      const raw = importText.trim()
      if (!raw) {
        setImportMsg('Pega el JSON de n8n')
        return
      }
      let data = JSON.parse(raw)
      if (Array.isArray(data)) data = data[0] || {}
      if (data.json) data = data.json
      const result = importFromFacturaPayload(data)
      setImportMsg(
        `Factura ${result.factura || '—'}: +${result.added} líneas` +
          (result.skipped ? `, ${result.skipped} ya existían` : '') +
          ` · Total inventario: ${result.total}`
      )
      setImportText('')
      if (result.added > 0) {
        setImportOpen(false)
        setFiltroEstado('recibido')
      }
      refresh()
    } catch (e) {
      setImportMsg('JSON no válido: ' + (e.message || e))
    }
  }

  const borrarFactura = (fac) => {
    if (
      !window.confirm(
        `¿Eliminar todas las líneas de la factura ${fac} del inventario local?`
      )
    )
      return
    deleteByFactura(fac)
    setSelectedId(null)
    refresh()
  }

  return (
    <div className="rec-wrap">
      <div className="rec-toolbar">
        <div>
          <h2 className="rec-title">Recambios</h2>
          <p className="rec-sub">
            Material de facturas BSH · usado, stock y devoluciones
          </p>
        </div>
        <div className="rec-toolbar-actions">
          <button
            type="button"
            className="btn-sm"
            onClick={() => setImportOpen((v) => !v)}
          >
            {importOpen ? 'Cerrar importación' : 'Importar factura (JSON)'}
          </button>
          <button
            type="button"
            className={`btn-sm${vistaStock ? ' active' : ''}`}
            onClick={() => setVistaStock((v) => !v)}
          >
            {vistaStock ? 'Ver lista' : 'Stock por material'}
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
          <span className="num">{formatMoney(stats.valor_stock)}</span>
          <span className="label">Valor stock</span>
        </div>
        <div className="rec-stat rec-stat-money">
          <span className="num" style={{ color: ESTADO_COLOR.a_devolver }}>
            {formatMoney(stats.valor_a_devolver)}
          </span>
          <span className="label">A devolver €</span>
        </div>
      </div>

      {error && <div className="rec-error">{error}</div>}

      {importOpen && (
        <div className="rec-import">
          <p className="rec-import-hint">
            Pega aquí el JSON completo que devuelve el Code node de n8n (con{' '}
            <code>factura</code>, <code>lineas</code>, etc.). Las líneas ya
            importadas no se duplican.
          </p>
          <textarea
            rows={8}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder='{ "factura": {...}, "lineas": [...] }'
          />
          <div className="rec-import-actions">
            <button type="button" className="btn-sm primary" onClick={importar}>
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
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          className="filter-select"
        >
          <option value="">Todos los estados</option>
          {ESTADOS_RECAMBIO.map((e) => (
            <option key={e} value={e}>
              {ESTADO_LABEL[e]}
            </option>
          ))}
        </select>
        <select
          value={filtroAviso}
          onChange={(e) => setFiltroAviso(e.target.value)}
          className="filter-select"
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
          <strong>{aDevolver.length}</strong> pieza(s) marcadas para devolver a
          BSH · {formatMoney(stats.valor_a_devolver)}
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

      {vistaStock ? (
        <div className="rec-stock">
          <h3>Stock por material (recibido + furgoneta)</h3>
          {stockGrouped.length === 0 ? (
            <p className="rec-empty">No hay material en stock.</p>
          ) : (
            <ul className="rec-stock-list">
              {stockGrouped.map((g) => (
                <li key={g.material}>
                  <div className="rec-stock-main">
                    <strong className="rec-mat">{g.material}</strong>
                    <span className="rec-desc">{g.descripcion}</span>
                  </div>
                  <div className="rec-stock-meta">
                    <span className="rec-qty">{g.cantidad} ud.</span>
                    <span>{formatMoney(g.valor_neto)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="rec-layout">
          <div className="rec-list-panel">
            {filtrados.length === 0 ? (
              <p className="rec-empty">
                {all.length === 0
                  ? 'Aún no hay recambios. Importa el JSON de una factura BSH.'
                  : 'Ningún recambio coincide con los filtros.'}
              </p>
            ) : (
              <ul className="rec-list">
                {filtrados.map((r) => (
                  <li
                    key={r.id}
                    className={`rec-list-item${selectedId === r.id ? ' active' : ''}`}
                    onClick={() => setSelectedId(r.id)}
                  >
                    <div className="rec-list-top">
                      <span
                        className="rec-badge"
                        style={{ background: ESTADO_COLOR[r.estado] }}
                      >
                        {labelEstado(r.estado)}
                      </span>
                      <span className="rec-mat">{r.material}</span>
                      {r.aviso && (
                        <span className="rec-aviso">Av. {r.aviso}</span>
                      )}
                    </div>
                    <div className="rec-list-name">{r.descripcion || '—'}</div>
                    <div className="rec-list-meta">
                      <span>{formatMoney(r.valor_neto)}</span>
                      {r.factura && <span>Fac. {r.factura}</span>}
                      {r.fecha_factura && (
                        <span>{formatFecha(r.fecha_factura)}</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rec-detail">
            {!selected ? (
              <p className="rec-empty">Selecciona un recambio para gestionar su estado.</p>
            ) : (
              <>
                <div className="rec-detail-header">
                  <div>
                    <span
                      className="rec-badge"
                      style={{ background: ESTADO_COLOR[selected.estado] }}
                    >
                      {labelEstado(selected.estado)}
                    </span>
                    <h3 className="rec-detail-title">
                      {selected.material}{' '}
                      <span className="rec-desc">{selected.descripcion}</span>
                    </h3>
                  </div>
                  <button
                    type="button"
                    className="btn-sm btn-danger"
                    onClick={() => eliminar(selected.id)}
                  >
                    Eliminar
                  </button>
                </div>

                <dl className="rec-dl">
                  <dt>Aviso pedido</dt>
                  <dd>{selected.aviso || '—'}</dd>
                  <dt>Utilizado en</dt>
                  <dd>{selected.utilizado_en_aviso || '—'}</dd>
                  <dt>Pedido BSH</dt>
                  <dd>{selected.pedido_bsh || '—'}</dd>
                  <dt>Pedido cliente</dt>
                  <dd>{selected.pedido_cliente || '—'}</dd>
                  <dt>Factura</dt>
                  <dd>
                    {selected.factura || '—'}
                    {selected.fecha_factura
                      ? ` · ${formatFecha(selected.fecha_factura)}`
                      : ''}
                  </dd>
                  <dt>Albarán</dt>
                  <dd>{selected.albaran || '—'}</dd>
                  <dt>Cantidad</dt>
                  <dd>{selected.cantidad}</dd>
                  <dt>Precio / neto</dt>
                  <dd>
                    {formatMoney(selected.precio_unidad)} →{' '}
                    {formatMoney(selected.valor_neto)}
                    {selected.descuento_pct != null
                      ? ` (${selected.descuento_pct}%)`
                      : ''}
                  </dd>
                </dl>

                <div className="rec-actions">
                  <span className="rec-actions-label">Cambiar estado</span>
                  <div className="rec-actions-btns">
                    {accionesDisponibles(selected).map((a) => (
                      <button
                        key={a.estado}
                        type="button"
                        className="btn-sm"
                        style={{
                          borderColor: a.color,
                          color: a.color,
                        }}
                        onClick={() => cambiarEstado(selected.id, a.estado)}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="rec-field">
                  <span>Notas</span>
                  <textarea
                    rows={3}
                    defaultValue={selected.notas || ''}
                    key={selected.id + '-notas'}
                    onBlur={(e) => {
                      if (e.target.value !== (selected.notas || '')) {
                        guardarNotas(selected.id, e.target.value)
                      }
                    }}
                    placeholder="Observaciones, ubicación en furgoneta…"
                  />
                </label>

                {selected.historial_estados?.length > 0 && (
                  <div className="rec-hist">
                    <span className="rec-actions-label">Historial</span>
                    <ul>
                      {selected.historial_estados
                        .slice()
                        .reverse()
                        .map((h, i) => (
                          <li key={i}>
                            <span
                              className="rec-badge sm"
                              style={{ background: ESTADO_COLOR[h.estado] }}
                            >
                              {labelEstado(h.estado)}
                            </span>
                            <span className="rec-hist-date">
                              {formatFecha(h.en)}
                            </span>
                            {h.origen && (
                              <span className="rec-hist-origen">{h.origen}</span>
                            )}
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
          <span className="rec-actions-label">Facturas en inventario</span>
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
                    className="btn-sm"
                    onClick={() => borrarFactura(f)}
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
