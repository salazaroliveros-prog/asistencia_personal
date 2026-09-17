# Manual operativo del sistema de asistencia y carnets QR

Este manual explica, paso a paso, cómo operar el sistema para registrar trabajadores activos, imprimir sus carnets con QR, escanear la asistencia y generar reportes.

## 1. Acceso al sistema

### 1.1 Abrir la aplicación

1. Abre la URL pública o local del sistema.
2. Inicia sesión con tu usuario autorizado.
3. Si la app está en modo local por falta de conexión, se mostrará una advertencia y puedes seguir usando la cola offline; cuando recupere la conexión, los registros se sincronizarán.

### 1.2 Roles recomendados

- Administrador: crea y edita trabajadores, ajusta configuración, descarga PDF y reportes.
- Supervisor: revisa marcaciones y reportes.
- Operador de campo: usa el escáner QR para marcar asistencia desde móvil.

## 2. Registrar trabajadores activos

### 2.1 Crear un trabajador

1. Entra a la vista Personal.
2. Haz clic en "Nuevo trabajador".
3. Completa estos campos obligatorios:
   - ID del trabajador
   - Nombre completo
   - DPI/CUI
   - Puesto
   - Estado: Activo
   - Teléfono/WhatsApp (recomendado)
   - Dirección (opcional)
   - Foto (opcional pero recomendable)
4. Guarda el registro.

### 2.2 Verificar que el trabajador quedó activo

- En la tabla de Personal, el trabajador debe verse con estado "Activo".
- Si tiene QR y foto, ya está listo para impresión y asistencia.
- Si se desea inactivar al operador, cambia el estado a "Inactivo" o "Suspendido" y no se considerará activo para marcación.

> Recomendación: solo imprime carnets a los trabajadores con estado Activo.

## 3. Generar e imprimir el carnet con QR

### 3.1 Abrir el modal de carnet

1. En Personal, busca al trabajador activo.
2. Haz clic en el botón con icono de QR.
3. Se abrirá el modal del carné con:
   - nombre del trabajador
   - ID
   - DPI/CUI
   - puesto
   - foto
   - código QR

### 3.2 Imprimir el carnet

1. En el modal del carné, usa el botón "Imprimir".
2. Ajusta la orientación y activa el modo de impresión del navegador.
3. Selecciona la impresora adecuada.
4. Revisa que la hoja salga en tamaño correcto para carnet o tarjeta identificativa.

### 3.3 Descargar PNG

1. En el mismo modal, usa "Descargar PNG".
2. El sistema genera una imagen con el carné listo para imprimir más tarde.
3. Guarda el archivo con nombre tipo: `carne-NOMBRE-ID.png`.

### 3.4 Recomendación de impresión

- Usa papel tamaño A4 o un material más resistente para trabajo en obra.
- Si el QR se ve pequeño, aumenta el tamaño del documento antes de imprimir.
- Cada trabajador activo debe portar su carné visible al momento de marcar asistencia.

## 4. Flujo de marcación de asistencia

### 4.1 Escenario recomendado

- El trabajador lleva su carnet físico o la imagen del QR en móvil.
- El operador de campo abre el escáner desde la ruta de campo.

### 4.2 Entrar al escáner

1. Abre `field-scanner.html` o la ruta del escáner de campo.
2. Inicia sesión con tu usuario autorizado y contraseña.
3. La cámara del dispositivo se activa y queda lista para leer QR.

### 4.3 Escanear el QR del trabajador

1. Dirige la cámara hacia el QR del carnet.
2. La app identifica el trabajador por su contenido QR.
3. Si el QR es válido, la app muestra los datos del trabajador y el tipo de marcación disponible.
4. Si el QR no es válido, se mostrará una alerta y no se registrará la marcación.

### 4.4 Seleccionar el tipo de marcación

El sistema permite registrar lo siguiente:

- Entrada
- Salida de descanso
- Regreso de descanso
- Salida de obra
- Marcaciones extra o especiales según la configuración del proyecto

### 4.5 Validación del registro

1. La app captura la hora local y, si aplica, la ubicación GPS.
2. Verifica el trabajador, la geocerca y la validación del registro.
3. Guarda la asistencia.
4. Muestra confirmación visual de éxito.

## 5. Ver la asistencia desde el dashboard

### 5.1 Dashboard principal

1. Entra al Dashboard.
2. Revisa los indicadores del día:
   - presentes
   - ausentes
   - tardanzas
   - horas extra
   - marcaciones del día
3. La lectura se actualiza en tiempo real cuando hay conexión.

### 5.2 Ver lista de marcaciones

1. Abre la vista Asistencia.
2. Filtra por fecha, trabajador o tipo de marca.
3. Puedes corregir marcas manualmente si la operación lo requiere.

