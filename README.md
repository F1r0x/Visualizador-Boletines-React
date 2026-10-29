# Visualizador de Boletines (React)

Versión en **React + Vite** de la página para subir PDFs de boletines y visualizar los avisos extraídos por n8n.

## Requisitos

- Node.js 18+

## Arrancar en local

```bash
git clone https://github.com/F1r0x/Visualizador-Boletines-React.git
cd Visualizador-Boletines-React
npm install
npm run dev
```

Abre la URL que muestre Vite (normalmente `http://localhost:5173`).

## Estructura

```
src/
  main.jsx
  App.jsx
  index.css
  components/AvisoCard.jsx
  utils/parseAvisos.js
  data/demoAvisos.js
```

## Uso

1. Pega la URL del webhook de n8n (`POST`, campo binario `data`).
2. Arrastra o selecciona el PDF.
3. Pulsa **Procesar PDF**.
4. O usa **Cargar datos de ejemplo**.

## Build

```bash
npm run build
```
