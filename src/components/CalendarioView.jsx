import { useMemo, useState } from 'react'
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

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

export default function CalendarioView({ avisos, metaTick, onSelectAviso, onMetaChange }) {
  const [modo, setModo] = useState('mes')
  const [anchor, setAnchor] = useState(() => startOfMonth(new Date()))
  const [diaSel, setDiaSel] = useState(() => toYMD(new Date()))
  const [asignando, setAsignando] = useState(null)
  const [panel, setPanel] = useState('ruta')

  const hoy = toYMD(new Date())
  const monthStart = useMemo(() => startOfMonth(anchor), [anchor])
  const weekStart = useMemo(() => startOfWeek(anchor), [anchor])

  const celdas = useMemo(() => {
    if (modo === 'semana') {
      return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
    }
    return celdasDelMes(monthStart)
  }, [modo, monthStart, weekStart])

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
    setPanel('ruta')
    if (asignando) {
      setMeta(asignando, { citaFecha: ymd })
      onMetaChange?.()
      setAsignando(null)
    }
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
        </div>
        <div className="cal-stats">
          <span className="cal-stat"><strong>{totalCitados}</strong> citados</span>
          <span className="cal-stat muted"><strong>{sinCita.length}</strong> sin cita</span>
        </div>
      </div>

      {asignando && (
        <div className="cal-assign-banner">
          Elige un día en el calendario para citar: <strong>{labelAvisoCorto(asignando)}</strong>
          <button type="button" className="btn-sm" onClick={() => setAsignando(null)}>Cancelar</button>
        </div>
      )}

      <div className="cal-layout">
        <div className={`cal-board ${modo}`}>
          <div className="cal-weekdays">
            {WEEKDAYS.map((w) => <div key={w} className="cal-wd">{w}</div>)}
          </div>
          <div className={`cal-grid ${modo === 'semana' ? 'week' : 'month'}`}>
            {celdas.map((d) => {
              const ymd = toYMD(d)
              const items = porDia[ymd] || []
              const isHoy = ymd === hoy
              const isSel = ymd === diaSel
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
                    {items.slice(0, modo === 'semana' ? 8 : 4).map(({ aviso: a, meta }) => (
                      <li key={avisoKeySafe(a)} className={`cal-chip ${estadoClass(meta.estado)} ${meta.franja === 'Urgencia' ? 'urg' : ''}`} title={labelAvisoCorto(a)}>
                        {meta.citaHora && <em>{meta.citaHora}</em>}
                        <span>{labelAvisoCorto(a)}</span>
                      </li>
                    ))}
                    {items.length > (modo === 'semana' ? 8 : 4) && (
                      <li className="more">+{items.length - (modo === 'semana' ? 8 : 4)}</li>
                    )}
                  </ul>
                </button>
              )
            })}
          </div>
        </div>

        <aside className="cal-side">
          <div className="cal-side-tabs">
            <button type="button" className={panel === 'ruta' ? 'btn-sm active' : 'btn-sm'} onClick={() => setPanel('ruta')}>Día seleccionado</button>
            <button type="button" className={panel === 'sin-cita' ? 'btn-sm active' : 'btn-sm'} onClick={() => setPanel('sin-cita')}>Sin cita ({sinCita.length})</button>
          </div>

          {panel === 'ruta' && (
            <div className="cal-ruta">
              <h3>{formatDiaLargo(new Date(diaSel + 'T12:00:00'))}</h3>
              {delDia.length > 0 && rutaMaps && (
                <a className="btn-sm cal-maps-btn" href={rutaMaps} target="_blank" rel="noopener noreferrer">
                  Abrir ruta en Maps ({delDia.length})
                </a>
              )}
              {delDia.length === 0 ? (
                <p className="hist-empty">No hay avisos este día.{sinCita.length > 0 && ' Usa «Sin cita» para asignar uno pulsando un día.'}</p>
              ) : (
                <ol className="ruta-list">
                  {delDia.map(({ aviso: a, meta }, idx) => (
                    <li key={avisoKeySafe(a)} className="ruta-item">
                      <span className="ruta-num">{idx + 1}</span>
                      <div className="ruta-body">
                        <button type="button" className="ruta-title" onClick={() => onSelectAviso?.(a)}>{labelAvisoCorto(a)}</button>
                        <div className="ruta-meta">
                          {[val(a.direccion?.completa), val(a.direccion?.codigo_postal)].filter(Boolean).join(' · ') || 'Sin dirección'}
                          {val(a.aparato?.marca) && ` · ${val(a.aparato.marca)}`}
                        </div>
                        <div className="ruta-controls">
                          <input type="time" value={meta.citaHora || ''} onChange={(e) => asignarHora(a, e.target.value)} title="Hora" />
                          <select value={meta.franja || 'Sin franja'} onChange={(e) => asignarFranja(a, e.target.value)}>
                            {FRANJAS.map((f) => <option key={f} value={f}>{f}</option>)}
                          </select>
                          <span className={`estado-pill ${estadoClass(meta.estado)}`}>{meta.estado || 'Pendiente'}</span>
                          <button type="button" className="btn-sm" onClick={() => quitarCita(a)} title="Quitar cita">Quitar</button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}

          {panel === 'sin-cita' && (
            <div className="cal-ruta">
              <h3>Pendientes de citar</h3>
              <p className="cal-hint">Pulsa <strong>Citar</strong> y luego el día en el calendario.</p>
              {sinCita.length === 0 ? (
                <p className="hist-empty">Todos los avisos tienen cita asignada.</p>
              ) : (
                <ul className="sin-cita-list">
                  {sinCita.map(({ aviso: a, meta }) => (
                    <li key={avisoKeySafe(a)}>
                      <div>
                        <button type="button" className="ruta-title" onClick={() => onSelectAviso?.(a)}>{labelAvisoCorto(a)}</button>
                        <div className="ruta-meta">
                          {val(a.direccion?.codigo_postal) || '—'}
                          {val(a.aparato?.tipo) && ` · ${val(a.aparato.tipo)}`}
                          <span className={`estado-pill ${estadoClass(meta.estado)}`}>{meta.estado}</span>
                        </div>
                      </div>
                      <button type="button" className="btn-sm active" onClick={() => { setAsignando(a); setPanel('ruta') }}>Citar</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

function avisoKeySafe(a) {
  return String(a?.aviso ?? a?.orden ?? Math.random())
}
