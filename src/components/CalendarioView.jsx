import { useMemo, useState, useEffect } from 'react'
import {
  startOfWeek,
  startOfMonth,
  addDays,
  addMonths,
  toYMD,
  formatDiaLargo,
  formatMesAnio,
  celdasDelMes,
  avisosPorFechas,
  avisosDelDia,
  avisosSinCita,
  labelAvisoCorto,
  mapsRutaUrl,
  estadoClass,
} from '../utils/calendario'
import { setMeta, FRANJAS } from '../utils/localMeta'
import { val } from '../utils/parseAvisos'

const WEEKDAYS = [
  { id: 0, label: 'Lun', short: 'L' },
  { id: 1, label: 'Mar', short: 'M' },
  { id: 2, label: 'Mié', short: 'X' },
  { id: 3, label: 'Jue', short: 'J' },
  { id: 4, label: 'Vie', short: 'V' },
  { id: 5, label: 'Sáb', short: 'S' },
  { id: 6, label: 'Dom', short: 'D' },
]

const WORK_DAYS_KEY = 'boletines-work-days'
const DEFAULT_WORK = [0, 1, 2, 3, 4]

function loadWorkDays() {
  try {
    const raw = localStorage.getItem(WORK_DAYS_KEY)
    if (!raw) return DEFAULT_WORK
    const arr = JSON.parse(raw)
    if (Array.isArray(arr) && arr.length > 0) return arr.map(Number)
  } catch {}
  return DEFAULT_WORK
}

function dowMon0(date) {
  const js = date.getDay()
  return js === 0 ? 6 : js - 1
}

