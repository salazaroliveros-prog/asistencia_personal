/**
 * CONTROL PERSONAL CAMPO — utils/cache-manager.js
 * Advanced caching strategy with memory and localStorage persistence
 * @version 1.0.0
 */

const CacheManager = (() => {
  
  const memoryCache = new Map();
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes default TTL
  const CACHE_PREFIX = 'cpc_cache_';

  /**
   * Set item in cache with optional TTL
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   * @param {number} ttl - Time to live in milliseconds (default: 5 minutes)
   */
  function set(key, value, ttl = CACHE_TTL) {
    const expires = Date.now() + ttl;
    
    // Memory cache
    memoryCache.set(key, {
      value,
      expires
    });
    
    // LocalStorage cache for persistence
    try {
      const cacheItem = {
        value,
        expires,
        timestamp: Date.now()
      };
      localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(cacheItem));
    } catch (e) {
      console.warn('[CacheManager] LocalStorage write failed:', e);
    }
  }

  /**
   * Get item from cache
   * @param {string} key - Cache key
   * @returns {*} Cached value or null if expired/not found
   */
  function get(key) {
    // Check memory cache first (faster)
    const memItem = memoryCache.get(key);
    if (memItem && memItem.expires > Date.now()) {
      return memItem.value;
    }
    
    // Check localStorage cache
    try {
      const stored = localStorage.getItem(`${CACHE_PREFIX}${key}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.expires > Date.now()) {
          // Restore to memory cache
          memoryCache.set(key, parsed);
          return parsed.value;
        } else {
          // Expired - remove from localStorage
          localStorage.removeItem(`${CACHE_PREFIX}${key}`);
        }
      }
    } catch (e) {
      console.warn('[CacheManager] LocalStorage read failed:', e);
    }
    
    return null;
  }

  /**
   * Check if item exists and is not expired
   * @param {string} key - Cache key
   * @returns {boolean} True if item exists and is valid
   */
  function has(key) {
    return get(key) !== null;
  }

  /**
   * Invalidate specific cache item
   * @param {string} key - Cache key to invalidate
   */
  function invalidate(key) {
    memoryCache.delete(key);
    try {
      localStorage.removeItem(`${CACHE_PREFIX}${key}`);
    } catch (e) {
      console.warn('[CacheManager] Cache invalidation failed:', e);
    }
  }

  /**
   * Clear all cache (memory and localStorage)
   */
  function clear() {
    memoryCache.clear();
    
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith(CACHE_PREFIX))
        .forEach(k => localStorage.removeItem(k));
    } catch (e) {
      console.warn('[CacheManager] Cache clear failed:', e);
    }
  }

  /**
   * Get cache statistics
   * @returns {object} Cache statistics
   */
  function getStats() {
    const memKeys = Array.from(memoryCache.keys());
    const localStorageKeys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_PREFIX));
    
    return {
      memoryCacheSize: memoryCache.size,
      localStorageCacheSize: localStorageKeys.length,
      totalCacheSize: memKeys.length + localStorageKeys.length,
      memoryKeys: memKeys,
      localStorageKeys: localStorageKeys.map(k => k.replace(CACHE_PREFIX, ''))
    };
  }

  /**
   * Clean expired items from cache
   */
  function cleanExpired() {
    const now = Date.now();
    
    // Clean memory cache
    for (const [key, item] of memoryCache.entries()) {
      if (item.expires <= now) {
        memoryCache.delete(key);
      }
    }
    
    // Clean localStorage cache
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith(CACHE_PREFIX))
        .forEach(k => {
          try {
            const parsed = JSON.parse(localStorage.getItem(k));
            if (parsed.expires <= now) {
              localStorage.removeItem(k);
            }
          } catch (e) {
            // Invalid cache item, remove it
            localStorage.removeItem(k);
          }
        });
    } catch (e) {
      console.warn('[CacheManager] Expired cache cleanup failed:', e);
    }
  }

  /**
   * Get or set pattern - fetch from cache if available, otherwise compute and cache
   * @param {string} key - Cache key
   * @param {Function} computeFn - Function to compute value if not cached
   * @param {number} ttl - Time to live in milliseconds
   * @returns {Promise<*>} Computed or cached value
   */
  async function getOrSet(key, computeFn, ttl = CACHE_TTL) {
    const cached = get(key);
    if (cached !== null) {
      return cached;
    }
    
    const value = await computeFn();
    set(key, value, ttl);
    return value;
  }

  return { 
    set, 
    get, 
    has, 
    invalidate, 
    clear, 
    getStats, 
    cleanExpired,
    getOrSet
  };
})();