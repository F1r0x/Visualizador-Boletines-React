import { useState, useEffect, useMemo } from 'react'
import {
  loadRecordatorioSettings,
  saveRecordatorioSettings,
  dismissRecordatoriosHoy,
  isRecordatoriosDismissedHoy,
  calcularRecordatorios,
  hayRecordatorios,
} from '../utils/recordatorios'

export default function RemindersBanner({ avisos, metaTick, onSelectAviso }) {
  const [settings, setSettings] = useState(loadRecordatorioSettings)
  const [showCfg, setShowCfg] = useState(false)
  const [dismissed, setDismissed] = useState(isRecordatoriosDismissedHoy)

  useEffect(() => {
    setDismissed(isRecordatoriosDismissedHoy())
  }, [avisos, metaTick])

  const rec = useMemo(
    () => calcularRecordatorios(avisos, settings),
    [avisos, metaTick, settings]
  )

  const actualizar = (patch) => {
    setSettings(saveRecordatorioSettings(patch))
  }

  const total =
    rec.citasHoy.length +
    rec.limitesVencidos.length +
    rec.limitesProximos.length

  const mostrarBanner =
    settings.activos && !dismissed && hayRecordatorios(rec)

  return (
    <div className="reminders-wrap">
      <div className="reminders-toolbar">
        <button
          type="button"
          className={`btn-sm ${settings.activos ? 'active' : ''}`}
          onClick={() => actualizar({ activos: !settings.activos })}
          title={settings.activos ? 'Desactivar recordatorios' : 'Activar recordatorios'}
        >
          {settings.activos ? '🔔 Recordatorios ON' : '🔕 Recordatorios OFF'}
        </button>
        <button
          type="button"
          className={`btn-sm ${showCfg ? 'active' : ''}`}
          onClick={() => setShowCfg((v) => !v)}
        >
          Ajustes
        </button>
        {settings.activos && dismissed && total > 0 && (
          <button
            type="button"
            className="btn-sm"
            onClick={() => {
              try {
                localStorage.removeItem('boletines-recordatorios-dismiss')
              } catch {}
              setDismissed(false)
            }}
          >
            Mostrar de nuevo ({total})
          </button>
        )}
      </div>

      {showCfg && (
        <div className="reminders-cfg">
          <label className="rem-check">
            <input
              type="checkbox"
              checked={settings.activos}
              onChange={(e) => actualizar({ activos: e.target.checked })}
            />
            Activar recordatorios al abrir
          </label>
          <label className="rem-check">
            <input
              type="checkbox"
              checked={settings.citasHoy}
              disabled={!settings.activos}
              onChange={(e) => actualizar({ citasHoy: e.target.checked })}
            />
            Citas de hoy
          </label>
          <label className="rem-check">
            <input
              type="checkbox"
              checked={settings.limites}
              disabled={!settings.activos}
              onChange={(e) => actualizar({ limites: e.target.checked })}
            />
            Límites de 1ª visita (vencidos y próximos)
          </label>
          <label className="rem-dias">
            Avisar límites con hasta
            <input
              type="number"
              min={1}
              max={14}
              value={settings.diasAvisoLimite ?? 3}
              disabled={!settings.activos || !settings.limites}
              onChange={(e) =>
                actualizar({
                  diasAvisoLimite: Math.max(
                    1,
                    Math.min(14, Number(e.target.value) || 3)
                  ),
                })
              }
            />
            días de margen
          </label>
        </div>
      )}

      {mostrarBanner && (
        <div className="reminders-banner" role="status">
          <div className="reminders-banner-head">
            <strong>Recordatorios</strong>
            <button
              type="button"
              className="btn-sm"
              onClick={() => {
                dismissRecordatoriosHoy()
                setDismissed(true)
              }}
              title="Ocultar hasta mañana"
            >
              Ocultar hoy
            </button>
          </div>

          {rec.citasHoy.length > 0 && (
            <div className="rem-block">
              <h4>
                Citas de hoy <span className="rem-count">{rec.citasHoy.length}</span>
              </h4>
              <ul>
                {rec.citasHoy.map((c) => (
                  <li key={c.key}>
                    <button
                      type="button"
                      className="rem-link"
                      onClick={() => onSelectAviso?.(c.aviso)}
                    >
                      {c.hora && <em>{c.hora}</em>}
                      {c.nombre}
                      {c.cp && <span className="rem-cp">{c.cp}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {rec.limitesVencidos.length > 0 && (
            <div className="rem-block rem-danger">
              <h4>
                1ª visita vencida{' '}
                <span className="rem-count">{rec.limitesVencidos.length}</span>
              </h4>
              <ul>
                {rec.limitesVencidos.map((c) => (
                  <li key={c.key}>
                    <button
                      type="button"
                      className="rem-link"
                      onClick={() => onSelectAviso?.(c.aviso)}
                    >
                      {c.nombre}
                      <span className="rem-badge danger">
                        {c.limite} ({Math.abs(c.dias)}d)
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {rec.limitesProximos.length > 0 && (
            <div className="rem-block rem-warn">
              <h4>
                1ª visita próxima{' '}
                <span className="rem-count">{rec.limitesProximos.length}</span>
              </h4>
              <ul>
                {rec.limitesProximos.map((c) => (
                  <li key={c.key}>
                    <button
                      type="button"
                      className="rem-link"
                      onClick={() => onSelectAviso?.(c.aviso)}
                    >
                      {c.nombre}
                      <span className="rem-badge warn">
                        {c.limite}
                        {c.dias === 0 ? ' · hoy' : ` · ${c.dias}d`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
