import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import AvisoCard from './components/AvisoCard'
import CalendarioView from './components/CalendarioView'
import { normalizarRespuestaN8n, val } from './utils/parseAvisos'
import { DEMO_AVISOS } from './data/demoAvisos'
import { getMeta, ESTADOS } from './utils/localMeta'
import { exportAvisosCsv } from './utils/exportCsv'
import {
  listHistorial,
  saveHistorialEntry,
  deleteHistorialEntry,
} from './utils/historial'

const WEBHOOK_URL = 'https://n8n.automatizatutrabajo.com/webhook/boletines'

export default function App() {
  const [file, setFile] = useState(null)
  const [avisos, setAvisos] = useState([])
  const [status, setStatus] = useState({ msg: '', type: '' })
  const [loading, setLoading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [filtroMarca, setFiltroMarca] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [metaTick, setMetaTick] = useState(0)
  const [historial, setHistorial] = useState([])
  const [showHist, setShowHist] = useState(false)
  const [vista, setVista] = useState('lista')
  const [scrollToAviso, setScrollToAviso] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => { setHistorial(listHistorial()) }, [])

  const guardarEnHistorial = (lista, nombre) => {
    saveHistorialEntry({ nombre, avisos: lista })
    setHistorial(listHistorial())
  }

  const setFileSafe = useCallback((f) => {
    if (!f) return
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      setStatus({ msg: 'Solo se admiten archivos PDF.', type: 'error' })
      return
    }
    setFile(f)
    setStatus({ msg: `PDF listo: ${f.name} (${(f.size / 1024).toFixed(1)} KB)`, type: 'success' })
  }, [])

  const onDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) setFileSafe(f)
  }

  const cargarDemo = () => {
    setAvisos(DEMO_AVISOS)
    guardarEnHistorial(DEMO_AVISOS, 'Datos de ejemplo')
    setStatus({ msg: `Mostrando ${DEMO_AVISOS.length} avisos de ejemplo.`, type: 'success' })
  }

  const cargarHistorial = (entry) => {
    setAvisos(entry.avisos || [])
    setShowHist(false)
    setStatus({ msg: `Cargado del historial: ${entry.nombre} (${entry.count} avisos).`, type: 'success' })
  }

  const borrarHistorial = (id, e) => {
    e.stopPropagation()
    setHistorial(deleteHistorialEntry(id))
  }

  const procesarPdf = async () => {
    if (!file) {
      setStatus({ msg: 'Selecciona un archivo PDF primero.', type: 'error' })
      return
    }
    setLoading(true)
    setStatus({ msg: 'Subiendo PDF y ejecutando workflow...', type: 'loading' })
    try {
      const formData = new FormData()
      formData.append('data', file, file.name)
      const res = await fetch(WEBHOOK_URL, { method: 'POST', body: formData })
      const rawText = await res.text()
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText} - ${rawText.slice(0, 200)}`)
      let data
      try { data = JSON.parse(rawText) } catch { throw new Error('La respuesta no es JSON valido: ' + rawText.slice(0, 150)) }
      const lista = normalizarRespuestaN8n(data)
      setAvisos(lista)
      guardarEnHistorial(lista, file?.name || 'Boletin PDF')
      setStatus({ msg: `PDF procesado correctamente. ${lista.length} avisos recibidos.`, type: 'success' })
    } catch (err) {
      console.error(err)
      setStatus({ msg: `Error: ${err.message}`, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const marcasDisponibles = useMemo(() => {
    const set = new Set()
    avisos.forEach((a) => { const m = val(a.aparato?.marca); if (m) set.add(m) })
    return [...set].sort()
  }, [avisos])

  const avisosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return avisos.filter((a) => {
      const meta = getMeta(a)
      if (filtroEstado && meta.estado !== filtroEstado) return false
      if (filtroMarca && val(a.aparato?.marca) !== filtroMarca) return false
      if (!q) return true
      const blob = [a.aviso, a.orden, a.cliente?.nombre, a.cliente?.telefonos, a.cliente?.nif, a.direccion?.completa, a.direccion?.codigo_postal, a.aparato?.marca, a.aparato?.modelo, a.aparato?.tipo, a.averia?.causa, a.seguro?.compania, meta.nota, meta.estado].filter(Boolean).join(' ').toLowerCase()
      return blob.includes(q)
    })
  }, [avisos, busqueda, filtroMarca, filtroEstado, metaTick])

  const marcasResumen = {}
  avisosFiltrados.forEach((a) => {
    const m = val(a.aparato?.marca) || 'Sin marca'
    marcasResumen[m] = (marcasResumen[m] || 0) + 1
  })

  return (
    <div className="container">
      <header>
        <h1>Boletines de Servicio</h1>
        <p>Sube el PDF del boletin, n8n lo procesa y gestiona tus avisos</p>
      </header>

      <div className="controls">
        <div
          className={`drop-zone ${dragOver ? 'dragover' : ''} ${file ? 'has-file' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          <input ref={inputRef} type="file" accept="application/pdf,.pdf" onChange={(e) => setFileSafe(e.target.files?.[0])} />
          <div style={{ fontSize: '1.8rem', marginBottom: '0.4rem' }}>PDF</div>
          <div className="hint">Arrastra aqui el PDF del boletin o haz clic para seleccionarlo</div>
          {file && <div className="filename">{file.name} ({(file.size / 1024).toFixed(1)} KB)</div>}
        </div>

        <div className="btn-row">
          <button className="btn" onClick={procesarPdf} disabled={loading || !file}>Procesar PDF</button>
          <button className="btn btn-secondary" onClick={cargarDemo}>Cargar datos de ejemplo</button>
          <button className="btn btn-secondary" onClick={() => setShowHist((v) => !v)}>Historial ({historial.length})</button>
          {avisos.length > 0 && (
            <button className="btn btn-secondary" onClick={() => exportAvisosCsv(avisosFiltrados)}>Exportar CSV</button>
          )}
        </div>

        {showHist && (
          <div className="historial-panel">
            <h3>Historial local</h3>
            {historial.length === 0 ? (
              <p className="hist-empty">Aun no hay boletines guardados en este navegador.</p>
            ) : (
              <ul className="hist-list">
                {historial.map((h) => (
                  <li key={h.id}>
                    <button type="button" className="hist-item" onClick={() => cargarHistorial(h)}>
                      <span className="hist-name">{h.nombre}</span>
                      <span className="hist-meta">{h.count} avisos · {new Date(h.fecha).toLocaleString('es-ES')}</span>
                    </button>
                    <button type="button" className="btn-x" onClick={(e) => borrarHistorial(h.id, e)} title="Eliminar">×</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {status.msg && <div className={`status ${status.type}`}>{status.msg}</div>}
      </div>

      {avisos.length > 0 && (
        <div className="toolbar">
          <div className="vista-toggle">
            <button type="button" className={vista === 'lista' ? 'btn-sm active' : 'btn-sm'} onClick={() => setVista('lista')}>Lista</button>
            <button type="button" className={vista === 'calendario' ? 'btn-sm active' : 'btn-sm'} onClick={() => setVista('calendario')}>Calendario</button>
          </div>
          {vista === 'lista' && (
            <>
              <input type="search" className="search-input" placeholder="Buscar nombre, aviso, modelo, CP..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
              <select value={filtroMarca} onChange={(e) => setFiltroMarca(e.target.value)} className="filter-select">
                <option value="">Todas las marcas</option>
                {marcasDisponibles.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className="filter-select">
                <option value="">Todos los estados</option>
                {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </>
          )}
        </div>
      )}

      {avisos.length > 0 && vista === 'lista' && (
        <div className="summary">
          <div className="stat">
            <div className="num">{avisosFiltrados.length}</div>
            <div className="label">{avisosFiltrados.length === avisos.length ? 'Avisos' : `de ${avisos.length}`}</div>
          </div>
          {Object.entries(marcasResumen).map(([m, c]) => (
            <div className="stat" key={m}>
              <div className="num">{c}</div>
              <div className="label">{m}</div>
            </div>
          ))}
        </div>
      )}

      {avisos.length > 0 && vista === 'calendario' && (
        <CalendarioView
          avisos={avisos}
          metaTick={metaTick}
          onSelectAviso={(a) => {
            setVista('lista')
            setScrollToAviso(String(a.aviso ?? a.orden))
            setTimeout(() => setScrollToAviso(null), 2000)
          }}
        />
      )}

      <div className="avisos">
        {avisos.length === 0 ? (
          <div className="empty-state"><p>Selecciona un PDF y pulsa <strong>Procesar PDF</strong><br />o carga los datos de ejemplo.</p></div>
        ) : vista === 'calendario' ? null : avisosFiltrados.length === 0 ? (
          <div className="empty-state"><p>Ningun aviso coincide con los filtros.</p></div>
        ) : (
          avisosFiltrados.map((a, i) => (
            <div key={`${a.orden}-${a.aviso}-${i}`} id={`aviso-${a.aviso}`} className={scrollToAviso && String(a.aviso) === scrollToAviso ? 'aviso-highlight-wrap' : undefined}>
              <AvisoCard aviso={a} onMetaChange={() => setMetaTick((t) => t + 1)} />
            </div>
          ))
        )}
      </div>

      <footer>React + Vite · n8n · Lista, calendario y citas se guardan en este navegador</footer>
    </div>
  )
}
