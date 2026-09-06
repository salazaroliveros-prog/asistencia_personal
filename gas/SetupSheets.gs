/**
 * CONTROL PERSONAL CAMPO - SetupSheets.gs
 * Descripción: Script de aprovisionamiento de Google Sheets.
 * Ejecutar UNA SOLA VEZ para inicializar la base de datos.
 * Zona horaria: GMT-6 (Guatemala)
 */

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN PRINCIPAL DE SETUP
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ejecutar manualmente desde el editor de Apps Script.
 * Crea todas las hojas con sus columnas, validaciones y formato.
 */
function setupCompleto() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  Logger.log("=== INICIANDO SETUP DE CONTROL PERSONAL CAMPO ===");

  setupPersonal(ss);
  setupAsistencias(ss);
  setupAlertas(ss);
  setupConfiguracion(ss);
  eliminarHojaDefault(ss);
  protegerCabeceras(ss);

  Logger.log("=== SETUP COMPLETADO EXITOSAMENTE ===");
  SpreadsheetApp.getUi().alert("✅ Setup completado. La base de datos está lista para usar.");
}

// ─────────────────────────────────────────────────────────────────────────────
// SETUP HOJA: PERSONAL
// ─────────────────────────────────────────────────────────────────────────────
function setupPersonal(ss) {
  var nombre = "Personal";
  var sheet = obtenerOCrearHoja(ss, nombre);
  sheet.clear();

  var cabeceras = [
    "ID_Trabajador",
    "Nombre_Completo",
    "DPI_CUI",
    "Puesto",
    "Jefe_Inmediato",
    "Telefono",
    "WhatsApp",
    "Direccion",
    "Fotografia_URL",
    "Codigo_QR_Data",
    "Fecha_Registro",
    "Estado"
  ];

  // Escribir cabeceras
  var rangoCabecera = sheet.getRange(1, 1, 1, cabeceras.length);
  rangoCabecera.setValues([cabeceras]);
  estilizarCabecera(rangoCabecera);

  // Validación de Estado
  var validacionEstado = SpreadsheetApp.newDataValidation()
    .requireValueInList(["Activo", "Inactivo"], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, 12, 1000, 1).setDataValidation(validacionEstado);

  // Validación de Puesto
  var puestos = ["Albañil", "Maestro de Obra", "Armador", "Carpintero", "Electricista", "Operador", "Residente", "Bodeguero", "Plomero", "Soldador"];
  var validacionPuesto = SpreadsheetApp.newDataValidation()
    .requireValueInList(puestos, true)
    .setAllowInvalid(true)
    .build();
  sheet.getRange(2, 4, 1000, 1).setDataValidation(validacionPuesto);

  // Ajustar anchos de columna
  sheet.setColumnWidth(1, 140);  // ID
  sheet.setColumnWidth(2, 220);  // Nombre
  sheet.setColumnWidth(3, 150);  // DPI
  sheet.setColumnWidth(4, 150);  // Puesto
  sheet.setColumnWidth(5, 160);  // Jefe
  sheet.setColumnWidth(6, 130);  // Teléfono
  sheet.setColumnWidth(7, 160);  // WhatsApp
  sheet.setColumnWidth(8, 200);  // Dirección
  sheet.setColumnWidth(9, 200);  // Fotografía
  sheet.setColumnWidth(10, 250); // QR Data
  sheet.setColumnWidth(11, 160); // Fecha
  sheet.setColumnWidth(12, 100); // Estado

  // Fila de ejemplo
  sheet.appendRow([
    "TRAB-EJEMPLO",
    "Juan Pérez García",
    "2934567890123",
    "Albañil",
    "Carlos Supervisorde",
    "+502 5555-1234",
    "https://wa.me/50255551234",
    "Guatemala, Guatemala",
    "",
    '{"id":"TRAB-EJEMPLO","dpi":"2934567890123","nombre":"Juan Pérez García"}',
    new Date(),
    "Activo"
  ]);

  Logger.log("✅ Hoja 'Personal' configurada");
}