export default function CalendarioView({
  avisos,
  metaTick,
  onSelectAviso,
  onMetaChange,
  onDelete,
}) {
  const [modo, setModo] = useState('mes')
  const [anchor, setAnchor] = useState(() => startOfMonth(new Date()))
  const [diaSel, setDiaSel] = useState(() => toYMD(new Date()))
  const [asignando, setAsignando] = useState(null)
  const [showPopup, setShowPopup] = useState(false)
  const [popupTab, setPopupTab] = useState('ruta')
  const [workDays, setWorkDays] = useState(loadWorkDays)
  const [showWorkCfg, setShowWorkCfg] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem(WORK_DAYS_KEY, JSON.stringify(workDays))
    } catch {}
  }, [workDays])

  const hoy = toYMD(new Date())
  const monthStart = useMemo(() => startOfMonth(anchor), [anchor])
  const weekStart = useMemo(() => startOfWeek(anchor), [anchor])

  const workSet = useMemo(() => new Set(workDays), [workDays])
  const headers = useMemo(
    () => WEEKDAYS.filter((w) => workSet.has(w.id)),
    [workSet]
  )
  const nCols = Math.max(headers.length, 1)

  const celdas = useMemo(() => {
    let all
    if (modo === 'semana') {
      all = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
    } else {
      all = celdasDelMes(monthStart)
    }
    return all.filter((d) => workSet.has(dowMon0(d)))
  }, [modo, monthStart, weekStart, workSet])

  const ymds = useMemo(() => celdas.map(toYMD), [celdas])

  const porDia = useMemo(
    () => avisosPorFechas(avisos, ymds),
    [avisos, ymds.join(','), metaTick]
  )

  const delDia = useMemo(
    () => avisosDelDia(avisos, diaSel),
    [avisos, diaSel, metaTick]
  )

  const sinCita = useMemo(
    () => avisosSinCita(avisos),
    [avisos, metaTick]
  )

  const totalCitados = useMemo(() => {
    let n = 0
    Object.values(porDia).forEach((arr) => { n += arr.length })
    return n
  }, [porDia])

  const rutaMaps = useMemo(() => mapsRutaUrl(delDia), [delDia])

  const irHoy = () => {
    const now = new Date()
    setAnchor(modo === 'mes' ? startOfMonth(now) : startOfWeek(now))
    setDiaSel(toYMD(now))
  }

  const prev = () => {
    if (modo === 'mes') setAnchor(addMonths(monthStart, -1))
    else setAnchor(addDays(weekStart, -7))
  }

  const next = () => {
    if (modo === 'mes') setAnchor(addMonths(monthStart, 1))
    else setAnchor(addDays(weekStart, 7))
  }

  const clickDia = (ymd) => {
    setDiaSel(ymd)
    setPopupTab('ruta')
    if (asignando) {
      setMeta(asignando, { citaFecha: ymd })
      onMetaChange?.()
      setAsignando(null)
      setShowPopup(true)
      return
    }
    setShowPopup(true)
  }

  const toggleWorkDay = (id) => {
    setWorkDays((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev
        return prev.filter((x) => x !== id)
      }
      return [...prev, id].sort((a, b) => a - b)
    })
  }

  const asignarHora = (a, hora) => {
    setMeta(a, { citaHora: hora })
    onMetaChange?.()
  }

  const asignarFranja = (a, franja) => {
    const v = franja === 'Sin franja' ? '' : franja
    setMeta(a, { franja: v })
    onMetaChange?.()
  }

  const quitarCita = (a) => {
    setMeta(a, { citaFecha: '', citaHora: '', franja: '' })
    onMetaChange?.()
  }

  const tituloNav =
    modo === 'mes'
      ? formatMesAnio(monthStart)
      : `${formatDiaLargo(weekStart)} – ${addDays(weekStart, 6).getDate()}`

  const maxChips = modo === 'semana' ? 6 : nCols <= 5 ? 4 : 3
  const rowH = modo === 'semana' ? 180 : nCols <= 5 ? 118 : 96

  return (
    <div className="cal-wrap">
      <div className="cal-toolbar">
        <div className="cal-nav">
          <button type="button" className="btn-sm" onClick={prev}>←</button>
          <button type="button" className="btn-sm" onClick={irHoy}>Hoy</button>
          <button type="button" className="btn-sm" onClick={next}>→</button>
          <span className="cal-range">{tituloNav}</span>
        </div>
        <div className="cal-modes">
          <button type="button" className={modo === 'mes' ? 'btn-sm active' : 'btn-sm'} onClick={() => { setModo('mes'); setAnchor(startOfMonth(new Date(diaSel + 'T12:00:00'))) }}>Mes</button>
          <button type="button" className={modo === 'semana' ? 'btn-sm active' : 'btn-sm'} onClick={() => { setModo('semana'); setAnchor(startOfWeek(new Date(diaSel + 'T12:00:00'))) }}>Semana</button>
          <button type="button" className={showWorkCfg ? 'btn-sm active' : 'btn-sm'} onClick={() => setShowWorkCfg((v) => !v)} title="Días laborables">Días</button>
          <button type="button" className="btn-sm" onClick={() => { setPopupTab('sin-cita'); setShowPopup(true) }}>Sin cita ({sinCita.length})</button>
        </div>
        <div className="cal-stats">
          <span className="cal-stat"><strong>{totalCitados}</strong> citados</span>
          <span className="cal-stat muted"><strong>{sinCita.length}</strong> sin cita</span>
        </div>
      </div>

      {showWorkCfg && (
        <div className="cal-work-cfg">
          <span className="cal-work-label">Mostrar en el calendario:</span>
          {WEEKDAYS.map((w) => (
            <label key={w.id} className="cal-work-chip">
              <input type="checkbox" checked={workSet.has(w.id)} onChange={() => toggleWorkDay(w.id)} />
              {w.label}
            </label>
          ))}
          <button type="button" className="btn-sm" onClick={() => setWorkDays(DEFAULT_WORK)}>L–V</button>
          <button type="button" className="btn-sm" onClick={() => setWorkDays([0, 1, 2, 3, 4, 5, 6])}>Todos</button>
        </div>
      )}

      {asignando && (
        <div className="cal-assign-banner">
          Elige un día para citar: <strong>{labelAvisoCorto(asignando)}</strong>
          <button type="button" className="btn-sm" onClick={() => setAsignando(null)}>Cancelar</button>
        </div>
      )}

      <div className={`cal-board full ${modo}`}>
        <div className="cal-weekdays" style={{ gridTemplateColumns: `repeat(${nCols}, minmax(0, 1fr))` }}>
          {headers.map((w) => (
            <div key={w.id} className="cal-wd">{w.label}</div>
          ))}
        </div>
        <div
          className={`cal-grid ${modo === 'semana' ? 'week' : 'month'}`}
          style={{
            gridTemplateColumns: `repeat(${nCols}, minmax(0, 1fr))`,
            gridAutoRows: `${rowH}px`,
          }}
        >
          {celdas.map((d) => {
            const ymd = toYMD(d)
            const items = porDia[ymd] || []
            const isHoy = ymd === hoy
            const isSel = ymd === diaSel && showPopup
            const fueraMes = modo === 'mes' && d.getMonth() !== monthStart.getMonth()
            return (
              <button
                key={ymd}
                type="button"
                className={['cal-day', isHoy ? 'hoy' : '', isSel ? 'sel' : '', fueraMes ? 'fuera' : '', items.length ? 'has-items' : '', asignando ? 'pickable' : ''].filter(Boolean).join(' ')}
                onClick={() => clickDia(ymd)}
              >
                <div className="cal-day-head">
                  <span className="cal-day-num">{d.getDate()}</span>
                  {items.length > 0 && <span className="cal-day-badge">{items.length}</span>}
                </div>
                <ul className="cal-day-list">
                  {items.slice(0, maxChips).map(({ aviso: a, meta }) => (
                    <li
                      key={avisoKeySafe(a)}
                      className={`cal-chip ${estadoClass(meta.estado)} ${meta.franja === 'Urgencia' ? 'urg' : ''}`}
                      title={`${meta.citaHora ? meta.citaHora + ' · ' : ''}${labelAvisoCorto(a)}`}
                    >
                      {meta.citaHora && <em>{meta.citaHora}</em>}
                      {labelAvisoCorto(a)}
                    </li>
                  ))}
                  {items.length > maxChips && (
                    <li className="more">+{items.length - maxChips}</li>
                  )}
                </ul>
              </button>
            )
          })}
        </div>
      </div>

      {showPopup && (
        <div className="cal-popup-overlay" onClick={() => setShowPopup(false)} role="presentation">
          <div className="cal-popup" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="cal-popup-head">
              <div className="cal-side-tabs">
                <button type="button" className={popupTab === 'ruta' ? 'btn-sm active' : 'btn-sm'} onClick={() => setPopupTab('ruta')}>
                  {formatDiaLargo(new Date(diaSel + 'T12:00:00'))}
                </button>
                <button type="button" className={popupTab === 'sin-cita' ? 'btn-sm active' : 'btn-sm'} onClick={() => setPopupTab('sin-cita')}>
                  Sin cita ({sinCita.length})
                </button>
              </div>
              <button type="button" className="btn-sm" onClick={() => setShowPopup(false)} title="Cerrar">✕</button>
            </div>

            {popupTab === 'ruta' && (
              <div className="cal-ruta">
                {delDia.length > 0 && rutaMaps && (
                  <a className="btn-sm cal-maps-btn" href={rutaMaps} target="_blank" rel="noopener noreferrer">
                    Abrir ruta en Maps ({delDia.length})
                  </a>
                )}
                {delDia.length === 0 ? (
                  <p className="hist-empty">
                    No hay avisos este día.
                    {sinCita.length > 0 && ' Cambia a «Sin cita» para asignar uno.'}
                  </p>
                ) : (
                  <ol className="ruta-list">
                    {delDia.map(({ aviso: a, meta }, idx) => (
                      <li key={avisoKeySafe(a)} className="ruta-item">
                        <span className="ruta-num">{idx + 1}</span>
                        <div className="ruta-body">
                          <button type="button" className="ruta-title" onClick={() => { setShowPopup(false); onSelectAviso?.(a) }}>
                            {labelAvisoCorto(a)}
                          </button>
                          <div className="ruta-meta">
                            {[val(a.direccion?.completa), val(a.direccion?.codigo_postal)].filter(Boolean).join(' · ') || 'Sin dirección'}
                            {val(a.aparato?.marca) && ` · ${val(a.aparato.marca)}`}
                          </div>
                          <div className="ruta-controls">
                            <input type="time" value={meta.citaHora || ''} onChange={(e) => asignarHora(a, e.target.value)} />
                            <select value={meta.franja || 'Sin franja'} onChange={(e) => asignarFranja(a, e.target.value)}>
                              {FRANJAS.map((f) => <option key={f} value={f}>{f}</option>)}
                            </select>
                            <span className={`estado-pill ${estadoClass(meta.estado)}`}>{meta.estado || 'Pendiente'}</span>
                            <button type="button" className="btn-sm" onClick={() => quitarCita(a)}>Quitar cita</button>
                            {onDelete && (
                              <button
                                type="button"
                                className="btn-sm btn-delete-aviso"
                                onClick={() => {
                                  const label = a.aviso || a.orden || ''
                                  if (window.confirm(`¿Eliminar el aviso ${label}?`)) onDelete(a)
                                }}
                              >
                                Eliminar
                              </button>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}

            {popupTab === 'sin-cita' && (
              <div className="cal-ruta">
                <p className="cal-hint">Pulsa <strong>Citar</strong>, cierra y elige un día en el calendario.</p>
                {sinCita.length === 0 ? (
                  <p className="hist-empty">Todos los avisos tienen cita.</p>
                ) : (
                  <ul className="sin-cita-list">
                    {sinCita.map(({ aviso: a, meta }) => (
                      <li key={avisoKeySafe(a)}>
                        <div>
                          <button type="button" className="ruta-title" onClick={() => { setShowPopup(false); onSelectAviso?.(a) }}>
                            {labelAvisoCorto(a)}
                          </button>
                          <div className="ruta-meta">
                            {val(a.direccion?.codigo_postal) || '—'}
                            {val(a.aparato?.tipo) && ` · ${val(a.aparato.tipo)}`}
                            <span className={`estado-pill ${estadoClass(meta.estado)}`}>{meta.estado}</span>
                          </div>
                        </div>
                        <button type="button" className="btn-sm active" onClick={() => { setAsignando(a); setShowPopup(false) }}>Citar</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function avisoKeySafe(a) {
  return String(a?.aviso ?? a?.orden ?? Math.random())
}
