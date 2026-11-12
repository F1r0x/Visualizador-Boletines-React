import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'boletines-theme-pref'

function readPref() {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'dark' || v === 'light' || v === 'system') return v
  } catch {
    /* ignore */
  }
  return 'system'
}

function systemIsDark() {
  if (typeof window === 'undefined' || !window.matchMedia) return true
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/** Resuelve preferencia → tema efectivo */
export function resolveTheme(pref) {
  if (pref === 'light') return 'light'
  if (pref === 'dark') return 'dark'
  return systemIsDark() ? 'dark' : 'light'
}

function applyDomTheme(resolved) {
  const root = document.documentElement
  root.setAttribute('data-theme', resolved)
  root.style.colorScheme = resolved === 'light' ? 'light' : 'dark'
}

/**
 * Preferencia de tema: sistema | oscuro | claro.
 * Por defecto sigue al sistema operativo.
 */
export function useTheme() {
  const [pref, setPrefState] = useState(readPref)
  const [resolved, setResolved] = useState(() => resolveTheme(readPref()))

  const apply = useCallback((nextPref) => {
    const r = resolveTheme(nextPref)
    setResolved(r)
    applyDomTheme(r)
  }, [])

  useEffect(() => {
    apply(pref)
  }, [pref, apply])

  useEffect(() => {
    if (pref !== 'system' || !window.matchMedia) return undefined
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => apply('system')
    if (mq.addEventListener) mq.addEventListener('change', onChange)
    else mq.addListener(onChange)
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange)
      else mq.removeListener(onChange)
    }
  }, [pref, apply])

  const setPref = useCallback((next) => {
    const v = next === 'light' || next === 'dark' || next === 'system' ? next : 'system'
    try {
      localStorage.setItem(STORAGE_KEY, v)
    } catch {
      /* ignore */
    }
    setPrefState(v)
  }, [])

  const cycle = useCallback(() => {
    const order = ['system', 'dark', 'light']
    const i = order.indexOf(pref)
    setPref(order[(i + 1) % order.length])
  }, [pref, setPref])

  return { pref, resolved, setPref, cycle }
}