### 5.3 Historial del trabajador

1. En Personal, selecciona el trabajador.
2. Haz clic en historial para ver todas sus marcaciones.
3. Usa este registro para verificar dudas, atrasos o jornadas incompletas.

## 6. Generar reportes y exportar datos

### 6.1 Reportes por fecha

1. Entra a Reportes.
2. Selecciona el rango de fechas.
3. Elige el tipo de salida:
   - vista previa
   - PDF
   - Excel
   - impresión
4. Ajusta filtros por área, puesto o trabajador.

### 6.2 Exportación profesional

- Puedes descargar reportes para auditoría o entrega a administración.
- El sistema usa exportaciones PDF/Excel con la información consolidada de las marcaciones registradas.

## 7. Modo offline y sincronización

### 7.1 Qué pasa sin conexión

- La app guarda operaciones locales.
- El escáner puede registrar marcaciones aunque haya caída de red.
- Los datos quedan en la cola del dispositivo hasta recuperar conectividad.

### 7.2 Cómo sincroniza

1. La conexión vuelve a estar disponible.
2. La app detecta la reconexión.
3. La cola de marcaciones se envía automáticamente a Firestore.
4. El panel de conexión y el estado de sincronización muestran el resultado.

> Importante: para que la sincronización funcione, el usuario debe estar autenticado correctamente y tener permisos en Firebase.

## 8. Configuración general del sistema

### 8.1 Ajustes principales

En la vista Ajustes revisa:

- nombre de la obra
- horario de entrada y salida
- tolerancia de tardanzas
- duración del descanso
- geocerca / ubicación de obra
- tema visual
- Firebase, conexión y sincronización

### 8.2 Seguridad

- Solo debe usarse con usuarios autorizados.
- No compartas credenciales de administrador.
- Los trabajadores solo deben portar el carnet impreso, no un PIN local o código secreto.
- Las reglas de Firestore bloquean accesos no autorizados.

## 9. Flujo recomendado de operación diaria

### Administración

1. Revisar trabajadores activos.
2. Verificar que cada trabajador tenga estado Activo.
3. Imprimir carnet con QR a cada operador vigente.
4. Confirmar que la foto del trabajador esté correcta.
5. Revisar la configuración del horario y geocerca.

### Campo

1. Abrir escáner desde móvil.
2. Iniciar sesión con cuenta autorizada.
3. Escanear el QR del trabajador.
4. Validar la marca y confirmar.
5. Repetir en cada asistencia.

### Supervisión

1. Revisar Dashboard.
2. Buscar tardanzas, ausencias o inconsistencias.
3. Generar reportes del día o del rango requerido.
4. Corregir la operación manual si es necesario.

## 10. Solución rápida de problemas

### El trabajador no puede marcar asistencia

- Verifica que el trabajador tenga estado Activo.
- Revisa que el QR del trabajador esté generado y no esté vencido.
- Confirma que el QR se esté leyendo con la cámara del teléfono.
- Comprueba que la conexión esté disponible.

### La cámara no abre

- Permite el acceso a la cámara en el navegador.
- Cierra otras apps que estén usando la cámara.
- Usa Chrome, Edge o Safari actualizado.

### La app dice que no hay conexión

- Verifica Wi‑Fi o datos móviles.
- Revisa la sincronización del proyecto Firebase.
- Reintenta la operación; la cola offline debe guardar la marca.

### El carnet no imprime bien

- Revisa la vista previa antes de imprimir.
- Ajusta la escala o el tamaño del documento.
- Usa la función de PDF o descarga PNG si la impresión directa falla.

## 11. Checklist final antes de usar en producción

- [ ] Todos los trabajadores activos tienen carnet y QR.
- [ ] Los estados de personal están correctos.
- [ ] La cuenta de acceso a administrador/operador está autorizada.
- [ ] La cámara del móvil funciona correctamente.
- [ ] La geocerca de la obra está configurada.
- [ ] El proyecto Firebase está conectado y sincroniza.
- [ ] Hay al menos un registro de prueba de asistencia válido.
- [ ] Se realizó una prueba de impresión del carnet.
- [ ] Se probó el flujo de escaneo y carga del Dashboard.

## 12. Resumen rápido

El ciclo normal del sistema es:

1. Registrar trabajadores activos.
2. Imprimir su carnet con QR.
3. Escanear los QR desde el campo.
4. Registrar asistencia.
5. Revisar el dashboard y reportes.
6. Sincronizar y auditar la operación.

Con este flujo el sistema queda listo para operar en obra, controlar asistencia en tiempo real y mantener un historial confiable de trabajadores.
