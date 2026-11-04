import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import AvisoCard from './components/AvisoCard'
import CalendarioView from './components/CalendarioView'
import CloudPanel from './components/CloudPanel'
import LoginScreen from './components/LoginScreen'
import RemindersBanner from './components/RemindersBanner'
import OfflineBanner from './components/OfflineBanner'
import { useAuth } from './hooks/useAuth'
import { normalizarRespuestaN8n, val } from './utils/parseAvisos'
import { aplicarCitasDesdeHorario } from './utils/citasDesdeHorario'
import { getMeta, ESTADOS, deleteMeta, avisoKey } from './utils/localMeta'
import { exportAvisosCsv } from './utils/exportCsv'
import {
  listHistorial,
  saveHistorialEntry,
  deleteHistorialEntry,
  mergeAvisosParaCalendario,
  removeAvisoFromHistorial,
} from './utils/historial'
import {
  guardarCacheOffline,
  cargarCacheOffline,
  aplicarMetaDesdeCache,
  isOnline,
} from './utils/offlineCache'

const WEBHOOK_URL = 'https://n8n.automatizatutrabajo.com/webhook/boletines'

export default function App() {
  const {
    authEnabled,
    user,
    loading: authLoading,
    error: authError,
    setError: setAuthError,
    login,
    logout,
    isAuthenticated,
  } = useAuth()

  const [file, setFile] = useState(null)
  const [avisos, setAvisos] = useState([])
  const [status, setStatus] = useState({ msg: '', type: '' })
  const [loading, setLoading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [filtroMarca, setFiltroMarca] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroCp, setFiltroCp] = useState('')
  const [filtroUrgencia, setFiltroUrgencia] = useState('')
  const [filtroHorario, setFiltroHorario] = useState('')
  const [filtroCita, setFiltroCita] = useState('')
  const [metaTick, setMetaTick] = useState(0)
  const [historial, setHistorial] = useState([])
  const [showHist, setShowHist] = useState(false)
  const [showCloud, setShowCloud] = useState(false)
  const [vista, setVista] = useState('lista')
  const [scrollToAviso, setScrollToAviso] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    const hist = listHistorial()
    setHistorial(hist)
    if (hist.length > 0) {
      const ultimo = hist[0]
      let lista = ultimo.avisos || []
      lista = aplicarCitasDesdeHorario(lista, {
        forzar: true,
        nombreArchivo: ultimo.nombre || '',
      })
      setAvisos(lista)
      setMetaTick((t) => t + 1)
      setStatus({
        msg: `Cargados avisos anteriores: ${ultimo.nombre} (${ultimo.count} avisos).`,
        type: 'success',
      })
    }
  }, [])

  // Si arrancamos offline y no hay avisos, restaurar caché
  useEffect(() => {
    if (!isOnline() && avisos.length === 0) {
      const cache = cargarCacheOffline()
      if (cache?.avisos?.length) {
        setAvisos(aplicarMetaDesdeCache(cache.avisos))
        setStatus({
          msg: `Modo offline: ${cache.avisos.length} avisos desde caché (${cache.fechaAgenda || 'guardados'}).`,
          type: 'success',
        })
      }
    }
  }, [])

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

  const cargarHistorial = (entry) => {
    let lista = entry.avisos || []
    lista = aplicarCitasDesdeHorario(lista, {
      forzar: true,
      nombreArchivo: entry.nombre || '',
    })
    setAvisos(lista)
    setMetaTick((t) => t + 1)
    setShowHist(false)
    setStatus({
      msg: `Cargado del historial: ${entry.nombre} (${entry.count} avisos).`,
      type: 'success',
    })
  }

  const borrarHistorial = (id, e) => {
    e.stopPropagation()
    setHistorial(deleteHistorialEntry(id))
  }

  const eliminarAviso = (aviso) => {
    const key = avisoKey(aviso)
    setAvisos((prev) => prev.filter((a) => avisoKey(a) !== key && a !== aviso))
    setHistorial(removeAvisoFromHistorial(aviso))
    deleteMeta(aviso)
    setMetaTick((t) => t + 1)
    setStatus({
      msg: `Aviso ${aviso.aviso || aviso.orden || ''} eliminado.`,
      type: 'success',
    })
  }

  const avisosCalendario = useMemo(
    () => mergeAvisosParaCalendario(avisos, historial),
    [avisos, historial]
  )

  // Snapshot offline (citas de hoy o lote actual)
  useEffect(() => {
    if (avisosCalendario.length > 0) {
      guardarCacheOffline(avisosCalendario)
    }
  }, [avisosCalendario, metaTick])

  const procesarPdf = async () => {
    if (!isOnline()) {
      setStatus({
        msg: 'Sin conexión: no se puede enviar el PDF. Revisa los avisos en caché offline.',
        type: 'error',
      })
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
      const res = await fetch(WEBHOOK_URL, { method: 'POST', body: formData })
      const rawText = await res.text()
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText} - ${rawText.slice(0, 200)}`)
      }
      let data
      try {
        data = JSON.parse(rawText)
      } catch {
        throw new Error('La respuesta no es JSON valido: ' + rawText.slice(0, 150))
      }
      let lista = normalizarRespuestaN8n(data)
      const nombrePdf = file?.name || ''
      lista = aplicarCitasDesdeHorario(lista, {
        forzar: true,
        nombreArchivo: nombrePdf,
      })
      const m = nombrePdf.match(/(0?[1-9]|[12]\d|3[01])[-_.](0?[1-9]|1[0-2])[-_.](20\d{2})/)
      const diaMsg = m
        ? `${m[1].padStart(2, '0')}/${m[2].padStart(2, '0')}/${m[3]}`
        : (lista.find((a) => a.fecha_encabezado)?.fecha_encabezado || '')
            .toString()
            .split('-')
            .reverse()
            .join('/')
      setAvisos(lista)
      setMetaTick((t) => t + 1)
      guardarEnHistorial(lista, nombrePdf || 'Boletin PDF')
      const conHora = lista.filter((a) => a.horario).length
      setStatus({
        msg: `PDF procesado: ${lista.length} avisos${
          conHora ? ` · ${conHora} con horario` : ''
        }${diaMsg ? ` · agenda ${diaMsg}` : ''}.`,
        type: 'success',
      })
    } catch (err) {
      console.error(err)
      setStatus({ msg: `Error: ${err.message}`, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const marcasDisponibles = useMemo(() => {
    const set = new Set()
    avisos.forEach((a) => {
      const m = val(a.aparato?.marca)
      if (m) set.add(m)
    })
    return [...set].sort()
  }, [avisos])

  const cpsDisponibles = useMemo(() => {
    const set = new Set()
    avisos.forEach((a) => {
      const cp = val(a.direccion?.codigo_postal)
      if (cp) set.add(cp)
    })
    return [...set].sort()
  }, [avisos])

  const esUrgente = (a, meta) => {
    const t = val(a.seguro?.tipo_urgencia) || ''
    if (/urgenc/i.test(t)) return true
    if (meta.franja === 'Urgencia') return true
    const est = val(a.estado) || ''
    if (/urgenc/i.test(est)) return true
    return false
  }

  const hayFiltrosActivos = !!(
    busqueda.trim() ||
    filtroMarca ||
    filtroEstado ||
    filtroCp ||
    filtroUrgencia ||
    filtroHorario ||
    filtroCita
  )

  const limpiarFiltros = () => {
    setBusqueda('')
    setFiltroMarca('')
    setFiltroEstado('')
    setFiltroCp('')
    setFiltroUrgencia('')
    setFiltroHorario('')
    setFiltroCita('')
  }

  const avisosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return avisos.filter((a) => {
      const meta = getMeta(a)
      if (filtroEstado && meta.estado !== filtroEstado) return false
      if (filtroMarca && val(a.aparato?.marca) !== filtroMarca) return false
      if (filtroCp && val(a.direccion?.codigo_postal) !== filtroCp) return false
      if (filtroUrgencia === 'si' && !esUrgente(a, meta)) return false
      if (filtroUrgencia === 'no' && esUrgente(a, meta)) return false
      const tieneHorario = !!val(a.horario)
      if (filtroHorario === 'con' && !tieneHorario) return false
      if (filtroHorario === 'sin' && tieneHorario) return false
      const tieneCita = !!(meta.citaFecha || meta.citaHora)
      if (filtroCita === 'con' && !tieneCita) return false
      if (filtroCita === 'sin' && tieneCita) return false
      if (!q) return true
      const blob = [
        a.aviso, a.orden, a.cliente?.nombre, a.cliente?.telefonos, a.cliente?.nif,
        a.direccion?.completa, a.direccion?.codigo_postal, a.aparato?.marca,
        a.aparato?.modelo, a.aparato?.tipo, a.averia?.causa, a.seguro?.compania,
        a.seguro?.tipo_urgencia, a.horario, meta.nota, meta.estado,
      ].filter(Boolean).join(' ').toLowerCase()
      return blob.includes(q)
    })
  }, [avisos, busqueda, filtroMarca, filtroEstado, filtroCp, filtroUrgencia, filtroHorario, filtroCita, metaTick])

  const marcasResumen = {}
  avisosFiltrados.forEach((a) => {
    const m = val(a.aparato?.marca) || 'Sin marca'
    marcasResumen[m] = (marcasResumen[m] || 0) + 1
  })

  if (authLoading) {
    return (
      <div className="login-page">
        <p className="login-loading">Comprobando sesión…</p>
      </div>
    )
  }

  if (authEnabled && !isAuthenticated) {
    return <LoginScreen onLogin={login} error={authError} setError={setAuthError} />
  }

  return (
    <div className="container">
      <header>
        <div className="header-top">
          <div>
            <h1>Boletines de Servicio</h1>
            <p>Sube el PDF del boletin, n8n lo procesa y gestiona tus avisos</p>
          </div>
          {authEnabled && user && (
            <div className="user-bar">
              <span className="user-email" title={user.email}>{user.email}</span>
              <button type="button" className="btn-sm" onClick={logout}>Salir</button>
            </div>
          )}
        </div>
      </header>

      <OfflineBanner />

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
          <button className="btn btn-secondary" onClick={() => setShowHist((v) => !v)}>Historial ({historial.length})</button>
          <button className="btn btn-secondary" onClick={() => setShowCloud((v) => !v)}>Nube / BD</button>
          {avisos.length > 0 && (
            <button className="btn btn-secondary" onClick={() => exportAvisosCsv(avisosFiltrados)}>Exportar CSV</button>
          )}
        </div>

        {showCloud && (
          <CloudPanel
            avisos={avisos}
            onLoadAvisos={(lista) => {
              setAvisos(aplicarCitasDesdeHorario(lista, { forzar: true }))
              setMetaTick((t) => t + 1)
              setShowCloud(false)
              setVista('lista')
            }}
            onStatus={setStatus}
          />
        )}

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

      <RemindersBanner
        avisos={avisosCalendario}
        metaTick={metaTick}
        onSelectAviso={(a) => {
          const key = avisoKey(a)
          setAvisos((prev) => {
            if (prev.some((x) => avisoKey(x) === key)) return prev
            return [a, ...prev]
          })
          setVista('lista')
          setScrollToAviso(String(a.aviso ?? a.orden))
          setTimeout(() => setScrollToAviso(null), 2000)
        }}
      />

      <div className="toolbar">
        <div className="vista-toggle">
          <button type="button" className={vista === 'lista' ? 'btn-sm active' : 'btn-sm'} onClick={() => setVista('lista')}>Lista</button>
          <button type="button" className={vista === 'calendario' ? 'btn-sm active' : 'btn-sm'} onClick={() => setVista('calendario')}>Calendario</button>
        </div>
        {vista === 'lista' && avisos.length > 0 && (
          <>
            <input type="search" className="search-input" placeholder="Buscar nombre, aviso, modelo, CP…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
            <select value={filtroCp} onChange={(e) => setFiltroCp(e.target.value)} className="filter-select" title="Código postal">
              <option value="">Todos los CP</option>
              {cpsDisponibles.map((cp) => <option key={cp} value={cp}>{cp}</option>)}
            </select>
            <select value={filtroMarca} onChange={(e) => setFiltroMarca(e.target.value)} className="filter-select" title="Marca">
              <option value="">Todas las marcas</option>
              {marcasDisponibles.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className="filter-select" title="Estado">
              <option value="">Todos los estados</option>
              {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
            <select value={filtroUrgencia} onChange={(e) => setFiltroUrgencia(e.target.value)} className="filter-select" title="Urgencia">
              <option value="">Urgencia: todas</option>
              <option value="si">Solo urgentes</option>
              <option value="no">No urgentes</option>
            </select>
            <select value={filtroHorario} onChange={(e) => setFiltroHorario(e.target.value)} className="filter-select" title="Horario del boletín">
              <option value="">Horario boletín: todos</option>
              <option value="con">Con horario</option>
              <option value="sin">Sin horario</option>
            </select>
            <select value={filtroCita} onChange={(e) => setFiltroCita(e.target.value)} className="filter-select" title="Cita planificada">
              <option value="">Cita: todas</option>
              <option value="con">Con cita</option>
              <option value="sin">Sin cita</option>
            </select>
            {hayFiltrosActivos && (
              <button type="button" className="btn-sm" onClick={limpiarFiltros} title="Quitar todos los filtros">Limpiar filtros</button>
            )}
          </>
        )}
      </div>

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

      {vista === 'calendario' && (
        <CalendarioView
          avisos={avisosCalendario}
          metaTick={metaTick}
          onMetaChange={() => setMetaTick((t) => t + 1)}
          onDelete={eliminarAviso}
          onSelectAviso={(a) => {
            const key = avisoKey(a)
            setAvisos((prev) => {
              if (prev.some((x) => avisoKey(x) === key)) return prev
              return [a, ...prev]
            })
            setVista('lista')
            setScrollToAviso(String(a.aviso ?? a.orden))
            setTimeout(() => setScrollToAviso(null), 2000)
          }}
        />
      )}

      <div className="avisos">
        {vista === 'calendario' ? null : avisos.length === 0 ? (
          <div className="empty-state">
            <p>
              Selecciona un PDF y pulsa <strong>Procesar PDF</strong>
              <br />
              o abre el <strong>Historial</strong> de boletines anteriores.
              <br />
              El calendario une las citas de todos los boletines guardados.
            </p>
          </div>
        ) : avisosFiltrados.length === 0 ? (
          <div className="empty-state"><p>Ningun aviso coincide con los filtros.</p></div>
        ) : (
          avisosFiltrados.map((a, i) => (
            <div
              key={`${a.orden}-${a.aviso}-${i}`}
              id={`aviso-${a.aviso}`}
              className={scrollToAviso && String(a.aviso) === scrollToAviso ? 'aviso-highlight-wrap' : undefined}
            >
              <AvisoCard aviso={a} onMetaChange={() => setMetaTick((t) => t + 1)} onDelete={eliminarAviso} />
            </div>
          ))
        )}
      </div>

      <footer>React + Vite · n8n · Login Supabase · Offline PWA</footer>
    </div>
  )
}
