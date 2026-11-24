// Rubros: cada negocio elige el suyo y la app adapta textos, campos del pedido, ejemplos y la demo de la landing.
// Los campos de la base no cambian (orders.dedication / orders.allergies): solo cambia cómo se llaman.

const DEFAULT_SLOTS = ['10:00 a 13:00', '16:00 a 20:00'];

export const RUBROS = {
  cocina: {
    key: 'cocina',
    label: 'Cocina y pastelería',
    short: 'Cocina',
    ejemplos: 'Pastelerías, viandas, cocina casera, hamburgueserías',
    icon: 'M6 13.9A4 4 0 0 1 7.5 6a5 5 0 0 1 9 0A4 4 0 0 1 18 13.9V21H6zM6 17h12',
    items: 'Productos',
    item: 'producto',
    insumos: 'Insumos',
    insumo: 'Insumo',
    receta: 'Receta',
    workMode: 'Modo cocina',
    pending: 'no cocinar hasta confirmar',
    capTitle: 'Poné cuántas unidades podés hacer por día',
    capHint: 'Así nunca te piden más de lo que entra en el horno.',
    capExample: 'Tortas grandes',
    note1: { label: 'Dedicatoria', ph: 'Ej: ¡Feliz cumple Sofi!' },
    note2: { label: 'Alergias o restricciones', ph: 'Ej: sin TACC, sin frutos secos', warn: true },
    retiro: 'Retiro',
    envio: 'Envío a domicilio',
    bizPh: 'Ej: Lola Pastelería',
    slugPh: 'dulce-lola',
    slots: DEFAULT_SLOTS,
    demo: {
      day: 'Sábado 22',
      cap: 'Cupo de horno · Tortas',
      capCount: '5 de 6',
      order: 'Torta Rogel · sáb 22 · 10 a 13 h · Martina G.',
      deposit: '$ 18.500',
      alert: 'Subió la manteca 14 %',
      alertSub: 'La Rogel quedó con 9 % de margen. Precio sugerido:',
      price: '$ 38.900',
    },
    sample: {
      insumos: [
        ['Harina 000', 'Bolsa', 1, 'kg', 1200, 'Mayorista', ''],
        ['Manteca', 'Pan', 500, 'g', 4000, 'Mayorista', ''],
        ['Huevos', 'Maple', 30, 'u', 6000, 'Granja', ''],
        ['Azúcar', 'Paquete', 1, 'kg', 1500, 'Mayorista', ''],
        ['Chocolate semiamargo', 'Barra', 1, 'kg', 15000, 'Distribuidora', ''],
        ['Crema de leche', 'Pote', 500, 'ml', 3500, 'Mayorista', ''],
      ],
      productos: [
        ['P-001', 'Torta de chocolate grande', 'Tortas grandes', 18000, '', 'Sí', '', 'Bizcochuelo húmedo, ganache y crema. 20 porciones.'],
        ['P-002', 'Docena de alfajores', 'Alfajores', 12500, 20, 'Sí', '', 'Alfajores caseros bañados en chocolate semiamargo.'],
      ],
      recipes: {
        'P-001': [['Harina 000', 500, 'g'], ['Huevos', 6, 'u'], ['Manteca', 200, 'g'], ['Azúcar', 300, 'g'], ['Chocolate semiamargo', 300, 'g'], ['Crema de leche', 200, 'ml']],
        'P-002': [['Harina 000', 300, 'g'], ['Manteca', 150, 'g'], ['Azúcar', 100, 'g'], ['Huevos', 2, 'u'], ['Chocolate semiamargo', 250, 'g']],
      },
    },
  },
  belleza: {
    key: 'belleza',
    label: 'Belleza y estética',
    short: 'Belleza',
    ejemplos: 'Peluquerías, uñas, cejas y pestañas, masajes, barberías',
    icon: 'M6 3v6a6 6 0 0 0 12 0V3M12 15v6M8 21h8',
    items: 'Servicios',
    item: 'servicio',
    insumos: 'Materiales',
    insumo: 'Material',
    receta: 'Materiales por servicio',
    workMode: 'Turnos del día',
    pending: 'esperando la seña para confirmar el turno',
    capTitle: 'Poné cuántos turnos atendés por día',
    capHint: 'Así nunca te reservan más turnos de los que podés atender.',
    capExample: 'Uñas',
    note1: { label: 'Detalle o referencia', ph: 'Ej: mismo color que la última vez' },
    note2: { label: 'Alergias o sensibilidades', ph: 'Ej: alergia al látex', warn: true },
    retiro: 'En el local',
    envio: 'A domicilio',
    bizPh: 'Ej: Estudio Nails Lu',
    slugPh: 'nails-lu',
    slots: ['10:00', '11:30', '13:00', '15:00', '16:30', '18:00'],
    slotCapacity: 1,
    demo: {
      day: 'Viernes 21',
      cap: 'Turnos · Uñas',
      capCount: '7 de 8',
      order: 'Esmaltado semipermanente · vie 21 · 16:30 · Carla M.',
      deposit: '$ 6.000',
      alert: 'Subió el esmalte 18 %',
      alertSub: 'El semipermanente quedó con 12 % de margen. Precio sugerido:',
      price: '$ 14.500',
    },
    sample: {
      insumos: [
        ['Esmalte semipermanente', 'Frasco', 10, 'ml', 9000, 'Distribuidora', ''],
        ['Base y top coat', 'Kit', 20, 'ml', 14000, 'Distribuidora', ''],
        ['Algodón', 'Paquete', 100, 'u', 2500, 'Farmacia', ''],
        ['Shampoo profesional', 'Bidón', 1, 'l', 12000, 'Distribuidora', ''],
      ],
      productos: [
        ['S-001', 'Esmaltado semipermanente', 'Uñas', 12000, '', 'Sí', '', 'Limado, cutícula y esmaltado. 1 hora.'],
        ['S-002', 'Corte y brushing', 'Peluquería', 15000, '', 'Sí', '', 'Lavado, corte y brushing. 1 hora y media.'],
      ],
      recipes: {
        'S-001': [['Esmalte semipermanente', 1, 'ml'], ['Base y top coat', 1, 'ml'], ['Algodón', 6, 'u']],
        'S-002': [['Shampoo profesional', 40, 'ml'], ['Algodón', 2, 'u']],
      },
    },
  },
  regalos: {
    key: 'regalos',
    label: 'Regalos y personalizados',
    short: 'Regalos',
    ejemplos: 'Desayunos sorpresa, boxes, florerías, cotillón, souvenirs',
    icon: 'M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z',
    items: 'Productos',
    item: 'producto',
    insumos: 'Materiales',
    insumo: 'Material',
    receta: 'Materiales por unidad',
    workMode: 'Modo armado',
    pending: 'no armar hasta confirmar',
    capTitle: 'Poné cuántos pedidos podés armar por día',
    capHint: 'Así nunca te piden más de lo que llegás a armar y entregar.',
    capExample: 'Desayunos',
    note1: { label: 'Mensaje de la tarjeta', ph: 'Ej: ¡Feliz aniversario, te amo!' },
    note2: { label: 'Indicaciones', ph: 'Ej: tocar timbre 3B, es sorpresa', warn: false },
    retiro: 'Retiro',
    envio: 'Envío a domicilio',
    bizPh: 'Ej: Despertares Regalos',
    slugPh: 'despertares',
    slots: ['8:00 a 10:00', '10:00 a 12:00', '16:00 a 19:00'],
    demo: {
      day: 'Domingo 16',
      cap: 'Cupo de armado · Desayunos',
      capCount: '11 de 12',
      order: 'Desayuno sorpresa · dom 16 · 8 a 10 h · Julián R.',
      deposit: '$ 14.000',
      alert: 'Subieron las medialunas 20 %',
      alertSub: 'El desayuno quedó con 11 % de margen. Precio sugerido:',
      price: '$ 31.500',
    },
    sample: {
      insumos: [
        ['Caja kraft con visor', 'Pack', 10, 'u', 15000, 'Mayorista', ''],
        ['Globo metalizado', 'Pack', 10, 'u', 8000, 'Cotillón', ''],
        ['Medialunas', 'Docena', 12, 'u', 7200, 'Panadería', ''],
        ['Café en grano', 'Paquete', 250, 'g', 5000, 'Tostadero', ''],
        ['Tarjeta impresa', 'Pack', 50, 'u', 6000, 'Imprenta', ''],
      ],
      productos: [
        ['R-001', 'Desayuno sorpresa', 'Desayunos', 28000, '', 'Sí', '', 'Café, medialunas, jugo y globo, en caja con tarjeta.'],
        ['R-002', 'Box de cumpleaños', 'Boxes', 22000, 15, 'Sí', '', 'Caja con dulces, globo y tarjeta personalizada.'],
      ],
      recipes: {
        'R-001': [['Caja kraft con visor', 1, 'u'], ['Globo metalizado', 1, 'u'], ['Medialunas', 4, 'u'], ['Café en grano', 30, 'g'], ['Tarjeta impresa', 1, 'u']],
        'R-002': [['Caja kraft con visor', 1, 'u'], ['Globo metalizado', 2, 'u'], ['Tarjeta impresa', 1, 'u']],
      },
    },
  },
  servicios: {
    key: 'servicios',
    label: 'Talleres y servicios',
    short: 'Talleres',
    ejemplos: 'Costura y arreglos, sublimación, impresión 3D, reparaciones',
    icon: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z',
    items: 'Trabajos',
    item: 'trabajo',
    insumos: 'Materiales',
    insumo: 'Material',
    receta: 'Materiales por unidad',
    workMode: 'Modo taller',
    pending: 'no empezar hasta confirmar',
    capTitle: 'Poné cuántos trabajos podés entregar por día',
    capHint: 'Así nunca te comprometés a más de lo que sale del taller.',
    capExample: 'Sublimación',
    note1: { label: 'Detalle del trabajo', ph: 'Ej: nombre «Martín» en letra cursiva' },
    note2: { label: 'Medidas o aclaraciones', ph: 'Ej: subir el ruedo 3 cm', warn: false },
    retiro: 'Retiro en el taller',
    envio: 'Envío a domicilio',
    bizPh: 'Ej: Taller Sublima',
    slugPh: 'sublima',
    slots: DEFAULT_SLOTS,
    demo: {
      day: 'Jueves 20',
      cap: 'Cupo del taller · Sublimación',
      capCount: '23 de 24',
      order: '12 tazas sublimadas · jue 20 · 16 a 20 h · Club Atlético',
      deposit: '$ 45.000',
      alert: 'Subieron las tazas 15 %',
      alertSub: 'La taza sublimada quedó con 8 % de margen. Precio sugerido:',
      price: '$ 8.900',
    },
    sample: {
      insumos: [
        ['Taza blanca sublimable', 'Caja', 36, 'u', 54000, 'Mayorista', ''],
        ['Papel de sublimación', 'Paquete', 100, 'u', 9000, 'Mayorista', ''],
        ['Hilo de poliéster', 'Cono', 1, 'u', 2500, 'Mercería', ''],
        ['Cierre de 18 cm', 'Bolsa', 50, 'u', 15000, 'Mercería', ''],
      ],
      productos: [
        ['T-001', 'Taza sublimada', 'Sublimación', 7500, '', 'Sí', '', 'Taza de cerámica con tu diseño o foto.'],
        ['T-002', 'Cambio de cierre', 'Arreglos', 9000, '', 'Sí', '', 'Cambio de cierre de pantalón o pollera.'],
      ],
      recipes: {
        'T-001': [['Taza blanca sublimable', 1, 'u'], ['Papel de sublimación', 1, 'u']],
        'T-002': [['Cierre de 18 cm', 1, 'u'], ['Hilo de poliéster', 0.05, 'u']],
      },
    },
  },
  eventos: {
    key: 'eventos',
    label: 'Alquileres y eventos',
    short: 'Eventos',
    ejemplos: 'Inflables, vajilla, sonido e iluminación, livings, carpas',
    icon: 'M3 21h18M5 21V10l7-6 7 6v11M9 21v-6h6v6',
    items: 'Artículos',
    item: 'artículo',
    insumos: 'Gastos',
    insumo: 'Gasto',
    receta: 'Gastos por alquiler',
    workMode: 'Modo armado',
    pending: 'no cargar hasta confirmar',
    capTitle: 'Poné cuántas unidades tenés para alquilar por día',
    capHint: 'Así nunca alquilás dos veces el mismo inflable para el mismo día.',
    capExample: 'Inflables',
    note1: { label: 'Detalle del evento', ph: 'Ej: cumple de 5 años, 30 chicos' },
    note2: { label: 'Indicaciones de entrega', ph: 'Ej: patio con acceso por el garaje', warn: false },
    retiro: 'Retira en el depósito',
    envio: 'Entrega e instalación',
    bizPh: 'Ej: Saltarín Eventos',
    slugPh: 'saltarin',
    slots: ['Mañana', 'Tarde', 'Noche'],
    demo: {
      day: 'Sábado 29',
      cap: 'Disponibles · Inflables',
      capCount: '2 de 3',
      order: 'Inflable castillo · sáb 29 · Tarde · Familia Gómez',
      deposit: '$ 22.500',
      alert: 'Subió el flete 25 %',
      alertSub: 'El inflable quedó con 14 % de margen. Precio sugerido:',
      price: '$ 52.000',
    },
    sample: {
      insumos: [
        ['Flete ida y vuelta', 'Viaje', 1, 'u', 12000, 'Fletero', ''],
        ['Limpieza y desinfección', 'Servicio', 1, 'u', 5000, '', ''],
        ['Detergente', 'Bidón', 5, 'l', 9000, 'Mayorista', ''],
      ],
      productos: [
        ['A-001', 'Inflable castillo', 'Inflables', 45000, '', 'Sí', '', 'Castillo de 4 x 4 m con motor. Incluye armado.'],
        ['A-002', 'Kit vajilla para 50', 'Vajilla', 25000, '', 'Sí', '', 'Platos, cubiertos y copas para 50 personas.'],
      ],
      recipes: {
        'A-001': [['Flete ida y vuelta', 1, 'u'], ['Limpieza y desinfección', 1, 'u']],
        'A-002': [['Flete ida y vuelta', 1, 'u'], ['Detergente', 500, 'ml']],
      },
    },
  },
  oficios: {
    key: 'oficios',
    label: 'Oficios y mantenimiento',
    short: 'Oficios',
    ejemplos: 'Electricistas, gasistas, plomeros, aire acondicionado, cerrajeros',
    icon: 'M13 2 3 14h9l-1 8 10-12h-9l1-8z',
    items: 'Servicios',
    item: 'servicio',
    insumos: 'Materiales',
    insumo: 'Material',
    receta: 'Materiales por trabajo',
    workMode: 'Trabajos del día',
    pending: 'confirmar la visita antes de salir',
    capTitle: 'Poné cuántas visitas hacés por día',
    capHint: 'Así no te comprometés a más trabajos de los que llegás a hacer.',
    capExample: 'Visitas',
    note1: { label: 'Qué pasa', ph: 'Ej: salta la térmica cuando prendo el horno' },
    note2: { label: 'Cómo llegar o aclaraciones', ph: 'Ej: timbre 3B, hay perro, edificio sin ascensor', warn: false },
    photoLabel: 'Foto del problema',
    retiro: 'En el taller',
    envio: 'A domicilio',
    bizPh: 'Ej: Electricidad Ramírez',
    slugPh: 'electricidad-ramirez',
    slots: ['8 a 12 h', '14 a 18 h'],
    slotCapacity: 2,
    minDays: 0,
    delivery: true,
    demo: {
      day: 'Martes 24',
      cap: 'Visitas del día',
      capCount: '3 de 4',
      order: 'Revisión eléctrica · mar 24 · 8 a 12 h · Laura P.',
      deposit: '$ 15.000',
      alert: 'Subió el cable 2,5 mm 20 %',
      alertSub: 'La instalación de toma quedó con 22 % de margen. Precio sugerido:',
      price: '$ 38.000',
    },
    sample: {
      insumos: [
        ['Cable unipolar 2,5 mm', 'Rollo', 100, 'm', 85000, 'Casa de electricidad', ''],
        ['Llave térmica 2x20 A', 'Unidad', 1, 'u', 14000, 'Casa de electricidad', ''],
        ['Toma doble con tierra', 'Unidad', 1, 'u', 6500, 'Casa de electricidad', ''],
        ['Teflón y cinta', 'Kit', 1, 'u', 3000, 'Ferretería', ''],
      ],
      productos: [
        ['O-001', 'Visita y diagnóstico', 'Visitas', 15000, '', 'Sí', '', 'Vamos, revisamos y te pasamos el presupuesto. Se descuenta si hacemos el trabajo.'],
        ['O-002', 'Cambio de llave térmica', 'Electricidad', 35000, '', 'Sí', '', 'Incluye la térmica 2x20 A y la mano de obra.'],
        ['O-003', 'Instalación de toma', 'Electricidad', 30000, '', 'Sí', '', 'Toma doble con tierra, hasta 3 m de cable.'],
      ],
      recipes: {
        'O-002': [['Llave térmica 2x20 A', 1, 'u']],
        'O-003': [['Toma doble con tierra', 1, 'u'], ['Cable unipolar 2,5 mm', 3, 'm']],
      },
    },
  },
  optica: {
    key: 'optica',
    label: 'Óptica',
    short: 'Óptica',
    ejemplos: 'Anteojos de sol, armazones, recetados y lentes de contacto, con retiro coordinado',
    icon: 'M2 13a4 4 0 1 0 8 0 4 4 0 1 0-8 0M14 13a4 4 0 1 0 8 0 4 4 0 1 0-8 0M10 13h4M2 13l2-7h2M22 13l-2-7h-2',
    items: 'Productos',
    item: 'producto',
    insumos: 'Materiales',
    insumo: 'Material',
    receta: 'Materiales por trabajo',
    workMode: 'Modo taller',
    pending: 'no reservar ni mandar al laboratorio hasta cobrar la seña',
    capTitle: 'Poné cuántos trabajos podés entregar por día',
    capHint: 'Así no prometés más anteojos de los que el laboratorio y el taller llegan a hacer.',
    capExample: 'Recetados',
    note1: { label: 'Graduación (solo si son con receta)', ph: 'Ej: OD -1,50 -0,50 x180 · OI -1,25 · DIP 62' },
    note2: { label: 'Indicaciones u obra social', ph: 'Ej: color negro, lo retira mi hermana; OSDE 210', warn: false },
    photoLabel: 'Foto de la receta (si son recetados)',
    readyMsg: true,
    retiro: 'Retiro en la óptica',
    envio: 'Envío a domicilio',
    bizPh: 'Ej: Óptica Visión Clara',
    slugPh: 'vision-clara',
    slots: ['10:00 a 13:00', '16:00 a 20:00'],
    minDays: 1,
    demo: {
      day: 'Jueves 20',
      cap: 'Entregas del día · Recetados',
      capCount: '9 de 12',
      order: 'Anteojos multifocales · jue 20 · 16 a 20 h · Marta P.',
      deposit: '$ 95.000',
      alert: 'Subieron los cristales 12 %',
      alertSub: 'Los multifocales quedaron con 18 % de margen. Precio sugerido:',
      price: '$ 214.000',
    },
    sample: {
      insumos: [
        ['Par de cristales orgánicos monofocales', 'Par', 1, 'u', 28000, 'Laboratorio', ''],
        ['Par de cristales multifocales', 'Par', 1, 'u', 120000, 'Laboratorio', ''],
        ['Armazón de stock', 'Unidad', 1, 'u', 25000, 'Distribuidora', ''],
        ['Estuche y paño', 'Pack', 10, 'u', 20000, 'Distribuidora', ''],
        ['Caja de lentes de contacto mensuales', 'Caja', 6, 'u', 38000, 'Distribuidora', ''],
        ['Anteojos de sol polarizados (costo)', 'Unidad', 1, 'u', 18000, 'Distribuidora', ''],
      ],
      productos: [
        ['O-001', 'Anteojos de sol polarizados', 'Sol', 45000, 10, 'Sí', '', 'Elegí el día y horario para retirarlos en la óptica.'],
        ['O-003', 'Anteojos recetados monofocales', 'Recetados', 95000, '', 'Sí', '', 'Armazón a elección + cristales orgánicos. Subí la foto de tu receta. Listos en 3 a 5 días hábiles.'],
        ['O-002', 'Lentes de contacto mensuales (caja x6)', 'Lentes de contacto', 52000, 20, 'Sí', '', 'Con tu receta de contactología vigente.'],
      ],
      recipes: {
        'O-001': [['Anteojos de sol polarizados (costo)', 1, 'u'], ['Estuche y paño', 1, 'u']],
        'O-002': [['Caja de lentes de contacto mensuales', 1, 'u']],
        'O-003': [['Par de cristales orgánicos monofocales', 1, 'u'], ['Armazón de stock', 1, 'u'], ['Estuche y paño', 1, 'u']],
      },
    },
  },
  otro: {
    key: 'otro',
    label: 'Otro rubro por encargo',
    short: 'Otro',
    ejemplos: 'Cualquier negocio que trabaja con pedidos, turnos o reservas',
    icon: 'M12 2 2 7l10 5 10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
    items: 'Productos',
    item: 'producto',
    insumos: 'Materiales',
    insumo: 'Material',
    receta: 'Materiales por unidad',
    workMode: 'Modo trabajo',
    pending: 'no preparar hasta confirmar',
    capTitle: 'Poné cuántos pedidos podés hacer por día',
    capHint: 'Así nunca te piden más de lo que llegás a hacer.',
    capExample: 'Encargos',
    note1: { label: 'Detalle del pedido', ph: 'Ej: color azul, con nombre' },
    note2: { label: 'Indicaciones', ph: 'Ej: entregar después de las 18', warn: false },
    retiro: 'Retiro',
    envio: 'Envío a domicilio',
    bizPh: 'Ej: Mi Emprendimiento',
    slugPh: 'mi-emprendimiento',
    slots: DEFAULT_SLOTS,
    demo: {
      day: 'Martes 18',
      cap: 'Cupo del día · Encargos',
      capCount: '9 de 10',
      order: 'Encargo personalizado · mar 18 · 16 a 20 h · Lucía P.',
      deposit: '$ 10.000',
      alert: 'Subió un material 12 %',
      alertSub: 'El encargo quedó con 10 % de margen. Precio sugerido:',
      price: '$ 23.000',
    },
    sample: {
      insumos: [
        ['Material principal', 'Paquete', 10, 'u', 20000, 'Proveedor', ''],
        ['Packaging', 'Pack', 50, 'u', 10000, 'Proveedor', ''],
      ],
      productos: [
        ['E-001', 'Encargo personalizado', 'Encargos', 20000, '', 'Sí', '', 'Cambiá este ejemplo por lo que vendés.'],
        ['E-002', 'Encargo simple', 'Encargos', 9000, 30, 'Sí', '', 'Cambiá este ejemplo por lo que vendés.'],
      ],
      recipes: {
        'E-001': [['Material principal', 2, 'u'], ['Packaging', 1, 'u']],
        'E-002': [['Material principal', 1, 'u'], ['Packaging', 1, 'u']],
      },
    },
  },
};

