/**
 * Apogee R1 Anti - Orbital Canvas & Physics Engine
 * Renders bottom-anchored Core and concentric upward arc tracks.
 * Handles angular rotation via physical scroll wheel and touch dragging.
 */

class OrbitalCanvas {
  constructor(canvasEl, options = {}) {
    this.canvas = canvasEl;
    this.ctx = canvasEl.getContext('2d');
    this.options = options;

    // Viewport geometry (fixed 240x282)
    this.width = 240;
    this.height = 282;
    this.cx = 120;     // Center X
    this.cy = 280;     // Center Y (anchored at bottom edge)

    // Orbital Radii
    this.coreRadius = 46;
    this.orbits = [
      { id: 1, name: 'ORBIT 1', label: 'FOCUS', radius: 94, color: '#FFB800', glow: 'rgba(255, 184, 0, 0.4)' },
      { id: 2, name: 'ORBIT 2', label: 'UP NEXT', radius: 146, color: '#00E5FF', glow: 'rgba(0, 229, 255, 0.35)' },
      { id: 3, name: 'ORBIT 3', label: 'BACKLOG', radius: 200, color: '#A855F7', glow: 'rgba(168, 85, 247, 0.3)' }
    ];

    // Angular state (in radians, 0 = straight up)
    this.orbitRotation = [0, 0, 0];       // Rotation offset for orbits 1, 2, 3
    this.angularVelocity = 0;             // Current momentum from wheel / drag
    this.ambientDrift = 0.0005;           // Gentle cosmic background drift

    // Data references
    this.coreGoal = "LAUNCH R1";
    this.tasks = [];
    this.selectedTaskId = null;
    this.absorbAnimations = [];           // Tasks animating into the Core
    this.corePulse = 0;                   // Glow pulse intensity (0 to 1)

    // Touch / Drag tracking
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartTime = 0;
    this.lastDragX = 0;

    // Setup DPR and size
    this.setupCanvas();
    this.bindEvents();
    this.startLoop();
  }

  setupCanvas() {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx.scale(dpr, dpr);
  }

  bindEvents() {
    // 1. Touch Drag & Tap
    this.canvas.addEventListener('touchstart', (e) => {
      const touch = e.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;

      this.isDragging = true;
      this.dragStartX = x;
      this.lastDragX = x;
      this.dragStartTime = performance.now();
      this.angularVelocity = 0;
    }, { passive: true });

    this.canvas.addEventListener('touchmove', (e) => {
      if (!this.isDragging) return;
      const touch = e.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      const x = touch.clientX - rect.left;

      const deltaX = x - this.lastDragX;
      this.lastDragX = x;

      // Convert deltaX into angular rotation
      const deltaAngle = (deltaX / 120);
      this.orbitRotation = this.orbitRotation.map(r => r + deltaAngle);
    }, { passive: true });

    this.canvas.addEventListener('touchend', (e) => {
      if (!this.isDragging) return;
      this.isDragging = false;

      const duration = performance.now() - this.dragStartTime;
      const totalDeltaX = this.lastDragX - this.dragStartX;

      if (Math.abs(totalDeltaX) < 8 && duration < 300) {
        // Tap detected!
        const touch = e.changedTouches[0];
        const rect = this.canvas.getBoundingClientRect();
        this.handleTap(touch.clientX - rect.left, touch.clientY - rect.top);
      } else {
        // Fling momentum
        this.angularVelocity = (totalDeltaX / Math.max(duration, 50)) * 0.03;
      }
    });

    // 2. Mouse Drag & Click for Desktop Preview
    let isMouseDown = false;
    let mouseStartX = 0;
    let lastMouseX = 0;
    let mouseStartTime = 0;

    this.canvas.addEventListener('mousedown', (e) => {
      isMouseDown = true;
      mouseStartX = e.offsetX;
      lastMouseX = e.offsetX;
      mouseStartTime = performance.now();
      this.angularVelocity = 0;
    });

    window.addEventListener('mousemove', (e) => {
      if (!isMouseDown) return;
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const deltaX = x - lastMouseX;
      lastMouseX = x;

      const deltaAngle = (deltaX / 120);
      this.orbitRotation = this.orbitRotation.map(r => r + deltaAngle);
    });

    window.addEventListener('mouseup', (e) => {
      if (!isMouseDown) return;
      isMouseDown = false;
      const duration = performance.now() - mouseStartTime;
      const totalDelta = lastMouseX - mouseStartX;

      if (Math.abs(totalDelta) < 6 && duration < 250) {
        const rect = this.canvas.getBoundingClientRect();
        this.handleTap(e.clientX - rect.left, e.clientY - rect.top);
      } else {
        this.angularVelocity = (totalDelta / Math.max(duration, 50)) * 0.03;
      }
    });
  }

