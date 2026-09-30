/**
 * Apogee R1 Anti - Storage Adapter
 * Compatible with Rabbit R1 creations-sdk (window.creationStorage.plain)
 * with transparent fallback to localStorage for desktop/browser preview.
 */

const ApogeeStorage = {
  getStorageEngine() {
    if (typeof window.creationStorage !== 'undefined') {
      // Prefer hardware-encrypted storage (Android M+ Keystore)
      if (window.creationStorage.secure && typeof window.creationStorage.secure.getItem === 'function') {
        return { engine: window.creationStorage.secure, isSecure: true };
      }
      if (window.creationStorage.plain && typeof window.creationStorage.plain.getItem === 'function') {
        return { engine: window.creationStorage.plain, isSecure: false };
      }
    }
    return null;
  },

  async getItem(key, defaultValue = null) {
    try {
      const storage = this.getStorageEngine();
      if (storage) {
        // Try secure first, fallback to plain if migrating
        let encoded = await storage.engine.getItem(key);
        if (!encoded && storage.isSecure && window.creationStorage.plain) {
          encoded = await window.creationStorage.plain.getItem(key);
        }
        if (!encoded) return defaultValue;
        return JSON.parse(decodeURIComponent(escape(atob(encoded))));
      } else {
        const raw = localStorage.getItem(key);
        if (!raw) return defaultValue;
        return JSON.parse(raw);
      }
    } catch (err) {
      console.warn(`[ApogeeStorage] Error reading key "${key}":`, err);
      return defaultValue;
    }
  },

  async setItem(key, value) {
    try {
      const jsonStr = JSON.stringify(value);
      const storage = this.getStorageEngine();
      if (storage) {
        const encoded = btoa(unescape(encodeURIComponent(jsonStr)));
        await storage.engine.setItem(key, encoded);
      } else {
        localStorage.setItem(key, jsonStr);
      }
      return true;
    } catch (err) {
      console.error(`[ApogeeStorage] Error saving key "${key}":`, err);
      return false;
    }
  },

  async removeItem(key) {
    try {
      const storage = this.getStorageEngine();
      if (storage) {
        await storage.engine.removeItem(key);
      } else {
        localStorage.removeItem(key);
      }
      return true;
    } catch (err) {
      console.error(`[ApogeeStorage] Error removing key "${key}":`, err);
      return false;
    }
  },

  async clear() {
    try {
      const storage = this.getStorageEngine();
      if (storage) {
        await storage.engine.clear();
      } else {
        localStorage.clear();
      }
      return true;
    } catch (err) {
      console.error(`[ApogeeStorage] Error clearing storage:`, err);
      return false;
    }
  }
};

window.ApogeeStorage = ApogeeStorage;