// Palabras de la app que cambian según el rubro: cómo se llaman los pedidos, la pantalla de trabajo
// y los pasillos de la lista de compras (las claves se guardan en shopping_items.category).
const TERMS = {
  cocina: {
    shopEx: 'Harina 5 kg $6500',
    orders: 'Pedidos', order: 'pedido', orderCap: 'Pedido', prodTitle: 'Producción y compras', prepTab: 'Qué preparar',
    shopCats: [['secos', 'Secos'], ['frescos', 'Lácteos/Frescos'], ['carnes', 'Carnes'], ['packaging', 'Packaging'], ['otros', 'Otros']],
  },
  belleza: {
    shopEx: 'Esmalte 3 un $9000',
    orders: 'Turnos', order: 'turno', orderCap: 'Turno', prodTitle: 'Día y compras', prepTab: 'Qué atender',
    shopCats: [['uso', 'Productos de uso'], ['descartables', 'Descartables'], ['reventa', 'Para vender'], ['otros', 'Otros']],
  },
  regalos: {
    shopEx: 'Cajas 20 un $8000',
    orders: 'Pedidos', order: 'pedido', orderCap: 'Pedido', prodTitle: 'Armado y compras', prepTab: 'Qué armar',
    shopCats: [['materiales', 'Materiales'], ['packaging', 'Packaging'], ['deco', 'Decoración'], ['otros', 'Otros']],
  },
  servicios: {
    shopEx: 'Tornillos 100 un $5000',
    orders: 'Trabajos', order: 'trabajo', orderCap: 'Trabajo', prodTitle: 'Trabajo y compras', prepTab: 'Qué hacer',
    shopCats: [['materiales', 'Materiales'], ['repuestos', 'Repuestos'], ['herramientas', 'Herramientas'], ['otros', 'Otros']],
  },
  eventos: {
    shopEx: 'Lavandina 5 l $4000',
    orders: 'Reservas', order: 'reserva', orderCap: 'Reserva', prodTitle: 'Armado y compras', prepTab: 'Qué armar',
    shopCats: [['limpieza', 'Limpieza'], ['repuestos', 'Repuestos'], ['descartables', 'Descartables'], ['otros', 'Otros']],
  },
  oficios: {
    shopEx: 'Cable 2,5 mm 10 m $9000',
    orders: 'Trabajos', order: 'trabajo', orderCap: 'Trabajo', prodTitle: 'Trabajos y compras', prepTab: 'Qué hacer',
    shopCats: [['electricidad', 'Electricidad'], ['sanitarios', 'Sanitarios y gas'], ['ferreteria', 'Ferretería'], ['otros', 'Otros']],
  },
  optica: {
    shopEx: 'Estuches 20 un $15000',
    orders: 'Trabajos', order: 'trabajo', orderCap: 'Trabajo', prodTitle: 'Taller y compras', prepTab: 'Qué entregar',
    shopCats: [['cristales', 'Cristales y laboratorio'], ['armazones', 'Armazones'], ['contacto', 'Lentes de contacto'], ['accesorios', 'Estuches y accesorios'], ['otros', 'Otros']],
  },
  otro: {
    shopEx: 'Bolsas 50 un $3000',
    orders: 'Pedidos', order: 'pedido', orderCap: 'Pedido', prodTitle: 'Trabajo y compras', prepTab: 'Qué hacer',
    shopCats: [['materiales', 'Materiales'], ['packaging', 'Packaging'], ['otros', 'Otros']],
  },
};
for (const k of Object.keys(RUBROS)) Object.assign(RUBROS[k], TERMS[k] || TERMS.otro);

