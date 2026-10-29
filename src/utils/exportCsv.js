import { val } from './parseAvisos'
import { getMeta } from './localMeta'

function esc(v) {
  const s = v == null ? '' : String(v)
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function exportAvisosCsv(avisos) {
  const headers = [
    'Orden',
    'Aviso',
    'Estado',
    'Nota',
    'Nombre',
    'Teléfono',
    'NIF',
    'Dirección',
    'C.P.',
    'Marca',
    'Modelo',
    'Tipo',
    'Causa',
    'Síntoma',
    'Diagnóstico',
    'Compañía',
    'Modalidad',
    'Expediente',
    'Urgencia',
    'Límite 1ª visita',
    'Límite terminación',
    'Tienda',
    'Aviso anterior',
  ]

  const rows = avisos.map((a) => {
    const meta = getMeta(a)
    const tel = Array.isArray(a.cliente?.telefonos)
      ? a.cliente.telefonos.join(', ')
      : a.cliente?.telefonos || ''
    return [
      a.orden,
      a.aviso,
      meta.estado,
      meta.nota,
      val(a.cliente?.nombre),
      tel,
      val(a.cliente?.nif),
      val(a.direccion?.completa),
      val(a.direccion?.codigo_postal),
      val(a.aparato?.marca),
      val(a.aparato?.modelo),
      val(a.aparato?.tipo),
      val(a.averia?.causa),
      val(a.averia?.sintoma),
      val(a.averia?.diagnostico),
      val(a.seguro?.compania),
      val(a.seguro?.modalidad),
      val(a.seguro?.expediente),
      val(a.seguro?.tipo_urgencia),
      val(a.fechas?.limite_primera_visita),
      val(a.fechas?.limite_terminacion),
      val(a.tienda_solicitante),
      val(a.aviso_anterior),
    ].map(esc)
  })

  const csv = [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `avisos-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
