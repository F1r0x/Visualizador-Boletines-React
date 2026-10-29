import { useEffect, useState } from 'react'
import {
  isSupabaseConfigured,
  cloudListBatches,
  cloudLoadBatch,
  cloudSaveBatch,
  cloudSyncMeta,
  cloudSearchClientes,
  cloudStats,
  labelCliente,
} from '../utils/db'
import { val } from '../utils/parseAvisos'

export default function CloudPanel({ avisos, onLoadAvisos, onStatus }) {
  const [batches, setBatches] = useState([])
  const [stats, setStats] = useState(null)
  const [busy, setBusy] = useState(false)
  const [q, setQ] = useState('')
  const [clientes, setClientes] = useState([])
  const [tab, setTab] = useState('nube')

  const refresh = async () => {
    if (!isSupabaseConfigured) return
    try {
      const [b, s] = await Promise.all([cloudListBatches(), cloudStats()])
      setBatches(b)
      setStats(s)
    } catch (err) {
      onStatus?.({ msg: `Nube: ${err.message}`, type: 'error' })
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const guardar = async () => {
    if (!avisos?.length) {
      onStatus?.({ msg: 'No hay avisos que guardar en la nube.', type: 'error' })
      return
    }
    setBusy(true)
    try {
      const batch = await cloudSaveBatch(
        `Guardado ${new Date().toLocaleString('es-ES')}`,
        avisos
      )
      onStatus?.({
        msg: `Guardado en la nube: ${batch.nombre} (${batch.avisos_count} avisos).`,
        type: 'success',
      })
      await refresh()
    } catch (err) {
      onStatus?.({ msg: `Error al guardar: ${err.message}`, type: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const sincronizarMeta = async () => {
    if (!avisos?.length) return
    setBusy(true)
    try {
      await cloudSyncMeta(avisos)
      onStatus?.({ msg: 'Estados, notas y citas sincronizados en la nube.', type: 'success' })
    } catch (err) {
      onStatus?.({ msg: `Error sync: ${err.message}`, type: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const cargar = async (id) => {
    setBusy(true)
    try {
      const lista = await cloudLoadBatch(id)
      onLoadAvisos?.(lista)
      onStatus?.({
        msg: `Cargados ${lista.length} avisos desde la nube (con meta).`,
        type: 'success',
      })
    } catch (err) {
      onStatus?.({ msg: `Error al cargar: ${err.message}`, type: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const buscar = async () => {
    if (!q.trim()) return
    setBusy(true)
    try {
      const rows = await cloudSearchClientes(q)
      setClientes(rows)
      setTab('clientes')
    } catch (err) {
      onStatus?.({ msg: `Búsqueda: ${err.message}`, type: 'error' })
    } finally {
      setBusy(false)
    }
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="cloud-panel cloud-off">
        <h3>Base de datos (Supabase)</h3>
        <p>
          Aún no está configurado. Crea un proyecto gratis en{' '}
          <a href="https://supabase.com" target="_blank" rel="noreferrer">supabase.com</a>,
          ejecuta el SQL de <code>supabase/schema.sql</code> y crea <code>.env.local</code>:
        </p>
        <pre className="env-hint">{`VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=tu_anon_key`}</pre>
        <p className="hist-empty">Luego reinicia <code>npm run dev</code>.</p>
      </div>
    )
  }

  return (
    <div className="cloud-panel">
      <div className="cloud-tabs">
        <button type="button" className={tab === 'nube' ? 'btn-sm active' : 'btn-sm'} onClick={() => setTab('nube')}>Nube</button>
        <button type="button" className={tab === 'clientes' ? 'btn-sm active' : 'btn-sm'} onClick={() => setTab('clientes')}>Clientes</button>
        <button type="button" className={tab === 'stats' ? 'btn-sm active' : 'btn-sm'} onClick={() => { setTab('stats'); refresh() }}>Informe</button>
      </div>

      {tab === 'nube' && (
        <>
          <div className="cloud-actions">
            <button type="button" className="btn-sm" disabled={busy || !avisos.length} onClick={guardar}>Guardar lote en nube</button>
            <button type="button" className="btn-sm" disabled={busy || !avisos.length} onClick={sincronizarMeta}>Sync estados/citas</button>
            <button type="button" className="btn-sm" disabled={busy} onClick={refresh}>Actualizar lista</button>
          </div>
          {batches.length === 0 ? (
            <p className="hist-empty">No hay lotes en la nube todavía.</p>
          ) : (
            <ul className="hist-list">
              {batches.map((b) => (
                <li key={b.id}>
                  <button type="button" className="hist-item" onClick={() => cargar(b.id)} disabled={busy}>
                    <span className="hist-name">{b.nombre}</span>
                    <span className="hist-meta">{b.avisos_count} avisos · {new Date(b.created_at).toLocaleString('es-ES')}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {tab === 'clientes' && (
        <>
          <div className="cloud-search">
            <input type="search" placeholder="Nombre, NIF, dirección, modelo…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && buscar()} />
            <button type="button" className="btn-sm" onClick={buscar} disabled={busy}>Buscar</button>
          </div>
          {clientes.length === 0 ? (
            <p className="hist-empty">Busca para ver historial de clientes en la nube.</p>
          ) : (
            <ul className="hist-list">
              {clientes.map((r, i) => {
                const p = r.payload || {}
                return (
                  <li key={`${r.aviso_key}-${i}`}>
                    <button type="button" className="hist-item" onClick={() => onLoadAvisos?.([p])}>
                      <span className="hist-name">{labelCliente(p)}</span>
                      <span className="hist-meta">
                        {[val(p.aparato?.marca), val(p.aparato?.modelo), val(p.direccion?.completa), r.created_at && new Date(r.created_at).toLocaleDateString('es-ES')].filter(Boolean).join(' · ')}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}

      {tab === 'stats' && stats && (
        <div className="cloud-stats">
          <div className="stat"><div className="num">{stats.batches}</div><div className="label">Lotes</div></div>
          <div className="stat"><div className="num">{stats.avisos}</div><div className="label">Avisos</div></div>
          {Object.entries(stats.porEstado || {}).map(([e, c]) => (
            <div className="stat" key={e}><div className="num">{c}</div><div className="label">{e}</div></div>
          ))}
        </div>
      )}
    </div>
  )
}