// Cómo se ve el link del cliente en cada rubro: qué se pide, con qué palabras y qué campos sobran.
// qty: elegir cantidad · occasion: «¿para qué ocasión?» · photo: subir foto · policyPh: condiciones sugeridas.
const LINK = {
  cocina: {
    mode: 'pedido', qty: true, occasion: true, photo: true,
    pick: 'Elegí qué querés', cta: 'Pedir', form: 'Tu pedido', submit: 'Enviar pedido', when: 'Cuándo lo querés',
    policyPh: 'Ej: La seña reserva la fecha. Cambios de sabor o diseño hasta 48 h antes. Si cancelás con menos de 48 h, la seña no se devuelve.',
  },
  belleza: {
    mode: 'turno', qty: false, occasion: false, photo: true,
    pick: 'Elegí el servicio', cta: 'Reservar', form: 'Tu turno', submit: 'Reservar turno', when: 'Día y hora',
    policyPh: 'Ej: Llegá 5 minutos antes; hay 10 minutos de tolerancia. Si no podés venir, avisá con 24 h de anticipación o se pierde la seña.',
  },
  regalos: {
    mode: 'pedido', qty: true, occasion: true, photo: true,
    pick: 'Elegí tu regalo', cta: 'Pedir', form: 'Tu pedido', submit: 'Enviar pedido', when: 'Cuándo se entrega',
    policyPh: 'Ej: Entregamos en la franja elegida. Si no hay nadie para recibir, te escribimos por WhatsApp para coordinar.',
  },
  servicios: {
    mode: 'pedido', qty: true, occasion: true, photo: true,
    pick: 'Elegí qué necesitás', cta: 'Pedir', form: 'Tu trabajo', submit: 'Enviar pedido', when: 'Para cuándo',
    policyPh: 'Ej: Arrancamos con la seña y el diseño aprobado. Una vez aprobado no se hacen cambios.',
  },
  eventos: {
    mode: 'reserva', qty: true, occasion: true, photo: false,
    pick: 'Elegí qué alquilar', cta: 'Reservar', form: 'Tu reserva', submit: 'Reservar fecha', when: 'Fecha del evento',
    policyPh: 'Ej: La fecha se confirma con la seña. Si cancelás con 7 días o más te devolvemos la seña. Necesitamos un enchufe cerca y lugar libre de 5 × 5 m.',
  },
  oficios: {
    mode: 'visita', qty: false, occasion: false, photo: true,
    pick: 'Elegí qué necesitás', cta: 'Pedir', form: 'Pedí tu visita', submit: 'Pedir visita', when: 'Qué día y franja te queda bien',
    policyPh: 'Ej: La visita para presupuestar cuesta $15.000 y se descuenta si hacemos el trabajo. Los materiales se presupuestan aparte. Garantía de 90 días en la mano de obra.',
  },
  optica: {
    mode: 'pedido', qty: false, occasion: false, photo: true,
    pick: 'Elegí qué necesitás', cta: 'Pedir', form: 'Tu pedido', submit: 'Enviar pedido', when: 'Cuándo pasás a buscarlos',
    policyPh: 'Ej: Los recetados tardan de 3 a 7 días según el laboratorio. Traé la receta original al retirar. Si no podés venir en tu horario, avisanos por WhatsApp.',
  },
  otro: {
    mode: 'pedido', qty: true, occasion: true, photo: true,
    pick: 'Elegí qué querés', cta: 'Pedir', form: 'Tu pedido', submit: 'Enviar pedido', when: 'Cuándo lo querés',
    policyPh: 'Ej: La seña reserva tu pedido. Cambios hasta 48 h antes de la entrega.',
  },
};
for (const k of Object.keys(RUBROS)) RUBROS[k].link = LINK[k] || LINK.otro;

