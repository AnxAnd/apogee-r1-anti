/**
 * Apogee R1 Anti - Main Application Controller
 * Coordinates State, Canvas Rendering, Hardware Input, and R1 SDK Integration
 */

(function () {
  'use strict';

  // Application State
  const AppState = {
    projects: [
      { id: 'proj-1', name: 'Launch R1' }
    ],
    activeProjectId: 'proj-1',
    tasks: [],
    selectedTaskId: null,
    targetOrbitForNewTask: 1
  };

  // Seed tasks if empty
  const SEED_TASKS = [
    { id: 't-1', projectId: 'proj-1', title: 'Scroll wheel test', orbit: 1, baseAngle: -0.22, status: 'active' },
    { id: 't-2', projectId: 'proj-1', title: 'Inspect bottom Core', orbit: 1, baseAngle: 0.25, status: 'active' },
    { id: 't-3', projectId: 'proj-1', title: 'Test touch drag', orbit: 2, baseAngle: -0.45, status: 'active' },
    { id: 't-4', projectId: 'proj-1', title: 'AI Copilot prompt', orbit: 2, baseAngle: 0.35, status: 'active' },
    { id: 't-5', projectId: 'proj-1', title: 'Rabbithole gallery', orbit: 3, baseAngle: -0.55, status: 'active' },
    { id: 't-6', projectId: 'proj-1', title: 'Haptic feedback', orbit: 3, baseAngle: 0.50, status: 'active' }
  ];

  let canvas = null;

  // DOM Elements
  const els = {
    menuBtn: document.getElementById('menuBtn'),
    addBtn: document.getElementById('addBtn'),
    menuDrawer: document.getElementById('menuDrawer'),
    closeDrawerBtn: document.getElementById('closeDrawerBtn'),
    projectList: document.getElementById('projectList'),
    newProjectBtn: document.getElementById('newProjectBtn'),
    copilotBtn: document.getElementById('copilotBtn'),
    doneCount: document.getElementById('doneCount'),
    clearDoneBtn: document.getElementById('clearDoneBtn'),
    exitAppBtn: document.getElementById('exitAppBtn'),
    taskSheet: document.getElementById('taskSheet'),
    sheetBackdrop: document.getElementById('sheetBackdrop'),
    closeSheetBtn: document.getElementById('closeSheetBtn'),
    sheetTaskTitle: document.getElementById('sheetTaskTitle'),
    sheetTaskNotes: document.getElementById('sheetTaskNotes'),
    completeBtn: document.getElementById('completeBtn'),
    deleteBtn: document.getElementById('deleteBtn'),
    taskModal: document.getElementById('taskModal'),
    taskInput: document.getElementById('taskInput'),
    closeTaskModal: document.getElementById('closeTaskModal'),
    saveTaskBtn: document.getElementById('saveTaskBtn'),
    cancelTaskBtn: document.getElementById('cancelTaskBtn'),
    modalOrbitRow: document.getElementById('modalOrbitRow'),
    goalModal: document.getElementById('goalModal'),
    goalInput: document.getElementById('goalInput'),
    closeGoalModal: document.getElementById('closeGoalModal'),
    saveGoalBtn: document.getElementById('saveGoalBtn'),
    cancelGoalBtn: document.getElementById('cancelGoalBtn'),
    absorbedSection: document.getElementById('absorbedSection'),
    absorbedCountBadge: document.getElementById('absorbedCountBadge'),
    absorbedList: document.getElementById('absorbedList'),
    audioToggleBtn: document.getElementById('audioToggleBtn'),
    toast: document.getElementById('toast')
  };

  // Initialize
  document.addEventListener('DOMContentLoaded', async () => {
    console.log('[Apogee R1 Anti] Booting application...');

    // 1. Initialize Subsystems
    ApogeeHardware.init();
    ApogeeCopilot.init();
    if (window.ApogeeAudio) ApogeeAudio.init();

    // 2. Load Persisted State
    await loadState();

    // 3. Initialize Orbital Canvas
    const canvasEl = document.getElementById('orbitalCanvas');
    canvas = new OrbitalCanvas(canvasEl, {
      onTaskTap: (task) => openTaskSheet(task),
      onCoreTap: () => openGoalModal(),
      onOrbitTap: (orbitId) => openTaskModal(orbitId)
    });

    // 4. Update Canvas with Initial Data
    refreshCanvasData();

    // 5. Connect Hardware Events
    bindHardwareEvents();

    // 6. Connect UI Click Listeners
    bindUIEvents();

    showToast('Apogee R1 Ready');
  });

  // --------------------------------------------------------------------------
  // State & Persistence
  // --------------------------------------------------------------------------
  async function loadState() {
    try {
      const isInit = await ApogeeStorage.getItem('apogee_initialized', false);
      const savedProjects = await ApogeeStorage.getItem('apogee_projects');
      const savedActiveId = await ApogeeStorage.getItem('apogee_active_project');
      const savedTasks = await ApogeeStorage.getItem('apogee_tasks');

      if (!isInit && (!savedTasks || savedTasks.length === 0)) {
        // First boot ever: seed defaults
        AppState.projects = [{ id: 'proj-1', name: 'Launch R1' }];
        AppState.activeProjectId = 'proj-1';
        AppState.tasks = SEED_TASKS;
        await ApogeeStorage.setItem('apogee_initialized', true);
        await saveState();
        return;
      }

      if (savedProjects && Array.isArray(savedProjects) && savedProjects.length > 0) {
        AppState.projects = savedProjects;
      }
      if (savedActiveId && AppState.projects.some(p => p.id === savedActiveId)) {
        AppState.activeProjectId = savedActiveId;
      } else if (AppState.projects.length > 0) {
        AppState.activeProjectId = AppState.projects[0].id;
      }
      if (savedTasks && Array.isArray(savedTasks)) {
        AppState.tasks = savedTasks;
      }
      // Ensure initialized flag is marked
      await ApogeeStorage.setItem('apogee_initialized', true);
    } catch (err) {
      console.error('[Apogee R1 Anti] Error loading state:', err);
    }
  }

  async function saveState() {
    try {
      await ApogeeStorage.setItem('apogee_initialized', true);
      await ApogeeStorage.setItem('apogee_projects', AppState.projects);
      await ApogeeStorage.setItem('apogee_active_project', AppState.activeProjectId);
      await ApogeeStorage.setItem('apogee_tasks', AppState.tasks);
    } catch (err) {
      console.error('[Apogee R1 Anti] Error saving state:', err);
    }
  }

  function getActiveProject() {
    return AppState.projects.find(p => p.id === AppState.activeProjectId) || AppState.projects[0];
  }

  function getActiveTasks() {
    return AppState.tasks.filter(t => t.projectId === AppState.activeProjectId);
  }

  function refreshCanvasData() {
    const project = getActiveProject();
    const activeTasks = getActiveTasks();

    if (canvas) {
      canvas.setCoreGoal(project ? project.name : 'GOAL');
      canvas.setTasks(activeTasks);
    }

    // Update telemetry in drawer
    const doneTasks = activeTasks.filter(t => t.status === 'done');
    if (els.doneCount) {
      els.doneCount.textContent = doneTasks.length;
    }

    renderProjectList();
  }

  // --------------------------------------------------------------------------
  // Hardware Events Wiring
  // --------------------------------------------------------------------------
  function bindHardwareEvents() {
    // Physical scroll wheel: rotates satellites smoothly along their arc tracks
    ApogeeHardware.on('scrollUp', () => {
      if (canvas) canvas.scroll(1);
      if (window.ApogeeAudio) ApogeeAudio.playTick();
    });

    ApogeeHardware.on('scrollDown', () => {
      if (canvas) canvas.scroll(-1);
      if (window.ApogeeAudio) ApogeeAudio.playTick();
    });

    // PTT Side Button: single click
    ApogeeHardware.on('sideClick', () => {
      if (window.ApogeeAudio) ApogeeAudio.playTap();
      // If task sheet is open, close it
      if (els.taskSheet.classList.contains('open')) {
        closeTaskSheet();
        return;
      }
      // If any modal is open, close it
      if (els.taskModal.classList.contains('open')) {
        closeTaskModal();
        return;
      }
      if (els.goalModal.classList.contains('open')) {
        closeGoalModal();
        return;
      }
      if (els.menuDrawer.classList.contains('open')) {
        closeMenuDrawer();
        return;
      }
      // Otherwise, open quick-add task modal
      openTaskModal(1);
    });

    // PTT Long Press: trigger AI Copilot
    ApogeeHardware.on('longPressStart', () => {
      triggerCopilotBreakdown();
    });
  }

  // --------------------------------------------------------------------------
  // UI Interactions
  // --------------------------------------------------------------------------
  function bindUIEvents() {
    // Menu Drawer
    els.menuBtn.addEventListener('click', () => {
      if (window.ApogeeAudio) ApogeeAudio.playTap();
      openMenuDrawer();
    });
    els.closeDrawerBtn.addEventListener('click', () => {
      if (window.ApogeeAudio) ApogeeAudio.playTap();
      closeMenuDrawer();
    });

    // Add Task Button
    els.addBtn.addEventListener('click', () => {
      if (window.ApogeeAudio) ApogeeAudio.playTap();
      openTaskModal(1);
    });

    // New Goal / Project Button
    els.newProjectBtn.addEventListener('click', () => {
      if (window.ApogeeAudio) ApogeeAudio.playTap();
      closeMenuDrawer();
      openGoalModal(true);
    });

    // AI Copilot Button in Drawer
    els.copilotBtn.addEventListener('click', () => {
      if (window.ApogeeAudio) ApogeeAudio.playTap();
      closeMenuDrawer();
      triggerCopilotBreakdown();
    });

    // Audio Toggle
    if (els.audioToggleBtn) {
      els.audioToggleBtn.addEventListener('click', () => {
        if (window.ApogeeAudio) {
          ApogeeAudio.enabled = !ApogeeAudio.enabled;
          els.audioToggleBtn.textContent = ApogeeAudio.enabled ? '🔊 Audio Cues: ON' : '🔇 Audio Cues: OFF';
          showToast(ApogeeAudio.enabled ? 'Audio Cues Enabled' : 'Audio Cues Muted');
          if (ApogeeAudio.enabled) ApogeeAudio.playTap();
        }
      });
    }

    // Clear Done Tasks
    els.clearDoneBtn.addEventListener('click', async () => {
      if (window.ApogeeAudio) ApogeeAudio.playTap();
      AppState.tasks = AppState.tasks.filter(t => !(t.projectId === AppState.activeProjectId && t.status === 'done'));
      await saveState();
      refreshCanvasData();
      showToast('Cleared Done Tasks');
    });

    // Exit App to rabbitOS
    els.exitAppBtn.addEventListener('click', async () => {
      await saveState();
      ApogeeHardware.closeApp();
    });

    // Task Bottom Sheet Actions
    els.completeBtn.addEventListener('click', () => {
      if (!AppState.selectedTaskId) return;
      const task = AppState.tasks.find(t => t.id === AppState.selectedTaskId);
      if (!task) return;

      closeTaskSheet();

      // Trigger celestial absorption chime and collapse animation into Core
      if (window.ApogeeAudio) ApogeeAudio.playAbsorb();
      canvas.triggerAbsorption(task, async () => {
        task.status = 'done';
        await saveState();
        refreshCanvasData();
        showToast('Task Absorbed in Core ✓');
      });
    });

    els.deleteBtn.addEventListener('click', async () => {
      if (!AppState.selectedTaskId) return;
      AppState.tasks = AppState.tasks.filter(t => t.id !== AppState.selectedTaskId);
      closeTaskSheet();
      await saveState();
      refreshCanvasData();
      showToast('Task Deleted');
    });

    // Orbit switcher pills in Bottom Sheet
    const sheetPills = els.taskSheet.querySelectorAll('.orbit-pill');
    sheetPills.forEach(pill => {
      pill.addEventListener('click', async () => {
        if (!AppState.selectedTaskId) return;
        const targetOrbit = parseInt(pill.dataset.orbit, 10);
        const task = AppState.tasks.find(t => t.id === AppState.selectedTaskId);
        if (task) {
          task.orbit = targetOrbit;
          sheetPills.forEach(p => p.classList.toggle('active', parseInt(p.dataset.orbit, 10) === targetOrbit));
          if (canvas) canvas.layoutOrbitTasks();
          await saveState();
          refreshCanvasData();
          showToast(`Moved to Orbit ${targetOrbit}`);
        }
      });
    });

    // Close sheet when tapping on handle
    els.taskSheet.querySelector('.sheet-handle').addEventListener('click', () => {
      closeTaskSheet();
    });

    // Close sheet when tapping on backdrop (tap outside)
    if (els.sheetBackdrop) {
      const handleBackdropDismiss = (e) => {
        // Prevent ghost click from the touch event that just opened the sheet
        if (Date.now() - lastSheetOpenTime < 450) {
          e.stopPropagation();
          e.preventDefault();
          return;
        }
        if (window.ApogeeAudio) ApogeeAudio.playTap();
        closeTaskSheet();
      };

      els.sheetBackdrop.addEventListener('click', handleBackdropDismiss);
      els.sheetBackdrop.addEventListener('touchend', handleBackdropDismiss);
    }

    // Close sheet when clicking close '×' button
    if (els.closeSheetBtn) {
      els.closeSheetBtn.addEventListener('click', () => {
        if (window.ApogeeAudio) ApogeeAudio.playTap();
        closeTaskSheet();
      });
    }

    // Auto-save title input changes
    if (els.sheetTaskTitle) {
      els.sheetTaskTitle.addEventListener('input', async () => {
        if (!AppState.selectedTaskId) return;
        const task = AppState.tasks.find(t => t.id === AppState.selectedTaskId);
        if (task && els.sheetTaskTitle.value.trim()) {
          task.title = els.sheetTaskTitle.value.trim();
          await saveState();
          refreshCanvasData();
        }
      });
    }

    // Auto-save note input changes
    if (els.sheetTaskNotes) {
      els.sheetTaskNotes.addEventListener('input', async () => {
        if (!AppState.selectedTaskId) return;
        const task = AppState.tasks.find(t => t.id === AppState.selectedTaskId);
        if (task) {
          task.note = els.sheetTaskNotes.value;
          await saveState();
        }
      });
    }

    // Quick Add Task Modal
    els.closeTaskModal.addEventListener('click', () => closeTaskModal());
    els.cancelTaskBtn.addEventListener('click', () => closeTaskModal());
    els.saveTaskBtn.addEventListener('click', () => submitNewTask());

    els.taskInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitNewTask();
    });

    const modalPills = els.modalOrbitRow.querySelectorAll('.orbit-pill');
    modalPills.forEach(pill => {
      pill.addEventListener('click', () => {
        modalPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        AppState.targetOrbitForNewTask = parseInt(pill.dataset.orbit, 10);
      });
    });

    // Goal Modal
    els.closeGoalModal.addEventListener('click', () => closeGoalModal());
    els.cancelGoalBtn.addEventListener('click', () => closeGoalModal());
    els.saveGoalBtn.addEventListener('click', () => submitGoal());

    els.goalInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitGoal();
    });

    // Dismiss modals when tapping dimmed overlay outside box
    els.goalModal.addEventListener('click', (e) => {
      if (e.target === els.goalModal) closeGoalModal();
    });
    els.taskModal.addEventListener('click', (e) => {
      if (e.target === els.taskModal) closeTaskModal();
    });

    // Auto-flush persistence when app is backgrounded, screen locks, or webview closes
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        saveState();
      }
    });
    window.addEventListener('pagehide', () => {
      saveState();
    });
    window.addEventListener('beforeunload', () => {
      saveState();
    });
  }

  // --------------------------------------------------------------------------
  // Bottom Sheet Controller
  // --------------------------------------------------------------------------
  let lastSheetOpenTime = 0;

  function openTaskSheet(task) {
    lastSheetOpenTime = Date.now();
    AppState.selectedTaskId = task.id;
    if (canvas) canvas.selectedTaskId = task.id;

    if (els.sheetTaskTitle) {
      els.sheetTaskTitle.value = task.title;
    }
    if (els.sheetTaskNotes) {
      els.sheetTaskNotes.value = task.note || '';
    }

    const sheetPills = els.taskSheet.querySelectorAll('.orbit-pill');
    sheetPills.forEach(pill => {
      pill.classList.toggle('active', parseInt(pill.dataset.orbit, 10) === task.orbit);
    });

    els.taskSheet.classList.add('open');
    if (els.sheetBackdrop) els.sheetBackdrop.classList.add('open');
  }

  function closeTaskSheet() {
    AppState.selectedTaskId = null;
    if (canvas) canvas.selectedTaskId = null;
    els.taskSheet.classList.remove('open');
    if (els.sheetBackdrop) els.sheetBackdrop.classList.remove('open');
  }

  // --------------------------------------------------------------------------
  // Drawer & Modals
  // --------------------------------------------------------------------------
  function openMenuDrawer() {
    closeTaskSheet();
    renderProjectList();
    els.menuDrawer.classList.add('open');
  }

  function closeMenuDrawer() {
    els.menuDrawer.classList.remove('open');
  }

  function openTaskModal(orbitId = 1) {
    closeTaskSheet();
    AppState.targetOrbitForNewTask = orbitId;

    const modalPills = els.modalOrbitRow.querySelectorAll('.orbit-pill');
    modalPills.forEach(p => {
      p.classList.toggle('active', parseInt(p.dataset.orbit, 10) === orbitId);
    });

    els.taskInput.value = '';
    els.taskModal.classList.add('open');
    setTimeout(() => els.taskInput.focus(), 50);
  }

  function closeTaskModal() {
    els.taskModal.classList.remove('open');
  }

  async function submitNewTask() {
    const title = els.taskInput.value.trim();
    if (!title) return;

    const newTask = {
      id: 't-' + Date.now().toString(36),
      projectId: AppState.activeProjectId,
      title: title,
      note: '',
      orbit: AppState.targetOrbitForNewTask,
      baseAngle: 0,
      status: 'active'
    };

    AppState.tasks.push(newTask);
    if (canvas) canvas.layoutOrbitTasks();
    await saveState();
    refreshCanvasData();
    closeTaskModal();
    showToast('Satellite Launched 🚀');
  }

  let isCreatingNewGoal = false;

  function openGoalModal(isNew = false) {
    isCreatingNewGoal = isNew;
    const project = getActiveProject();
    els.goalInput.value = isNew ? '' : (project ? project.name : '');

    if (els.absorbedSection) {
      if (isNew) {
        els.absorbedSection.style.display = 'none';
      } else {
        els.absorbedSection.style.display = 'flex';
        renderAbsorbedList();
      }
    }

    els.goalModal.classList.add('open');
    setTimeout(() => els.goalInput.focus(), 50);
  }

  function closeGoalModal() {
    els.goalModal.classList.remove('open');
  }

  function renderAbsorbedList() {
    if (!els.absorbedList || !els.absorbedCountBadge) return;
    const project = getActiveProject();
    const absorbedTasks = AppState.tasks.filter(t => t.projectId === project.id && t.status === 'done');

    els.absorbedCountBadge.textContent = absorbedTasks.length;
    els.absorbedList.innerHTML = '';

    if (absorbedTasks.length === 0) {
      els.absorbedList.innerHTML = '<div class="empty-absorbed">No tasks absorbed yet</div>';
      return;
    }

    absorbedTasks.forEach(task => {
      const item = document.createElement('div');
      item.className = 'absorbed-item';
      item.innerHTML = `
        <div class="absorbed-item-info">
          <span class="absorbed-dot"></span>
          <span class="absorbed-title" title="${task.title}">${task.title}</span>
        </div>
        <button class="restore-btn" data-id="${task.id}" title="Push back to orbit">⟲ Orbit</button>
      `;

      item.querySelector('.restore-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        task.status = 'active';
        if (!task.orbit || task.orbit < 1 || task.orbit > 3) task.orbit = 1;
        if (canvas) canvas.layoutOrbitTasks();
        if (window.ApogeeAudio) ApogeeAudio.playTap();
        await saveState();
        refreshCanvasData();
        renderAbsorbedList();
        showToast(`"${task.title}" Restored to Orbit ${task.orbit} 🚀`);
      });

      els.absorbedList.appendChild(item);
    });
  }

  async function submitGoal() {
    const name = els.goalInput.value.trim();
    if (!name) return;

    if (isCreatingNewGoal) {
      const newProj = {
        id: 'proj-' + Date.now().toString(36),
        name: name
      };
      AppState.projects.push(newProj);
      AppState.activeProjectId = newProj.id;
    } else {
      const project = getActiveProject();
      if (project) project.name = name;
    }

    await saveState();
    refreshCanvasData();
    closeGoalModal();
    showToast('Core Goal Updated');
  }

  function renderProjectList() {
    if (!els.projectList) return;
    els.projectList.innerHTML = '';

    AppState.projects.forEach(proj => {
      const btn = document.createElement('button');
      btn.className = `project-select-btn ${proj.id === AppState.activeProjectId ? 'active' : ''}`;
      btn.innerHTML = `<span>${proj.name}</span>${proj.id === AppState.activeProjectId ? '●' : ''}`;
      btn.addEventListener('click', async () => {
        AppState.activeProjectId = proj.id;
        await saveState();
        refreshCanvasData();
        closeMenuDrawer();
        showToast(`Core: ${proj.name}`);
      });
      els.projectList.appendChild(btn);
    });
  }

  // --------------------------------------------------------------------------
  // AI Copilot Integration
  // --------------------------------------------------------------------------
  async function triggerCopilotBreakdown() {
    const project = getActiveProject();
    showToast('R1 AI Generating Tasks...');

    const suggestedTasks = await ApogeeCopilot.generateTasksForGoal(project.name);

    if (suggestedTasks && suggestedTasks.length > 0) {
      // Place tasks in Orbit 1, 2, and 3
      suggestedTasks.forEach((title, idx) => {
        const orbit = Math.min(3, idx + 1);
        const newTask = {
          id: 't-ai-' + Date.now().toString(36) + idx,
          projectId: AppState.activeProjectId,
          title: title,
          orbit: orbit,
          baseAngle: (idx === 0 ? 0 : (idx === 1 ? -0.35 : 0.45)),
          status: 'active'
        };
        AppState.tasks.push(newTask);
      });

      await saveState();
      refreshCanvasData();
      showToast(`${suggestedTasks.length} Tasks Generated ⚡`);
    } else {
      showToast('AI Generation Failed');
    }
  }

  // --------------------------------------------------------------------------
  // Toast Alerts
  // --------------------------------------------------------------------------
  let toastTimer = null;
  function showToast(msg) {
    if (!els.toast) return;
    els.toast.textContent = msg;
    els.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      els.toast.classList.remove('show');
    }, 1800);
  }
})();
