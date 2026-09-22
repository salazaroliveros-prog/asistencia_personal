/**
 * Sub-aplicación PWA de escáner de asistencia QR
 * - Conexión en tiempo real vía Firestore
 * - Transacciones para registro atómico de asistencia
 * - Autenticación anónima para el escáner
 */

// Estado global
let currentFacingMode = "environment";
let lastScanTime = 0;
let animationId = null;
let db, auth, app;

// Configuración de detección QR optimizada
const QR_DETECTION_CONFIG = {
  maxWidth: 640,           // Downscale para rendimiento
  maxHeight: 480,
  throttleMs: 100,         // ~10fps max
  lastDetectionTime: 0
};

// Elementos del DOM
const video = document.getElementById("preview");
const canvas = document.getElementById("canvas");
const statusDot = document.getElementById("dot");
const statusText = document.getElementById("status-text");
const lastScanDiv = document.getElementById("last-scan");
const toggleCameraBtn = document.getElementById("toggle-camera");
const flashBtn = document.getElementById("flash-toggle");
const toastContainer = document.getElementById("toast-container");

/**
 * Inicializar Firebase con configuración del entorno.
 * Usa window.FIREBASE_CONFIG (definido por firebase-config.js) si está disponible,
 * o intenta leer /js/config.js como respaldo.
 * Usa la SDK compat (ya cargada por las etiquetas <script> del HTML),
 * no la modular — evita el mismatch de API.
 */
async function initFirebase() {
  // 1. Obtener la configuración desde window.FIREBASE_CONFIG (canónico)
  let config = (typeof window !== "undefined" && window.FIREBASE_CONFIG) ? window.FIREBASE_CONFIG : null;

  // 2. Respaldo: parsear /js/config.js buscando FIREBASE_CONFIG (mayúsculas) o firebaseConfig
  if (!config || !config.apiKey) {
    try {
      const response = await fetch("/js/config.js");
      const text = await response.text();
      // Intentar window.FIREBASE_CONFIG primero (uso real del proyecto)
      let match = text.match(/window\.FIREBASE_CONFIG\s*=\s*window\.FIREBASE_CONFIG\s*\|\|\s*(\{[\s\S]*?\});/);
      if (!match) {
        match = text.match(/window\.FIREBASE_CONFIG\s*=\s*(\{[\s\S]*?\})\s*;/);
      }
      if (!match) {
        // Respaldo legacy: window.firebaseConfig en minúsculas
        match = text.match(/window\.firebaseConfig\s*=\s*(\{[^;]+\})/);
      }
      if (match) {
        config = JSON.parse(
          match[1]
            .replace(/(['"])([a-zA-Z0-9_-]+)\1\s*:/g, '"$2":')
            .replace(/([{,]\s*)([a-zA-Z0-9_-]+)\s*:/g, '$1"$2":')
            .replace(/,\s*([}\]])/g, '$1')
        );
      }
    } catch (e) {
      console.warn("No se pudo leer /js/config.js:", e);
    }
  }

  if (!config || !config.apiKey) {
    throw new Error("No se pudo obtener configuración de Firebase. Verifica firebase-config.js.");
  }

  // 3. Usar la SDK compat ya cargada como <script> en el HTML (no como import dinámico modular)
  //    firebase, firebase.firestore(), firebase.auth() son la API compat.
  if (typeof firebase === "undefined") {
    throw new Error("Firebase SDK compat no está cargada. Verifica los <script> en scanner.html.");
  }

  if (!firebase.apps.length) {
    app = firebase.initializeApp(config);
  } else {
    app = firebase.apps[0];
  }

  db = firebase.firestore();
  auth = firebase.auth();

  // Sin enablePersistence: el SDK compat 12.x emite warn de deprecación y no
  // expone persistentLocalCache. Este HTML redirige a field-scanner.html.

  // Iniciar sesión anónima para cumplir con las reglas de Firestore
  try {
    await auth.signInAnonymously();
  } catch (e) {
    console.error("Auth anónima fallida:", e);
  }

  setConnectionStatus(true);
  console.log("Firebase (compat) inicializado para escáner");
}

/**
 * Wrapper: obtener documento de Firestore (trabajadores)
 * Usa la API compat: db.collection().doc().get() en lugar de funciones modulares.
 */
async function getWorkerDoc(workerId) {
  const snap = await db.collection("trabajadores").doc(String(workerId)).get();
  return snap;
}

/**
 * Mostrar notificación toast
 */
function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

/**
 * Actualizar estado de conexión
 */
function setConnectionStatus(online) {
    if (statusDot) statusDot.classList.toggle("online", online);
  if (statusText) statusText.textContent = online ? "En línea" : "Sin conexión";
}

/**
 * Iniciar cámara (mobile-first: cámara trasera por defecto)
 */
async function startCamera(facingMode = "environment") {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode } });
    video.srcObject = stream;
    setConnectionStatus(true);
    detectQRCode();
  } catch (err) {
    console.error("Error accediendo cámara:", err);
    showToast("No se pudo acceder a la cámara", "error");
    setConnectionStatus(false);
  }
}

