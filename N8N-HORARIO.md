# Mejorar extracción de HORARIO en n8n

En el boletín el campo suele venir como **HORAS:** `09:30-10:30`.
Tu nodo *Generar json* ya lo mapea a `horario`, pero conviene reforzar el parser
y devolver JSON estructurado al webhook.

## 1. Nodo Generar json — bloque HORAS

```js
  let horas = extraerCampo(texto, 'HORAS')
    || extraerCampo(texto, 'HORARIO')
    || null;

  if (!horas) {
    const mH = texto.match(
      /HORAS?\s*:\s*(\d{1,2}:\d{2}\s*[-–—aA]\s*\d{1,2}:\d{2}|\d{1,2}:\d{2})/i
    );
    if (mH) horas = mH[1].trim();
  }

  if (horas && /^DATOS DEL/i.test(horas)) horas = null;
```

En el return: `horario: horas`

## 2. NIF limpio

```js
  const nifLimpio = (() => {
    if (!nif) return null;
    const s = nif.trim();
    if (/^DATOS DEL/i.test(s)) return null;
    return s;
  })();
```

## 3. Webhook: preferir JSON estructurado

Conecta `Generar json` → `Respond to Webhook`  
(o `responseBody: {{ $('Generar json').all().map(i => i.json) }}`)

## 4. App web

- Lee `horario` del webhook
- Muestra el horario en la tarjeta
- Rellena `citaHora` con el inicio (09:30) si no hay hora guardada
- El calendario muestra esa hora en las chips
