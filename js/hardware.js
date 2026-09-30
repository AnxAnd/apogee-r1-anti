/**
 * Apogee R1 Anti - Hardware Adapter
 * Integrates with Rabbit R1 creations-sdk hardware events:
 * - Scroll Wheel ('scrollUp', 'scrollDown')
 * - Side Button / PTT ('sideClick', 'longPressStart', 'longPressEnd')
 * - WebView closer ('closeWebView')
 * - Accelerometer ('window.creationSensors.accelerometer')
 * - Desktop browser fallback (mouse wheel, keyboard arrows, 'P' key)
 */

const ApogeeHardware = {
  listeners: {
    scrollUp: [],
    scrollDown: [],
    sideClick: [],
    longPressStart: [],
    longPressEnd: [],
    tilt: []
  },
  
  isR1Hardware: false,
  accelRunning: false,

  init() {
    this.isR1Hardware = typeof window.PluginMessageHandler !== 'undefined' || 
                        typeof window.creationStorage !== 'undefined';

    console.log(`[ApogeeHardware] Initializing hardware listeners (R1 Mode: ${this.isR1Hardware})`);

    // 1. R1 Native Hardware Events
    window.addEventListener('scrollUp', () => this.trigger('scrollUp'));
    window.addEventListener('scrollDown', () => this.trigger('scrollDown'));
    window.addEventListener('sideClick', () => this.trigger('sideClick'));
    window.addEventListener('longPressStart', () => this.trigger('longPressStart'));
    window.addEventListener('longPressEnd', () => this.trigger('longPressEnd'));

    // 2. Desktop Browser Simulator (Wheel & Keys)
    window.addEventListener('wheel', (e) => {
      // Ignore if user is scrolling inside a scrollable modal/drawer
      const scrollable = e.target.closest('.scrollable-area, .drawer-content');
      if (scrollable && scrollable.scrollHeight > scrollable.clientHeight) {
        return;
      }
      e.preventDefault();
      if (e.deltaY < 0 || e.deltaX < 0) {
        this.trigger('scrollUp');
      } else {
        this.trigger('scrollDown');
      }
    }, { passive: false });

    window.addEventListener('keydown', (e) => {
      // Ignore if typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight' || e.key === 'k') {
        e.preventDefault();
        this.trigger('scrollUp');
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'j') {
        e.preventDefault();
        this.trigger('scrollDown');
      } else if (e.key.toLowerCase() === 'p' || e.key === ' ') {
        e.preventDefault();
        this.trigger('sideClick');
      }
    });

    // 3. Accelerometer Support (if available on device)
    this.initAccelerometer();
  },

  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
  },

  trigger(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => {
        try {
          cb(data);
        } catch (err) {
          console.error(`[ApogeeHardware] Error in ${event} listener:`, err);
        }
      });
    }
  },

  async initAccelerometer() {
    if (typeof window.creationSensors !== 'undefined' && window.creationSensors.accelerometer) {
      try {
        const available = window.creationSensors.accelerometer.isAvailable ? 
          await window.creationSensors.accelerometer.isAvailable() : true;
        
        if (available) {
          window.creationSensors.accelerometer.start((data) => {
            if (data) {
              const tiltX = data.tiltX !== undefined ? data.tiltX : (data.x || 0);
              const tiltY = data.tiltY !== undefined ? data.tiltY : (data.y || 0);
              this.trigger('tilt', { tiltX, tiltY });
            }
          }, { frequency: 30 });
          this.accelRunning = true;
          console.log('[ApogeeHardware] Accelerometer active');
        }
      } catch (err) {
        console.warn('[ApogeeHardware] Accelerometer init skipped:', err);
      }
    }
  },

  closeApp() {
    if (typeof closeWebView !== 'undefined' && typeof closeWebView.postMessage === 'function') {
      closeWebView.postMessage('');
    } else {
      console.log('[ApogeeHardware] closeWebView called in browser mode');
      window.location.reload();
    }
  }
};

window.ApogeeHardware = ApogeeHardware;