  // Wheel step from hardware listener
  scroll(direction) {
    // direction > 0 for up, < 0 for down
    const impulse = direction > 0 ? 0.075 : -0.075;
    this.angularVelocity += impulse;
  }

  handleTap(x, y) {
    // 1. Check if tap hit the Core dome
    const distToCenter = Math.hypot(x - this.cx, y - this.cy);
    if (distToCenter <= this.coreRadius + 8) {
      if (this.options.onCoreTap) this.options.onCoreTap();
      return;
    }

    // 2. Check if tap hit any task chip
    for (let i = this.tasks.length - 1; i >= 0; i--) {
      const task = this.tasks[i];
      if (task.status === 'done') continue;
      const pos = this.getTaskCoordinates(task);
      const hit = Math.hypot(x - pos.x, y - pos.y);
      if (hit <= 18) { // Tap hit radius
        if (this.options.onTaskTap) this.options.onTaskTap(task);
        return;
      }
    }

    // 3. Check if tap hit an orbit track (for quick-add into that orbit)
    for (const orbit of this.orbits) {
      if (Math.abs(distToCenter - orbit.radius) < 16) {
        if (this.options.onOrbitTap) this.options.onOrbitTap(orbit.id);
        return;
      }
    }
  }

  setTasks(tasks) {
    this.tasks = tasks;
    this.layoutOrbitTasks();
  }

  layoutOrbitTasks() {
    for (const orbit of this.orbits) {
      const orbitTasks = this.tasks.filter(t => t.orbit === orbit.id && t.status !== 'done');
      if (orbitTasks.length === 0) continue;

      // Minimum safe angular spacing: card width (48px) + 16px buffer
      const minSpacing = (48 + 16) / orbit.radius;
      
      // Sort tasks by existing baseAngle (or id) to keep order stable
      orbitTasks.sort((a, b) => (a.baseAngle || 0) - (b.baseAngle || 0));

      const count = orbitTasks.length;
      if (count === 1) {
        orbitTasks[0].baseAngle = 0;
      } else {
        // Natural spread: between minSpacing and 0.65 radians
        const idealSpan = Math.min(1.2, count * minSpacing);
        const step = Math.max(minSpacing, idealSpan / (count - 1));
        const startAngle = -((count - 1) * step) / 2;
        orbitTasks.forEach((t, idx) => {
          t.baseAngle = startAngle + idx * step;
        });
      }
    }
  }

  resolveCollisions() {
    for (const orbit of this.orbits) {
      const orbitTasks = this.tasks.filter(t => t.orbit === orbit.id && t.status !== 'done');
      if (orbitTasks.length < 2) continue;

      const minSpacing = (48 + 16) / orbit.radius;
      orbitTasks.sort((a, b) => a.baseAngle - b.baseAngle);

      for (let i = 0; i < orbitTasks.length - 1; i++) {
        const t1 = orbitTasks[i];
        const t2 = orbitTasks[i + 1];
        const diff = t2.baseAngle - t1.baseAngle;

        if (diff < minSpacing) {
          const overlap = minSpacing - diff;
          t1.baseAngle -= overlap * 0.5;
          t2.baseAngle += overlap * 0.5;
        }
      }
    }
  }

  setCoreGoal(goalName) {
    this.coreGoal = goalName;
  }

  triggerAbsorption(task, onComplete) {
    const startPos = this.getTaskCoordinates(task);
    this.absorbAnimations.push({
      task,
      startX: startPos.x,
      startY: startPos.y,
      progress: 0,
      onComplete
    });
  }

  getTaskCoordinates(task) {
    const orbit = this.orbits.find(o => o.id === task.orbit) || this.orbits[0];
    const rotOffset = this.orbitRotation[task.orbit - 1] || 0;
    const angle = (task.baseAngle || 0) + rotOffset;

    // angle: 0 is straight UP (y = cy - r, x = cx)
    const x = this.cx + orbit.radius * Math.sin(angle);
    const y = this.cy - orbit.radius * Math.cos(angle);
    return { x, y, angle };
  }

