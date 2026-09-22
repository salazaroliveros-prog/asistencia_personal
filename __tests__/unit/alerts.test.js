/**
 * Control Personal Campo — Alerts (toasts y confirm) unit tests
 * @jest-environment jsdom
 *
 * Cubre los arreglos del sistema de notificaciones:
 *  - una sola región viva por aviso (role/aria-live según el tipo)
 *  - límite de toasts simultáneos y cierre manual
 *  - render de iconos Lucide acotado al subárbol del aviso
 *  - confirm(): Escape cancela, Enter en "Cancelar" NO confirma (regresión),
 *    sin fugas de listener y con retorno del foco al elemento de origen
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const alertsCode = fs.readFileSync(
  path.resolve(__dirname, '../../js/utils/alerts.js'),
  'utf8',
);

// `const` en vm.runInContext no se expone en el sandbox: se reasigna a window.
const wrappedCode =
  alertsCode + '\nwindow.__Alerts = typeof Alerts !== "undefined" ? Alerts : undefined;';

/**
 * Carga alerts.js en un contexto que usa el DOM de jsdom.
 * @param {object} [lucideStub] - Stub de window.lucide
 * @returns {object} API pública de Alerts
 */
function loadAlerts(lucideStub) {
  const sandbox = {
    window,
    document,
    console: { log() {}, warn() {}, error() {} },
    // Se delega en el global en tiempo de llamada para que los temporizadores
    // falsos de Jest (useFakeTimers) también apliquen dentro del sandbox.
    setTimeout: (...args) => global.setTimeout(...args),
    clearTimeout: (...args) => global.clearTimeout(...args),
    Promise,
    lucide: lucideStub,
  };
  const ctx = vm.createContext(sandbox);
  vm.runInContext(wrappedCode, ctx);
  return ctx.window.__Alerts;
}

const MODAL_HTML = `
  <div id="modal-confirm" class="modal-overlay" role="alertdialog" aria-modal="true" hidden>
    <div class="modal">
      <div class="confirm-icon-wrap" id="confirm-icon-wrap" aria-hidden="true">
        <i data-lucide="alert-triangle" id="confirm-icon"></i>
      </div>
      <h2 id="modal-confirm-title">Confirmar acción</h2>
      <p id="modal-confirm-message" class="confirm-message"></p>
      <button type="button" id="btn-confirm-cancel" class="btn btn-ghost">Cancelar</button>
      <button type="button" id="btn-confirm-ok" class="btn btn-danger">
        <i data-lucide="check" aria-hidden="true"></i>
        <span id="confirm-ok-label">Confirmar</span>
      </button>
    </div>
  </div>`;

const keydown = (key) => {
  document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  return Promise.resolve(); // deja asentar la microtarea de resolve
};

