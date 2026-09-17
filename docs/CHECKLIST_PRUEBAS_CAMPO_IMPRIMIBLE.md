# Checklist de pruebas físicas en obra

Este documento sirve para validar el sistema en sitio con un teléfono real, un usuario autorizado y datos reales de personal.

## 1. Datos iniciales

- Fecha de prueba:
- Obra / sitio:
- Supervisor responsable:
- Usuario autenticado:
- Dispositivo:
- Versión de app:
- Conectividad: Wi‑Fi / Datos / Sin conexión

## 2. Requisitos previos

- [ ] El usuario tiene acceso autorizado
- [ ] Hay al menos 3 trabajadores activos
- [ ] Existe al menos 1 carné impreso o QR visible
- [ ] La cámara del móvil funciona
- [ ] La ubicación/GPS está habilitada
- [ ] La app puede abrirse sin bloqueo
- [ ] La conexión a Firebase está disponible

## 3. Prueba de inicio de sesión

- [ ] La app abre correctamente
- [ ] El login funciona con cuenta autorizada
- [ ] El usuario entra al dashboard principal
- [ ] No aparecen errores de JavaScript
- [ ] La sesión se mantiene en la navegación normal

## 4. Prueba de Personal / trabajadores

### Registrar trabajador

- [ ] Ir a Personal
- [ ] Click en "Nuevo trabajador"
- [ ] Ingresar nombre completo
- [ ] Ingresar DPI/CUI
- [ ] Ingresar puesto
- [ ] Ingresar teléfono/WhatsApp
- [ ] Ingresar dirección
- [ ] Agregar foto si aplica
- [ ] Guardar
- [ ] Verificar que aparece en la tabla
- [ ] Confirmar que queda con estado Activo

### Validar formulario

- [ ] El sistema valida campos obligatorios
- [ ] No se aceptan datos vacíos donde corresponda
- [ ] No se duplica el mismo DPI en un registro activo
- [ ] El sistema muestra mensaje claro si algo falla

## 5. Prueba de QR y carné

- [ ] Abrir trabajador desde Personal
- [ ] Click en botón de QR
- [ ] Confirmar que aparece el modal de carné
- [ ] Verificar que se muestra el nombre, ID, puesto y QR
- [ ] Confirmar que el QR es legible
- [ ] Probar "Imprimir"
- [ ] Probar "Descargar PNG"
- [ ] Imprimir una prueba en papel
- [ ] Revisar que el texto sea legible y el QR no esté borroso

## 6. Prueba de escáner del móvil

- [ ] Abrir la ruta del escáner desde el teléfono
- [ ] Permitir acceso a cámara
- [ ] Iniciar sesión en el escáner
- [ ] Confirmar que la cámara queda activa
- [ ] Escanear un QR válido
- [ ] Verificar que la app reconoce al trabajador
- [ ] Verificar que aparece la información del trabajador
- [ ] Seleccionar tipo de marcación: Entrada / Salida de descanso / Regreso / Salida de obra
- [ ] Confirmar que se registra la marca
- [ ] Verificar mensaje de éxito

## 7. Prueba de asistencia real

### Registro del día

- [ ] Registrar entrada de un trabajador
- [ ] Registrar salida de descanso
- [ ] Registrar regreso de descanso
- [ ] Registrar salida de obra
- [ ] Revisar que cada acción se refleja con la hora correcta

### Verificar en dashboard

- [ ] El Dashboard muestra el total correcto
- [ ] Presentes, ausentes y tardanzas se actualizan
- [ ] Las marcas aparecen en la tabla de asistencia
- [ ] El historial del trabajador es correcto

## 8. Prueba de GPS / geocerca

- [ ] Permitir acceso a ubicación
- [ ] Verificar que la app captura coordenadas
- [ ] Estar dentro de la zona de la obra
- [ ] Confirmar que la marca se acepta
- [ ] Salirse de la zona de trabajo
- [ ] Confirmar que la app rechaza o advierte si corresponde

Resultado esperado:

- [ ] Dentro de la geocerca: se acepta la marca
- [ ] Fuera de la geocerca: advertencia o bloqueo según configuración

## 9. Prueba de conexión y sincronización

### Modo online

- [ ] Realizar una marca con conexión
- [ ] Verificar que se sincroniza con Firebase
- [ ] Revisar que el dashboard refleja la marca

### Modo offline

- [ ] Desactivar Internet
- [ ] Registrar asistencia localmente
- [ ] Reactivar conexión
- [ ] Verificar que la marca se sincroniza y desaparece de la cola local

## 10. Prueba de reportes

- [ ] Abrir módulo de Reportes
- [ ] Seleccionar rango de fechas
- [ ] Generar vista previa
- [ ] Exportar PDF
- [ ] Exportar Excel
- [ ] Verificar que los datos coinciden con las asistencias reales

## 11. Prueba de seguridad / permisos

- [ ] Usuario no autorizado no puede entrar a funciones restringidas
- [ ] No se permite acceso libre a datos del sistema sin login
- [ ] La app no expone acceso anónimo inseguro
- [ ] Los cambios solo se guardan con usuario válido

## 12. Hallazgos / errores

- Error / anomalía:
- Severidad: Baja / Media / Alta
- Captura de evidencia:
- Responsable:
- Solución propuesta:

## 13. Resultado final

- [ ] Prueba aprobada
- [ ] Prueba con observaciones
- [ ] Prueba fallida

Observaciones finales:

____________________________________________________
____________________________________________________
____________________________________________________