  startLoop() {
    const loop = () => {
      this.updatePhysics();
      this.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  updatePhysics() {
    // Dynamic anti-collision repulsion between satellites on same orbit
    this.resolveCollisions();

    // Apply angular velocity to all orbits
    if (Math.abs(this.angularVelocity) > 0.0001) {
      for (let i = 0; i < this.orbitRotation.length; i++) {
        // Outer orbits move slightly slower for parallax depth
        const depthFactor = 1 - (i * 0.12);
        this.orbitRotation[i] += this.angularVelocity * depthFactor;
      }
      this.angularVelocity *= 0.91; // Smooth friction
    } else {
      this.angularVelocity = 0;
    }

    // Ambient gentle drift
    for (let i = 0; i < this.orbitRotation.length; i++) {
      this.orbitRotation[i] += this.ambientDrift * (1 + i * 0.2);
    }

    // Update absorption animations
    for (let i = this.absorbAnimations.length - 1; i >= 0; i--) {
      const anim = this.absorbAnimations[i];
      anim.progress += 0.055;
      if (anim.progress >= 1) {
        this.corePulse = 1.0; // Trigger core pulse
        if (anim.onComplete) anim.onComplete();
        this.absorbAnimations.splice(i, 1);
      }
    }

    // Core pulse decay
    if (this.corePulse > 0) {
      this.corePulse = Math.max(0, this.corePulse - 0.04);
    }
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // 1. Draw Subtle Background Cosmic Dust
    this.drawBackgroundStars(ctx);

    // 2. Draw Concentric Upward Orbit Arcs
    this.orbits.forEach((orbit, index) => {
      this.drawOrbitArc(ctx, orbit);
    });

    // 3. Draw Regular Satellites
    this.tasks.forEach(task => {
      if (task.status === 'done') return;
      // Skip if actively in absorption animation
      if (this.absorbAnimations.some(a => a.task.id === task.id)) return;
      this.drawSatellite(ctx, task);
    });

    // 4. Draw Absorbing Satellites
    this.absorbAnimations.forEach(anim => {
      this.drawAbsorbingSatellite(ctx, anim);
    });

    // 5. Draw Bottom Core Anchor Dome
    this.drawCore(ctx);
  }

  drawBackgroundStars(ctx) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    // Static predefined star coordinates
    const stars = [
      [30, 45, 1], [70, 75, 1], [190, 50, 1.2], [220, 90, 0.8],
      [15, 130, 0.8], [225, 160, 1], [40, 200, 0.8], [205, 220, 1.2]
    ];
    stars.forEach(([x, y, r]) => {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  drawOrbitArc(ctx, orbit) {
    const r = orbit.radius;

    // Upward arc span: from angle ~ 125 deg to ~ 55 deg (in standard polar)
    // Centered at bottom (120, 280)
    // Left edge intersection: x=0 => cos(theta) = -120/r
    let halfAngle = Math.asin(Math.min(1.0, 116 / r));
    // Let arc extend nicely across the screen
    const startAngle = -Math.PI / 2 - halfAngle - 0.05;
    const endAngle = -Math.PI / 2 + halfAngle + 0.05;

    ctx.save();

    // Outer Glow Track
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, r, startAngle, endAngle);
    ctx.strokeStyle = orbit.glow;
    ctx.lineWidth = 4;
    ctx.stroke();

    // Sharp Core Double Track (Inner line + Outer line)
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, r - 1.5, startAngle, endAngle);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(this.cx, this.cy, r, startAngle, endAngle);
    ctx.strokeStyle = orbit.color;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Orbit Label Text (Centred at apex or along curve)
    const labelX = this.cx;
    const labelY = this.cy - r - 5;
    ctx.font = 'bold 8px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace';
    ctx.fillStyle = orbit.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${orbit.name} • ${orbit.label}`, labelX, labelY);

    ctx.restore();
  }

  drawSatellite(ctx, task) {
    const { x, y, angle } = this.getTaskCoordinates(task);

    // Cull if outside visible canvas viewport bounds
    if (x < -20 || x > this.width + 20 || y < 20 || y > this.height + 20) {
      return;
    }

    const orbit = this.orbits.find(o => o.id === task.orbit) || this.orbits[0];
    const isSelected = this.selectedTaskId === task.id;

    ctx.save();
    ctx.translate(x, y);

    // Particle motion trail behind orbiter
    ctx.fillStyle = orbit.glow;
    const trailLen = 3;
    for (let t = 1; t <= trailLen; t++) {
      const tx = -Math.sin(angle) * (t * 4);
      const ty = Math.cos(angle) * (t * 4);
      ctx.beginPath();
      ctx.arc(tx, ty, 2 - (t * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }

    // Satellite Pill Card
    const w = 48;
    const h = 16;
    const radius = 8;

    // Halo Glow
    ctx.shadowColor = isSelected ? '#FFFFFF' : orbit.color;
    ctx.shadowBlur = isSelected ? 10 : 6;

    // Body
    ctx.fillStyle = '#141414';
    ctx.strokeStyle = isSelected ? '#FFFFFF' : orbit.color;
    ctx.lineWidth = isSelected ? 1.8 : 1.2;

    this.roundRect(ctx, -w / 2, -h / 2, w, h, radius, true, true);

    // Indicator Dot on left of pill
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(-w / 2 + 7, 0, 3, 0, Math.PI * 2);
    ctx.fillStyle = orbit.color;
    ctx.fill();

    // Text Label inside pill
    ctx.font = 'bold 8px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    const maxTextWidth = w - 18;
    let label = task.title;
    if (ctx.measureText(label).width > maxTextWidth) {
      while (label.length > 2 && ctx.measureText(label + '…').width > maxTextWidth) {
        label = label.slice(0, -1);
      }
      label += '…';
    }
    ctx.fillText(label, -w / 2 + 13, 0.5);

    ctx.restore();
  }

  drawAbsorbingSatellite(ctx, anim) {
    const t = anim.progress; // 0 -> 1
    // Interpolate from start (x,y) down into Core (cx, cy - 20)
    const targetX = this.cx;
    const targetY = this.cy - 10;

    const curX = anim.startX + (targetX - anim.startX) * (t * t);
    const curY = anim.startY + (targetY - anim.startY) * (t * t);
    const scale = Math.max(0.1, 1 - t);
    const alpha = Math.max(0.1, 1 - t * 0.9);

    ctx.save();
    ctx.translate(curX, curY);
    ctx.scale(scale, scale);
    ctx.globalAlpha = alpha;

    ctx.shadowColor = '#FF6A00';
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#FFB800';
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  drawCore(ctx) {
    const r = this.coreRadius + (this.corePulse * 6);
    ctx.save();

    // Core Pulse Aura
    if (this.corePulse > 0.01) {
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, r + 14 * this.corePulse, Math.PI, 0);
      ctx.fillStyle = `rgba(255, 90, 0, ${this.corePulse * 0.45})`;
      ctx.fill();
    }

    // Outer Glow Halo
    ctx.shadowColor = '#FF5500';
    ctx.shadowBlur = 16 + (this.corePulse * 14);

    // Core Dome Gradient Fill
    const grad = ctx.createRadialGradient(
      this.cx, this.cy - r * 0.6, 5,
      this.cx, this.cy, r
    );
    grad.addColorStop(0, '#FFA200');   // Bright warm top
    grad.addColorStop(0.45, '#FF5500'); // Vibrant neon orange
    grad.addColorStop(1, '#B32D00');   // Deep amber base

    ctx.beginPath();
    ctx.arc(this.cx, this.cy, r, Math.PI, 0);
    ctx.fillStyle = grad;
    ctx.fill();

    // Dome Rim Stroke
    ctx.strokeStyle = '#FFE082';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Reset shadow for crisp text
    ctx.shadowBlur = 0;

    // "CORE" Header Text
    ctx.font = '900 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('CORE', this.cx, this.cy - r * 0.55);

    // Active Project / Goal Subtitle
    ctx.font = 'bold 8px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    
    let goalDisplay = this.coreGoal.toUpperCase();
    if (goalDisplay.length > 14) goalDisplay = goalDisplay.slice(0, 12) + '…';
    ctx.fillText(goalDisplay, this.cx, this.cy - r * 0.25);

    ctx.restore();
  }

  roundRect(ctx, x, y, width, height, radius, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }
}

window.OrbitalCanvas = OrbitalCanvas;
