/**
 * CONTROL PERSONAL CAMPO — utils/crypto-utils.js
 * Utilidades de criptografía usando Web Crypto API nativo
 * Reemplaza crypto-js deprecado con solución nativa y segura
 * @version 1.5.0
 */

const CryptoUtils = (() => {
  /**
   * Genera un hash SHA-256 de un string
   * @param {string} text - Texto a hashear
   * @returns {Promise<string>} Hash en formato hexadecimal
   */
  async function sha256(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  }

  /**
   * Genera un ID único criptográficamente seguro
   * @param {number} length - Longitud del ID en bytes (default: 16)
   * @returns {Promise<string>} ID en formato hexadecimal
   */
  async function generateSecureId(length = 16) {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Encripta datos usando AES-GCM
   * @param {string} data - Datos a encriptar
   * @param {string} key - Clave de encriptación
   * @returns {Promise<{encrypted: string, iv: string}>} Datos encriptados y IV
   */
  async function encrypt(data, key) {
    const encoder = new TextEncoder();
    const keyBuffer = encoder.encode(key);
    
    // Derivar clave
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
    
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const derivedKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );
    
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const dataBuffer = encoder.encode(data);
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      derivedKey,
      dataBuffer
    );
    
    return {
      encrypted: Array.from(new Uint8Array(encrypted), byte => byte.toString(16).padStart(2, '0')).join(''),
      iv: Array.from(iv, byte => byte.toString(16).padStart(2, '0')).join(''),
      salt: Array.from(salt, byte => byte.toString(16).padStart(2, '0')).join('')
    };
  }

  /**
   * Desencripta datos usando AES-GCM
   * @param {string} encrypted - Datos encriptados
   * @param {string} iv - Vector de inicialización
   * @param {string} salt - Salt para derivación de clave
   * @param {string} key - Clave de desencriptación
   * @returns {Promise<string>} Datos desencriptados
   */
  async function decrypt(encrypted, iv, salt, key) {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const keyBuffer = encoder.encode(key);
    
    // Derivar clave
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
    
    const saltArray = new Uint8Array(salt.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    const derivedKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: saltArray,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
    
    const ivArray = new Uint8Array(iv.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    const encryptedArray = new Uint8Array(encrypted.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivArray },
      derivedKey,
      encryptedArray
    );
    
    return decoder.decode(decrypted);
  }

  /**
   * Genera un token aleatorio seguro
   * @param {number} length - Longitud del token (default: 32)
   * @returns {Promise<string>} Token seguro
   */
  async function generateToken(length = 32) {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Verifica si Web Crypto API está disponible
   * @returns {boolean} true si está disponible
   */
  function isAvailable() {
    return typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined';
  }

  return {
    sha256,
    generateSecureId,
    encrypt,
    decrypt,
    generateToken,
    isAvailable
  };
})();

// Exponer el módulo globalmente
window.CryptoUtils = CryptoUtils;