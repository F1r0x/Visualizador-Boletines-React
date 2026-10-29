import { useState, useRef, useCallback } from 'react'
import AvisoCard from './components/AvisoCard'
import { normalizarRespuestaN8n, val } from './utils/parseAvisos'
import { DEMO_AVISOS } from './data/demoAvisos'

export default function App() {
  const [webhookUrl, setWebhookUrl] = useState('')
  const [file, setFile] = useState(null)
  const [avisos, setAvisos] = useState([])
  const [status, setStatus] = useState({ msg: '', type: '' })
  const [loading, setLoading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef(null)

  const setFileSafe = useCallback((f) => {
    if (!f) return
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      setStatus({ msg: 'Solo se admiten archivos PDF.', type: 'error' })
      return
    }
    setFile(f)
    setStatus({
      msg: `PDF listo: ${f.name} (${(f.size / 1024).toFixed(1)} KB)`,
      type: 'success',
    })
  }, [])

  const onDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) setFileSafe(f)
  }

  const cargarDemo = () => {
    setAvisos(DEMO_AVISOS)
    setStatus({
      msg: `Mostrando ${DEMO_AVISOS.length} avisos de ejemplo.`,
      type: 'success',
    })
  }

  const procesarPdf = async () => {
    if (!webhookUrl.trim()) {
      setStatus({ msg: 'Introduce la URL del webhook de n8n.', type: 'error' })
      return
    }
    if (!file) {
      setStatus({ msg: 'Selecciona un archivo PDF primero.', type: 'error' })
      return
    }

    setLoading(true)
    setStatus({ msg: 'Subiendo PDF y ejecutando workflow...', type: 'loading' })

    try {
      const formData = new FormData()
      formData.append('data', file, file.name)
      const res = await fetch(webhookUrl.trim(), { method: 'POST', body: formData })
      const rawText = await res.text()
      if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + res.statusText + ' - ' + rawText.slice(0, 200))
      let data
      try { data = JSON.parse(rawText) } catch { throw new Error('La respuesta no es JSON valido: ' + rawText.slice(0, 150)) }
      const lista = normalizarRespuestaN8n(data)
      setAvisos(lista)
      setStatus({ msg: 'PDF procesado correctamente. ' + lista.length + ' avisos recibidos.', type: 'success' })
    } catch (err) {
      console.error(err)
      setStatus({ msg: 'Error: ' + err.message, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const marcas = {}
  avisos.forEach((a) => {
    const m = val(a.aparato && a.aparato.marca) || 'Sin marca'
    marcas[m] = (marcas[m] || 0) + 1
  })

  return (
    <div className="container">
      <header>
        <h1>Boletines de Servicio</h1>
        <p>Sube el PDF del boletin, n8n lo procesa y ves todos los avisos</p>
      </header>

      <div className="controls">
        <div className="field">
          <label htmlFor="webhookUrl">URL del Webhook de n8n</label>
          <input
            id="webhookUrl"
            type="url"
            placeholder="https://tu-n8n.com/webhook/boletines"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
          />
        </div>

        <div
          className={'drop-zone' + (dragOver ? ' dragover' : '') + (file ? ' has-file' : '')}
          onClick={() => inputRef.current && inputRef.current.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => setFileSafe(e.target.files && e.target.files[0])}
          />
          <div style={{ fontSize: '1.8rem', marginBottom: '0.4rem' }}>PDF</div>
          <div className="hint">Arrastra aqui el PDF del boletin o haz clic para seleccionarlo</div>
          {file && (
            <div className="filename">{file.name} ({(file.size / 1024).toFixed(1)} KB)</div>
          )}
        </div>

        <div className="btn-row">
          <button className="btn" onClick={procesarPdf} disabled={loading || !file}>
            Procesar PDF
          </button>
          <button className="btn btn-secondary" onClick={cargarDemo}>
            Cargar datos de ejemplo
          </button>
        </div>

        {status.msg && <div className={'status ' + status.type}>{status.msg}</div>}
      </div>

      {avisos.length > 0 && (
        <div className="summary">
          <div className="stat">
            <div className="num">{avisos.length}</div>
            <div className="label">Avisos</div>
          </div>
          {Object.entries(marcas).map(([m, c]) => (
            <div className="stat" key={m}>
              <div className="num">{c}</div>
              <div className="label">{m}</div>
            </div>
          ))}
        </div>
      )}

      <div className="avisos">
        {avisos.length === 0 ? (
          <div className="empty-state">
            <p>
              Selecciona un PDF y pulsa <strong>Procesar PDF</strong>
              <br />
              o carga los datos de ejemplo para ver como queda.
            </p>
          </div>
        ) : (
          avisos.map((a, i) => (
            <AvisoCard key={String(a.orden) + '-' + String(a.aviso) + '-' + i} aviso={a} />
          ))
        )}
      </div>

      <footer>
        React + Vite - El PDF se envia al webhook de n8n con el campo <code>data</code>
      </footer>
    </div>
  )
}
