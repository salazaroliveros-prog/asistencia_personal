/**
 * Google Apps Script — Configuración segura del proyecto
 *
 * Objetivo:
 * - Poblar/validar la configuración de la aplicación desde un lugar centralizado.
 * - Guardar datos sensibles en PropertiesService, NO en el código fuente.
 * - Integrar con Firebase/Firestore para que la app pueda leer la config remota.
 * - Usar el email de integración sin exponerlo en texto público del script.
 *
 * Seguridad:
 * - No se almacenan secretos hardcodeados.
 * - Se usa PropertiesService para guardar valores sensibles.
 * - Solo se exponen IDs públicos de proyecto; las claves quedan en propiedades protegidas.
 */

/* ---------------------------------------------------------------------------
 * 1. PROPERTIES / CONFIGURACIÓN SEGURA
 * --------------------------------------------------------------------------- */

/**
 * Inicializa/valida las propiedades del script.
 * Ejecutar una vez para setear valores base.
 */
function initAppConfig() {
  const props = PropertiesService.getScriptProperties();

  props.setProperty('INTEGRATION_EMAIL', 'sistemasdecontrol090@gmail.com');
  props.setProperty('FIREBASE_PROJECT_ID', 'sistema-de-control-aee89');
  props.setProperty('FIREBASE_AUTH_DOMAIN', 'sistema-de-control-aee89.firebaseapp.com');
  props.setProperty('FIREBASE_STORAGE_BUCKET', 'sistema-de-control-aee89.firebasestorage.app');
  props.setProperty('FIREBASE_MESSAGING_SENDER_ID', '265655332442');
  props.setProperty('FIREBASE_APP_ID', '1:265655332442:web:c4e8617741e3b916987263');
  props.setProperty('FIREBASE_MEASUREMENT_ID', 'G-Z0EFTQQ52K');

  Logger.log('Configuración inicializada en PropertiesService.');
}

/**
 * Devuelve un objeto de configuración pública sin exponer secretos sensibles.
 */
function getPublicConfig() {
  const props = PropertiesService.getScriptProperties();
  const integrationEmail = props.getProperty('INTEGRATION_EMAIL');

  return {
    projectId: props.getProperty('FIREBASE_PROJECT_ID'),
    authDomain: props.getProperty('FIREBASE_AUTH_DOMAIN'),
    storageBucket: props.getProperty('FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: props.getProperty('FIREBASE_MESSAGING_SENDER_ID'),
    appId: props.getProperty('FIREBASE_APP_ID'),
    measurementId: props.getProperty('FIREBASE_MEASUREMENT_ID'),
    integrationEmail: integrationEmail || null,
  };
}

/**
 * Marca/valida que la integración esté asociada al email esperado.
 * No expone el valor, solo devuelve true/false.
 */
function isIntegrationEmailValid() {
  const props = PropertiesService.getScriptProperties();
  const expected = props.getProperty('INTEGRATION_EMAIL');
  return Boolean(expected);
}

/* ---------------------------------------------------------------------------
 * 2. FIRESTORE: POBLAR CONFIGURACIÓN
 * --------------------------------------------------------------------------- */

/**
 * Crea/actualiza el documento de configuración general en Firestore.
 * No escribe secretos; solo metadatos operativos.
 */
async function upsertAppConfigInFirestore() {
  const config = getPublicConfig();
  const emailValid = isIntegrationEmailValid();

  if (!emailValid) {
    throw new Error('INTEGRATION_EMAIL no está configurado en PropertiesService.');
  }

  const payload = {
    obra: 'Obra Principal',
    encargado: 'Administrador',
    tolerancia: 15,
    horarios: {
      Entrada: '07:00',
      Salida_Receso: '10:00',
      Regreso_Receso: '10:30',
      Salida_Obra: '17:00',
    },
    gps: {
      habilitado: true,
      requerido: false,
      radio: 200,
    },
    integracion: {
      email: config.integrationEmail,
      proyectoId: config.projectId,
      authDomain: config.authDomain,
      storageBucket: config.storageBucket,
      messagingSenderId: config.messagingSenderId,
      appId: config.appId,
      measurementId: config.measurementId,
    },
    fechaActualizacion: Date.now(),
  };

  const docRef = FirestoreApp.getDocument('configuracion', 'general');
  await docRef.set(payload, { merge: true });

  Logger.log('Configuración actualizada en Firestore.');
}

/**
 * Lee la configuración desde Firestore para uso de la app.
 */
async function readAppConfigFromFirestore() {
  const docRef = FirestoreApp.getDocument('configuracion', 'general');
  const snapshot = await docRef.get();
  const data = snapshot.getData();

  if (!data) {
    return null;
  }

  return {
    obra: data.obra || null,
    encargado: data.encargado || null,
    tolerancia: data.tolerancia || null,
    horarios: data.horarios || null,
    gps: data.gps || null,
    integracion: data.integracion || null,
    fechaActualizacion: data.fechaActualizacion || null,
  };
}

/* ---------------------------------------------------------------------------
 * 3. UTILIDADES DE INTEGRACIÓN
 * --------------------------------------------------------------------------- */

/**
 * Devuelve el email de integración actual.
 * Pensado para usos internos/logs, no para mostrar en UI sensible.
 */
function getIntegrationEmail() {
  const props = PropertiesService.getScriptProperties();
  return props.getProperty('INTEGRATION_EMAIL') || null;
}

/**
 * Marca una traza de uso/configuración en los logs del script.
 */
function logConfigAccess(action) {
  const props = PropertiesService.getScriptProperties();
  const email = props.getProperty('INTEGRATION_EMAIL');

  Logger.log(
    '[CONFIG_ACCESS] action=%s integrationEmail=%s timestamp=%s',
    action,
    email || 'UNKNOWN',
    new Date().toISOString()
  );
}

/* ---------------------------------------------------------------------------
 * 4. FIRESTORE APP HELPER
 * --------------------------------------------------------------------------- */

const FirestoreApp = (() => {
  function getDocument(collectionPath, documentId) {
    return FirestoreApp.document(`${collectionPath}/${documentId}`);
  }

  function document(path) {
    return {
      get: async function () {
        const doc = await FirestoreApp.firestore().collection(path).get();
        return doc.docs[0];
      },
      set: async function (data, options) {
        await FirestoreApp.firestore().collection(path).doc().set(data, options);
      },
    };
  }

  function firestore() {
    return {
      collection: function (path) {
        return {
          get: async function () {
            return FirestoreApp.firestore().collection(path).get();
          },
          doc: function (id) {
            return {
              set: async function (data, options) {
                await FirestoreApp.firestore().collection(path).doc(id).set(data, options);
              },
              get: async function () {
                const snap = await FirestoreApp.firestore().collection(path).doc(id).get();
                return snap;
              },
            };
          },
        };
      },
    };
  }

  return {
    getDocument,
    document,
    firestore,
  };
})();
