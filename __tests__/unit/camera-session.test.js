const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadCameraSession(mediaDevices) {
  const code = fs.readFileSync(
    path.resolve(__dirname, '../../js/utils/camera-session.js'),
    'utf8'
  );
  const window = { CPC: {} };
  const context = vm.createContext({
    window,
    navigator: { mediaDevices },
    location: { protocol: 'https:' },
    Promise,
    Error,
    console,
  });
  vm.runInContext(code, context);
  return window.CPC.CameraSession;
}

describe('CameraSession', () => {
  it('stops every active track and detaches the preview when a camera closes', () => {
    const CameraSession = loadCameraSession({});
    const stopped = [];
    const video = { srcObject: { getTracks: () => [{ stop: () => stopped.push('first') }, { stop: () => stopped.push('second') }] } };

    CameraSession.stopStream(video);

    expect(stopped).toEqual(['first', 'second']);
    expect(video.srcObject).toBeNull();
  });

  it('falls back from a selected camera to the requested facing mode', async () => {
    const requests = [];
    const stream = { getTracks: () => [] };
    const CameraSession = loadCameraSession({
      getUserMedia: async constraints => {
        requests.push(constraints);
        if (requests.length === 1) {
          const error = new Error('Selected camera unavailable');
          error.name = 'OverconstrainedError';
          throw error;
        }
        return stream;
      },
    });

    const result = await CameraSession.startStream({ deviceId: 'rear-camera', facingMode: 'environment' });

    expect(result.stream).toBe(stream);
    expect(requests).toEqual([
      { video: { deviceId: { exact: 'rear-camera' } }, audio: false },
      { video: { facingMode: { ideal: 'environment' } }, audio: false },
    ]);
  });

  it('describes a denied permission with an actionable message', () => {
    const CameraSession = loadCameraSession({});

    expect(CameraSession.describeError({ name: 'NotAllowedError' })).toContain('permiso');
  });

  it('starts QR scanning through Html5Qrcode without opening a second media stream', async () => {
    const mediaDevices = { getUserMedia: jest.fn() };
    const CameraSession = loadCameraSession(mediaDevices);
    const starts = [];
    class Scanner {
      async start(camera, config) {
        starts.push({ camera, config });
        if (starts.length === 1) {
          const error = new Error('Rear lens unavailable');
          error.name = 'OverconstrainedError';
          throw error;
        }
      }
      async stop() {}
    }

    const scanner = CameraSession.createQrController({ Scanner, elementId: 'reader', onSuccess: () => {} });
    await scanner.start({ facingMode: 'environment' });

    expect(starts.map(item => item.camera)).toEqual([
      { facingMode: 'environment' },
      { facingMode: 'user' },
    ]);
    expect(mediaDevices.getUserMedia).not.toHaveBeenCalled();
  });

  it('escala el recorte del decodificador al lado menor del frame de vídeo', () => {
    const CameraSession = loadCameraSession({});
    const qrbox = CameraSession.buildQrboxFn({ ratio: 0.5 });

    // 0.5 * min(640, 480) = 240 y 0.5 * min(1280, 720) = 360
    expect(qrbox(640, 480)).toEqual({ width: 240, height: 240 });
    expect(qrbox(1280, 720)).toEqual({ width: 360, height: 360 });
  });

  it('nunca devuelve un recorte menor al mínimo que exige html5-qrcode', () => {
    const CameraSession = loadCameraSession({});
    const qrbox = CameraSession.buildQrboxFn({ ratio: 0.01 });

    // MIN_QR_BOX_SIZE de html5-qrcode = 50 px
    expect(qrbox(640, 480)).toEqual({ width: 50, height: 50 });
  });

  it('usa un recorte de respaldo mientras el vídeo no tiene dimensiones', () => {
    const CameraSession = loadCameraSession({});
    const qrbox = CameraSession.buildQrboxFn({ ratio: 0.7 });

    expect(qrbox(0, 0)).toEqual({ width: 320, height: 320 });
    expect(qrbox(undefined, undefined)).toEqual({ width: 320, height: 320 });
  });

  it('ignora ratios fuera de rango y aplica el valor por defecto', () => {
    const CameraSession = loadCameraSession({});
    // ratio por defecto 0.7 * min(640, 480) = 336
    expect(CameraSession.buildQrboxFn()(640, 480)).toEqual({ width: 336, height: 336 });
    expect(CameraSession.buildQrboxFn({ ratio: 2 })(640, 480)).toEqual({ width: 336, height: 336 });
    expect(CameraSession.buildQrboxFn({ ratio: 0 })(640, 480)).toEqual({ width: 336, height: 336 });
  });

  it('entrega el qrbox como función para que la librería mida el frame real', async () => {
    const CameraSession = loadCameraSession({ getUserMedia: jest.fn() });
    const starts = [];
    class Scanner {
      async start(camera, config) { starts.push(config); }
      async stop() {}
    }

    const controller = CameraSession.createQrController({ Scanner, elementId: 'reader', onSuccess: () => {} });
    await controller.start({ facingMode: 'environment' });

    expect(typeof starts[0].qrbox).toBe('function');
    expect(starts[0].qrbox(640, 480)).toEqual({ width: 336, height: 336 });
  });

  it('mantiene safeQrBox como respaldo estático para llamadores antiguos', () => {
    const CameraSession = loadCameraSession({});

    expect(CameraSession.safeQrBox(null, { width: 250, height: 250 })).toEqual({ width: 250, height: 250 });
    expect(CameraSession.safeQrBox(null)).toEqual({ width: 320, height: 320 });
  });
});