// ─────────────────────────────────────────────────────────────────────────────
// SETUP HOJA: ASISTENCIAS
// ─────────────────────────────────────────────────────────────────────────────
function setupAsistencias(ss) {
  var nombre = "Asistencias";
  var sheet = obtenerOCrearHoja(ss, nombre);
  sheet.clear();

  // IMPORTANTE: Los nombres de columnas deben coincidir EXACTAMENTE con los
  // usados en sheetToObjects() y en el frontend (api.js, pdf-builder.js, historial).
  var cabeceras = [
    "ID_Asistencia",       // Identificador único
    "ID_Trabajador",       // FK → Personal.ID_Trabajador
    "Nombre_Trabajador",   // Denormalizado para reportes rápidos
    "Fecha",               // YYYY-MM-DD
    "Tipo_Marcacion",      // Entrada | Salida_Receso | Regreso_Receso | Salida_Obra
    "Hora_Programada",     // HH:MM (según configuración)
    "Hora_Real",           // HH:MM:SS (hora del servidor)
    "Minutos_Tolerancia",  // Número entero
    "Estado_Marcacion",    // A Tiempo | Tolerancia | Atraso | Ausencia
    "Horas_Extra",         // Número decimal (0.5, 1.0, etc.)
    "Metodo_Registro",     // Escaneo_QR | Manual_Fisica  ← nombre correcto para el frontend
    "Ubicacion_Obra",      // Texto libre (nombre de la obra)
    "GPS_Latitud",         // Coordenada GPS latitud
    "GPS_Longitud",        // Coordenada GPS longitud
    "GPS_Accuracy",        // Precisión GPS en metros
    "Geofence_Inside",     // Si está dentro de la geocerca (Si/No)
    "Geofence_Distance"    // Distancia al centro de geocerca en metros
  ];

  var rangoCabecera = sheet.getRange(1, 1, 1, cabeceras.length);
  rangoCabecera.setValues([cabeceras]);
  estilizarCabecera(rangoCabecera);

  // Validación: Tipo de marcación
  var validacionTipo = SpreadsheetApp.newDataValidation()
    .requireValueInList(["Entrada", "Salida_Receso", "Regreso_Receso", "Salida_Obra"], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, 5, 5000, 1).setDataValidation(validacionTipo);

  // Validación: Estado
  var validacionEstado = SpreadsheetApp.newDataValidation()
    .requireValueInList(["A Tiempo", "Tolerancia", "Atraso", "Ausencia", "Pendiente"], true)
    .setAllowInvalid(true)
    .build();
  sheet.getRange(2, 9, 5000, 1).setDataValidation(validacionEstado);

  // Validación: Método
  var validacionMetodo = SpreadsheetApp.newDataValidation()
    .requireValueInList(["Escaneo_QR", "Manual_Fisica"], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, 11, 5000, 1).setDataValidation(validacionMetodo);

  // Formato de columna Fecha como texto para preservar YYYY-MM-DD
  sheet.getRange(2, 4, 5000, 1)
    .setNumberFormat('@STRING@');

  // Formato numérico para horas extra
  sheet.getRange(2, 10, 5000, 1)
    .setNumberFormat('0.0');

  // Anchos de columna
  sheet.setColumnWidth(1,  140); // ID_Asistencia
  sheet.setColumnWidth(2,  140); // ID_Trabajador
  sheet.setColumnWidth(3,  200); // Nombre_Trabajador
  sheet.setColumnWidth(4,  120); // Fecha
  sheet.setColumnWidth(5,  150); // Tipo_Marcacion
  sheet.setColumnWidth(6,  130); // Hora_Programada
  sheet.setColumnWidth(7,  130); // Hora_Real
  sheet.setColumnWidth(8,  140); // Minutos_Tolerancia
  sheet.setColumnWidth(9,  130); // Estado_Marcacion
  sheet.setColumnWidth(10, 100); // Horas_Extra
  sheet.setColumnWidth(11, 130); // Metodo_Registro
  sheet.setColumnWidth(12, 160); // Ubicacion_Obra
  sheet.setColumnWidth(13, 120); // GPS_Latitud
  sheet.setColumnWidth(14, 120); // GPS_Longitud
  sheet.setColumnWidth(15, 100); // GPS_Accuracy
  sheet.setColumnWidth(16, 100); // Geofence_Inside
  sheet.setColumnWidth(17, 120); // Geofence_Distance

  // Fila de ejemplo
  var hoy = Utilities.formatDate(new Date(), "GMT-6", "yyyy-MM-dd");
  sheet.appendRow([
    "ASIS-EJEMPLO",
    "TRAB-EJEMPLO",
    "Juan Pérez García",
    hoy,
    "Entrada",
    "07:00",
    "06:58:30",
    15,
    "A Tiempo",
    0,
    "Escaneo_QR",
    "Obra Principal",
    "14.634915",     // GPS_Latitud (ejemplo: Guatemala City)
    "-90.506894",    // GPS_Longitud
    "10",           // GPS_Accuracy (metros)
    "Si",           // Geofence_Inside
    "25"            // Geofence_Distance (metros)
  ]);

  Logger.log("✅ Hoja 'Asistencias' configurada con columna Metodo_Registro");
}