// Cómo se presentan las fotos y videos de cada producto (en la carga y en el link).
const MEDIA = {
  cocina: { title: 'Más fotos y video', hint: 'Un video de 10 segundos girando la torta o cortándola vende más que cualquier foto. Sumá fotos de cerca y por dentro.' },
  belleza: { title: 'Trabajos hechos', hint: 'Subí fotos de trabajos tuyos, mejor si son antes y después. Es lo primero que mira una clienta antes de reservar.' },
  regalos: { title: 'Más fotos y video', hint: 'Mostrá qué trae por dentro: un video abriendo la caja funciona muy bien.' },
  servicios: { title: 'Trabajos hechos', hint: 'Fotos de trabajos terminados, de cerca, para que se vea la terminación.' },
  eventos: { title: 'Así queda armado', hint: 'Un video del armado y una foto con gente al lado, así se entiende el tamaño.' },
  oficios: { title: 'Trabajos terminados', hint: 'Fotos de antes y después: generan confianza antes de que te abran la puerta.' },
  optica: { title: 'Más fotos', hint: 'De frente, de costado y puestos. Para que se lo prueben con la cámara, cargá abajo el probador virtual.' },
  otro: { title: 'Más fotos y video', hint: 'Fotos de cerca y un video corto mostrando el producto.' },
};
for (const k of Object.keys(RUBROS)) RUBROS[k].media = MEDIA[k] || MEDIA.otro;



export const RUBRO_KEYS = Object.keys(RUBROS);

// Link de Google Maps para «Cómo llegar».
export function mapsUrl(address) {
  return address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : null;
}

export function rubroOf(bakeryOrKey) {
  const key = typeof bakeryOrKey === 'string' ? bakeryOrKey : bakeryOrKey?.business_type;
  return RUBROS[key] || RUBROS.cocina;
}

// Versión liviana para componentes de cliente (sin los ejemplos).
export function publicRubros() {
  return RUBRO_KEYS.map((k) => {
    const { sample, ...rest } = RUBROS[k];
    return rest;
  });
}
