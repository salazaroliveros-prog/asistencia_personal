import { Html5QrcodeScanner } from 'html5-qrcode';

export class QrScanner {
  constructor() {
    this.scanner = null;
    this.handler = null;
  }

  start(containerId, handler) {
    this.handler = handler;
    if (this.scanner) { this.stop(); }

    this.scanner = new Html5QrcodeScanner(containerId, {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1,
      showTorchButtonIfSupported: true,
    });

    this.scanner.render(
      (decodedText) => this.onScan(decodedText),
      () => { /* ignore scan misses */ }
    );
  }

  stop() {
    if (this.scanner) {
      try { this.scanner.clear(); } catch { /* noop */ }
      this.scanner = null;
    }
  }

  onScan(text) {
    if (!this.handler) return;
    const workerId = text.trim();
    if (!workerId) return;
    const payload = {
      workerId,
      tipo: 'Entrada',
      metodo: 'QR',
      ubicacion: null,
    };
    this.handler(payload);
  }
}
