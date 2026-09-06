# SYSTEM PROMPT & GUIDE DE DESARROLLO: APLICACIÓN WEB "CONTROL PERSONAL CAMPO"

> **Versión del Instructivo:** 1.0.0  
> **Target Environment:** VS Code / Code Assistant Agent (Cursor, Continue, GitHub Copilot)  
> **Proyecto:** CONTROL PERSONAL CAMPO — Sistema Inteligente de Gestión y Asistencia de Personal en Obra  
> **Autor / Arquitectura:** Prompt Engineering & Software Architecture Team  

---

## 1. INTRODUCCIÓN Y OBJETIVOS DEL AGENTE

Este archivo de instrucciones `.md` actúa como la **guía maestra (System Prompt)** para el desarrollo completo de la aplicación web **CONTROL PERSONAL CAMPO**. El agente de Inteligencia Artificial debe seguir de manera estricta y secuencial todas las especificaciones técnicas, arquitectónicas y visuales detalladas en este documento para generar código limpio, robusto, seguro y mantenible.

### 1.1 Misión del Agente
Construir una Single Page Application (SPA) modular, responsiva e intuitiva, conectada de manera transparente a una base de datos distribuida en **Google Sheets** a través de un backend serverless implementado en **Google Apps Script (GAS)**.

---

## 2. ARQUITECTURA GENERAL Y STACK TECNOLÓGICO

### 2.1 Stack Tecnológico
- **Frontend Core:** HTML5 Semántico, JavaScript ES6+ (Vanilla / Asíncrono via `fetch`), CSS3 nativo sin frameworks pesados (soporte para variables CSS, CSS Grid y Flexbox).
- **Estilos & UI:** **Glassmorphism Moderno (Clear Glass Pattern)**:
  - Fondos semi-transparentes con `backdrop-filter: blur(12px)`.
  - Bordes finos luminosos (`border: 1px solid rgba(255, 255, 255, 0.25)`).
  - Sombras suaves y difusas (`box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.15)`).
  - Paleta de colores basada en tonos celestes, azul cielo (`#00A8E8`, `#007EA7`, `#003459`), blancos translúcidos y acentos en verde esmeralda y rojo coral para estados.
  - Textura granulada (noise overlay) sutil para mejorar la tridimensionalidad del cristal.
- **Librerías Frontend (vía CDN seguro):**
  - **QRCode.js / html5-qrcode:** Para generación de códigos QR y lectura mediante cámara del dispositivo móvil.
  - **jspdf & jspdf-autotable:** Para la generación e impresión de reportes ejecutivos en PDF.
  - **Lucide Icons / FontAwesome:** Iconografía vectorial estilizada.
- **Backend / Persistencia:**
  - **Google Apps Script (GAS):** Web App expuesta mediante Endpoint `doPost(e)` y `doGet(e)`.
  - **Google Sheets API / Sheet DB:** Base de datos relacional simulada con hojas estructuradas.

### 2.2 Diagrama de Flujo de Datos
```
[ Frontend: Glassmorphism UI ]
       │
       ├─► [ Módulo QR Scanner / Formulario Admin ]
       │          │
       │          ▼ (HTTPS JSON Payload)
       ├─► [ Service Layer: API Client (js/api.js) ]
       │          │
       │          ▼ (POST / GET via fetch)
       └─► [ Google Apps Script (Web App Endpoint) ]
                  │
                  ▼
          [ Google Sheets (Database Engine) ]
          ├─ Sheet: "Personal"
          ├─ Sheet: "Asistencias"
          ├─ Sheet: "Alertas"
          └─ Sheet: "Configuracion"
```

---

## 3. ESTRUCTURA DEL PROYECTO (DIRECTORY TREE)

El agente de IA debe organizar el repositorio de archivos con la siguiente jerarquía estricta:

```
control-personal-campo/
├── index.html                  # Contenedor SPA principal
├── css/
│   ├── main.css                # Reset, variables, tipografía y estilos base
│   ├── glassmorphism.css       # Efectos de cristal, desenfoques y componentes UI
│   ├── components.css          # Tablas, tarjetas, formularios, botones, modales
│   └── print.css               # Estilos de impresión y vista previa de reportes
├── js/
│   ├── config.js               # Constantes globales, URLs de Apps Script y estado
│   ├── api.js                  # Conector de comunicación con Google Apps Script
│   ├── app.js                  # Router SPA y lógica de inicialización
│   ├── modules/
│   │   ├── personal.js         # CRUD de Trabajadores y generación de QR
│   │   ├── asistencia.js       # Escáner QR, marcación física y reglas de tolerancia
│   │   ├── dashboard.js        # KPIs, gráficos y calendario interactivo
│   │   ├── reportes.js         # Exportación PDF/CSV y vista previa
│   │   └── ajustes.js          # Configuración del sistema y vinculación de Google
│   └── utils/
│       ├── qr-generator.js     # Helper para renderizado de QR
│       ├── pdf-builder.js      # Plantilla y generador PDF con membrete
│       └── alerts.js           # Notificaciones Toast y alertas en tiempo real
├── gas/
│   ├── Code.gs                 # Script principal backend de Google Apps Script
│   └── SetupSheets.gs          # Script de aprovisionamiento de pestañas y cabeceras
└── assets/
    ├── img/                    # Logos, texturas noise y placeholders
    └── icons/                  # Iconos SVG adicionales
```

