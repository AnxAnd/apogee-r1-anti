/**
 * Apogee R1 Anti - Copilot Adapter
 * Integrates with Rabbit R1 creations-sdk LLM channel:
 * - PluginMessageHandler.postMessage({ message, useLLM: true, wantsR1Response: false })
 * - window.onPluginMessage callback
 * - Browser simulation fallback when running outside R1 hardware
 */

const ApogeeCopilot = {
  activeCallback: null,
  isProcessing: false,

  init() {
    // Intercept or hook into window.onPluginMessage
    const previousHandler = window.onPluginMessage;
    window.onPluginMessage = (data) => {
      if (previousHandler) previousHandler(data);
      this.handlePluginMessage(data);
    };
  },

  handlePluginMessage(data) {
    console.log('[ApogeeCopilot] Received message from R1 system:', data);
    if (!this.activeCallback) return;

    let responsePayload = null;

    // Check data.data (JSON string or object)
    if (data.data) {
      try {
        responsePayload = typeof data.data === 'string' ? JSON.parse(data.data) : data.data;
      } catch (e) {
        console.warn('[ApogeeCopilot] data.data was not JSON:', data.data);
      }
    }

    // Check data.message if data.data was absent or not JSON
    if (!responsePayload && data.message) {
      try {
        responsePayload = JSON.parse(data.message);
      } catch (e) {
        // Plain text fallback
        responsePayload = { text: data.message };
      }
    }

    const cb = this.activeCallback;
    this.activeCallback = null;
    this.isProcessing = false;
    cb(null, responsePayload || data);
  },

  async generateTasksForGoal(goalName, wantsVoice = false) {
    if (this.isProcessing) return;
    this.isProcessing = true;

    const prompt = `You are Apogee, a project orchestration assistant on rabbitOS. For the goal "${goalName}", generate 3 concise, highly actionable tasks (maximum 4 words each). Respond ONLY with valid JSON in this exact format: {"tasks": ["Task 1", "Task 2", "Task 3"]}`;

    return new Promise((resolve) => {
      this.activeCallback = (err, result) => {
        if (err || !result) {
          resolve(this.getMockTasks(goalName));
          return;
        }

        if (result.tasks && Array.isArray(result.tasks)) {
          resolve(result.tasks);
        } else if (result.data && result.data.tasks) {
          resolve(result.data.tasks);
        } else {
          resolve(this.getMockTasks(goalName));
        }
      };

      if (typeof window.PluginMessageHandler !== 'undefined') {
        try {
          window.PluginMessageHandler.postMessage(JSON.stringify({
            message: prompt,
            useLLM: true,
            wantsR1Response: wantsVoice
          }));

          // Safety timeout in case device takes too long
          setTimeout(() => {
            if (this.isProcessing && this.activeCallback) {
              console.warn('[ApogeeCopilot] LLM request timed out, falling back to heuristic');
              const cb = this.activeCallback;
              this.activeCallback = null;
              this.isProcessing = false;
              cb(null, null);
            }
          }, 12000);
        } catch (err) {
          console.error('[ApogeeCopilot] Error posting to PluginMessageHandler:', err);
          this.activeCallback(err, null);
        }
      } else {
        // Desktop browser mode simulation
        console.log('[ApogeeCopilot] Simulating LLM response in browser mode...');
        setTimeout(() => {
          if (this.activeCallback) {
            this.activeCallback(null, { tasks: this.getMockTasks(goalName) });
          }
        }, 800);
      }
    });
  },

  getMockTasks(goalName) {
    const defaultSuggestions = [
      ["Design key interface", "Implement core logic", "Run testing validation"],
      ["Draft initial outline", "Review team feedback", "Publish update announcement"],
      ["Set up workspace", "Gather essential assets", "Schedule team check-in"]
    ];
    return defaultSuggestions[Math.floor(Math.random() * defaultSuggestions.length)];
  }
};

window.ApogeeCopilot = ApogeeCopilot;
