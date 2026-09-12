import './firebase.js';
import { API } from './api.js';
import { state } from './app-state.js';
import { LS_KEYS } from './utils/constants.js';
import { QrScanner } from './scanner/qr.js';
import { getCurrentPosition, distanceMeters } from './scanner/gps.js';
import { enqueue } from './sync/queue.js';

const app = document.getElementById('app');
const splash = document.getElementById('splash');

function $(selector){ return app?.querySelector(selector) ?? null; }

function initUI() {
  if (!app) return;

  app.innerHTML = `
    <div class="mobile-shell">
      <header class="topbar">
        <div class="topbar-left">
          <span class="app-name">Marcación</span>
          <span class="connection-pill" id="connection-pill">---</span>
        </div>
        <div class="topbar-right">
          <span class="sync-badge" id="sync-badge" hidden>0</span>
          <button id="btn-sync" class="icon-btn" title="Sincronizar">⟳</button>
        </div>
      </header>

      <main class="content">
        <section class="card">
          <h2>Escáner QR</h2>
          <div id="scanner-container" class="scanner-container"></div>
          <button id="btn-toggle-scanner" class="primary-btn">Iniciar cámara</button>
        </section>

        <section class="card">
          <h2>Marcación manual</h2>
          <label>DPI / CUI
            <input id="input-dpi" type="text" inputmode="numeric" maxlength="13" placeholder="1234567890123" />
          </label>
          <label>Tipo
            <select id="input-tipo">
              <option value="Entrada">Entrada</option>
              <option value="Salida_Receso">Salida a receso</option>
              <option value="Regreso_Receso">Regreso de receso</option>
              <option value="Salida_Obra">Salida de obra</option>
            </select>
          </label>
          <label>Método
            <select id="input-metodo">
              <option value="QR">QR</option>
              <option value="Manual">Manual</option>
              <option value="GPS">GPS</option>
            </select>
          </label>
          <button id="btn-registrar-manual" class="primary-btn">Registrar</button>
        </section>

        <section class="card">
          <h2>Cola offline</h2>
          <div id="queue-count">0 pendientes</div>
          <button id="btn-clear-queue" class="secondary-btn">Limpiar cola</button>
        </section>
      </main>
    </div>
  `;

  bindEvents();
  updateSyncBadge();
}

let scanner = new QrScanner();

function bindEvents() {
  const btnToggle = $('#btn-toggle-scanner');
  const btnRegistrar = $('#btn-registrar-manual');
  const btnSync = $('#btn-sync');
  const btnClear = $('#btn-clear-queue');

  btnToggle?.addEventListener('click', () => {
    const container = $('#scanner-container');
    if (!container) return;
    if (btnToggle.textContent === 'Iniciar cámara') {
      scanner.start('scanner-container', handleScan);
      btnToggle.textContent = 'Detener cámara';
    } else {
      scanner.stop();
      btnToggle.textContent = 'Iniciar cámara';
    }
  });

  btnRegistrar?.addEventListener('click', async () => {
    const workerId = $('#input-dpi')?.value?.trim() || '';
    const tipo = $('#input-tipo')?.value || 'Entrada';
    const metodo = $('#input-metodo')?.value || 'Manual';
    if (!workerId) { alert('Ingrese DPI/CUI'); return; }

    let ubicacion = null;
    if (metodo === 'GPS') {
      try { ubicacion = await getCurrentPosition(); } catch { /* ignore */ }
    }

    const result = await API.registrar({ workerId, tipo, metodo, ubicacion });
    if (result.success) {
      alert(result.offline ? 'Marcación guardada offline' : 'Marcación registrada');
      updateSyncBadge();
    }
  });

  btnSync?.addEventListener('click', async () => {
    const result = await API.sync();
    alert(`${result.enviadas} sincronizadas, ${result.errores} errores`);
    updateSyncBadge();
  });

  btnClear?.addEventListener('click', async () => {
    if (!confirm('¿Limpiar cola offline?')) return;
    await import('./sync/queue').then((m) => m.clearQueue());
    updateSyncBadge();
  });
}

function handleScan(payload) {
  API.registrar(payload).then((result) => {
    if (result.success) alert('QR escaneado: ' + payload.workerId);
    updateSyncBadge();
  });
}

async function updateSyncBadge() {
  const { listQueue } = await import('./sync/queue');
  const items = await listQueue();
  const badge = $('#sync-badge');
  const count = $('#queue-count');
  if (badge) { badge.hidden = items.length === 0; badge.textContent = String(items.length); }
  if (count) count.textContent = `${items.length} pendientes`;
}

async function init() {
  try {
    const raw = localStorage.getItem(LS_KEYS.FIREBASE_CONFIG);
    const config = raw ? JSON.parse(raw) : { apiKey: '', authDomain: '', projectId: '' };
    if (config.apiKey && config.authDomain && config.projectId) {
      await API.initialize(config);
    } else {
      $('#connection-pill')?.classList.add('offline');
    }
  } catch {
    // ignore
  } finally {
    splash?.setAttribute('hidden', '');
    initUI();
  }
}

state.on('connected', (connected) => {
  const pill = $('#connection-pill');
  if (pill) {
    connected ? pill.classList.add('online') : pill.classList.add('offline');
    pill.textContent = connected ? 'En línea' : 'Local';
  }
});

init();


