/**
 * CONTROL PERSONAL CAMPO — demo-data.js
 * Datos de prueba realistas para validar el funcionamiento completo de la app.
 * Se carga ANTES de app.js. El parche de API se aplica síncronamente.
 * NO incluir en producción — remover el <script> en index.html.
 * @version 1.1.0
 */

(function injectDemoData() {

  // ── Fecha base: hoy ────────────────────────────────────────────────────────
  const hoy = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  })();

  const daysAgo = (n) => {
    const d = new Date(); d.setDate(d.getDate() - n);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };

  const ayer  = daysAgo(1);
  const hace2 = daysAgo(2);
  const hace3 = daysAgo(3);
  const hace4 = daysAgo(4);
  const hace5 = daysAgo(5);
  const hace6 = daysAgo(6);

  // ── Avatares con ui-avatars.com ────────────────────────────────────────────
  function avatar(nombre, bg) {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(nombre)}&background=${bg}&color=fff&size=128&bold=true&font-size=0.4`;
  }

  // ── PERSONAL — 12 trabajadores (11 activos, 1 inactivo) ───────────────────
  const PERSONAL = [
    { ID_Trabajador:'TRAB-A1B2C3D4', Nombre_Completo:'Carlos Enrique Méndez López',     DPI_CUI:'2934567890123', Puesto:'Maestro de Obra', Jefe_Inmediato:'Ing. Roberto Pérez',   Telefono:'+502 5512-3456', WhatsApp:'https://wa.me/50255123456', Direccion:'Guatemala, Guatemala',           Fotografia_URL:avatar('Carlos Méndez',     '003459'), Codigo_QR_Data:'{"id":"TRAB-A1B2C3D4","dpi":"2934567890123","nombre":"Carlos Enrique Méndez López"}',     Fecha_Registro:'2025-01-10 08:00:00', Estado:'Activo'   },
    { ID_Trabajador:'TRAB-E5F6G7H8', Nombre_Completo:'María Lucía Hernández Castro',     DPI_CUI:'1823456789012', Puesto:'Residente',       Jefe_Inmediato:'Ing. Roberto Pérez',   Telefono:'+502 4423-7890', WhatsApp:'https://wa.me/50244237890', Direccion:'Mixco, Guatemala',                Fotografia_URL:avatar('María Hernández',   '2A9D8F'), Codigo_QR_Data:'{"id":"TRAB-E5F6G7H8","dpi":"1823456789012","nombre":"María Lucía Hernández Castro"}',     Fecha_Registro:'2025-01-10 08:00:00', Estado:'Activo'   },
    { ID_Trabajador:'TRAB-I9J0K1L2', Nombre_Completo:'Juan Pablo García Solís',          DPI_CUI:'3045678901234', Puesto:'Albañil',         Jefe_Inmediato:'Carlos Méndez',        Telefono:'+502 5534-6789', WhatsApp:'https://wa.me/50255346789', Direccion:'Villa Nueva, Guatemala',          Fotografia_URL:avatar('Juan García',       '007EA7'), Codigo_QR_Data:'{"id":"TRAB-I9J0K1L2","dpi":"3045678901234","nombre":"Juan Pablo García Solís"}',          Fecha_Registro:'2025-01-15 08:00:00', Estado:'Activo'   },
    { ID_Trabajador:'TRAB-M3N4O5P6', Nombre_Completo:'Pedro Antonio Ramírez Vásquez',    DPI_CUI:'4156789012345', Puesto:'Albañil',         Jefe_Inmediato:'Carlos Méndez',        Telefono:'+502 5545-7890', WhatsApp:'https://wa.me/50255457890', Direccion:'San Miguel Petapa, Guatemala',    Fotografia_URL:avatar('Pedro Ramírez',     'E63946'), Codigo_QR_Data:'{"id":"TRAB-M3N4O5P6","dpi":"4156789012345","nombre":"Pedro Antonio Ramírez Vásquez"}',    Fecha_Registro:'2025-01-15 08:00:00', Estado:'Activo'   },
    { ID_Trabajador:'TRAB-Q7R8S9T0', Nombre_Completo:'Ana Sofía Molina Torres',           DPI_CUI:'5267890123456', Puesto:'Bodeguero',       Jefe_Inmediato:'María Hernández',      Telefono:'+502 5556-8901', WhatsApp:'https://wa.me/50255568901', Direccion:'Guatemala, Guatemala',           Fotografia_URL:avatar('Ana Molina',        'FFB703'), Codigo_QR_Data:'{"id":"TRAB-Q7R8S9T0","dpi":"5267890123456","nombre":"Ana Sofía Molina Torres"}',           Fecha_Registro:'2025-02-01 08:00:00', Estado:'Activo'   },
    { ID_Trabajador:'TRAB-U1V2W3X4', Nombre_Completo:'Luis Fernando Orozco Paz',          DPI_CUI:'6378901234567', Puesto:'Electricista',    Jefe_Inmediato:'Carlos Méndez',        Telefono:'+502 5567-9012', WhatsApp:'https://wa.me/50255679012', Direccion:'Amatitlán, Guatemala',            Fotografia_URL:avatar('Luis Orozco',       '6A0DAD'), Codigo_QR_Data:'{"id":"TRAB-U1V2W3X4","dpi":"6378901234567","nombre":"Luis Fernando Orozco Paz"}',          Fecha_Registro:'2025-02-01 08:00:00', Estado:'Activo'   },
    { ID_Trabajador:'TRAB-Y5Z6A7B8', Nombre_Completo:'Diego Alejandro Cifuentes Ruiz',   DPI_CUI:'7489012345678', Puesto:'Carpintero',      Jefe_Inmediato:'Carlos Méndez',        Telefono:'+502 5578-0123', WhatsApp:'https://wa.me/50255780123', Direccion:'Escuintla, Escuintla',            Fotografia_URL:avatar('Diego Cifuentes',   '17A589'), Codigo_QR_Data:'{"id":"TRAB-Y5Z6A7B8","dpi":"7489012345678","nombre":"Diego Alejandro Cifuentes Ruiz"}',   Fecha_Registro:'2025-02-15 08:00:00', Estado:'Activo'   },
    { ID_Trabajador:'TRAB-C9D0E1F2', Nombre_Completo:'Rosa Elena Chávez Morales',         DPI_CUI:'8590123456789', Puesto:'Operador',        Jefe_Inmediato:'Carlos Méndez',        Telefono:'+502 5589-1234', WhatsApp:'https://wa.me/50255891234', Direccion:'Chimaltenango, Chimaltenango',    Fotografia_URL:avatar('Rosa Chávez',       'E07B39'), Codigo_QR_Data:'{"id":"TRAB-C9D0E1F2","dpi":"8590123456789","nombre":"Rosa Elena Chávez Morales"}',         Fecha_Registro:'2025-03-01 08:00:00', Estado:'Activo'   },
    { ID_Trabajador:'TRAB-G3H4I5J6', Nombre_Completo:'Marco Tulio Ajú Xiquín',            DPI_CUI:'9601234567890', Puesto:'Armador',         Jefe_Inmediato:'Carlos Méndez',        Telefono:'+502 5590-2345', WhatsApp:'https://wa.me/50255902345', Direccion:'Sacatepéquez, Antigua Guatemala', Fotografia_URL:avatar('Marco Ajú',         '2980B9'), Codigo_QR_Data:'{"id":"TRAB-G3H4I5J6","dpi":"9601234567890","nombre":"Marco Tulio Ajú Xiquín"}',            Fecha_Registro:'2025-03-01 08:00:00', Estado:'Activo'   },
    { ID_Trabajador:'TRAB-K7L8M9N0', Nombre_Completo:'Claudia Patricia Reyes Fuentes',   DPI_CUI:'0712345678901', Puesto:'Plomero',         Jefe_Inmediato:'Carlos Méndez',        Telefono:'+502 5501-3456', WhatsApp:'https://wa.me/50255013456', Direccion:'Quetzaltenango, Quetzaltenango',  Fotografia_URL:avatar('Claudia Reyes',     'C0392B'), Codigo_QR_Data:'{"id":"TRAB-K7L8M9N0","dpi":"0712345678901","nombre":"Claudia Patricia Reyes Fuentes"}',   Fecha_Registro:'2025-03-15 08:00:00', Estado:'Activo'   },
    { ID_Trabajador:'TRAB-O1P2Q3R4', Nombre_Completo:'Héctor Manuel Barrios Xol',         DPI_CUI:'1823456789013', Puesto:'Soldador',        Jefe_Inmediato:'Carlos Méndez',        Telefono:'+502 5512-4567', WhatsApp:'https://wa.me/50255124567', Direccion:'Petén, San Benito',               Fotografia_URL:avatar('Héctor Barrios',    '5D6D7E'), Codigo_QR_Data:'{"id":"TRAB-O1P2Q3R4","dpi":"1823456789013","nombre":"Héctor Manuel Barrios Xol"}',         Fecha_Registro:'2025-04-01 08:00:00', Estado:'Activo'   },
    { ID_Trabajador:'TRAB-S5T6U7V8', Nombre_Completo:'Ingrid Paola Sánchez Lima',          DPI_CUI:'2934567890124', Puesto:'Maestro de Obra', Jefe_Inmediato:'Ing. Roberto Pérez',   Telefono:'+502 4423-8901', WhatsApp:'https://wa.me/50244238901', Direccion:'Guatemala, Zona 12',              Fotografia_URL:avatar('Ingrid Sánchez',    '1E8449'), Codigo_QR_Data:'{"id":"TRAB-S5T6U7V8","dpi":"2934567890124","nombre":"Ingrid Paola Sánchez Lima"}',          Fecha_Registro:'2025-04-01 08:00:00', Estado:'Inactivo' },
  ];

  const activos = PERSONAL.filter(p => p.Estado === 'Activo'); // 11 trabajadores

  // ── Helper para crear marcaciones ─────────────────────────────────────────
  let seq = 1;
  const horasProg = { Entrada:'07:00', Salida_Receso:'10:00', Regreso_Receso:'10:30', Salida_Obra:'17:00' };
  function m(t, fecha, tipo, horaReal, estado, extra=0, met='Escaneo_QR') {
    return {
      ID_Asistencia:     `ASIS-DEMO-${String(seq++).padStart(4,'0')}`,
      ID_Trabajador:     t.ID_Trabajador,
      Nombre_Trabajador: t.Nombre_Completo,
      Fecha:             fecha,
      Tipo_Marcacion:    tipo,
      Hora_Programada:   horasProg[tipo] || '07:00',
      Hora_Real:         horaReal,
      Minutos_Tolerancia:15,
      Estado_Marcacion:  estado,
      Horas_Extra:       extra,
      Metodo_Registro:   met,
      Ubicacion_Obra:    'Construcciones Ramsa — Zona 10',
    };
  }

  // ── ASISTENCIAS ────────────────────────────────────────────────────────────
  const TODAS = [];

  // Función para generar un día completo para un grupo de trabajadores
  function diaCompleto(fecha, trabajadores, configs) {
    trabajadores.forEach((t, i) => {
      const cfg = configs[i] || { hora:'07:00', estado:'A Tiempo', extra:0 };
      TODAS.push(m(t, fecha, 'Entrada',        cfg.hora+':00',  cfg.estado, 0));
      TODAS.push(m(t, fecha, 'Salida_Receso',  '10:00:00',      'A Tiempo', 0));
      TODAS.push(m(t, fecha, 'Regreso_Receso', '10:30:00',      'A Tiempo', 0));
      TODAS.push(m(t, fecha, 'Salida_Obra',    cfg.salidaHora || '17:02:00', 'A Tiempo', cfg.extra||0));
    });
  }

  // ── HOY: escenario realista variado ───────────────────────────────────────
  // Carlos [0] — Maestro, jornada completa + horas extra (ya salió)
  TODAS.push(m(activos[0],  hoy,'Entrada',        '06:58:00','A Tiempo'));
  TODAS.push(m(activos[0],  hoy,'Salida_Receso',  '10:02:00','A Tiempo'));
  TODAS.push(m(activos[0],  hoy,'Regreso_Receso', '10:31:00','Tolerancia'));
  TODAS.push(m(activos[0],  hoy,'Salida_Obra',    '17:47:00','A Tiempo', 0.5));

  // María [1] — Residente, en receso ahora
  TODAS.push(m(activos[1],  hoy,'Entrada',        '07:00:00','A Tiempo'));
  TODAS.push(m(activos[1],  hoy,'Salida_Receso',  '10:00:00','A Tiempo'));

  // Juan [2] — Albañil, tardanza → en obra
  TODAS.push(m(activos[2],  hoy,'Entrada',        '07:22:00','Atraso',0,'Manual_Fisica'));
  TODAS.push(m(activos[2],  hoy,'Salida_Receso',  '10:01:00','A Tiempo',0,'Manual_Fisica'));
  TODAS.push(m(activos[2],  hoy,'Regreso_Receso', '10:29:00','A Tiempo',0,'Manual_Fisica'));

  // Pedro [3] — Albañil, puntual → en obra
  TODAS.push(m(activos[3],  hoy,'Entrada',        '06:55:00','A Tiempo'));
  TODAS.push(m(activos[3],  hoy,'Salida_Receso',  '10:00:00','A Tiempo'));
  TODAS.push(m(activos[3],  hoy,'Regreso_Receso', '10:30:00','A Tiempo'));

  // Ana [4] — Bodeguero, tolerancia → en obra
  TODAS.push(m(activos[4],  hoy,'Entrada',        '07:12:00','Tolerancia'));
  TODAS.push(m(activos[4],  hoy,'Salida_Receso',  '10:05:00','A Tiempo'));
  TODAS.push(m(activos[4],  hoy,'Regreso_Receso', '10:32:00','Tolerancia'));

  // Luis [5] — Electricista, recién entró
  TODAS.push(m(activos[5],  hoy,'Entrada',        '07:03:00','A Tiempo'));

  // Diego [6] — Carpintero, en obra
  TODAS.push(m(activos[6],  hoy,'Entrada',        '06:50:00','A Tiempo'));
  TODAS.push(m(activos[6],  hoy,'Salida_Receso',  '10:00:00','A Tiempo'));
  TODAS.push(m(activos[6],  hoy,'Regreso_Receso', '10:30:00','A Tiempo'));

  // Rosa [7] — Operador, ya salió con 1h extra
  TODAS.push(m(activos[7],  hoy,'Entrada',        '07:00:00','A Tiempo'));
  TODAS.push(m(activos[7],  hoy,'Salida_Receso',  '10:00:00','A Tiempo'));
  TODAS.push(m(activos[7],  hoy,'Regreso_Receso', '10:30:00','A Tiempo'));
  TODAS.push(m(activos[7],  hoy,'Salida_Obra',    '18:15:00','A Tiempo', 1.0));

  // Marco [8] — Armador, AUSENTE hoy (no hay registros)
  // Claudia [9] — Plomero, AUSENTE hoy
  // Héctor [10] — Soldador, puntual en obra
  TODAS.push(m(activos[10], hoy,'Entrada',        '07:05:00','A Tiempo'));

  // ── AYER: 10 de 11 presentes ──────────────────────────────────────────────
  const cfgsAyer = [
    {hora:'06:58',estado:'A Tiempo',salidaHora:'18:05:00',extra:1.0},
    {hora:'07:00',estado:'A Tiempo'},
    {hora:'07:00',estado:'A Tiempo'},
    {hora:'07:08',estado:'Tolerancia'},
    {hora:'07:14',estado:'Tolerancia'},
    {hora:'07:01',estado:'A Tiempo'},
    {hora:'06:55',estado:'A Tiempo'},
    {hora:'07:00',estado:'A Tiempo'},
    {hora:'07:00',estado:'A Tiempo'},
    {hora:'07:02',estado:'A Tiempo'},
  ];
  diaCompleto(ayer, activos.slice(0,10), cfgsAyer);

  // ── HACE 2 DÍAS: 8 de 11 ─────────────────────────────────────────────────
  diaCompleto(hace2, activos.slice(0,8), [
    {hora:'07:00',estado:'A Tiempo'},
    {hora:'06:55',estado:'A Tiempo'},
    {hora:'07:20',estado:'Atraso'},
    {hora:'07:00',estado:'A Tiempo'},
    {hora:'07:00',estado:'A Tiempo'},
    {hora:'07:10',estado:'Tolerancia'},
    {hora:'06:58',estado:'A Tiempo'},
    {hora:'07:00',estado:'A Tiempo'},
  ]);

  // ── HACE 3 DÍAS: 9 de 11 ─────────────────────────────────────────────────
  diaCompleto(hace3, activos.slice(0,9), [
    {hora:'06:50',estado:'A Tiempo',salidaHora:'17:00:00'},
    {hora:'07:00',estado:'A Tiempo'},
    {hora:'07:00',estado:'A Tiempo'},
    {hora:'07:15',estado:'Tolerancia'},
    {hora:'07:00',estado:'A Tiempo'},
    {hora:'07:00',estado:'A Tiempo'},
    {hora:'07:00',estado:'A Tiempo'},
    {hora:'07:08',estado:'Tolerancia'},
    {hora:'07:00',estado:'A Tiempo'},
  ]);

  // ── HACE 4 DÍAS: 10 de 11 ────────────────────────────────────────────────
  diaCompleto(hace4, activos.slice(0,10), [
    {hora:'07:00',estado:'A Tiempo',salidaHora:'17:30:00',extra:0.5},
    {hora:'07:00',estado:'A Tiempo'},
    {hora:'07:05',estado:'A Tiempo'},
    {hora:'07:00',estado:'A Tiempo'},
    {hora:'07:00',estado:'A Tiempo'},
    {hora:'07:18',estado:'Atraso'},
    {hora:'07:00',estado:'A Tiempo'},
    {hora:'07:00',estado:'A Tiempo'},
    {hora:'06:52',estado:'A Tiempo'},
    {hora:'07:00',estado:'A Tiempo'},
  ]);

  // ── HACE 5 DÍAS: 11 de 11 — día perfecto ─────────────────────────────────
  diaCompleto(hace5, activos, [
    {hora:'07:00',estado:'A Tiempo'},
    {hora:'06:58',estado:'A Tiempo'},
    {hora:'07:00',estado:'A Tiempo'},
    {hora:'07:00',estado:'A Tiempo'},
    {hora:'07:00',estado:'A Tiempo'},
    {hora:'07:02',estado:'A Tiempo'},
    {hora:'06:55',estado:'A Tiempo'},
    {hora:'07:00',estado:'A Tiempo'},
    {hora:'07:00',estado:'A Tiempo'},
    {hora:'07:01',estado:'A Tiempo'},
    {hora:'06:59',estado:'A Tiempo'},
  ]);

  // ── HACE 6 DÍAS: 7 de 11 ─────────────────────────────────────────────────
  diaCompleto(hace6, activos.slice(0,7), [
    {hora:'07:00',estado:'A Tiempo'},
    {hora:'07:00',estado:'A Tiempo'},
    {hora:'07:25',estado:'Atraso'},
    {hora:'07:00',estado:'A Tiempo'},
    {hora:'07:00',estado:'A Tiempo'},
    {hora:'07:00',estado:'A Tiempo'},
    {hora:'07:00',estado:'A Tiempo'},
  ]);

  // ── ALERTAS ────────────────────────────────────────────────────────────────
  const ALERTAS = [
    { ID_Alerta:'ALRT-DEMO-001', Fecha_Hora:`${hoy} 07:22:00`,   ID_Trabajador:'TRAB-I9J0K1L2', Tipo_Incidencia:'Tardanza en Entrada — 22 min (Atraso)',     Estatus:'Pendiente' },
    { ID_Alerta:'ALRT-DEMO-002', Fecha_Hora:`${ayer} 07:14:00`,  ID_Trabajador:'TRAB-Q7R8S9T0', Tipo_Incidencia:'Tardanza en Entrada — 14 min (Tolerancia)', Estatus:'Pendiente' },
    { ID_Alerta:'ALRT-DEMO-003', Fecha_Hora:`${hoy} 00:00:00`,   ID_Trabajador:'TRAB-G3H4I5J6', Tipo_Incidencia:'Ausencia sin justificar — Marco Ajú',        Estatus:'Pendiente' },
    { ID_Alerta:'ALRT-DEMO-004', Fecha_Hora:`${hoy} 00:00:00`,   ID_Trabajador:'TRAB-K7L8M9N0', Tipo_Incidencia:'Ausencia sin justificar — Claudia Reyes',    Estatus:'Pendiente' },
  ];

  // ── CONFIGURACIÓN ──────────────────────────────────────────────────────────
  const CONFIG = {
    Nombre_App:'CONTROL PERSONAL CAMPO', Nombre_Obra:'Construcciones Ramsa — Zona 10',
    Tolerancia_Minutos:15, Hora_Entrada:'07:00', Hora_Salida_Receso:'10:00',
    Hora_Regreso_Receso:'10:30', Hora_Salida_Obra:'17:00',
    Encargado:'Ing. Roberto Pérez', Logo_Base64:'', Webhook_URL:'', Version:'1.1.0',
  };

  // ── Derivados que el dashboard necesita ───────────────────────────────────
  const asistenciasHoy = TODAS.filter(a => a.Fecha === hoy);

  // ── GUARDAR EN localStorage ───────────────────────────────────────────────
  try {
    localStorage.setItem('cpc_personal_cache', JSON.stringify(PERSONAL));
    localStorage.setItem('cpc_config',         JSON.stringify(CONFIG));
    localStorage.setItem('cpc_last_sync',      new Date().toISOString());
    localStorage.setItem('cpc_demo_loaded',    '1');
  } catch(e) { /* ignorar */ }

  // ── PRECARGAR AppState SÍNCRONAMENTE ──────────────────────────────────────
  // AppState ya está disponible porque config.js cargó antes que este script.
  AppState.set('personal',    PERSONAL);
  AppState.set('asistencias', asistenciasHoy);
  AppState.set('alertas',     ALERTAS.filter(a => a.Estatus === 'Pendiente'));
  AppState.set('config',      CONFIG);
  AppState.set('connected',   true);   // Simular conexión activa (API parcheada)
  // URL ficticia para que los if(gasUrl) en los módulos no bloqueen las llamadas
  AppState.set('gasUrl',      'https://demo.control-personal-campo.local/exec');
  try { localStorage.setItem('cpc_gas_url', 'https://demo.control-personal-campo.local/exec'); } catch(e) {}

  // Exponer para que el parche de API los use
  window.__DEMO = { TODAS, PERSONAL, ALERTAS, CONFIG };

  // ── PARCHEAR API SÍNCRONAMENTE ────────────────────────────────────────────
  // API ya existe porque api.js cargó antes. Lo parcheamos antes de que
  // app.js registre su DOMContentLoaded y llame a cargar().
  function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

  API.obtenerPersonal = async () => {
    await delay(180);
    const list = window.__DEMO.PERSONAL;
    AppState.set('personal', list);
    return { success:true, data:list, total:list.length };
  };

  API.obtenerAsistencias = async (fecha) => {
    await delay(150);
    const data = window.__DEMO.TODAS.filter(a => a.Fecha === (fecha || AppState.today()));
    AppState.set('asistencias', data);
    return { success:true, data, total:data.length };
  };

  API.obtenerAsistenciaRango = async (fechaInicio, fechaFin) => {
    await delay(200);
    const data = window.__DEMO.TODAS.filter(a => a.Fecha >= fechaInicio && a.Fecha <= fechaFin);
    return { success:true, data, total:data.length };
  };

  API.obtenerAlertas = async () => {
    await delay(150);
    const pendientes = window.__DEMO.ALERTAS.filter(a => a.Estatus === 'Pendiente');
    AppState.set('alertas', pendientes);
    return { success:true, data:pendientes, total:pendientes.length };
  };

  API.marcarAlertaRevisada = async (id) => {
    await delay(100);
    const idx = window.__DEMO.ALERTAS.findIndex(a => a.ID_Alerta === id);
    if (idx !== -1) window.__DEMO.ALERTAS[idx].Estatus = 'Revisado';
    return { success:true, message:'Alerta revisada (demo)' };
  };

  API.obtenerConfiguracion = async () => {
    await delay(100);
    return { success:true, data:window.__DEMO.CONFIG };
  };

  API.guardarConfiguracion = async (payload) => {
    await delay(150);
    Object.assign(window.__DEMO.CONFIG, payload);
    AppState.set('config', { ...AppState.get('config'), ...payload });
    return { success:true, message:'Configuración guardada (demo)' };
  };

  API.registrarMarcacion = async (payload) => {
    await delay(300);
    const ahora = new Date();
    const hr = `${String(ahora.getHours()).padStart(2,'0')}:${String(ahora.getMinutes()).padStart(2,'0')}:${String(ahora.getSeconds()).padStart(2,'0')}`;
    const id  = 'ASIS-LIVE-' + Date.now().toString().slice(-6);
    const nueva = {
      ID_Asistencia:     id,
      ID_Trabajador:     payload.idTrabajador,
      Nombre_Trabajador: payload.nombreTrabajador,
      Fecha:             payload.fecha,
      Tipo_Marcacion:    payload.tipoMarcacion,
      Hora_Programada:   payload.horaProgramada||'07:00',
      Hora_Real:         hr,
      Minutos_Tolerancia:payload.minutosTolerancia||15,
      Estado_Marcacion:  payload.estadoMarcacion||'A Tiempo',
      Horas_Extra:       payload.horasExtra||0,
      Metodo_Registro:   payload.metodo||'Manual_Fisica',
      Ubicacion_Obra:    payload.obra||window.__DEMO.CONFIG.Nombre_Obra,
    };
    window.__DEMO.TODAS.push(nueva);
    return { success:true, id, horaReal:hr, estadoMarcacion:nueva.Estado_Marcacion, horasExtra:nueva.Horas_Extra, message:'Marcación registrada (demo)' };
  };

  API.registrarPersonal = async (payload) => {
    await delay(400);
    const id = 'TRAB-LIVE-' + Date.now().toString().slice(-6);
    const nuevo = { ID_Trabajador:id, Nombre_Completo:payload.nombre, DPI_CUI:payload.dpi, Puesto:payload.puesto, Jefe_Inmediato:payload.jefe||'', Telefono:payload.telefono||'', WhatsApp:payload.whatsapp||'', Direccion:payload.direccion||'', Fotografia_URL:payload.fotografia||'', Codigo_QR_Data:JSON.stringify({id,dpi:payload.dpi,nombre:payload.nombre}), Fecha_Registro:new Date().toISOString(), Estado:'Activo' };
    window.__DEMO.PERSONAL.push(nuevo);
    AppState.set('personal', window.__DEMO.PERSONAL);
    return { success:true, id, message:'Trabajador registrado (demo)' };
  };

  API.actualizarPersonal = async (payload) => {
    await delay(300);
    const list = window.__DEMO.PERSONAL;
    const idx  = list.findIndex(p => p.ID_Trabajador === payload.id);
    if (idx !== -1) Object.assign(list[idx], { Nombre_Completo:payload.nombre, DPI_CUI:payload.dpi, Puesto:payload.puesto, Jefe_Inmediato:payload.jefe, Telefono:payload.telefono, WhatsApp:payload.whatsapp, Direccion:payload.direccion, Fotografia_URL:payload.fotografia||list[idx].Fotografia_URL });
    AppState.set('personal', list);
    return { success:true, message:'Trabajador actualizado (demo)' };
  };

  API.eliminarPersonal = async (id) => {
    await delay(300);
    const list = window.__DEMO.PERSONAL;
    const idx  = list.findIndex(p => p.ID_Trabajador === id);
    if (idx !== -1) list[idx].Estado = 'Inactivo';
    AppState.set('personal', list.filter(p => p.Estado === 'Activo'));
    return { success:true, message:'Trabajador dado de baja (demo)' };
  };

  API.ping = async () => { throw new Error('Modo demo — sin GAS real configurado'); };

  // ── Actualizar indicador de conexión visual ────────────────────────────────
  // Se ejecuta después de que DOMContentLoaded ponga la app visible
  document.addEventListener('DOMContentLoaded', () => {
    const dot  = document.querySelector('.connection-dot');
    const text = document.getElementById('connection-text');
    if (dot)  dot.className  = 'connection-dot connected';
    if (text) text.textContent = 'Demo activo';
    // Suprimir el toast de "Sin conexión configurada"
    sessionStorage.setItem('cpc_setup_notified', '1');
  }, { capture: true });

  console.info('[Demo] ✅ Datos y API parcheados síncronamente:', {
    personal: PERSONAL.length, asistencias: TODAS.length,
    alertas: ALERTAS.length, hoy: asistenciasHoy.length,
  });

})();
