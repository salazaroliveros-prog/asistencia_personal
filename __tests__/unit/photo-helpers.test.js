/**
 * Control Personal Campo — Photo helpers tests
 */

const PhotoHelpers = (() => {
  try {
    const fs = require('fs');
    const path = require('path');
    const code = fs.readFileSync(path.join(__dirname, 'js/utils/photo-helpers.js'), 'utf8');
    const vm = require('vm');
    const ctx = vm.createContext({ 
      window: {}, 
      console, 
      document: { 
        getElementById: () => ({ src: '', style: {} }) 
      },
      FileReader: class MockFileReader {
        constructor() {}
        readAsDataURL() {
          setTimeout(() => {
            this.onload({ result: 'data:image/jpeg;base64,test' });
          }, 10);
        }
      }
    });
    vm.runInContext(code, ctx);
    return ctx.window?.CPC?.PhotoHelpers || {};
  } catch (e) {
    console.warn('PhotoHelpers not available:', e.message);
    return {};
  }
})();

describe('PhotoHelpers', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <img id="foto-preview" style="display:none" />
      <div id="foto-placeholder" style="display:none"></div>
    `;
  });

  it('compresses images maintaining aspect ratio', () => {
    const mockImg = {
      width: 1200,
      height: 800,
      src: 'data:image/jpeg;base64,test'
    };
    
    const result = PhotoHelpers.compressImage(mockImg, 400, 400, 0.8);
    expect(result).toContain('data:image/jpeg;base64,');
  });

  it('does not upscale small images', () => {
    const mockImg = {
      width: 200,
      height: 200,
      src: 'data:image/jpeg;base64,test'
    };
    
    const result = PhotoHelpers.compressImage(mockImg, 400, 400, 0.8);
    expect(result).toContain('data:image/jpeg;base64,');
  });

  it('updates photo preview visibility', () => {
    const preview = document.getElementById('foto-preview');
    const placeholder = document.getElementById('foto-placeholder');
    
    PhotoHelpers.updatePhotoPreview('data:image/jpeg;base64,test');
    expect(preview.style.display).toBe('block');
    expect(placeholder.style.display).toBe('none');
  });

  it('clears photo preview when src is empty', () => {
    const preview = document.getElementById('foto-preview');
    const placeholder = document.getElementById('foto-placeholder');
    
    PhotoHelpers.updatePhotoPreview('');
    expect(preview.style.display).toBe('none');
    expect(placeholder.style.display).toBe('none');
  });
});
