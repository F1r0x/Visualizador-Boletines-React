# PWA — Instalar en el móvil

## Instalación de dependencias

```bash
git pull
npm install
npm run icons   # opcional, si tienes ImageMagick
npm run build
npm run preview
```

## Android (Chrome)

1. Abre la URL **HTTPS** de la app (o preview en la misma Wi‑Fi).
2. Menú ⋮ → **Instalar aplicación** / **Añadir a la pantalla de inicio**.

## iPhone (Safari)

1. Abre la URL en **Safari**.
2. **Compartir** → **Añadir a pantalla de inicio**.

## Importante

- En `npm run dev` la PWA no se registra (solo en `build` + `preview` o en producción).
- iOS/Android requieren **HTTPS** para instalar (excepto localhost en el propio PC).
- Lo ideal: desplegar en Vercel/Netlify y abrir esa URL en el móvil.