---

## 4. BASE DE DATOS Y Google Apps Script (GAS)

### 4.1 Estructura de Google Sheets
El script `SetupSheets.gs` debe inicializar la Hoja de Cálculo con las siguientes pestañas y columnas:

1. **Pestaña `Personal`:**
   - `ID_Trabajador` (UUID / P-0001)
   - `Nombre_Completo`
   - `DPI_CUI` (Documento Personal de Identificación - Contexto Guatemala)
   - `Puesto` (Albañil, Maestro de Obra, Residente, Bodeguero, etc.)
   - `Jefe_Inmediato`
   - `Telefono`
   - `WhatsApp`
   - `Direccion` (Departamento / Municipio de Guatemala)
   - `Fotografia_URL` (Google Drive / Base64)
   - `Codigo_QR_Data`
   - `Fecha_Registro`
   - `Estado` (Activo / Inactivo)

2. **Pestaña `Asistencias`:**
   - `ID_Asistencia` (UUID / A-0001)
   - `ID_Trabajador`
   - `Nombre_Trabajador`
   - `Fecha` (YYYY-MM-DD)
   - `Tipo_Marcacion` (Entrada | Salida_Receso | Regreso_Receso | Salida_Obra)
   - `Hora_Programada` (HH:MM)
   - `Hora_Real` (HH:MM:SS)
   - `Minutos_Tolerancia`
   - `Estado_Marcacion` (A Tiempo | Atraso | Omision | Ausencia)
   - `Horas_Extra` (Decimal)
   - `Metodo` (Escaneo_QR | Manual_Fisica)
   - `Ubicacion_GPS` / `Obra`

3. **Pestaña `Alertas`:**
   - `ID_Alerta`
   - `Fecha_Hora`
   - `ID_Trabajador`
   - `Tipo_Incidencia` (Omisión Entrada, Tardanza Receso, etc.)
   - `Estatus` (Pendiente | Revisado)

4. **Pestaña `Configuracion`:**
   - `Clave` | `Valor` (Nombre_App, Tolerancia_Minutos, Webhook_URL, Logo_Base64)

### 4.2 Código Backend Google Apps Script (`gas/Code.gs`)
```javascript
// Serverless Backend en Google Apps Script
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action;
    var sheetApp = SpreadsheetApp.getActiveSpreadsheet();
    
    switch (action) {
      case 'registrarPersonal':
        return responseJSON(registrarPersonal(sheetApp, data.payload));
      case 'registrarMarcacion':
        return responseJSON(registrarMarcacion(sheetApp, data.payload));
      case 'obtenerPersonal':
        return responseJSON(obtenerPersonal(sheetApp));
      case 'obtenerAsistencias':
        return responseJSON(obtenerAsistencias(sheetApp, data.fecha));
      case 'actualizarPersonal':
        return responseJSON(actualizarPersonal(sheetApp, data.payload));
      case 'eliminarPersonal':
        return responseJSON(eliminarPersonal(sheetApp, data.id));
      default:
        return responseJSON({ success: false, error: 'Acción no válida' });
    }
  } catch (err) {
    return responseJSON({ success: false, error: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

function responseJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function registrarPersonal(ss, payload) {
  var sheet = ss.getSheetByName("Personal");
  var id = "TRAB-" + Utilities.getUuid().substring(0, 8).toUpperCase();
  var fecha = new Date();
  
  sheet.appendRow([
    id,
    payload.nombre,
    payload.dpi,
    payload.puesto,
    payload.jefe,
    payload.telefono,
    payload.whatsapp,
    payload.direccion,
    payload.fotografia,
    id, // QR Data usa el ID único
    fecha,
    "Activo"
  ]);
  
  return { success: true, id: id, message: "Personal registrado correctamente" };
}

function registrarMarcacion(ss, payload) {
  var sheet = ss.getSheetByName("Asistencias");
  var idAsistencia = "ASIS-" + Utilities.getUuid().substring(0, 8).toUpperCase();
  var horaActual = new Date();
  
  sheet.appendRow([
    idAsistencia,
    payload.idTrabajador,
    payload.nombreTrabajador,
    payload.fecha,
    payload.tipoMarcacion,
    payload.horaProgramada,
    Utilities.formatDate(horaActual, "GMT-6", "HH:mm:ss"),
    payload.minutosTolerancia,
    payload.estadoMarcacion,
    payload.horasExtra || 0,
    payload.metodo,
    payload.obra || "Obra Principal"
  ]);
  
  return { success: true, id: idAsistencia, message: "Marcación registrada con éxito" };
}

function obtenerPersonal(ss) {
  var sheet = ss.getSheetByName("Personal");
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  var data = [];
  
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][11] === "Activo") { // Solo activos
      var obj = {};
      for (var j = 0; j < headers.length; j++) {
        obj[headers[j]] = rows[i][j];
      }
      data.push(obj);
    }
  }
  return { success: true, data: data };
}
```

