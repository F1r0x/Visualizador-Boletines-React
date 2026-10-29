/** Datos de ejemplo ya estructurados (equivalente al pinData de n8n) */
export const DEMO_AVISOS = [
  {
    orden: 1,
    aviso: '898913',
    cliente: { nombre: 'VALENTIN MOCANO', telefonos: '637043583', nif: '' },
    direccion: {
      completa: 'CAL CANUTA PARTIDA NUM: 1 CALPE (ALICANTE-ALACANT) 03710',
      codigo_postal: '03710',
    },
    aparato: { marca: 'BOSCH', modelo: 'HRG6767S2/58', tipo: 'HORNO' },
    averia: {
      causa: 'Aparato instalado EN COLUMNA_Pieza rota:_Mando giratorio_de funciones',
      sintoma: '16X3* >>> DIAGNÓSTICO: Llevar mando de funciones',
      diagnostico: 'Llevar mando de funciones',
    },
    seguro: {},
    fechas: {},
    tienda_solicitante: '',
    aviso_anterior: '',
  },
  {
    orden: 2,
    aviso: '898912',
    cliente: { nombre: 'VALENTIN MOCANO', telefonos: '637043583', nif: '' },
    direccion: {
      completa: 'CAL CANUTA PARTIDA NUM: 1 CALPE (ALICANTE-ALACANT) 03710',
      codigo_postal: '03710',
    },
    aparato: { marca: 'BOSCH', modelo: 'CFA634GS1/01', tipo: 'MICROONDAS' },
    averia: {
      causa: 'Pieza rota:_Mando roto',
      sintoma: '16X3* >>> DIAGNÓSTICO: Cambiar mando',
      diagnostico: 'Cambiar mando',
    },
    seguro: {},
    fechas: {},
    tienda_solicitante: '',
    aviso_anterior: '',
  },
  {
    orden: 3,
    aviso: '898634',
    cliente: {
      nombre: 'ENRIQUE IVARS GARCIA',
      telefonos: '679400709',
      nif: '29026295L',
    },
    direccion: {
      completa: 'CAL DEL MEDITERRANEO 74 3 24 NUM: 0 TEULADA (ALICANTE-ALACANT) 03725',
      codigo_postal: '03725',
    },
    aparato: { marca: 'BALAY', modelo: 'Z9KDPWHA23(00)', tipo: 'SECADORA' },
    averia: {
      causa: 'COMPROBAR SI ES APARATO SUMMER Secadora',
      sintoma: '',
      diagnostico: '',
    },
    seguro: {
      compania: 'ASITUR ASISTENCIA S.A.',
      modalidad: 'ASITUR - Envío profesional',
      expediente: '261419541 N. POLIZA:',
      tipo_urgencia: 'Aviso Compañía Seguros',
    },
    fechas: {},
    tienda_solicitante: '',
    aviso_anterior: '',
  },
  {
    orden: 5,
    aviso: '898717',
    cliente: {
      nombre: 'JEAN MARC CHEMARIN',
      telefonos: '614583055',
      nif: 'Z2557266Q',
    },
    direccion: {
      completa:
        'CAL Calle ZONA OLIVOS, #183. NUM: 0 Benitachell/Poble Nou de Benitatxell, el (ALICANTE-ALACANT) 03726',
      codigo_postal: '03726',
    },
    aparato: { marca: 'NEFF', modelo: 'Z9KDPHNA04(00)', tipo: 'MICROONDAS' },
    averia: {
      causa: 'Microondas_No calienta en modo Microondas',
      sintoma: 'C273',
      diagnostico: '',
    },
    seguro: {
      compania: 'Sejescar S.L.',
      modalidad: 'Sejescar- Siniestro (con ppto)',
      expediente: '21857946 N. POLIZA:',
      tipo_urgencia: 'Urgencia 24 horas compañías',
    },
    fechas: {
      limite_primera_visita: '09-09-2026',
      limite_terminacion: '05-11-2026',
    },
    tienda_solicitante: '',
    aviso_anterior: '',
  },
  {
    orden: 9,
    aviso: '898650',
    cliente: {
      nombre: 'WILFRIED BRAUER',
      telefonos: '4915755740954, 04915755740954',
      nif: 'Y0615372K',
    },
    direccion: {
      completa: 'MARYVILLA NUM: 28 BLOQ: H CALP (ALICANTE-ALACANT) 03710',
      codigo_postal: '03710',
    },
    aparato: { marca: 'BOSCH', modelo: 'KIV86VSE0/07', tipo: 'FRIGORIFICO' },
    averia: {
      causa:
        'Ruido_constante (zumbido, ruido de motor) y/o se percibe un aumento del nivel de ruido_El ruido no desaparece al abrir la puerta._Enfría bien',
      sintoma: '1400* >>> DIAGNÓSTICO: Posible ruido trampilla motorizada (modelos adde',
      diagnostico: 'Posible ruido trampilla motorizada (modelos adde',
    },
    seguro: { tipo_urgencia: 'Urgente' },
    fechas: {
      limite_primera_visita: '09-09-2026',
      limite_terminacion: '15-09-2026',
    },
    tienda_solicitante: 'AITANA HOME SOLUTIONS, S.L (0600055700)',
    aviso_anterior: '858282',
  },
]
