import { useState, useEffect } from 'react'
import { infoCacheOffline, isOnline } from '../utils/offlineCache'

export default function OfflineBanner() {
  const [online, setOnline] = useState(isOnline)
  const [info, setInfo] = useState(infoCacheOffline)

  useEffect(() => {
    const on = () => {
      setOnline(true)
      setInfo(infoCacheOffline())
    }
    const off = () => {
      setOnline(false)
      setInfo(infoCacheOffline())
    }
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    const t = setInterval(() => setInfo(infoCacheOffline()), 15000)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
      clearInterval(t)
    }
  }, [])

  if (online) {
    if (!info?.count) return null
    return (
      <div className="offline-bar online-ok" title="Caché lista para modo sin cobertura">
        <span>☁ Online</span>
        <span className="offline-meta">
          Caché: {info.count} aviso{info.count === 1 ? '' : 's'}
          {info.countHoy ? ` · ${info.countHoy} hoy` : ''}
        </span>
      </div>
    )
  }

  return (
    <div className="offline-bar offline" role="status">
      <span>📡 Sin conexión — modo offline</span>
      {info?.count ? (
        <span className="offline-meta">
          Mostrando caché ({info.count} avisos
          {info.fechaAgenda ? ` · ${info.fechaAgenda}` : ''})
        </span>
      ) : (
        <span className="offline-meta">
          No hay avisos en caché. Ábrela con red al menos una vez.
        </span>
      )}
    </div>
  )
}
