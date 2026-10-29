/** Valores basura del parser de n8n cuando un campo está vacío */
const VALORES_INVALIDOS = [
  'DATOS DEL APARATO:',
  'DATOS DEL APARATO',
  'DATOS DEL USUARIO:',
  'DATOS DEL USUARIO',
  'DATOS DE LA AVERÍA:',
  'DATOS DE LA AVERÍA',
  'DATOS DE LA AVERIA:',
  'DATOS DE LA AVERIA',
  'SEGURO:',
  'SEGURO',
  'FECHAS:',
  'FECHAS',
]

export function limpiarCampo(v) {
  if (v === null || v === undefined) return ''
  const s = String(v).trim()
  if (!s) return ''
  if (VALORES_INVALIDOS.some((bad) => s.toUpperCase() === bad.toUpperCase())) return ''
  if (/^DATOS DEL (APARATO|USUARIO|AVER[IÍ]A)\s*:?/i.test(s)) return ''
  if (/^(SEGURO|FECHAS)\s*:?$/i.test(s)) return ''
  return s
}

export function val(v) {
  if (v === null || v === undefined || v === '') return null
  if (Array.isArray(v)) return v.map(limpiarCampo).filter(Boolean).join(', ') || null
  const s = limpiarCampo(v)
  return s || null
}

/** Convierte formato plano columnaA/columnaB → array de avisos estructurados */
export function flatToStructured(items) {
  const avisos = []
  let actual = null

  for (const row of items) {
    const key = (row.columnaA || row.ColumnaA || '').trim()
    const raw = row.columnaB ?? row.ColumnaB ?? ''
    const cleaned = limpiarCampo(raw)

    if (key === 'ORDEN') {
      if (actual) avisos.push(actual)
      actual = {
        orden: raw,
        aviso: '',
        cliente: {},
        direccion: {},
        aparato: {},
        averia: {},
        seguro: {},
        fechas: {},
        tienda_solicitante: '',
        aviso_anterior: '',
      }
    } else if (!actual) {
      continue
    } else if (key === 'AVISO') actual.aviso = cleaned
    else if (key === 'Nombre') actual.cliente.nombre = cleaned
    else if (key === 'Teléfono') actual.cliente.telefonos = cleaned
    else if (key === 'NIF') actual.cliente.nif = cleaned
    else if (key === 'Dirección') actual.direccion.completa = cleaned
    else if (key === 'Código Postal') actual.direccion.codigo_postal = cleaned
    else if (key === 'Marca') actual.aparato.marca = cleaned
    else if (key === 'Modelo / KI') actual.aparato.modelo = cleaned
    else if (key === 'Tipo') actual.aparato.tipo = cleaned
    else if (key === 'Causa') actual.averia.causa = cleaned
    else if (key === 'Síntoma') actual.averia.sintoma = cleaned
    else if (key === 'Diagnóstico') actual.averia.diagnostico = cleaned
    else if (key === 'Compañía') actual.seguro.compania = cleaned
    else if (key === 'Modalidad') actual.seguro.modalidad = cleaned
    else if (key === 'Expediente') actual.seguro.expediente = cleaned
    else if (key === 'Tipo de urgencia') actual.seguro.tipo_urgencia = cleaned
    else if (key === 'Límite primera visita') actual.fechas.limite_primera_visita = cleaned
    else if (key === 'Límite terminación') actual.fechas.limite_terminacion = cleaned
    else if (key === 'Tienda solicitante') actual.tienda_solicitante = cleaned
    else if (key === 'Aviso anterior') actual.aviso_anterior = cleaned
  }
  if (actual) avisos.push(actual)
  return avisos
}

/** Normaliza respuesta de n8n (plana o estructurada) a array de avisos */
export function normalizarRespuestaN8n(data) {
  let items = []
  if (Array.isArray(data)) items = data
  else if (data?.data && Array.isArray(data.data)) items = data.data
  else if (data?.items && Array.isArray(data.items)) items = data.items
  else if (data && typeof data === 'object') items = [data]

  if (!items.length) return []

  const first = items[0]
  const firstJson = first.json || first
  const isFlat =
    firstJson.columnaA !== undefined ||
    firstJson.ColumnaA !== undefined ||
    first.columnaA !== undefined ||
    first.ColumnaA !== undefined

  if (isFlat) {
    return flatToStructured(items.map((it) => it.json || it))
  }

  return items.map((item) => {
    const j = item.json || item
    const cli = j.cliente || {}
    return {
      orden: j.orden,
      aviso: j.aviso,
      cliente: {
        nombre: limpiarCampo(cli.nombre),
        nif: limpiarCampo(cli.nif),
        telefonos: Array.isArray(cli.telefonos)
          ? cli.telefonos.map(limpiarCampo).filter(Boolean)
          : limpiarCampo(cli.telefonos),
      },
      direccion: {
        completa: limpiarCampo(j.direccion?.completa),
        codigo_postal: limpiarCampo(j.direccion?.codigo_postal),
      },
      aparato: {
        marca: limpiarCampo(j.aparato?.marca),
        modelo: limpiarCampo(j.aparato?.modelo),
        tipo: limpiarCampo(j.aparato?.tipo),
      },
      averia: {
        causa: limpiarCampo(j.averia?.causa),
        sintoma: limpiarCampo(j.averia?.sintoma),
        diagnostico: limpiarCampo(j.averia?.diagnostico),
      },
      seguro: {
        compania: limpiarCampo(j.seguro?.compania),
        modalidad: limpiarCampo(j.seguro?.modalidad),
        expediente: limpiarCampo(j.seguro?.expediente),
        tipo_urgencia: limpiarCampo(j.seguro?.tipo_urgencia),
      },
      fechas: {
        limite_primera_visita: limpiarCampo(j.fechas?.limite_primera_visita),
        limite_terminacion: limpiarCampo(j.fechas?.limite_terminacion),
      },
      tienda_solicitante: limpiarCampo(j.tienda_solicitante),
      aviso_anterior: limpiarCampo(j.aviso_anterior),
    }
  })
}

export function mapsUrl(direccion, cp) {
  const partes = [val(direccion), val(cp)].filter(Boolean)
  if (!partes.length) return null
  return (
    'https://www.google.com/maps/search/?api=1&query=' +
    encodeURIComponent(partes.join(', '))
  )
}
