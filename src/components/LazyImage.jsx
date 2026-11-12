import { useState, useEffect, useRef } from 'react'

/**
 * Carga diferida de imágenes (útiles con data URLs pesadas).
 * Solo asigna src cuando el elemento está cerca del viewport.
 */
export default function LazyImage({
  src,
  alt = '',
  className = '',
  rootMargin = '120px',
  onClick,
}) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || !src) return

    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true)
          io.disconnect()
        }
      },
      { root: null, rootMargin, threshold: 0.01 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [src, rootMargin])

  useEffect(() => {
    setLoaded(false)
  }, [src])

  return (
    <span
      ref={ref}
      className={`lazy-img-wrap ${className}`.trim()}
      data-loaded={loaded ? '1' : '0'}
    >
      {visible && src ? (
        <img
          src={src}
          alt={alt}
          className="lazy-img"
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onClick={onClick}
          draggable={false}
        />
      ) : (
        <span className="lazy-img-placeholder" aria-hidden="true" />
      )}
    </span>
  )
}