---

## 5. MÓDULOS DEL SISTEMA Y REQUERIMIENTOS DETALLADOS

### 5.1 Módulo 1: Arquitectura, Estilos Glassmorphism & Vinculación

#### Requisitos Visuales (CSS):
- Usar variables CSS para dinamismo:
  ```css
  :root {
    --glass-bg: rgba(255, 255, 255, 0.18);
    --glass-border: rgba(255, 255, 255, 0.35);
    --glass-shadow: 0 8px 32px 0 rgba(0, 52, 89, 0.2);
    --color-primary: #007EA7;
    --color-secondary: #00A8E8;
    --color-dark: #003459;
    --color-light: #F4F9F9;
    --color-accent-amber: #FFB703;
    --color-accent-red: #E63946;
    --color-accent-green: #2A9D8F;
    --font-main: 'Inter', system-ui, -apple-system, sans-serif;
  }
  
  body {
    background: linear-gradient(135deg, #003459 0%, #007EA7 50%, #00A8E8 100%);
    background-attachment: fixed;
    font-family: var(--font-main);
    color: #ffffff;
    margin: 0;
    min-height: 100vh;
  }

  .glass-card {
    background: var(--glass-bg);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border: 1px solid var(--glass-border);
    border-radius: 16px;
    box-shadow: var(--glass-shadow);
    padding: 24px;
    margin-bottom: 20px;
  }
  ```

#### Vinculación con Google:
- Pantalla de Bienvenida/Ajustes iniciales con input para ingresar el **Web App URL Executable** generado por Apps Script (`https://script.google.com/macros/s/.../exec`).
- Guardado local en `localStorage` con validación de ping de estado.

---

### 5.2 Módulo 2: Gestión de Personal (CRUD & Códigos QR)

#### Formulario de Registro de Trabajador (Contexto Guatemala):
1. **Campos requeridos:**
   - Nombre Completo.
   - DPI / CUI (Validación de 13 dígitos numéricos).
   - Puesto de Trabajo (Dropdown: Albañil, Maestro de Obra, Armador, Carpintero, Electricista, Operador, Residente).
   - Jefe Inmediato.
   - Teléfono Móvil (Formato `+502 XXXX-XXXX`).
   - WhatsApp Directo (Link dinámico `https://wa.me/502XXXXXXXX`).
   - Dirección Domiciliar (Departamento y Municipio de Guatemala).
   - Carga de Fotografía: Compresión en Canvas a Base64/JPEG max 200KB.
2. **Generación Automática de Código QR:**
   - En cuanto se guarda el registro, la librería `QRCode.js` renderiza un QR que codifica el payload JSON: `{"id": "TRAB-XXXX", "dpi": "XXXXXXXXXXXXX", "nombre": "..."}`.
   - Botón para **Imprimir Carné de Identificación en Obra** (Vista en modal glassmorphism estilizado).
3. **Gestión CRUD:**
   - **Create:** Formulario interactivo.
   - **Read:** Tabla dinámica con filtro por nombre, puesto o DPI.
   - **Update:** Edición modal con precarga de datos.
   - **Delete:** Borrado lógico (cambio de estado a "Inactivo" en la hoja de Sheets).

---

### 5.3 Módulo 3: Control de Asistencia y Lógica de Horarios

