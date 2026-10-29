import { useMemo, useState } from 'react'
import {
  startOfWeek,
  addDays,
  toYMD,
  formatDiaCorto,
  formatDiaLargo,
  avisosPorSemana,
  avisosDelDia,
  labelAvisoCorto,
} from '../utils/calendario'
import { val } from '../utils/parseAvisos'

export default function CalendarioView({ avisos, metaTick, onSelectAviso }) {
  const [anchor, setAnchor] = useState(() => startOfWeek(new Date()))
  const [diaSel, setDiaSel] = useState(() => toYMD(new Date()))

  const weekStart = useMemo(() => startOfWeek(anchor), [anchor])
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  )

  const porDia = useMemo(
    () => avisosPorSemana(avisos, weekStart),
    [avisos, weekStart, metaTick]
  )

  const delDia = useMemo(
    () => avisosDelDia(avisos, diaSel),
    [avisos, diaSel, metaTick]
  )

  const hoy = toYMD(new Date())

  const prevWeek = () => setAnchor(addDays(weekStart, -7))
  const nextWeek = () => setAnchor(addDays(weekStart, 7))
  const thisWeek = () => {
    const s = startOfWeek(new Date())
    setAnchor(s)
    setDiaSel(toYMD(new Date()))
  }

  return (
    <div className="cal-wrap">
      <div className="cal-nav">
        <button type="button" className="btn-sm" onClick={prevWeek}>← Semana</button>
        <button type="button" className="btn-sm" onClick={thisWeek}>Hoy</button>
        <button type="button" className="btn-sm" onClick={nextWeek}>Semana →</button>
        <span className="cal-range">
          {formatDiaCorto(weekStart)} – {formatDiaCorto(addDays(weekStart, 6))}
        </span>
      </div>

      <div className="cal-grid">
        {days.map((d) => {
          const ymd = toYMD(d)
          const items = porDia[ymd] || []
          const isHoy = ymd === hoy
          const isSel = ymd === diaSel
          return (
            <button
              key={ymd}
              type="button"
              className={`cal-day${isHoy ? ' hoy' : ''}${isSel ? ' sel' : ''}`}
              onClick={() => setDiaSel(ymd)}
            >
              <div className="cal-day-head">{formatDiaCorto(d)}</div>
              <div className="cal-day-count">
                {items.length === 0 ? '—' : `${items.length} aviso${items.length > 1 ? 's' : ''}`}
              </div>
              <ul className="cal-day-list">
                {items.slice(0, 3).map(({ aviso: a, meta }) => (
                  <li key={avisoKeySafe(a)}>
                    {meta.citaHora && <strong>{meta.citaHora}</strong>}{' '}
                    {labelAvisoCorto(a).slice(0, 22)}
                    {meta.franja && meta.franja !== 'Sin franja' ? ` · ${meta.franja}` : ''}
                  </li>
                ))}
                {items.length > 3 && <li className="more">+{items.length - 3} más</li>}
              </ul>
            </button>
          )
        })}
      </div>

      <div className="cal-ruta">
        <h3>Ruta del día · {formatDiaLargo(new Date(diaSel + 'T12:00:00'))}</h3>
        {delDia.length === 0 ? (
          <p className="hist-empty">No hay avisos citados este día. Asigna fecha en la tarjeta del aviso.</p>
        ) : (
          <ol className="ruta-list">
            {delDia.map(({ aviso: a, meta }, idx) => (
              <li key={avisoKeySafe(a)}>
                <span className="ruta-num">{idx + 1}</span>
                <div className="ruta-body">
                  <button type="button" className="ruta-title" onClick={() => onSelectAviso?.(a)}>
                    {meta.citaHora || '—:—'} · {labelAvisoCorto(a)}
                    {meta.franja && meta.franja !== 'Sin franja' && (
                      <span className={`franja-tag franja-${meta.franja.toLowerCase()}`}>{meta.franja}</span>
                    )}
                  </button>
                  <div className="ruta-meta">
                    {[val(a.direccion?.completa), val(a.direccion?.codigo_postal)].filter(Boolean).join(' · ') || 'Sin dirección'}
                    {val(a.aparato?.marca) && ` · ${val(a.aparato.marca)}`}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}

function avisoKeySafe(a) {
  return String(a?.aviso ?? a?.orden ?? Math.random())
}
