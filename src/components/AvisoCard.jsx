import { useState, useEffect } from 'react'
import { val, mapsUrl, parseHorarioBoletin } from '../utils/parseAvisos'
import { ESTADOS, CHECKLIST_ITEMS, FRANJAS, getMeta, setMeta } from '../utils/localMeta'
import { plantillaWhatsApp } from '../utils/whatsapp'
import { urgenciaFecha, formatoDuracion } from '../utils/fechas'
import { preparacionesPorAviso } from '../utils/preparaciones'

async function copiarTexto(texto) {
  if (!texto) return false
  try {
    await navigator.clipboard.writeText(texto)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = texto
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch {
      return false
    }
  }
}

function Field({ label, value, copyable = false }) {
  const v = val(value)
  const [copied, setCopied] = useState(false)
  const onCopy = async () => {
    if (!copyable || !v) return
    const ok = await copiarTexto(v)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }
  return (
    <>
      <dt>{label}</dt>
      <dd
        className={[v ? '' : 'empty', copyable && v ? 'copyable' : '', copied ? 'copied' : '']
          .filter(Boolean)
          .join(' ')}
        onClick={copyable && v ? onCopy : undefined}
        title={copyable && v ? 'Clic para copiar' : undefined}
        role={copyable && v ? 'button' : undefined}
      >
        {v || '—'}
        {copied && <span className="copy-toast">Copiado</span>}
      </dd>
    </>
  )
}

function LongField({ label, value }) {
  const v = val(value)
  return (
    <>
      <dt className="field-long-label">{label}</dt>
      <dd className={v ? 'field-long' : 'field-long empty'}>{v || '—'}</dd>
    </>
  )
}

function parseTelefonos(value) {
  if (value == null || value === '') return []
  if (Array.isArray(value)) return value.map((t) => String(t).trim()).filter(Boolean)
  return String(value)
    .split(/[,;/|]+/)
    .map((t) => t.trim())
    .filter(Boolean)
}

function TelefonoChip({ numero }) {
  const [copied, setCopied] = useState(false)
  const onCopy = async (e) => {
    e.stopPropagation()
    const ok = await copiarTexto(numero)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }
  return (
    <button type="button" className={`tel-chip${copied ? ' copied' : ''}`} onClick={onCopy} title="Clic para copiar este número">
      {numero}
      {copied && <span className="copy-toast">Copiado</span>}
    </button>
  )
}

function TelefonosField({ value }) {
  const lista = parseTelefonos(value)
  if (!lista.length)
    return (
      <>
        <dt>Teléfono</dt>
        <dd className="empty">—</dd>
      </>
    )
  return (
    <>
      <dt>Teléfono</dt>
      <dd className="telefonos-list">
        {lista.map((num, i) => (
          <TelefonoChip key={`${num}-${i}`} numero={num} />
        ))}
      </dd>
    </>
  )
}

function DireccionField({ direccion, codigoPostal }) {
  const dir = val(direccion)
  const url = mapsUrl(direccion, codigoPostal)
  const textoCompleto = [dir, val(codigoPostal)].filter(Boolean).join(', ')
  const [copied, setCopied] = useState(false)
  const onCopy = async (e) => {
    if (e.target.closest('a')) return
    if (!textoCompleto) return
    const ok = await copiarTexto(textoCompleto)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }
  return (
    <>
      <dt>Dirección</dt>
      <dd
        className={[dir ? '' : 'empty', dir ? 'copyable' : '', copied ? 'copied' : ''].filter(Boolean).join(' ')}
        onClick={dir ? onCopy : undefined}
        title={dir ? 'Clic para copiar la dirección' : undefined}
        role={dir ? 'button' : undefined}
      >
        {dir || '—'}
        {url && (
          <a className="maps-btn" href={url} target="_blank" rel="noopener noreferrer" title="Maps" onClick={(e) => e.stopPropagation()}>
            Maps
          </a>
        )}
        {copied && <span className="copy-toast">Copiado</span>}
      </dd>
    </>
  )
}

function FechaField({ label, value }) {
  const v = val(value)
  const urg = urgenciaFecha(v)
  const cls = [v ? '' : 'empty', urg === 'pasada' ? 'fecha-pasada' : '', urg === 'proxima' ? 'fecha-proxima' : ''].filter(Boolean).join(' ')
  let badge = null
  if (urg === 'pasada') badge = <span className="fecha-badge danger">Vencida</span>
  if (urg === 'proxima') badge = <span className="fecha-badge warn">Próxima</span>
  return (
    <>
      <dt>{label}</dt>
      <dd className={cls}>
        {v || '—'}
        {badge}
      </dd>
    </>
  )
}

