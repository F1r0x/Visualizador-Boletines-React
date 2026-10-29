import { useState, useEffect } from 'react'
import { val, mapsUrl } from '../utils/parseAvisos'
import { ESTADOS, getMeta, setMeta } from '../utils/localMeta'
import { plantillaWhatsApp } from '../utils/whatsapp'

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
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 1500) }
  }
  return (
    <>
      <dt>{label}</dt>
      <dd
        className={[v ? '' : 'empty', copyable && v ? 'copyable' : '', copied ? 'copied' : ''].filter(Boolean).join(' ')}
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

function parseTelefonos(value) {
  if (value == null || value === '') return []
  if (Array.isArray(value)) return value.map((t) => String(t).trim()).filter(Boolean)
  return String(value).split(/[,;/|]+/).map((t) => t.trim()).filter(Boolean)
}

function TelefonoChip({ numero }) {
  const [copied, setCopied] = useState(false)
  const onCopy = async (e) => {
    e.stopPropagation()
    const ok = await copiarTexto(numero)
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 1500) }
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
  if (!lista.length) return (<><dt>Teléfono</dt><dd className="empty">—</dd></>)
  return (
    <>
      <dt>Teléfono</dt>
      <dd className="telefonos-list">
        {lista.map((num, i) => <TelefonoChip key={`${num}-${i}`} numero={num} />)}
      </dd>
    </>
  )
}

function DireccionField({ direccion, codigoPostal }) {
  const dir = val(direccion)
  const cp = val(codigoPostal)
  const textoCompleto = [dir, cp].filter(Boolean).join(', ')
  const url = mapsUrl(direccion, codigoPostal)
  const [copied, setCopied] = useState(false)
  const onCopy = async (e) => {
    if (e.target.closest('a')) return
    if (!textoCompleto) return
    const ok = await copiarTexto(textoCompleto)
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 1500) }
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
          <a className="maps-btn" href={url} target="_blank" rel="noopener noreferrer" title="Abrir en Google Maps" onClick={(e) => e.stopPropagation()}>
            Maps
          </a>
        )}
        {copied && <span className="copy-toast">Copiado</span>}
      </dd>
    </>
  )
}

export default function AvisoCard({ aviso, onMetaChange }) {
  const a = aviso
  const [estado, setEstado] = useState(() => getMeta(a).estado)
  const [nota, setNota] = useState(() => getMeta(a).nota)
  const [waOk, setWaOk] = useState(false)

  useEffect(() => {
    const m = getMeta(a)
    setEstado(m.estado)
    setNota(m.nota)
  }, [a.aviso, a.orden])

  const cambiarEstado = (e) => {
    const v = e.target.value
    setEstado(v)
    setMeta(a, { estado: v })
    onMetaChange?.()
  }

  const guardarNota = (e) => {
    const v = e.target.value
    setNota(v)
    setMeta(a, { nota: v })
    onMetaChange?.()
  }

  const copiarWhatsApp = async () => {
    try {
      await navigator.clipboard.writeText(plantillaWhatsApp(a))
      setWaOk(true)
      setTimeout(() => setWaOk(false), 1500)
    } catch { /* ignore */ }
  }

  const estadoClass = 'estado-' + String(estado).toLowerCase().replace(/\s+/g, '-')

  return (
    <article className={`aviso-card ${estadoClass}`}>
      <div className="aviso-header">
        <div className="header-left">
          <span className="orden">Orden {a.orden ?? '—'}</span>
          <span className="aviso-num">Aviso {a.aviso ?? '—'}</span>
        </div>
        <div className="header-actions">
          <select className="estado-select" value={estado} onChange={cambiarEstado} title="Estado del aviso">
            {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
          <button type="button" className="btn-wa" onClick={copiarWhatsApp} title="Copiar mensaje para WhatsApp">
            {waOk ? 'Copiado' : 'WhatsApp'}
          </button>
        </div>
      </div>

      <div className="aviso-nota">
        <label htmlFor={`nota-${a.aviso}`}>Nota del técnico</label>
        <textarea
          id={`nota-${a.aviso}`}
          rows={2}
          placeholder="Ej: llevar junta, llamar antes, acceso por patio..."
          value={nota}
          onChange={guardarNota}
        />
      </div>

      <div className="aviso-body">
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
          <h3>Datos de la avería</h3>
          <dl>
            <Field label="Causa" value={a.averia?.causa} />
            <Field label="Síntoma" value={a.averia?.sintoma} />
            <Field label="Diagnóstico" value={a.averia?.diagnostico} />
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
        <div className="section">
          <h3>Fechas y otros</h3>
          <dl>
            <Field label="Límite 1ª visita" value={a.fechas?.limite_primera_visita} />
            <Field label="Límite terminación" value={a.fechas?.limite_terminacion} />
            <Field label="Tienda solicitante" value={a.tienda_solicitante} />
            <Field label="Aviso anterior" value={a.aviso_anterior} />
          </dl>
        </div>
      </div>
    </article>
  )
}
