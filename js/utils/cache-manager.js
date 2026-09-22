/**
 * CONTROL PERSONAL CAMPO — utils/cache-manager.js
 * Gestión de cuota de localStorage (fuente única de la advertencia de espacio).
 * @version 1.6.0
 */

const CacheManager = (() => {

  const LS_QUOTA_WARN_BYTES = 4 * 1024 * 1024; // warn at ~4MB of cpc_ keys

  function checkQuota() {
    try {
      let totalBytes = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith('cpc_')) continue;
        const val = localStorage.getItem(key);
        totalBytes += (key.length + (val ? val.length : 0)) * 2; // UTF-16
      }
      if (totalBytes > LS_QUOTA_WARN_BYTES) {
        console.warn(`[CacheManager] localStorage uso estimado: ${(totalBytes / 1024).toFixed(1)} KB. Supera ${(LS_QUOTA_WARN_BYTES / 1024).toFixed(0)} KB.`);
      }
      return totalBytes;
    } catch (e) {
      return -1;
    }
  }

  return {
    checkQuota,
  };
})();

// Exponer el módulo globalmente
window.CacheManager = CacheManager;