/**
 * Detener cámara y liberar recursos
 */
function stopCamera() {
  if (video.srcObject) {
    video.srcObject.getTracks().forEach(track => track.stop());
    video.srcObject = null;
  }
  if (animationId) cancelAnimationFrame(animationId);
}

/**
 * Detección continua de códigos QR en el stream de video (optimizada)
 */
function detectQRCode() {
  if (!video.videoWidth || !video.videoHeight) {
    animationId = requestAnimationFrame(detectQRCode);
    return;
  }

  const now = performance.now();
  if (now - QR_DETECTION_CONFIG.lastDetectionTime < QR_DETECTION_CONFIG.throttleMs) {
    animationId = requestAnimationFrame(detectQRCode);
    return;
  }
  QR_DETECTION_CONFIG.lastDetectionTime = now;

  const context = canvas.getContext("2d");
  
  // Calcular dimensiones escaladas manteniendo aspect ratio
  const scale = Math.min(
    QR_DETECTION_CONFIG.maxWidth / video.videoWidth,
    QR_DETECTION_CONFIG.maxHeight / video.videoHeight,
    1
  );
  
  const scaledWidth = Math.round(video.videoWidth * scale);
  const scaledHeight = Math.round(video.videoHeight * scale);
  
  canvas.width = scaledWidth;
  canvas.height = scaledHeight;

  context.drawImage(video, 0, 0, scaledWidth, scaledHeight);
  const imageData = context.getImageData(0, 0, scaledWidth, scaledHeight);

  if (window.jsQR) {
    const code = window.jsQR(imageData.data, imageData.width, imageData.height);
    if (code && code.valid) {
      handleQRScan(code.data);
    }
  }

  animationId = requestAnimationFrame(detectQRCode);
}

/**
 * Procesar código QR escaneado (evita duplicados por debounce de 2s)
 */
function handleQRScan(data) {
  const now = Date.now();
  if (now - lastScanTime < 2000) return;
  lastScanTime = now;

  // Parsear el contenido del QR robustamente:
  //  - Si es JSON válido con workerId/id/dpi, usar esos campos
  //  - Si es un número (DPI a secas) o texto plano, tratar como workerId raw
  let qrData;
  try {
    const parsed = JSON.parse(data);
    if (typeof parsed === 'object' && parsed !== null) {
      qrData = parsed;
    } else {
      qrData = { raw: String(parsed).trim() };
    }
  } catch {
    qrData = { raw: String(data).trim() };
  }

  processAttendance(qrData);
}

/**
 * Procesar asistencia del trabajador escaneado
 */
async function processAttendance(qrData) {
  const workerId = qrData.workerId || qrData.id || qrData.dpi || qrData.raw;

  if (!workerId) {
    showToast("Datos del trabajador inválidos en el QR", "error");
    return;
  }

  lastScanDiv.innerHTML = `
    <div class="scan-result">
      <h3>Procesando asistencia...</h3>
      <p>ID Trabajador: ${String(workerId).replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]))}</p>
      <p class="timestamp">${new Date().toLocaleTimeString()}</p>
    </div>
  `;

  let worker = null;
  try {
    const workerDoc = await getWorkerDoc(workerId);

    if (!workerDoc.exists) {
      throw new Error(`Trabajador ${workerId} no encontrado en la base de datos`);
    }

    worker = workerDoc.data();
    showToast(`Asistencia registrada: ${worker.Nombre_Completo}`, "success");

    lastScanDiv.innerHTML = `
      <div class="scan-result">
        <h3>${String(worker.Nombre_Completo || '').replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]))}</h3>
        <p>Puesto: ${String(worker.Puesto || 'N/A').replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]))}</p>
        <p>DPI: ${String(workerId).replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]))}</p>
        <p class="timestamp">${new Date().toLocaleTimeString()}</p>
      </div>
    `;

    await registrarAsistencia(workerId, worker);

  } catch (error) {
    console.error("Error en asistencia:", error);
    // Si es error de red y tenemos datos del trabajador, encolar para sincronización posterior
    if (worker && (!navigator.onLine || error.message.includes('network') || error.message.includes('offline') || error.message.includes('permission'))) {
      await queueOfflineAttendance(workerId, worker);
    } else {
      showToast(`Error: ${error.message}`, "error");
    }

        lastScanDiv.innerHTML = `
      <div class="scan-result" style="background: #7f1d1d;">
        <h3>Error en escaneo</h3>
        <p>${error.message}</p>
        <p class="timestamp">${new Date().toLocaleTimeString()}</p>
      </div>
    `;
  }
}

