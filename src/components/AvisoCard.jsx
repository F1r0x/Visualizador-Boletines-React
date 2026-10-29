import { useState } from 'react'
import { val, mapsUrl } from '../utils/parseAvisos'

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
        className={[
          v ? '' : 'empty',
          copyable && v ? 'copyable' : '',
          copied ? 'copied' : '',
        ]
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
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  return (
    <>
      <dt>Dirección</dt>
      <dd
        className={[
          dir ? '' : 'empty',
          dir ? 'copyable' : '',
          copied ? 'copied' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={dir ? onCopy : undefined}
        title={dir ? 'Clic para copiar la dirección' : undefined}
        role={dir ? 'button' : undefined}
      >
        {dir || '—'}
        {url && (
          <a
            className="maps-btn"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            title="Abrir en Google Maps"
            onClick={(e) => e.stopPropagation()}
          >
            📍 Maps
          </a>
        )}
        {copied && <span className="copy-toast">Copiado</span>}
      </dd>
    </>
  )
}

export default function AvisoCard({ aviso }) {
  const a = aviso
  return (
    <article className="aviso-card">
      <div className="aviso-header">
        <span className="orden">Orden {a.orden ?? '—'}</span>
        <span className="aviso-num">Aviso {a.aviso ?? '—'}</span>
      </div>
      <div className="aviso-body">
        <div className="section">
          <h3>Datos del usuario</h3>
          <dl>
            <Field label="Nombre" value={a.cliente?.nombre} copyable />
            <Field label="Teléfono" value={a.cliente?.telefonos} copyable />
            <Field label="NIF" value={a.cliente?.nif} />
            <DireccionField
              direccion={a.direccion?.completa}
              codigoPostal={a.direccion?.codigo_postal}
            />
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
