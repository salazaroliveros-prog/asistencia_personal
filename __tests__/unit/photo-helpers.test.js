/**
 * Control Personal Campo — Photo helpers tests
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Cargar el módulo en un contexto con document simulado (jsdom provee document real)
const code = fs.readFileSync(
  path.resolve(__dirname, '../../js/utils/photo-helpers.js'),
  'utf8'
);
const mockCtx = vm.createContext({
  window: {},
  console,
  document: {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({
        drawImage: () => {},
      }),
      toDataURL: (type, quality) => `data:image/jpeg;base64,test`,
    }),
    getElementById: (id) => {
      const el = { src: '', style: { display: 'none' } };
      return el;
    },
  },
  FileReader: class MockFileReader {
    readAsDataURL() {
      setTimeout(() => this.onload({ target: { result: 'data:image/jpeg;base64,test' } }), 10);
    }
  },
  setTimeout,
  clearTimeout,
});
vm.runInContext(code, mockCtx);
const PhotoHelpers = mockCtx.window?.CPC?.PhotoHelpers || {};

describe('PhotoHelpers', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <img id="foto-preview" style="display:none" />
      <div id="foto-placeholder" style="display:none"></div>
    `;
  });

  it('exports compressImage function', () => {
    expect(typeof PhotoHelpers.compressImage).toBe('function');
  });

  it('exports updatePhotoPreview function', () => {
    expect(typeof PhotoHelpers.updatePhotoPreview).toBe('function');
  });

  it('returns a data URL from compressImage', () => {
    const mockImg = { width: 1200, height: 800 };
    const result = PhotoHelpers.compressImage(mockImg, 400, 400, 0.8);
    expect(result).toMatch(/^data:image\/jpeg;base64,/);
  });

  it('updates photo preview visibility (show)', () => {
    // Re-run with jsdom's real document
    const code2 = fs.readFileSync(
      path.resolve(__dirname, '../../js/utils/photo-helpers.js'),
      'utf8'
    );
    const ctx2 = vm.createContext({
      window: {},
      console,
      document,
      setTimeout,
      clearTimeout,
    });
    vm.runInContext(code2, ctx2);
    const PH = ctx2.window?.CPC?.PhotoHelpers || {};

    const preview = document.getElementById('foto-preview');
    const placeholder = document.getElementById('foto-placeholder');

    PH.updatePhotoPreview('data:image/jpeg;base64,test');
    expect(preview.style.display).toBe('block');
    expect(placeholder.style.display).toBe('none');
  });

  it('hides photo preview when src is empty', () => {
    const code2 = fs.readFileSync(
      path.resolve(__dirname, '../../js/utils/photo-helpers.js'),
      'utf8'
    );
    const ctx2 = vm.createContext({
      window: {},
      console,
      document,
      setTimeout,
      clearTimeout,
    });
    vm.runInContext(code2, ctx2);
    const PH = ctx2.window?.CPC?.PhotoHelpers || {};

    const preview = document.getElementById('foto-preview');
    PH.updatePhotoPreview('');
    expect(preview.style.display).toBe('none');
  });
});
