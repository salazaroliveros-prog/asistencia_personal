/**
 * Control Personal Campo — UpdateManager unit tests
 *
 * Semántica correcta:
 *   · sin marcador → sin alerta
 *   · primera visita / misma versión en página → sin alerta (ya corre esa versión)
 *   · página ya trae SHA nuevo vs seen viejo → sin alerta (seed, ya está actualizado)
 *   · remoto distinto al running → banner (simulado vía _notifyIfRemoteNewer)
 *   · "Ahora no" → banner oculto 1 hora
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const code = fs.readFileSync(
  path.resolve(__dirname, '../../js/utils/update-manager.js'),
  'utf8',
);

function makeSandbox(initialWindow = {}) {
  const bannerEl = {
    hidden: true,
    addEventListener: () => {},
  };
  const store = new Map();
  return {
    window: {
      ...initialWindow,
    },
    navigator: {},
    console,
    document: {
      getElementById: (id) => (id === 'update-banner' ? bannerEl : null),
    },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      clear: () => store.clear(),
    },
    JSON,
    Date,
    Math,
    Object,
    String,
    Number,
    setTimeout,
    clearTimeout,
    fetch: () => Promise.resolve({ text: () => Promise.resolve('') }),
    location: { pathname: '/', href: 'http://localhost/', protocol: 'http:', host: 'localhost' },
  };
}

function boot(win = {}) {
  const sandbox = makeSandbox(win);
  const ctx = vm.createContext(sandbox);
  vm.runInContext(code, ctx);
  return {
    UpdateManager: sandbox.window.UpdateManager,
    banner: sandbox.document.getElementById('update-banner'),
    store: sandbox.localStorage,
  };
}

describe('UpdateManager — detección por marcador de versión', () => {
  it('no muestra banner cuando no hay marcador de versión (dev/local)', () => {
    const { UpdateManager, banner, store } = boot();
    UpdateManager.init();
    expect(banner.hidden).toBe(true);
    expect(store.getItem('cpc_app_version_seen')).toBeNull();
  });

  it('primera visita: guarda la versión vista sin disparar alerta', () => {
    const { UpdateManager, banner, store } = boot({ __APP_VERSION__: 'abc123' });
    UpdateManager.init();
    expect(banner.hidden).toBe(true);
    expect(store.getItem('cpc_app_version_seen')).toBe('abc123');
  });

  it('página ya trae deploy nuevo: seed sin banner (usuario ya está actualizado)', () => {
    const sandbox = makeSandbox({ __APP_VERSION__: 'def456' });
    sandbox.localStorage.setItem('cpc_app_version_seen', 'abc123');
    const ctx = vm.createContext(sandbox);
    vm.runInContext(code, ctx);
    sandbox.window.UpdateManager.init();

    // Ya corre def456 → no pedir "recargar"; solo actualizar seen
    expect(sandbox.document.getElementById('update-banner').hidden).toBe(true);
    expect(sandbox.localStorage.getItem('cpc_app_version_seen')).toBe('def456');
  });

  it('misma versión ya vista: no vuelve a mostrar el banner', () => {
    const sandbox = makeSandbox({ __APP_VERSION__: 'abc123' });
    sandbox.localStorage.setItem('cpc_app_version_seen', 'abc123');
    const ctx = vm.createContext(sandbox);
    vm.runInContext(code, ctx);
    sandbox.window.UpdateManager.init();
    expect(sandbox.document.getElementById('update-banner').hidden).toBe(true);
  });

  it('remoto distinto al running: sí muestra banner', () => {
    const { UpdateManager, banner } = boot({ __APP_VERSION__: 'abc123' });
    UpdateManager.init();
    expect(banner.hidden).toBe(true);
    UpdateManager._notifyIfRemoteNewer('def456');
    expect(banner.hidden).toBe(false);
  });

  it('remoto igual al running: no muestra banner', () => {
    const { UpdateManager, banner } = boot({ __APP_VERSION__: 'abc123' });
    UpdateManager.init();
    UpdateManager._notifyIfRemoteNewer('abc123');
    expect(banner.hidden).toBe(true);
  });

  it('"Ahora no" oculta el banner (dismiss 1 hora)', () => {
    const sandbox = makeSandbox({ __APP_VERSION__: 'abc123' });
    const ctx = vm.createContext(sandbox);
    vm.runInContext(code, ctx);
    const UM = sandbox.window.UpdateManager;
    UM.init();
    UM._notifyIfRemoteNewer('xyz789');
    expect(sandbox.document.getElementById('update-banner').hidden).toBe(false);
    UM.dismissUpdate();
    expect(sandbox.localStorage.getItem('updateDismissedUntil')).toBeTruthy();
    expect(sandbox.document.getElementById('update-banner').hidden).toBe(true);
    UM.showUpdateBanner();
    expect(sandbox.document.getElementById('update-banner').hidden).toBe(true);
  });
});
