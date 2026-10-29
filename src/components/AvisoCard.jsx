import { val, mapsUrl } from '../utils/parseAvisos'

function Field({ label, value }) {
  const v = val(value)
  return (
    <>
      <dt>{label}</dt>
      <dd className={v ? '' : 'empty'}>{v || '—'}</dd>
    </>
  )
}

function DireccionField({ direccion, codigoPostal }) {
  const dir = val(direccion)
  const url = mapsUrl(direccion, codigoPostal)
  return (
    <>
      <dt>Dirección</dt>
      <dd className={dir ? '' : 'empty'}>
        {dir || '—'}
        {url && (
          <a
            className="maps-btn"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            title="Abrir en Google Maps"
          >
            📍 Maps
          </a>
        )}
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
            <Field label="Nombre" value={a.cliente?.nombre} />
            <Field label="Teléfono" value={a.cliente?.telefonos} />
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
            <Field label="Modelo / KI" value={a.aparato?.modelo} />
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