#### Reglas de Negocio de Marcación (Horarios de Guatemala):
| Marcación | Hora Oficial | Ventana Tolerancia | Alerta por Tardanza / Omisión |
| :--- | :---: | :---: | :--- |
| **Entrada a Obra** | 07:00 AM | 07:01 - 07:15 AM | > 07:15 AM (Alerta de Inasistencia / Tardanza) |
| **Salida a Receso** | 10:00 AM | 10:01 - 10:15 AM | > 10:15 AM (Alerta Omisión Salida Receso) |
| **Regreso de Receso** | 10:30 AM | 10:31 - 10:45 AM | > 10:45 AM (Alerta Exceso Receso) |
| **Salida de Obra** | 17:00 PM | 17:01 - 17:15 PM | > 17:15 PM (Inicia conteo de Horas Extra) |

#### Métodos de Marcación:
1. **Escáner QR Móvil:**
   - Utilizar la cámara del smartphone/tablet del capataz/residente vía `html5-qrcode`.
   - Lectura instantánea -> Emisión de feedback sonoro de confirmación -> Envío asíncrono a Google Sheets.
2. **Marcación Física / Manual (Fallback):**
   - Buscador de trabajador con autocompletado -> Botones rápidos de marcado: `[Entrada]`, `[Salida Receso]`, `[Regreso Receso]`, `[Salida Obra]`.
3. **Módulo de Horas Extra:**
   - Si la marcación de salida es posterior a las 17:15, el sistema calcula automáticamente el excedente en bloques de 0.5 horas o permite al administrador ingresar las horas aprobadas manualmente.

---

### 5.4 Módulo 4: Panel de Control (Dashboard Administrador)

#### Métricas y KPIs en Tiempo Real:
- **Tarjeta 1:** Total Personal Activo.
- **Tarjeta 2:** Asistencia del Día (% de cumplimiento).
- **Tarjeta 3:** Tardanzas y Omisiones registradas hoy.
- **Tarjeta 4:** Ausencias totales del día.

#### Calendario Interactivo de Asistencia:
- Vista mensual/semanal.
- Marcadores de color en cada día (Verde: >90% asistencia, Amarillo: 75-89%, Rojo: <75%).
- **Click en Día:** Abre un modal detallado con la lista de personal presente, horarios de marcación y lista de ausentes con botón de contacto rápido por WhatsApp.

---

### 5.5 Módulo 5: Reportes e Impresión Profesional

#### Generación de Documentos (PDF / CSV):
- **Reporte Diario de Obra:** Desglose puntual de asistencia por trabajador.
- **Reporte Semanal/Mensual:** Consolidado de días trabajados, minutos de atraso y horas extra para nómina.

#### Especificaciones Técnicas del PDF (`js/utils/pdf-builder.js`):
- Membrete institucional con Logo de la Empresa / Obra.
- Encabezado: "CONTROL PERSONAL CAMPO - REPORTE DE ASISTENCIA EN OBRA".
- Metadatos: Fecha de emisión, Obra, Encargado, Total de trabajadores.
- Estilo de Tabla:
  - Cabeceras en Azul Celeste (`#007EA7`) con texto blanco.
  - Filas alternadas en blanco translúcido y gris muy claro.
  - Formato de impresión A4 / Carta con márgenes de 15mm.
- **Vista Previa de Impresión Modal:** Permite ajustar orientación (Vertical/Horizontal) antes de descargar o mandar a imprimir (`window.print()`).

---

### 5.6 Módulo 6: Ajustes y Configuración de Negocio

- **General:** Nombre de la Obra/Empresa, Tolerancia personalizable (minutos), Logo personalizado.
- **Conexión:** URL del WebApp de Google Apps Script, Test de conexión, Sincronización manual forzada.
- **Copia de Seguridad:** Exportación completa del estado a JSON local.

---

## 6. INSTRUCCIONES DE EJECUCIÓN PASO A PASO PARA EL AGENTE

El agente de codificación debe seguir este orden para construir la solución:

1. **Paso 1:** Generar la estructura de carpetas y los archivos vacíos según la sección 3.
2. **Paso 2:** Crear el archivo `gas/Code.gs` y `gas/SetupSheets.gs` con la lógica de backend para Google Sheets.
3. **Paso 3:** Escribir el archivo `index.html` vinculando los CDN de `QRCode.js`, `html5-qrcode`, `jspdf`, `jspdf-autotable` y `Lucide Icons`.
4. **Paso 4:** Implementar el diseño visual en `css/main.css` y `css/glassmorphism.css` con la estética Clear Glass en tonos celestes.
5. **Paso 5:** Desarrollar los módulos JavaScript empezando por `config.js` y `api.js`.
6. **Paso 6:** Construir los componentes de UI: Formulario CRUD de Personal, Escáner QR, Dashboard con KPIs y Calendario, y Módulo de Reportes PDF/CSV.
7. **Paso 7:** Probar la integración asíncrona mediante peticiones `fetch` con manejo robusto de errores y notificaciones Toast.

---