/**
 * Registrar asistencia en Firestore con transacción (atomicidad garantizada)
 * Compatible con el esquema del sistema principal y sincronización en tiempo real.
 * Usa la API compat (db.collection, db.runTransaction, etc.) — NO la modular.
 * COLECCIÓN: "asistencias" (plural) — igual que api.js y las reglas de Firestore.
 */
async function registrarAsistencia(workerId, worker) {
  const fechaHoy = new Date().toISOString().split("T")[0];
  const ahora = new Date();
  const hora = ahora.toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit" });
  const timestamp = ahora.getTime();
  const dpiLimpio = String(workerId).replace(/[^0-9]/g, "");
  const asistenciaId = `${fechaHoy}_${dpiLimpio}`;

  await db.runTransaction(async (transaction) => {
    // COLECCIÓN CORRECTA: "asistencias" (plural, igual que api.js y firestore.rules)
    const asistenciaRef = db.collection("asistencias").doc(asistenciaId);
    const asistenciaDoc = await transaction.get(asistenciaRef);

    let historial = [];
    let metodosRegistro = [];

    if (asistenciaDoc.exists) {
      const data = asistenciaDoc.data();
      historial = data.Historial_Marcaciones || [];
      metodosRegistro = data.Metodos_Registro || [];
    }

    historial.push({
      Fecha: fechaHoy,
      Hora: hora,
      Timestamp: timestamp,
      Metodo_Registro: "QR_ESCANER_MOVIL",
      Origen: "SUB_APP_ESCANER"
    });

    metodosRegistro.push("QR_ESCANER_MOVIL");

    const asistenciaData = {
      ID_Trabajador: workerId,
      Documento: worker.DPI || worker.Documento || dpiLimpio,
      Nombre_Completo: worker.Nombre_Completo || "Desconocido",
      Puesto: worker.Puesto || "N/A",
      Fecha: fechaHoy,
      Jefe: worker.Jefe || "",
      Telefono: worker.Telefono || "",
      Estado_General: "Presente",
      Metodo_Registro: "QR_ESCANER_MOVIL",
      Ubicacion_Obra: worker.Ubicacion_Obra || "GPS: desconocida",
      Historial_Marcaciones: historial,
      Metodos_Registro: [...new Set(metodosRegistro)],
      Ultima_Actualizacion: timestamp,
      updated_at: new Date().toISOString()
    };

    transaction.set(asistenciaRef, asistenciaData, { merge: true });
  });

  window.dispatchEvent(new CustomEvent("asistencia-registrada", {
    detail: { workerId, fecha: fechaHoy, hora, timestamp }
  }));

  console.log("Asistencia registrada:", { workerId, fecha: fechaHoy, hora });
}

/**
 * Cola offline para sincronización posterior
 */
const OFFLINE_QUEUE_KEY = 'pwa_scanner_offline_queue';

function getOfflineQueue() {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
  } catch { return []; }
}

function saveOfflineQueue(queue) {
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue.slice(-100)));
  } catch { /* ignore */ }
}

async function queueOfflineAttendance(workerId, worker) {
  const queue = getOfflineQueue();
  const fechaHoy = new Date().toISOString().split("T")[0];
  const ahora = new Date();
  const hora = ahora.toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit" });
  const timestamp = ahora.getTime();
  const dpiLimpio = String(workerId).replace(/[^0-9]/g, "");
  
  queue.push({
    workerId,
    workerData: worker,
    fechaHoy,
    hora,
    timestamp,
    dpiLimpio,
    queuedAt: Date.now()
  });
  saveOfflineQueue(queue);
  showToast(`Sin conexión: marca encolada (${queue.length} pendientes)`, "error");
}

