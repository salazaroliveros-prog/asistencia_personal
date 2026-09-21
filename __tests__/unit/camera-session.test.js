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
});
