# Login email / contraseña

1. Supabase → Authentication → Providers → Email (activado).
2. Opcional: desactiva Confirm email si solo eres tú.
3. Authentication → Users → Add user (email + contraseña, Auto Confirm).
4. SQL Editor → ejecuta `supabase/auth-rls.sql`.
5. Vercel ya tiene VITE_SUPABASE_URL y ANON_KEY; push a main redeploya.
6. Abre la web → pantalla de login. Botón Salir arriba a la derecha.
