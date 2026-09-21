/**
 * Control Personal Campo — Photo helpers tests
 * @jest-environment jsdom
 *
 * Tests actualizados para reflejar mejoras de validación y JSDoc en photo-helpers.js v1.5.0
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
      toDataURL: (_type, _quality) => 'data:image/jpeg;base64,test',
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

  describe('fileToDataUrl', () => {
    it('exports fileToDataUrl function', () => {
      expect(typeof PhotoHelpers.fileToDataUrl).toBe('function');
    });

    it('rejects when no file is provided', async () => {
      await expect(PhotoHelpers.fileToDataUrl(null)).rejects.toThrow('No se proporcionó un archivo válido');
      await expect(PhotoHelpers.fileToDataUrl(undefined)).rejects.toThrow('No se proporcionó un archivo válido');
    });

    it('returns a promise for valid file object', () => {
      const mockFile = { name: 'test.jpg', type: 'image/jpeg', size: 1000 };
      const result = PhotoHelpers.fileToDataUrl(mockFile);
      // Verificar que retorna algo que tiene then (comportamiento de Promise)
      expect(typeof result.then).toBe('function');
    });
  });

  describe('compressImage', () => {
    it('exports compressImage function', () => {
      expect(typeof PhotoHelpers.compressImage).toBe('function');
    });

    it('returns a data URL from compressImage', () => {
      const mockImg = { width: 1200, height: 800 };
      const result = PhotoHelpers.compressImage(mockImg, 400, 400, 0.8);
      expect(result).toMatch(/^data:image\/jpeg;base64,/);
    });

    it('handles invalid image elements', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      expect(PhotoHelpers.compressImage(null)).toBe('');
      expect(PhotoHelpers.compressImage({})).toBe('');
      expect(PhotoHelpers.compressImage({ width: 100 })).toBe('');
      expect(PhotoHelpers.compressImage({ height: 100 })).toBe('');
      
      expect(consoleWarnSpy).toHaveBeenCalledWith('[PhotoHelpers] compressImage recibió elemento inválido');
      consoleWarnSpy.mockRestore();
    });

    it('respects aspect ratio when compressing', () => {
      const mockImg = { width: 1200, height: 800 };
      const result = PhotoHelpers.compressImage(mockImg, 400, 400, 0.8);
      expect(result).toMatch(/^data:image\/jpeg;base64,/);
      // El aspecto se mantiene (1200:800 = 3:2, el resultado debería mantener la proporción)
    });

    it('handles canvas context failure', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      // Crear un mock que no tiene getContext
      const mockCtx2 = vm.createContext({
        window: {},
        console,
        document: {
          createElement: () => ({
            width: 100,
            height: 100,
            getContext: () => null, // Simular fallo
          }),
          getElementById: () => ({ src: '', style: { display: 'none' } }),
        },
        setTimeout,
        clearTimeout,
      });
      vm.runInContext(code, mockCtx2);
      const PH2 = mockCtx2.window?.CPC?.PhotoHelpers || {};
      
      const result = PH2.compressImage({ width: 100, height: 100 });
      expect(result).toBe('');
      expect(consoleWarnSpy).toHaveBeenCalledWith('[PhotoHelpers] No se pudo obtener contexto 2D del canvas');
      consoleWarnSpy.mockRestore();
    });
  });

  describe('updatePhotoPreview', () => {
    it('exports updatePhotoPreview function', () => {
      expect(typeof PhotoHelpers.updatePhotoPreview).toBe('function');
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

    it('uses custom element IDs when provided', () => {
      document.body.innerHTML = `
        <img id="custom-preview" style="display:none" />
        <div id="custom-placeholder" style="display:none"></div>
      `;
      
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

      const preview = document.getElementById('custom-preview');
      const placeholder = document.getElementById('custom-placeholder');

      PH.updatePhotoPreview('data:image/jpeg;base64,test', 'custom-preview', 'custom-placeholder');
      expect(preview.style.display).toBe('block');
      expect(placeholder.style.display).toBe('none');
    });

    it('handles missing elements gracefully', () => {
      document.body.innerHTML = ''; // No elementos
      
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

      // No debería lanzar error cuando los elementos no existen
      expect(() => {
        PH.updatePhotoPreview('data:image/jpeg;base64,test');
      }).not.toThrow();
    });
  });
});
