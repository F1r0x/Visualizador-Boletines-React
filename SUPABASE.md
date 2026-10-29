# Nivel 4 — Base de datos con Supabase (gratis)

## 1. Crear proyecto

1. Entra en https://supabase.com y crea una cuenta.
2. **New project** → nombre, contraseña de BD y región (p. ej. Frankfurt).
3. Espera 1–2 min.

## 2. Crear tablas

1. **SQL Editor** → **New query**.
2. Copia el contenido de `supabase/schema.sql`.
3. **Run**.

## 3. Claves API

**Project Settings** → **API**: copia Project URL y anon public key.

## 4. Configurar la app

```bash
cp .env.example .env.local
# edita .env.local con URL y ANON_KEY
npm install
npm run dev
```

## 5. Uso

Botón **Nube / BD**:
- Guardar lote en nube
- Sync estados/citas
- Cargar lotes guardados
- Buscar clientes
- Informe por estados
