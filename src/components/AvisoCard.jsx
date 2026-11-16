import { useState, useEffect } from 'react'
import { val, mapsUrl, parseHorarioBoletin } from '../utils/parseAvisos'
import {
  ESTADOS,
  CHECKLIST_ITEMS,
  FRANJAS,
  getMeta,
  setMeta,
  isAvisoCompletado,
} from '../utils/localMeta'
import {
  preparacionesPorAviso,
  createPreparacionFromAviso,
  syncPreparacionesConAviso,
} from '../utils/preparaciones'
import { plantillaWhatsApp } from '../utils/whatsapp'

function formatoDuracion(inicio, fin) {
  if (!inicio || !fin) return ''
  const ms = new Date(fin) - new Date(inicio)
  if (ms < 0) return ''
  const m = Math.round(ms / 60000)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h}h ${r}min` : `${h}h`
}

export default function AvisoCard({
  aviso,
  onMetaChange,
  onDelete,
  onOpenPrep,
  onCreatePrep,
  prepTick,
}) {
  const a = aviso
  const initial = getMeta(a)
  const fichas = preparacionesPorAviso(a)
  const [estado, setEstado] = useState(initial.estado)
  const [nota, setNota] = useState(initial.nota)
  const [checklist, setChecklist] = useState(initial.checklist || {})
  const [inicioVisita, setInicioVisita] = useState(initial.inicioVisita || '')
  const [finVisita, setFinVisita] = useState(initial.finVisita || '')
  const [piezas, setPiezas] = useState(initial.piezas || [])
  const [nuevaPieza, setNuevaPieza] = useState('')
  const [citaFecha, setCitaFecha] = useState(initial.citaFecha || '')
  const [citaHora, setCitaHora] = useState(initial.citaHora || '')
  const [franja, setFranja] = useState(initial.franja || '')
  const [waOk, setWaOk] = useState(false)

  const persist = (patch) => {
    setMeta(a, patch)
    onMetaChange?.()
  }

  useEffect(() => {
    const m = getMeta(a)
    setEstado(m.estado)
    setNota(m.nota)
    setChecklist(m.checklist || {})
    setInicioVisita(m.inicioVisita || '')
    setFinVisita(m.finVisita || '')
    setPiezas(m.piezas || [])
    setCitaFecha(m.citaFecha || '')
    setFranja(m.franja || '')
    const delBoletin = parseHorarioBoletin(a.horario)
    if (m.citaHora) setCitaHora(m.citaHora)
    else if (delBoletin.inicio) {
      setCitaHora(delBoletin.inicio)
      setMeta(a, { citaHora: delBoletin.inicio })
      onMetaChange?.()
    } else setCitaHora('')
  }, [a.aviso, a.orden, a.horario, prepTick])

  useEffect(() => {
    const onMeta = (ev) => {
      const key = String(a.aviso ?? a.orden ?? '')
      const d = ev.detail || {}
      if (d.bulk || !d.key || String(d.key) === key) {
        setPiezas(getMeta(a).piezas || [])
      }
    }
    window.addEventListener('boletines-meta-changed', onMeta)
    return () => window.removeEventListener('boletines-meta-changed', onMeta)
  }, [a.aviso, a.orden])

  const cambiarEstado = (e) => {
    const v = e.target.value
    const antes = estado
    setEstado(v)
    persist({ estado: v })
    if (isAvisoCompletado(v) !== isAvisoCompletado(antes)) {
      syncPreparacionesConAviso(a, isAvisoCompletado(v))
      onCreatePrep?.()
    }
  }

  const añadirPieza = () => {
    const nombre = nuevaPieza.trim()
    if (!nombre) return
    const next = [...piezas, { nombre, cantidad: 1 }]
    setPiezas(next)
    setNuevaPieza('')
    persist({ piezas: next })
  }

  const telList = Array.isArray(a.cliente?.telefonos)
    ? a.cliente.telefonos
    : a.cliente?.telefonos
      ? [String(a.cliente.telefonos)]
      : []

  const checksDone = CHECKLIST_ITEMS.filter((i) => checklist[i]).length
  const duracion = formatoDuracion(inicioVisita, finVisita)
  const estadoClass =
    'estado-' + String(estado).toLowerCase().replace(/\s+/g, '-')

  return (
    <article className={`aviso-card ${estadoClass}`}>
      <div className="aviso-header">
        <div className="header-left">
          <span className="orden">Orden {a.orden ?? '—'}</span>
          <span className="aviso-num">Aviso {a.aviso ?? '—'}</span>
          {a.horario && <span className="badge badge-horario">{a.horario}</span>}
        </div>
        <div className="header-right">
          <select value={estado} onChange={cambiarEstado} className="estado-select">
            {ESTADOS.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
          {onDelete && (
            <button type="button" className="btn-sm btn-delete-aviso" onClick={() => onDelete(a)}>
              Eliminar
            </button>
          )}
        </div>
      </div>

      <div className="aviso-body">
        <div className="grid-3">
          <div className="block">
            <h3>Datos del usuario</h3>
            <p><strong>Nombre:</strong> {val(a.cliente?.nombre) || '—'}</p>
            <p><strong>Teléfono:</strong> {telList.length ? telList.join(', ') : '—'}</p>
            <p><strong>NIF:</strong> {val(a.cliente?.nif) || '—'}</p>
            <p><strong>Dirección:</strong> {val(a.direccion?.completa) || '—'}</p>
            <p><strong>CP:</strong> {val(a.direccion?.codigo_postal) || '—'}</p>
            {val(a.direccion?.completa) && (
              <a className="btn-sm" href={mapsUrl(a.direccion.completa)} target="_blank" rel="noreferrer">
                Abrir en Maps
              </a>
            )}
          </div>
          <div className="block">
            <h3>Datos del aparato</h3>
            <p><strong>Marca:</strong> {val(a.aparato?.marca) || '—'}</p>
            <p><strong>Modelo:</strong> {val(a.aparato?.modelo) || '—'}</p>
            <p><strong>Tipo:</strong> {val(a.aparato?.tipo) || '—'}</p>
          </div>
          <div className="block">
            <h3>Seguro</h3>
            <p><strong>Compañía:</strong> {val(a.seguro?.compania) || '—'}</p>
            <p><strong>Modalidad:</strong> {val(a.seguro?.modalidad) || '—'}</p>
            <p><strong>Expediente:</strong> {val(a.seguro?.expediente) || '—'}</p>
            <p><strong>Urgencia:</strong> {val(a.seguro?.tipo_urgencia) || '—'}</p>
          </div>
        </div>

        <div className="block">
          <h3>Datos de la avería</h3>
          <p className="text-wrap"><strong>Causa:</strong> {val(a.averia?.causa) || '—'}</p>
          <p className="text-wrap"><strong>Síntoma:</strong> {val(a.averia?.sintoma) || '—'}</p>
          <p className="text-wrap"><strong>Diagnóstico:</strong> {val(a.averia?.diagnostico) || '—'}</p>
        </div>

        <div className="block">
          <h3>Notas del técnico</h3>
          <textarea
            rows={3}
            value={nota}
            onChange={(e) => {
              setNota(e.target.value)
              persist({ nota: e.target.value })
            }}
            placeholder="Notas de la visita…"
          />
        </div>

        <div className="grid-2">
          <div className="block">
            <h3>Cita planificada</h3>
            <div className="cita-row">
              <input
                type="date"
                value={citaFecha}
                onChange={(e) => {
                  setCitaFecha(e.target.value)
                  persist({ citaFecha: e.target.value, citaOrigen: e.target.value ? 'manual' : '' })
                }}
              />
              <input
                type="time"
                value={citaHora}
                onChange={(e) => {
                  setCitaHora(e.target.value)
                  persist({ citaHora: e.target.value, citaOrigen: e.target.value ? 'manual' : '' })
                }}
              />
              <select
                value={franja}
                onChange={(e) => {
                  setFranja(e.target.value)
                  persist({ franja: e.target.value })
                }}
              >
                {FRANJAS.map((f) => (
                  <option key={f} value={f === 'Sin franja' ? '' : f}>{f}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="block">
            <h3>Fechas y otros</h3>
            <p><strong>1ª visita:</strong> {val(a.fechas?.limite_primera_visita) || '—'}</p>
            <p><strong>Terminación:</strong> {val(a.fechas?.limite_terminacion) || '—'}</p>
            <p><strong>Tienda:</strong> {val(a.tienda_solicitante) || '—'}</p>
          </div>
        </div>

        <div className="grid-2">
          <div className="block">
            <h3>Tiempo de visita {duracion ? `(${duracion})` : ''}</h3>
            <button
              type="button"
              className="btn-sm"
              onClick={() => {
                const iso = new Date().toISOString()
                setInicioVisita(iso)
                setFinVisita('')
                persist({ inicioVisita: iso, finVisita: '' })
              }}
            >
              Inicio
            </button>{' '}
            <button
              type="button"
              className="btn-sm"
              onClick={() => {
                const iso = new Date().toISOString()
                setFinVisita(iso)
                persist({ finVisita: iso })
              }}
            >
              Fin
            </button>
          </div>
          <div className="block">
            <h3>Fichas de preparación</h3>
            <button
              type="button"
              className="btn-sm"
              onClick={() => {
                const meta = getMeta(a)
                const prep = createPreparacionFromAviso(a, {
                  citaFecha: citaFecha || meta.citaFecha || '',
                  citaHora: citaHora || meta.citaHora || '',
                  nota: nota || meta.nota || '',
                  piezas: piezas.length ? piezas : meta.piezas || [],
                })
                onCreatePrep?.(prep)
                onOpenPrep?.(prep)
              }}
            >
              + Crear ficha
            </button>
            {fichas.length > 0 && (
              <ul className="prep-link-list">
                {fichas.map((p) => (
                  <li key={p.id}>
                    <button type="button" className="linkish" onClick={() => onOpenPrep?.(p)}>
                      {p.titulo || 'Ficha'}
                      {p.piezas?.length ? ` · ${p.piezas.length} pieza(s)` : ''}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="grid-2">
          <div className="block">
            <h3>Checklist visita ({checksDone}/{CHECKLIST_ITEMS.length})</h3>
            <ul className="checklist">
              {CHECKLIST_ITEMS.map((item) => (
                <li key={item}>
                  <label className="check-item">
                    <input
                      type="checkbox"
                      checked={!!checklist[item]}
                      onChange={() => {
                        const next = { ...checklist, [item]: !checklist[item] }
                        setChecklist(next)
                        persist({ checklist: next })
                      }}
                    />
                    <span>{item}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
          <div className="block">
            <h3>Piezas</h3>
            <div className="piezas-add">
              <input
                type="text"
                placeholder="Nombre o referencia"
                value={nuevaPieza}
                onChange={(e) => setNuevaPieza(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && añadirPieza()}
              />
              <button type="button" className="btn-sm" onClick={añadirPieza}>
                Añadir
              </button>
            </div>
            {piezas.length > 0 && (
              <ul className="piezas-list">
                {piezas.map((p, i) => (
                  <li key={`${p.nombre}-${i}`}>
                    <span>
                      {p.cantidad > 1 ? `${p.cantidad}× ` : ''}
                      {p.nombre}
                    </span>
                    <button
                      type="button"
                      className="btn-x"
                      onClick={() => {
                        const next = piezas.filter((_, j) => j !== i)
                        setPiezas(next)
                        persist({ piezas: next })
                      }}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="block">
          <button
            type="button"
            className="btn-sm"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(plantillaWhatsApp(a))
                setWaOk(true)
                setTimeout(() => setWaOk(false), 1500)
              } catch {}
            }}
          >
            {waOk ? 'Copiado' : 'Copiar WhatsApp'}
          </button>
        </div>
      </div>
    </article>
  )
}
