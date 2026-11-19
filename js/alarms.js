/**
 * Locked In - Alarms, Notifications, Health Check & Wake Lock Module
 * Web Audio API synthesizer, Service Worker notifications, missed alarms, and Wake Lock
 */

(function () {
  'use strict';

  window.LockedIn = window.LockedIn || {};

  let audioCtx = null;
  let activeAlarmOscillators = [];
  let testAlarmTimer = null;
  const firedAlarmKeys = new Set();

  function getAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playPositiveTick() {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880.00, ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.13);
    } catch (e) {
      // AudioContext locked or unsupported
    }
  }

  function startAlarmSound() {
    stopAlarmSound();
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const tones = [523.25, 659.25, 783.99, 1046.50];
      let startTime = ctx.currentTime + 0.05;

      const loopTones = () => {
        if (!LockedIn.state.activeAlarmBlock) return;
        tones.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, startTime + idx * 0.18);
          gain.gain.setValueAtTime(0.3, startTime + idx * 0.18);
          gain.gain.exponentialRampToValueAtTime(0.001, startTime + idx * 0.18 + 0.15);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(startTime + idx * 0.18);
          osc.stop(startTime + idx * 0.18 + 0.16);

          activeAlarmOscillators.push(osc);
        });

        startTime += 1.4;
        setTimeout(loopTones, 1300);
      };

      loopTones();
    } catch (err) {
      console.warn('Alarm sound error:', err);
    }
  }

  function stopAlarmSound() {
    activeAlarmOscillators.forEach(osc => {
      try { osc.stop(); } catch (e) {}
    });
    activeAlarmOscillators = [];
  }

  async function requestNotificationPermission() {
    if (!('Notification' in window)) {
      return 'unsupported';
    }
    if (Notification.permission === 'granted') {
      return 'granted';
    }
    if (Notification.permission === 'denied') {
      return 'denied';
    }
    try {
      const perm = await Notification.requestPermission();
      updateAlarmHealthUI();
      return perm;
    } catch (e) {
      return Notification.permission;
    }
  }

  async function showBlockNotification(block, options = {}) {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return false;
    }
    try {
      let reg = null;
      if ('serviceWorker' in navigator) {
        reg = await navigator.serviceWorker.ready;
      }
      if (!reg) return false;

      const isMissed = !!options.isMissed;
      const isTest = !!options.isTest;
      let title = block.title;
      if (isMissed) title = `Missed Alarm: ${block.title}`;
      if (isTest) title = `Test Alarm: ${block.title}`;

      const body = isMissed
        ? `Scheduled at ${block.start} (${options.diffMinutes || 0}m ago). Tap to review.`
        : `${block.start} - ${block.end}${block.note ? ' • ' + block.note : ''}`;

      await reg.showNotification(title, {
        body: body,
        icon: './icon-192.png',
        badge: './favicon.png',
        tag: `lockedin-alarm-${block.id}`,
        renotify: true,
        requireInteraction: true,
        vibrate: [300, 150, 300, 150, 500],
        data: {
          blockId: block.id,
          title: block.title,
          start: block.start,
          end: block.end,
          isMissed: isMissed,
          url: './'
        },
        actions: [
          { action: 'snooze', title: 'Snooze 5 min' },
          { action: 'done', title: 'Done' }
        ]
      });
      return true;
    } catch (err) {
      console.warn('showNotification failed:', err);
      return false;
    }
  }

  function triggerInAppAlarm(block, options = {}) {
    const { state } = LockedIn;
    if (!state.alarmsArmed) return;

    state.activeAlarmBlock = block;

    if (navigator.vibrate) {
      navigator.vibrate([300, 150, 300, 150, 500]);
    }

    startAlarmSound();

    const overlay = document.getElementById('alarmOverlay');
    const titleEl = document.getElementById('alarmModalTitle');
    const timeEl = document.getElementById('alarmModalTime');
    const noteEl = document.getElementById('alarmModalNote');

    if (options.isMissed) {
      if (titleEl) titleEl.textContent = `Missed Alarm: ${block.title}`;
      if (timeEl) timeEl.textContent = `Scheduled at ${block.start} (${options.diffMinutes || 0}m ago)`;
      if (noteEl) noteEl.textContent = block.note ? `${block.note} (Device was away or asleep)` : 'This block passed while Locked In was in the background.';
    } else if (options.isTest) {
      if (titleEl) titleEl.textContent = `Test Alarm: ${block.title}`;
      if (timeEl) timeEl.textContent = 'Audio, vibration & notification test';
      if (noteEl) noteEl.textContent = 'Health check verification successful.';
    } else {
      if (titleEl) titleEl.textContent = block.title;
      if (timeEl) timeEl.textContent = `${block.start} - ${block.end} (${block.type})`;
      if (noteEl) noteEl.textContent = block.note || 'Scheduled study block has started.';
    }

    if (overlay) overlay.classList.add('active');
  }

  function stopCurrentAlarm() {
    stopAlarmSound();
    LockedIn.state.activeAlarmBlock = null;
    const overlay = document.getElementById('alarmOverlay');
    if (overlay) overlay.classList.remove('active');
  }

  function snoozeCurrentAlarm(specificBlock = null) {
    const { state } = LockedIn;
    const { showToast } = LockedIn.ui;

    const block = specificBlock || state.activeAlarmBlock;
    stopCurrentAlarm();
    if (block) {
      const snoozeExpire = Date.now() + 5 * 60 * 1000;
      state.snoozedAlarms.push({
        block: block,
        expireTimestamp: snoozeExpire
      });
      showToast(`Alarm for "${block.title}" snoozed for 5 minutes.`, 'info');
    }
  }

  function checkAlarms() {
    const { state } = LockedIn;
    const { getTodayString, getActiveDayTimetable, timeToMinutes } = LockedIn.time;

    if (!state.alarmsArmed || state.isLocked) return;

    const now = new Date();
    const currentM = now.getHours() * 60 + now.getMinutes();
    const todayStr = getTodayString();

    // Check snoozed alarms
    const nowMs = Date.now();
    const readySnoozeIdx = state.snoozedAlarms.findIndex(s => nowMs >= s.expireTimestamp);
    if (readySnoozeIdx > -1) {
      const item = state.snoozedAlarms.splice(readySnoozeIdx, 1)[0];
      triggerInAppAlarm(item.block, { isMissed: false });
      showBlockNotification(item.block, { isMissed: false });
      return;
    }

    const blocks = getActiveDayTimetable(todayStr);
    if (!blocks || !blocks.length) return;

    for (const block of blocks) {
      if (!block.alarm) continue;

      const alarmKey = `${todayStr}_${block.id}_${block.start}`;
      if (firedAlarmKeys.has(alarmKey)) continue;

      const startM = timeToMinutes(block.start);
      const diff = currentM - startM;

      // Exact time: current minute matches start time
      if (diff === 0) {
        firedAlarmKeys.add(alarmKey);
        triggerInAppAlarm(block, { isMissed: false });
        showBlockNotification(block, { isMissed: false });
        break;
      }
      // Missed alarm: time passed in the last 30 minutes while app was sleeping / backgrounded
      else if (diff > 0 && diff <= 30) {
        firedAlarmKeys.add(alarmKey);
        triggerInAppAlarm(block, { isMissed: true, diffMinutes: diff });
        showBlockNotification(block, { isMissed: true, diffMinutes: diff });
        break;
      }
    }
  }

  function startAlarmCheckerLoop() {
    // Check every 10 seconds for exact minute timing
    setInterval(checkAlarms, 10000);

    // Immediate check on visibility change (reopening phone / switching tabs)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        checkAlarms();
        updateAlarmHealthUI();
      }
    });

    // Listen for Service Worker notification clicks (snooze / done)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', async (event) => {
        const msg = event.data;
        if (!msg || msg.type !== 'ALARM_ACTION') return;

        if (msg.action === 'snooze') {
          const block = (msg.data && msg.data.blockId) ? { id: msg.data.blockId, title: msg.data.title || 'Study Block' } : null;
          snoozeCurrentAlarm(block);
        } else if (msg.action === 'done') {
          stopCurrentAlarm();
          if (msg.blockId && LockedIn.today && LockedIn.today.toggleBlockDone) {
            await LockedIn.today.toggleBlockDone(msg.blockId);
            LockedIn.ui.showToast(`Marked "${msg.data.title || 'Block'}" as done!`, 'success');
          }
        }
      });
    }
  }

  function scheduleTestAlarm() {
    const { showToast } = LockedIn.ui;
    if (testAlarmTimer) {
      clearTimeout(testAlarmTimer);
    }
    showToast('Test alarm scheduled for 10 seconds! Lock your phone or switch apps to test.', 'info');
    
    // Ensure notification permission is requested if prompt
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(() => updateAlarmHealthUI());
    }

    testAlarmTimer = setTimeout(async () => {
      testAlarmTimer = null;
      const testBlock = {
        id: 'test-alarm-block',
        title: 'Alarm Health Check',
        start: 'Now',
        end: 'Test',
        type: 'study',
        note: 'Sound, vibration & notification test passed!'
      };
      triggerInAppAlarm(testBlock, { isTest: true });
      await showBlockNotification(testBlock, { isTest: true });
    }, 10000);
  }

  function updateAlarmHealthUI() {
    const permStatusEl = document.getElementById('healthNotificationStatus');
    const permBtn = document.getElementById('healthNotificationBtn');
    const permGuideEl = document.getElementById('healthNotificationGuide');
    const pwaStatusEl = document.getElementById('healthPwaStatus');
    const wakeStatusEl = document.getElementById('healthWakeStatus');

    if (!permStatusEl) return;

    if (!('Notification' in window)) {
      permStatusEl.textContent = 'Unsupported on this browser';
      permStatusEl.className = 'health-badge badge-warning';
      if (permBtn) permBtn.style.display = 'none';
      if (permGuideEl) {
        permGuideEl.style.display = 'block';
        permGuideEl.textContent = 'Web notifications are not supported in this browser. Use the Calendar export below for 100% reliable alarms.';
      }
    } else if (Notification.permission === 'granted') {
      permStatusEl.textContent = 'Active (Allowed)';
      permStatusEl.className = 'health-badge badge-success';
      if (permBtn) permBtn.style.display = 'none';
      if (permGuideEl) permGuideEl.style.display = 'none';
    } else if (Notification.permission === 'denied') {
      permStatusEl.textContent = 'Blocked';
      permStatusEl.className = 'health-badge badge-danger';
      if (permBtn) permBtn.style.display = 'none';
      if (permGuideEl) permGuideEl.style.display = 'block';
    } else {
      permStatusEl.textContent = 'Not requested yet';
      permStatusEl.className = 'health-badge badge-neutral';
      if (permBtn) permBtn.style.display = 'inline-block';
      if (permGuideEl) permGuideEl.style.display = 'none';
    }

    // PWA install state
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (pwaStatusEl) {
      if (isStandalone) {
        pwaStatusEl.textContent = 'Installed (Standalone PWA)';
        pwaStatusEl.className = 'health-badge badge-success';
      } else {
        pwaStatusEl.textContent = 'In Browser Tab (Tip: Add to Home Screen)';
        pwaStatusEl.className = 'health-badge badge-neutral';
      }
    }

    // Wake lock state
    if (wakeStatusEl) {
      if (!('wakeLock' in navigator)) {
        wakeStatusEl.textContent = 'Unsupported';
        wakeStatusEl.className = 'health-badge badge-neutral';
      } else if (LockedIn.state.wakeLockActive) {
        wakeStatusEl.textContent = 'Screen Awake (Active)';
        wakeStatusEl.className = 'health-badge badge-success';
      } else {
        wakeStatusEl.textContent = 'Inactive (Toggle below)';
        wakeStatusEl.className = 'health-badge badge-neutral';
      }
    }
  }

  async function toggleWakeLock(enable) {
    const { state } = LockedIn;
    const { showToast } = LockedIn.ui;

    if (!('wakeLock' in navigator)) {
      showToast('Wake Lock is not supported on this browser.', 'info');
      updateWakeLockUI();
      return;
    }

    if (enable) {
      try {
        state.wakeLockObj = await navigator.wakeLock.request('screen');
        state.wakeLockActive = true;
        state.wakeLockObj.addEventListener('release', () => {
          state.wakeLockActive = false;
          updateWakeLockUI();
          updateAlarmHealthUI();
        });
        updateWakeLockUI();
        updateAlarmHealthUI();
        showToast('Screen Wake Lock active: screen will stay awake', 'success');
      } catch (err) {
        state.wakeLockActive = false;
        updateWakeLockUI();
        updateAlarmHealthUI();
        showToast(`Wake Lock error: ${err.message}`, 'error');
      }
    } else {
      if (state.wakeLockObj) {
        await state.wakeLockObj.release();
        state.wakeLockObj = null;
      }
      state.wakeLockActive = false;
      updateWakeLockUI();
      updateAlarmHealthUI();
      showToast('Screen Wake Lock released', 'info');
    }
  }

  function updateWakeLockUI() {
    const { state } = LockedIn;
    const cb = document.getElementById('wakeLockCheckbox');
    if (cb) cb.checked = state.wakeLockActive;
  }

  LockedIn.alarms = {
    getAudioContext,
    playPositiveTick,
    startAlarmSound,
    stopAlarmSound,
    requestNotificationPermission,
    showBlockNotification,
    triggerInAppAlarm,
    stopCurrentAlarm,
    snoozeCurrentAlarm,
    checkAlarms,
    startAlarmCheckerLoop,
    scheduleTestAlarm,
    updateAlarmHealthUI,
    toggleWakeLock,
    updateWakeLockUI,
    firedAlarmKeys
  };
})();