async function processOfflineQueue() {
  const queue = getOfflineQueue();
  if (!queue.length || !db) return;
  
  const pending = [...queue];
  let successCount = 0;

  for (const item of pending) {
    try {
      let workerData = item.workerData;
      if (!workerData || !workerData.Nombre_Completo) {
        const workerDoc = await getWorkerDoc(item.workerId);
        if (workerDoc.exists) {
          workerData = workerDoc.data();
        }
      }
      
      if (!workerData) {
        console.warn('No se pudo obtener datos del trabajador para', item.workerId);
        continue;
      }
      
      // COLECCIÓN CORRECTA: "asistencias" (plural) — API compat
      const asistenciaId = `${item.fechaHoy}_${item.dpiLimpio}`;
      const asistenciaRef = db.collection("asistencias").doc(asistenciaId);

      await db.runTransaction(async (transaction) => {
        const asistenciaDoc = await transaction.get(asistenciaRef);
        
        let historial = [];
        let metodosRegistro = [];
        if (asistenciaDoc.exists) {
          const data = asistenciaDoc.data();
          historial = data.Historial_Marcaciones || [];
          metodosRegistro = data.Metodos_Registro || [];
        }
        historial.push({
          Fecha: item.fechaHoy,
          Hora: item.hora,
          Timestamp: item.timestamp,
          Metodo_Registro: "QR_ESCANER_MOVIL",
          Origen: "SUB_APP_ESCANER_OFFLINE"
        });
        metodosRegistro.push("QR_ESCANER_MOVIL");
        
        const asistenciaData = {
          ID_Trabajador: item.workerId,
          Documento: workerData.DPI || workerData.Documento || item.dpiLimpio,
          Nombre_Completo: workerData.Nombre_Completo || "Desconocido",
          Puesto: workerData.Puesto || "N/A",
          Fecha: item.fechaHoy,
          Jefe: workerData.Jefe || "",
          Telefono: workerData.Telefono || "",
          Estado_General: "Presente",
          Metodo_Registro: "QR_ESCANER_MOVIL",
          Ubicacion_Obra: workerData.Ubicacion_Obra || "GPS: desconocida",
          Historial_Marcaciones: historial,
          Metodos_Registro: [...new Set(metodosRegistro)],
          Ultima_Actualizacion: item.timestamp,
          updated_at: new Date().toISOString()
        };
        transaction.set(asistenciaRef, asistenciaData, { merge: true });
      });
      successCount++;
    } catch (err) {
      console.error('Error syncing offline item:', err);
    }
  }
  
  if (successCount > 0) {
    const remaining = queue.slice(successCount);
    saveOfflineQueue(remaining);
    showToast(`${successCount} marcas sincronizadas`, "success");
  }
}

// Detectar conexión y procesar cola
window.addEventListener('online', processOfflineListener);

function processOfflineListener() {
  processOfflineQueue();
}

/**
 * Escuchar cambios de asistencia en tiempo real (Firestore onSnapshot — API compat)
 * COLECCIÓN: "asistencias" (plural, igual que api.js y firestore.rules)
 */
function setupRealtimeListener() {
  if (!db) return;

  try {
    // API compat: db.collection().onSnapshot()
    db.collection("asistencias").onSnapshot(
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          console.log("RT change:", change.type, change.doc.id);
          if (change.type === "modified" || change.type === "added") {
            const data = change.doc.data();
            // Solo mostrar toast si tiene nombre (evita notificaciones vacías)
            if (data.Nombre_Completo) {
              showToast(`Asistencia actualizada: ${data.Nombre_Completo}`, "success");
            }
          }
        });
      },
      (err) => {
        console.warn("Listener tiempo real fallido:", err.message);
      }
    );
  } catch (err) {
    console.warn("No se pudo iniciar listener de tiempo real:", err.message);
  }
}

/**
 * Cargar jsQR dinámicamente para detección de códigos QR
 */
async function loadJSQR() {
  const script = document.createElement("script");
  script.src = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js";
  document.head.appendChild(script);
  return new Promise(resolve => script.onload = resolve);
}

toggleCameraBtn.addEventListener("click", () => {
  stopCamera();
  currentFacingMode = currentFacingMode === "environment" ? "user" : "environment";
  startCamera(currentFacingMode);
});

flashBtn.addEventListener("click", async () => {
  const track = video.srcObject?.getVideoTracks()[0];
  const capabilities = track?.getCapabilities?.();
  if (capabilities?.torch) {
    const imageCapture = new ImageCapture(track);
    const photoCapabilities = await imageCapture.getPhotoCapabilities();
    const torch = !photoCapabilities.torch;
    await track.applyConstraints({ advanced: [{ torch }] });
    flashBtn.textContent = torch ? "Apagar flash" : "Flash";
  } else {
    showToast("Flash no disponible en este dispositivo", "error");
  }
});

async function init() {
  await initFirebase();
  await loadJSQR();
  await startCamera(currentFacingMode);
  setupRealtimeListener();
  console.log("Sub-aplicación escáner lista");
}

document.addEventListener("DOMContentLoaded", init);

if (typeof window !== "undefined") {
  window.processAttendance = processAttendance;
  window.registrarAsistencia = registrarAsistencia;
}

