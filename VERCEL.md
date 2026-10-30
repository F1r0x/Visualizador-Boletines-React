# Despliegue en Vercel

## 1. Repo GitHub

https://github.com/F1r0x/Visualizador-Boletines-React

## 2. Conectar con Vercel

1. https://vercel.com → login con GitHub.
2. **Add New…** → **Project**.
3. Importa **Visualizador-Boletines-React**.
4. Ajustes:
   - Framework: **Vite**
   - Build: `npm run build`
   - Output: `dist`

## 3. Variables de entorno

**Settings → Environment Variables:**

- `VITE_SUPABASE_URL` = `https://xxxx.supabase.co`
- `VITE_SUPABASE_ANON_KEY` = tu clave anon public

Actívalas en Production, Preview y Development.

## 4. Deploy

Pulsa **Deploy**. URL tipo: `https://….vercel.app`

## 5. PWA en el móvil

Abre la URL HTTPS → Android: Instalar app / iPhone Safari: Añadir a pantalla de inicio.

Cada `git push` a main vuelve a desplegar automáticamente.
