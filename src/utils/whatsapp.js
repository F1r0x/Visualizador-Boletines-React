import { val } from './parseAvisos'

/** Texto listo para pegar en WhatsApp al cliente */
export function plantillaWhatsApp(aviso) {
  const nombre = val(aviso.cliente?.nombre) || 'cliente'
  const marca = val(aviso.aparato?.marca) || ''
  const tipo = val(aviso.aparato?.tipo) || 'aparato'
  const modelo = val(aviso.aparato?.modelo) || ''
  const num = aviso.aviso ? ` (aviso ${aviso.aviso})` : ''

  const aparato = [marca, tipo, modelo].filter(Boolean).join(' ')

  return (
    `Hola ${nombre}, soy el técnico de servicio${num}. ` +
    `Me pongo en contacto respecto a su ${aparato || 'electrodoméstico'}. ` +
    `¿Le vendría bien que pasara a revisarlo? Un saludo.`
  )
}
