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
 * Inicializar Firebase con configuración del entorno
 */
async function initFirebase() {
  const response = await fetch("/js/config.js");
  const text = await response.text();
  const match = text.match(/window\.firebaseConfig\s*=\s*(\{[^;]+\})/);
  if (!match) throw new Error("No se pudo obtener configuración de Firebase");

  const config = JSON.parse(
    match[1]
      .replace(/(['"])([a-zA-Z0-9_-]+)\1\s*:/g, '$2:')
      .replace(/,\s*([}\]])/g, '$1')
  );

  const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
  app = initializeApp(config);

  const firestore = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js");
  const authMod = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js");

  db = firestore.getFirestore(app);
  auth = authMod.getAuth(app);

  try { await firestore.enableNetwork(db); } catch (e) { console.warn("Firestore offline:", e); }
  await authMod.signInAnonymously(auth).catch(e => console.error("Auth fallida:", e));

  setConnectionStatus(true);
  console.log("Firebase inicializado para escáner");
}

/**
 * Wrapper: obtener documento de Firestore (trabajadores)
 */
async function getWorkerDoc(workerId) {
  const firestore = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js");
  return await firestore.getDoc(firestore.doc(db, "trabajadores", String(workerId)));
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
 * Detección continua de códigos QR en el stream de video
 */
function detectQRCode() {
  if (!video.videoWidth || !video.videoHeight) {
    animationId = requestAnimationFrame(detectQRCode);
    return;
  }

  const context = canvas.getContext("2d");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

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

  let qrData;
  try {
    qrData = JSON.parse(data);
  } catch {
    qrData = { raw: data };
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
      <p>ID Trabajador: ${workerId}</p>
      <p class="timestamp">${new Date().toLocaleTimeString()}</p>
    </div>
  `;

  try {
    const workerDoc = await getWorkerDoc(workerId);

    if (!workerDoc.exists) {
      throw new Error(`Trabajador ${workerId} no encontrado en la base de datos`);
    }

    const worker = workerDoc.data;
    showToast(`Asistencia registrada: ${worker.Nombre_Completo}`, "success");

    lastScanDiv.innerHTML = `
      <div class="scan-result">
        <h3>${worker.Nombre_Completo}</h3>
        <p>Puesto: ${worker.Puesto || "N/A"}</p>
        <p>DPI: ${workerId}</p>
        <p class="timestamp">${new Date().toLocaleTimeString()}</p>
      </div>
    `;

    await registrarAsistencia(workerId, worker);

  } catch (error) {
    console.error("Error en asistencia:", error);
    showToast(`Error: ${error.message}`, "error");

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
 * Compatible con el esquema del sistema principal y sincronización en tiempo real
 */
async function registrarAsistencia(workerId, worker) {
  const firestore = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js");
  const { collection, doc, runTransaction } = firestore;

  const fechaHoy = new Date().toISOString().split("T")[0];
  const ahora = new Date();
  const hora = ahora.toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit" });
  const timestamp = ahora.getTime();

  await runTransaction(db, async (transaction) => {
    const asistenciaRef = collection(db, "asistencia");
    const dpiLimpio = String(workerId).replace(/[^0-9]/g, "");
    const asistenciaId = `${fechaHoy}_${dpiLimpio}`;

    const asistenciaDoc = await transaction.get(doc(asistenciaRef, asistenciaId));

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

    transaction.set(doc(asistenciaRef, asistenciaId), asistenciaData, { merge: true });
  });

  window.dispatchEvent(new CustomEvent("asistencia-registrada", {
    detail: { workerId, fecha: fechaHoy, hora, timestamp }
  }));

  console.log("Asistencia registrada:", { workerId, fecha: fechaHoy, hora });
}

/**
 * Escuchar cambios de asistencia en tiempo real (Firestore onSnapshot)
 */
function setupRealtimeListener() {
  if (!db) return;

  import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js")
    .then(firestore => {
      const unsub = firestore.onSnapshot(
        firestore.collection(db, "asistencia"),
        (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            console.log("RT change:", change.type, change.doc.id);
            if (change.type === "modified" || change.type === "added") {
              const data = change.doc.data();
              showToast(`Asistencia actualizada: ${data.Nombre_Completo}`, "success");
            }
          });
        }
      );
      return unsub;
    })
    .catch(err => {
      console.warn("Listener tiempo real fallido:", err);
    });
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
  if (track && track.getCapabilities().torch) {
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

