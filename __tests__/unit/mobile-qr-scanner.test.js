const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadMobileScanner() {
  const code = fs.readFileSync(
    path.resolve(__dirname, '../../js/utils/mobile-qr-scanner.js'),
    'utf8',
  );
  const window = {};
  const context = vm.createContext({
    window,
    navigator: { mediaDevices: {} },
    location: { protocol: 'https:' },
    Promise,
    Error,
    console,
  });
  vm.runInContext(code, context);
  return window.MobileQRScanner;
}

describe('MobileQRScanner', () => {
  it('expone el recorte como fracción del lado menor del frame', () => {
    const MobileQRScanner = loadMobileScanner();
    const qrbox = MobileQRScanner.buildQrboxFn({ ratio: 0.5 });

    expect(qrbox(640, 480)).toEqual({ width: 240, height: 240 });
    expect(qrbox(1280, 720)).toEqual({ width: 360, height: 360 });
  });

  it('respeta el mínimo de html5-qrcode y el tamaño de respaldo', () => {
    const MobileQRScanner = loadMobileScanner();

    expect(MobileQRScanner.buildQrboxFn({ ratio: 0.01 })(640, 480)).toEqual({ width: 50, height: 50 });
    expect(MobileQRScanner.buildQrboxFn({ ratio: 0.7 })(0, 0)).toEqual({ width: 320, height: 320 });
  });

  it('los modos de rendimiento definen fracciones amplias, no píxeles fijos', () => {
    const MobileQRScanner = loadMobileScanner();

    ['low', 'balanced', 'high'].forEach((mode) => {
      const config = MobileQRScanner.getPerformanceConfig(mode);
      expect(config.qrbox).toBeUndefined();
      expect(config.qrboxRatio).toBeGreaterThanOrEqual(0.6);
      expect(config.qrboxRatio).toBeLessThanOrEqual(1);
    });
  });

  it('devuelve una copia del preset para no mutar la configuración original', () => {
    const MobileQRScanner = loadMobileScanner();
    const first = MobileQRScanner.getPerformanceConfig('balanced');
    first.fps = 99;
    first.qrboxRatio = 0.1;

    const second = MobileQRScanner.getPerformanceConfig('balanced');
    expect(second.fps).toBe(10);
    expect(second.qrboxRatio).toBe(0.7);
  });

  it('cae al modo balanced cuando el modo solicitado no existe', () => {
    const MobileQRScanner = loadMobileScanner();

    expect(MobileQRScanner.getPerformanceConfig('turbo')).toEqual(
      MobileQRScanner.getPerformanceConfig('balanced'),
    );
  });

  it('mantiene un recorte amplio en la configuración móvil por defecto', () => {
    const MobileQRScanner = loadMobileScanner();
    const config = MobileQRScanner.getMobileOptimizedConfig();

    expect(config.qrboxRatio).toBeGreaterThanOrEqual(0.7);
  });
});
