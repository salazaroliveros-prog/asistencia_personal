# Google Apps Script — Configuración Segura

## Resumen

Este directorio contiene scripts de Google Apps Script para poblar y validar la configuración de la aplicación desde **PropertiesService**, evitando exponer secretos en el código fuente.

## Archivos

- `apps-script-config.gs`: funciones base de configuración, lectura segura y helpers de Firestore.
- `apps-script-auto-config.gs`: flujo de auto-población desde PropertiesService hacia Firestore y verificación.

## Flujo recomendado

1. Abrir el proyecto en Google Apps Script.
2. Ejecutar `initAppConfig()` una sola vez para guardar valores en `PropertiesService`.
3. Ejecutar `populateAppConfigFromProperties()` para escribir la config en Firestore.
4. Verificar con `verifyFirestoreConfig()`.

## Seguridad

- No se almacenan secretos en el código fuente.
- Se usa `PropertiesService` para guardar valores sensibles.
- El email de integración se almacena en propiedades protegidas.
- Solo se escribe en Firestore metadatos operativos, no claves privadas.

## Integración

- Email de integración: `sistemasdecontrol090@gmail.com`
- Proyecto Firebase: `sistema-de-control-aee89`