// ─────────────────────────────────────────────────────────────────────────────
// SETUP HOJA: ALERTAS
// ─────────────────────────────────────────────────────────────────────────────
function setupAlertas(ss) {
  var nombre = "Alertas";
  var sheet = obtenerOCrearHoja(ss, nombre);
  sheet.clear();

  var cabeceras = [
    "ID_Alerta",
    "Fecha_Hora",
    "ID_Trabajador",
    "Tipo_Incidencia",
    "Estatus"
  ];

  var rangoCabecera = sheet.getRange(1, 1, 1, cabeceras.length);
  rangoCabecera.setValues([cabeceras]);
  estilizarCabecera(rangoCabecera, "#E63946");

  var validacion = SpreadsheetApp.newDataValidation()
    .requireValueInList(["Pendiente", "Revisado"], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, 5, 1000, 1).setDataValidation(validacion);

  sheet.setColumnWidth(1, 140);
  sheet.setColumnWidth(2, 180);
  sheet.setColumnWidth(3, 140);
  sheet.setColumnWidth(4, 250);
  sheet.setColumnWidth(5, 120);

  Logger.log("✅ Hoja 'Alertas' configurada");
}

// ─────────────────────────────────────────────────────────────────────────────
// SETUP HOJA: CONFIGURACIÓN
// ─────────────────────────────────────────────────────────────────────────────
function setupConfiguracion(ss) {
  var nombre = "Configuracion";
  var sheet = obtenerOCrearHoja(ss, nombre);
  sheet.clear();

  var cabeceras = ["Clave", "Valor", "Descripcion"];
  var rangoCabecera = sheet.getRange(1, 1, 1, cabeceras.length);
  rangoCabecera.setValues([cabeceras]);
  estilizarCabecera(rangoCabecera, "#2A9D8F");

  // Valores por defecto del sistema
  var defaults = [
    ["Nombre_App",          "CONTROL PERSONAL CAMPO",     "Nombre del sistema"],
    ["Nombre_Obra",         "Obra Principal",              "Nombre de la obra o empresa"],
    ["Tolerancia_Minutos",  "15",                          "Minutos de tolerancia para marcaciones"],
    ["Hora_Entrada",        "07:00",                       "Hora oficial de entrada"],
    ["Hora_Salida_Receso",  "10:00",                       "Hora oficial de salida a receso"],
    ["Hora_Regreso_Receso", "10:30",                       "Hora oficial de regreso de receso"],
    ["Hora_Salida_Obra",    "17:00",                       "Hora oficial de salida de obra"],
    ["Webhook_URL",         "",                            "URL del Web App de Google Apps Script"],
    ["Logo_Base64",         "",                            "Logo en Base64 para reportes PDF"],
    ["Encargado",           "Administrador",               "Nombre del encargado del sistema"],
    ["Version",             "1.0.0",                       "Versión del sistema"],
    ["GPS_Habilitado",      "true",                        "Habilitar captura de GPS en marcaciones"],
    ["GPS_Requerir_Ubicacion", "false",                     "Requerir ubicación obligatoria para marcaciones"],
    ["GPS_Centro_Lat",      "",                            "Latitud del centro de geocerca"],
    ["GPS_Centro_Lon",      "",                            "Longitud del centro de geocerca"],
    ["GPS_Radio_Metros",    "200",                         "Radio de geocerca en metros"]
  ];

  sheet.getRange(2, 1, defaults.length, 3).setValues(defaults);

  sheet.setColumnWidth(1, 200);
  sheet.setColumnWidth(2, 300);
  sheet.setColumnWidth(3, 280);

  Logger.log("✅ Hoja 'Configuracion' configurada");
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS DE SETUP
// ─────────────────────────────────────────────────────────────────────────────
function obtenerOCrearHoja(ss, nombre) {
  var sheet = ss.getSheetByName(nombre);
  if (!sheet) {
    sheet = ss.insertSheet(nombre);
    Logger.log("  Creada hoja: " + nombre);
  } else {
    Logger.log("  Hoja existente: " + nombre);
  }
  return sheet;
}

function estilizarCabecera(rango, color) {
  var colorFondo = color || "#007EA7";
  rango.setBackground(colorFondo)
    .setFontColor("#FFFFFF")
    .setFontWeight("bold")
    .setFontSize(11)
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");
  rango.getSheet().setFrozenRows(1);
}

function eliminarHojaDefault(ss) {
  var sheetDefault = ss.getSheetByName("Hoja 1") || ss.getSheetByName("Sheet1") || ss.getSheetByName("Hoja1");
  if (sheetDefault && ss.getSheets().length > 1) {
    ss.deleteSheet(sheetDefault);
    Logger.log("  Hoja por defecto eliminada");
  }
}

function protegerCabeceras(ss) {
  var hojas = ["Personal", "Asistencias", "Alertas", "Configuracion"];
  hojas.forEach(function(nombre) {
    var sheet = ss.getSheetByName(nombre);
    if (sheet) {
      var proteccion = sheet.getRange(1, 1, 1, sheet.getLastColumn()).protect();
      proteccion.setDescription("Cabeceras protegidas - No modificar");
      proteccion.setWarningOnly(true);
    }
  });
  Logger.log("✅ Protecciones de cabeceras aplicadas");
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN DE RESET (USO CUIDADOSO)
// ─────────────────────────────────────────────────────────────────────────────
function resetearDatos() {
  var ui = SpreadsheetApp.getUi();
  var respuesta = ui.alert(
    "⚠️ ADVERTENCIA",
    "¿Estás seguro de que deseas BORRAR TODOS los datos de Personal y Asistencias?\n\nEsta acción NO se puede deshacer.",
    ui.ButtonSet.YES_NO
  );

  if (respuesta !== ui.Button.YES) {
    ui.alert("Operación cancelada.");
    return;
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hojas = ["Personal", "Asistencias", "Alertas"];

  hojas.forEach(function(nombre) {
    var sheet = ss.getSheetByName(nombre);
    if (sheet && sheet.getLastRow() > 1) {
      sheet.deleteRows(2, sheet.getLastRow() - 1);
    }
  });

  ui.alert("✅ Datos borrados. Las cabeceras se mantuvieron intactas.");
}

// ─────────────────────────────────────────────────────────────────────────────
// MENÚ PERSONALIZADO EN GOOGLE SHEETS
// ─────────────────────────────────────────────────────────────────────────────
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("⚙️ Control Personal Campo")
    .addItem("🚀 Setup Inicial (Primera vez)", "setupCompleto")
    .addSeparator()
    .addItem("⚠️ Resetear Datos (Peligroso)", "resetearDatos")
    .addToUi();
}