describe('Alerts.toast', () => {
  let Alerts;

  beforeEach(() => {
    document.body.innerHTML = '<div id="toast-container"></div>';
    delete window.lucide;
    Alerts = loadAlerts();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('usa role=status + aria-live=polite para avisos no críticos', () => {
    const el = Alerts.success('Guardado', 'Listo');
    expect(el.getAttribute('role')).toBe('status');
    expect(el.getAttribute('aria-live')).toBe('polite');
    expect(el.classList.contains('success')).toBe(true);
  });

  it('usa role=alert + aria-live=assertive para errores', () => {
    const el = Alerts.error('Falló la conexión');
    expect(el.getAttribute('role')).toBe('alert');
    expect(el.getAttribute('aria-live')).toBe('assertive');
  });

  it('no deja el contenedor como región viva duplicada', () => {
    const container = document.getElementById('toast-container');
    expect(container.getAttribute('role')).toBeNull();
    expect(container.getAttribute('aria-live')).toBeNull();
  });

  it('escapa el HTML del título y del mensaje', () => {
    const el = Alerts.info('<img src=x onerror=alert(1)>', '<b>T</b>');
    expect(el.querySelectorAll('img')).toHaveLength(0);
    expect(el.querySelector('.toast-message').textContent)
      .toBe('<img src=x onerror=alert(1)>');
    expect(el.querySelector('.toast-title').textContent).toBe('<b>T</b>');
  });

  it('limita a 5 avisos simultáneos y los elimina tras la animación', () => {
    jest.useFakeTimers();
    const container = document.getElementById('toast-container');
    for (let i = 0; i < 6; i++) Alerts.info(`aviso ${i}`);

    const abiertos = container.querySelectorAll('.toast');
    expect(abiertos).toHaveLength(6);
    // El más antiguo se marca para salir inmediatamente
    expect(abiertos[0].classList.contains('removing')).toBe(true);

    jest.advanceTimersByTime(400);
    expect(container.querySelectorAll('.toast')).toHaveLength(5);
  });

  it('el botón cerrar retira el aviso', () => {
    jest.useFakeTimers();
    const el = Alerts.warning('Cuidado');
    el.querySelector('.toast-close').click();
    expect(el.classList.contains('removing')).toBe(true);
    jest.advanceTimersByTime(400);
    expect(document.getElementById('toast-container').querySelectorAll('.toast')).toHaveLength(0);
  });

  it('renderiza los iconos sólo del aviso, no de todo el documento', () => {
    const llamadas = [];
    const stub = { createIcons: (opts) => llamadas.push(opts) };
    window.lucide = stub;
    Alerts = loadAlerts(stub);

    // Icono ajeno al aviso (p. ej. un botón del panel principal)
    document.body.insertAdjacentHTML('beforeend', '<i data-lucide="user" id="icono-ajeno"></i>');

    const el = Alerts.info('hola');

    // El bundle de Lucide no soporta `nodes`: se acota renombrando el atributo
    expect(llamadas).toHaveLength(1);
    expect(llamadas[0].nameAttr).toBe('data-lucide-pending');
    expect(llamadas[0].nodes).toBeUndefined();

    // El icono ajeno conserva su atributo intacto → no se re-renderizó
    const ajeno = document.getElementById('icono-ajeno');
    expect(ajeno.getAttribute('data-lucide')).toBe('user');
    expect(ajeno.hasAttribute('data-lucide-pending')).toBe(false);

    // El icono del aviso queda con el nombre estándar y sin atributos temporales
    const iconoToast = el.querySelector('.toast-icon [data-lucide]');
    expect(iconoToast.getAttribute('data-lucide')).toBe('info');
    expect(iconoToast.hasAttribute('data-lucide-pending')).toBe(false);
  });
});

describe('Alerts.confirm', () => {
  let Alerts;

  beforeEach(() => {
    document.body.innerHTML = '<div id="toast-container"></div>' + MODAL_HTML;
    delete window.lucide;
    Alerts = loadAlerts();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('Escape devuelve false y cierra el modal', async () => {
    const p = Alerts.confirm('¿Eliminar registro?');
    expect(document.getElementById('modal-confirm').hidden).toBe(false);

    await keydown('Escape');
    expect(await p).toBe(false);
    expect(document.getElementById('modal-confirm').hidden).toBe(true);
  });

  it('Enter con el foco en Cancelar NO confirma (regresión)', async () => {
    const p = Alerts.confirm('¿Eliminar registro?');
    jest.advanceTimersByTime(100);
    // El foco por defecto está en el botón seguro
    expect(document.activeElement.id).toBe('btn-confirm-cancel');

    let resuelto;
    p.then((v) => { resuelto = v; });
    await keydown('Enter');
    await Promise.resolve();
    // Antes de la corrección, el keydown global resolvía true (acción destructiva)
    expect(resuelto).toBeUndefined();

    // La activación nativa del botón enfocado sí decide
    document.getElementById('btn-confirm-cancel').click();
    expect(await p).toBe(false);
  });

  it('el botón OK confirma y aplica las etiquetas personalizadas', async () => {
    const p = Alerts.confirm('¿Eliminar?', 'Confirmar borrado', {
      okLabel: 'Sí, borrar',
      cancelLabel: 'Mejor no',
    });
    expect(document.getElementById('confirm-ok-label').textContent).toBe('Sí, borrar');
    expect(document.getElementById('btn-confirm-cancel').textContent).toBe('Mejor no');

    document.getElementById('btn-confirm-ok').click();
    expect(await p).toBe(true);
  });

  it('resuelve una sola vez aunque Escape y el botón se disparen seguidos', async () => {
    const p = Alerts.confirm('¿Eliminar?');
    let veces = 0;
    p.then(() => { veces++; });

    await keydown('Escape');
    document.getElementById('btn-confirm-cancel').click();
    await Promise.resolve();

    expect(await p).toBe(false);
    expect(veces).toBe(1);
  });

  it('retira el listener de teclado al cerrar (sin fugas)', async () => {
    const quitar = jest.spyOn(document, 'removeEventListener');
    const p = Alerts.confirm('¿Eliminar?');
    await keydown('Escape');
    await p;

    const retirado = quitar.mock.calls.some(
      ([tipo, fn]) => tipo === 'keydown' && typeof fn === 'function',
    );
    expect(retirado).toBe(true);
    quitar.mockRestore();
  });

  it('devuelve el foco al elemento que abrió el diálogo', async () => {
    document.body.insertAdjacentHTML('beforeend', '<button id="disparador">Borrar</button>');
    const disparador = document.getElementById('disparador');
    disparador.focus();

    const p = Alerts.confirm('¿Eliminar?');
    jest.advanceTimersByTime(100);
    await keydown('Escape');
    await p;

    expect(document.activeElement).toBe(disparador);
  });

  it('cae a window.confirm si el modal no existe en el DOM', async () => {
    document.getElementById('modal-confirm').remove();
    const nativo = jest.fn(() => true);
    window.confirm = nativo;

    expect(await Alerts.confirm('¿Seguir?')).toBe(true);
    expect(nativo).toHaveBeenCalled();
  });
});