export default function AvisoCard({ aviso, onMetaChange, onDelete, onOpenPrep }) {
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
  }, [a.aviso, a.orden, a.horario])

  const cambiarEstado = (e) => {
    const v = e.target.value
    setEstado(v)
    persist({ estado: v })
  }
  const guardarNota = (e) => {
    const v = e.target.value
    setNota(v)
    persist({ nota: v })
  }
  const toggleCheck = (item) => {
    const next = { ...checklist, [item]: !checklist[item] }
    setChecklist(next)
    persist({ checklist: next })
  }
  const marcarInicio = () => {
    const iso = new Date().toISOString()
    setInicioVisita(iso)
    setFinVisita('')
    persist({ inicioVisita: iso, finVisita: '' })
  }
  const marcarFin = () => {
    const iso = new Date().toISOString()
    setFinVisita(iso)
    persist({ finVisita: iso })
  }
  const añadirPieza = () => {
    const nombre = nuevaPieza.trim()
    if (!nombre) return
    const next = [...piezas, { nombre, cantidad: 1 }]
    setPiezas(next)
    setNuevaPieza('')
    persist({ piezas: next })
  }
  const quitarPieza = (idx) => {
    const next = piezas.filter((_, i) => i !== idx)
    setPiezas(next)
    persist({ piezas: next })
  }
  const copiarWhatsApp = async () => {
    try {
      await navigator.clipboard.writeText(plantillaWhatsApp(a))
      setWaOk(true)
      setTimeout(() => setWaOk(false), 1500)
    } catch {}
  }

  const estadoClass = 'estado-' + String(estado).toLowerCase().replace(/\s+/g, '-')
  const checksDone = CHECKLIST_ITEMS.filter((i) => checklist[i]).length
  const duracion = formatoDuracion(inicioVisita, finVisita)

  return (
    <article className={`aviso-card ${estadoClass}`}>
      <div className="aviso-header">
        <div className="header-left">
          <span className="orden">Orden {a.orden ?? '—'}</span>
          <span className="aviso-num">Aviso {a.aviso ?? '—'}</span>
        </div>
        <div className="header-actions">
          <select className="estado-select" value={estado} onChange={cambiarEstado} title="Estado del aviso">
            {ESTADOS.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
          <button type="button" className="btn-wa" onClick={copiarWhatsApp} title="WhatsApp">
            {waOk ? '✓ Copiado' : 'WhatsApp'}
          </button>
          {onDelete && (
            <button
              type="button"
              className="btn-delete-aviso"
              onClick={() => {
                const label = a.aviso || a.orden || 'este aviso'
                if (window.confirm(`¿Eliminar el aviso ${label}?`)) onDelete(a)
              }}
              title="Eliminar este aviso"
            >
              Eliminar
            </button>
          )}
        </div>
      </div>

      <div className="aviso-nota">
        <label htmlFor={`nota-${a.aviso}`}>Nota del técnico</label>
        <textarea
          id={`nota-${a.aviso}`}
          rows={2}
          placeholder="Ej: llevar junta, llamar antes…"
          value={nota}
          onChange={guardarNota}
        />
      </div>

      <div className="aviso-cita">
        <h4>
          Cita planificada
          {getMeta(a).citaOrigen === 'boletin' && (
            <span className="cita-origen boletin">📋 Boletín</span>
          )}
          {getMeta(a).citaOrigen === 'manual' && (
            <span className="cita-origen manual">✏️ Manual</span>
          )}
        </h4>
        {val(a.horario) && (
          <p className="horario-boletin">
            Horario del boletín: <strong>{val(a.horario)}</strong>
          </p>
        )}
        <div className="cita-row">
          <input type="date" value={citaFecha} onChange={(e) => { const v = e.target.value; setCitaFecha(v); persist({ citaFecha: v, citaOrigen: 'manual' }) }} />
          <input type="time" value={citaHora} onChange={(e) => { const v = e.target.value; setCitaHora(v); persist({ citaHora: v, citaOrigen: 'manual' }) }} />
          <select value={franja || 'Sin franja'} onChange={(e) => { const v = e.target.value === 'Sin franja' ? '' : e.target.value; setFranja(v); persist({ franja: v, citaOrigen: 'manual' }) }}>
            {FRANJAS.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
          {(citaFecha || citaHora || franja) && (
            <button type="button" className="btn-sm" onClick={() => { setCitaFecha(''); setCitaHora(''); setFranja(''); persist({ citaFecha: '', citaHora: '', franja: '', citaOrigen: '' }) }}>
              Quitar cita
            </button>
          )}
        </div>
      </div>

      {fichas.length > 0 && (
        <div className="aviso-preps">
          <h4>Fichas de preparación ({fichas.length})</h4>
          <ul className="aviso-prep-list">
            {fichas.map((p) => (
              <li key={p.id}>
                <button type="button" className="btn-sm aviso-prep-btn" onClick={() => onOpenPrep?.(p)} title="Abrir ficha">
                  🔧 {p.titulo || 'Preparación'}
                  {p.citaFecha ? ` · ${p.citaFecha}${p.citaHora ? ' ' + p.citaHora : ''}` : ''}
                  {p.piezas?.length ? ` · ${p.piezas.length} pieza(s)` : ''}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="aviso-body aviso-body-primary">
        <div className="section">
          <h3>Datos del usuario</h3>
          <dl>
            <Field label="Nombre" value={a.cliente?.nombre} copyable />
            <TelefonosField value={a.cliente?.telefonos} />
            <Field label="NIF" value={a.cliente?.nif} />
            <DireccionField direccion={a.direccion?.completa} codigoPostal={a.direccion?.codigo_postal} />
            <Field label="C.P." value={a.direccion?.codigo_postal} />
          </dl>
        </div>
        <div className="section">
          <h3>Datos del aparato</h3>
          <dl>
            <Field label="Marca" value={a.aparato?.marca} />
            <Field label="Modelo / KI" value={a.aparato?.modelo} copyable />
            <Field label="Tipo" value={a.aparato?.tipo} />
          </dl>
        </div>
        <div className="section">
          <h3>Seguro</h3>
          <dl>
            <Field label="Compañía" value={a.seguro?.compania} />
            <Field label="Modalidad" value={a.seguro?.modalidad} />
            <Field label="Expediente" value={a.seguro?.expediente} />
            <Field label="Urgencia" value={a.seguro?.tipo_urgencia} />
          </dl>
        </div>
      </div>

      <div className="aviso-body aviso-averia-wrap">
        <div className="section section-averia section-averia-full">
          <h3>Datos de la avería</h3>
          <dl>
            <LongField label="Causa" value={a.averia?.causa} />
            <LongField label="Síntoma" value={a.averia?.sintoma} />
            <LongField label="Diagnóstico" value={a.averia?.diagnostico} />
          </dl>
        </div>
      </div>

      <div className="aviso-ops aviso-ops-row">
        <div className="section ops-block ops-fechas">
          <h4>Fechas y otros</h4>
          <dl className="dl-compact">
            <FechaField label="Límite 1ª visita" value={a.fechas?.limite_primera_visita} />
            <FechaField label="Límite terminación" value={a.fechas?.limite_terminacion} />
            <Field label="Tienda" value={a.tienda_solicitante} />
            <Field label="Aviso ant." value={a.aviso_anterior} />
          </dl>
        </div>
        <div className="tool-block ops-block">
          <h4>Tiempo de visita</h4>
          <div className="tiempo-row">
            <button type="button" className="btn-sm" onClick={marcarInicio}>{inicioVisita ? 'Reiniciar inicio' : 'Inicio visita'}</button>
            <button type="button" className="btn-sm" onClick={marcarFin} disabled={!inicioVisita}>Fin visita</button>
            {duracion && <span className="duracion">{duracion}</span>}
          </div>
        </div>
      </div>

      <div className="aviso-ops aviso-ops-row">
        <div className="tool-block ops-block">
          <h4>Checklist visita <span className="tool-count">{checksDone}/{CHECKLIST_ITEMS.length}</span></h4>
          <div className="checklist">
            {CHECKLIST_ITEMS.map((item) => (
              <label key={item} className="check-item">
                <input type="checkbox" checked={!!checklist[item]} onChange={() => toggleCheck(item)} />
                <span>{item}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="tool-block ops-block">
          <h4>Piezas</h4>
          <div className="piezas-add">
            <input type="text" placeholder="Nombre o referencia" value={nuevaPieza} onChange={(e) => setNuevaPieza(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && añadirPieza()} />
            <button type="button" className="btn-sm" onClick={añadirPieza}>Añadir</button>
          </div>
          {piezas.length > 0 && (
            <ul className="piezas-list">
              {piezas.map((p, i) => (
                <li key={`${p.nombre}-${i}`}>
                  <span>{p.nombre}</span>
                  <button type="button" className="btn-x" onClick={() => quitarPieza(i)}>×</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </article>
  )
}
