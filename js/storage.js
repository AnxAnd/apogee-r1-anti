/**
 * Apogee R1 Anti - Storage Adapter
 * Compatible with Rabbit R1 creations-sdk (window.creationStorage.plain)
 * with transparent fallback to localStorage for desktop/browser preview.
 */

const ApogeeStorage = {
  /**
   * Safely encode JSON to Base64 (supporting Unicode and emojis)
   */
  encode(data) {
    try {
      const jsonStr = JSON.stringify(data);
      return btoa(unescape(encodeURIComponent(jsonStr)));
    } catch (e) {
      try {
        return btoa(JSON.stringify(data));
      } catch (e2) {
        return JSON.stringify(data);
      }
    }
  },

  /**
   * Safely decode Base64 or raw JSON
   */
  decode(raw) {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'object') return raw;

    // 1. Try Base64 with Unicode decoding
    try {
      return JSON.parse(decodeURIComponent(escape(atob(raw))));
    } catch (e1) {}

    // 2. Try standard Base64 decoding
    try {
      return JSON.parse(atob(raw));
    } catch (e2) {}

    // 3. Try direct JSON parse (if stored unencoded)
    try {
      return JSON.parse(raw);
    } catch (e3) {}

    return null;
  },

  /**
   * Read key from storage, checking creationStorage.plain first, then secure, then localStorage
   */
  async getItem(key, defaultValue = null) {
    let raw = null;

    // 1. Check window.creationStorage.plain (Official R1 SDK persistence)
    if (typeof window.creationStorage !== 'undefined' && window.creationStorage.plain && typeof window.creationStorage.plain.getItem === 'function') {
      try {
        raw = await window.creationStorage.plain.getItem(key);
      } catch (err) {
        console.warn(`[ApogeeStorage] creationStorage.plain.getItem failed for "${key}":`, err);
      }
    }

    // 2. Check window.creationStorage.secure (Fallback)
    if (!raw && typeof window.creationStorage !== 'undefined' && window.creationStorage.secure && typeof window.creationStorage.secure.getItem === 'function') {
      try {
        raw = await window.creationStorage.secure.getItem(key);
      } catch (err) {
        console.warn(`[ApogeeStorage] creationStorage.secure.getItem failed for "${key}":`, err);
      }
    }

    // 3. Check HTML5 localStorage (Instant WebView persistence)
    if (!raw) {
      try {
        const localVal = localStorage.getItem(key);
        if (localVal !== null) {
          const parsed = this.decode(localVal);
          if (parsed !== null) return parsed;
        }
      } catch (err) {
        console.warn(`[ApogeeStorage] localStorage.getItem failed for "${key}":`, err);
      }
    }

    if (!raw) return defaultValue;

    const result = this.decode(raw);
    return result !== null ? result : defaultValue;
  },

  /**
   * Save key/value simultaneously to localStorage AND creationStorage.plain (+ secure if available)
   */
  async setItem(key, value) {
    const encoded = this.encode(value);
    const rawJson = JSON.stringify(value);

    // 1. Always save to localStorage immediately (synchronous, reliable within Android WebView)
    try {
      localStorage.setItem(key, rawJson);
    } catch (err) {
      console.warn(`[ApogeeStorage] localStorage.setItem failed for "${key}":`, err);
    }

    // 2. Always save to window.creationStorage.plain (Official R1 Creations storage API)
    if (typeof window.creationStorage !== 'undefined' && window.creationStorage.plain && typeof window.creationStorage.plain.setItem === 'function') {
      try {
        await window.creationStorage.plain.setItem(key, encoded);
      } catch (err) {
        console.warn(`[ApogeeStorage] creationStorage.plain.setItem failed for "${key}":`, err);
      }
    }

    // 3. Mirror to window.creationStorage.secure if available
    if (typeof window.creationStorage !== 'undefined' && window.creationStorage.secure && typeof window.creationStorage.secure.setItem === 'function') {
      try {
        await window.creationStorage.secure.setItem(key, encoded);
      } catch (err) {
        // Non-blocking
      }
    }

    return true;
  },

  async removeItem(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {}

    if (typeof window.creationStorage !== 'undefined') {
      if (window.creationStorage.plain && typeof window.creationStorage.plain.removeItem === 'function') {
        try { await window.creationStorage.plain.removeItem(key); } catch (e) {}
      }
      if (window.creationStorage.secure && typeof window.creationStorage.secure.removeItem === 'function') {
        try { await window.creationStorage.secure.removeItem(key); } catch (e) {}
      }
    }
    return true;
  },

  async clear() {
    try {
      localStorage.clear();
    } catch (e) {}

    if (typeof window.creationStorage !== 'undefined') {
      if (window.creationStorage.plain && typeof window.creationStorage.plain.clear === 'function') {
        try { await window.creationStorage.plain.clear(); } catch (e) {}
      }
      if (window.creationStorage.secure && typeof window.creationStorage.secure.clear === 'function') {
        try { await window.creationStorage.secure.clear(); } catch (e) {}
      }
    }
    return true;
  }
};

window.ApogeeStorage = ApogeeStorage;
