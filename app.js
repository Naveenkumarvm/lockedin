/**
 * Locked In - Progressive Web App (PWA)
 * Master Application Coordinator & Event Binder
 * Plain Vanilla JavaScript, Zero Frameworks, 100% Offline Capable
 */

(function () {
  'use strict';

  window.LockedIn = window.LockedIn || {};

  function renderAll() {
    if (LockedIn.today) LockedIn.today.renderTodayTab();
    if (LockedIn.learningLog) LockedIn.learningLog.renderLearningLogTab();
    if (LockedIn.report) LockedIn.report.renderReportTab();
    if (LockedIn.timetable) LockedIn.timetable.renderTimetableTab();
  }
  LockedIn.renderAll = renderAll;

  function onClick(id, handler) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', handler);
  }

  function bindEvents() {
    const { state } = LockedIn;
    const { parseDateString, getTodayString } = LockedIn.time;
    const { openModal, closeModal, showToast } = LockedIn.ui;

    // Tab navigation
    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        if (!targetTab) return;

        document.querySelectorAll('.nav-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        btn.classList.add('active');
        const contentEl = document.getElementById(targetTab);
        if (contentEl) contentEl.classList.add('active');

        state.currentTab = targetTab;
        if (LockedIn.alarms && LockedIn.alarms.getAudioContext) LockedIn.alarms.getAudioContext();

        if (targetTab === 'tab-today' && LockedIn.today) LockedIn.today.renderTodayTab();
        if (targetTab === 'tab-learning' && LockedIn.learningLog) LockedIn.learningLog.renderLearningLogTab();
        if (targetTab === 'tab-report' && LockedIn.report) LockedIn.report.renderReportTab();
        if (targetTab === 'tab-timetable' && LockedIn.timetable) LockedIn.timetable.renderTimetableTab();
      });
    });

    // Date navigation
    onClick('prevDayBtn', () => {
      const d = parseDateString(state.selectedDate);
      d.setDate(d.getDate() - 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      state.selectedDate = `${y}-${m}-${day}`;
      if (LockedIn.today) LockedIn.today.renderTodayTab();
    });

    onClick('nextDayBtn', () => {
      const d = parseDateString(state.selectedDate);
      d.setDate(d.getDate() + 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      state.selectedDate = `${y}-${m}-${day}`;
      if (LockedIn.today) LockedIn.today.renderTodayTab();
    });

    onClick('jumpTodayBtn', () => {
      state.selectedDate = getTodayString();
      if (LockedIn.today) LockedIn.today.renderTodayTab();
    });

    // Alarms armed/off chip toggle
    onClick('alarmStatusChip', () => {
      if (LockedIn.alarms && LockedIn.alarms.getAudioContext) LockedIn.alarms.getAudioContext();
      state.alarmsArmed = !state.alarmsArmed;
      const chip = document.getElementById('alarmStatusChip');
      if (chip) {
        chip.classList.toggle('armed', state.alarmsArmed);
        chip.classList.toggle('off', !state.alarmsArmed);
      }
      const text = document.getElementById('alarmStatusText');
      if (text) text.textContent = state.alarmsArmed ? 'Alarms armed' : 'Alarms off';
      showToast(`In-app alarms are now ${state.alarmsArmed ? 'armed' : 'turned off'}.`, 'info');
    });

    // Quick Lock & Profile buttons
    onClick('quickLockBtn', () => { if (LockedIn.auth) LockedIn.auth.lockApp(); });
    onClick('profileChipBtn', () => { if (LockedIn.auth) LockedIn.auth.openProfileManager(); });

    // PIN Keypad buttons
    document.querySelectorAll('.keypad-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-key');
        if (LockedIn.alarms && LockedIn.alarms.getAudioContext) LockedIn.alarms.getAudioContext();
        if (LockedIn.auth) LockedIn.auth.handlePinKey(key);
      });
    });

    // Keyboard PIN support
    window.addEventListener('keydown', (e) => {
      const pinModal = document.getElementById('pinModalBackdrop');
      if (pinModal && pinModal.classList.contains('active')) {
        if (/^[0-9]$/.test(e.key)) {
          if (LockedIn.auth) LockedIn.auth.handlePinKey(e.key);
        } else if (e.key === 'Backspace') {
          if (LockedIn.auth) LockedIn.auth.handlePinKey('del');
        } else if (e.key === 'Enter') {
          if (state.pinInputDigits.length >= 6 && LockedIn.auth) {
            LockedIn.auth.unlockWithPin(state.pinInputDigits);
          }
        }
      }
    });

    // Learning log session selector & submit
    document.querySelectorAll('.session-segmented .session-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.session-segmented .session-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        state.learningSessionChoice = btn.getAttribute('data-session') || 'Morning';
      });
    });

    const learningForm = document.getElementById('learningEntryForm');
    if (learningForm) {
      learningForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const topic = document.getElementById('learnTopicInput').value;
        const notes = document.getElementById('learnNotesInput').value;
        const minutes = document.getElementById('learnMinutesInput').value;

        if (LockedIn.today) {
          LockedIn.today.addLearningEntry(topic, state.learningSessionChoice, notes, minutes);
        }
        document.getElementById('learnTopicInput').value = '';
        document.getElementById('learnNotesInput').value = '';
        document.getElementById('learnTopicInput').focus();
      });
    }

    const logSearchInput = document.getElementById('logSearchInput');
    if (logSearchInput) {
      logSearchInput.addEventListener('input', () => {
        if (LockedIn.learningLog) LockedIn.learningLog.renderLearningLogTab();
      });
    }

    onClick('saveCsvBtn', () => { if (LockedIn.learningLog) LockedIn.learningLog.exportLearningLogCsv(); });

    // Timetable day switcher & actions
    onClick('switchMonSatBtn', () => {
      state.timetableEditDayType = 'mon_sat';
      if (LockedIn.timetable) LockedIn.timetable.renderTimetableTab();
    });

    onClick('switchSunBtn', () => {
      state.timetableEditDayType = 'sunday';
      if (LockedIn.timetable) LockedIn.timetable.renderTimetableTab();
    });

    onClick('addBlockBtn', () => {
      if (LockedIn.timetable) LockedIn.timetable.openBlockEditModal(state.timetableEditDayType);
    });

    onClick('resetTimetableBtn', () => {
      if (LockedIn.timetable) LockedIn.timetable.resetTimetableToSample();
    });

    const blockEditForm = document.getElementById('blockEditForm');
    if (blockEditForm) {
      blockEditForm.addEventListener('submit', (e) => {
        if (LockedIn.timetable) LockedIn.timetable.saveTimetableBlockFromForm(e);
      });
    }

    onClick('closeBlockModalBtn', () => closeModal('blockEditModal'));
    onClick('cancelBlockModalBtn', () => closeModal('blockEditModal'));
    onClick('exportCalendarBtn', () => { if (LockedIn.timetable) LockedIn.timetable.exportToCalendarIcs(); });
    onClick('testAlarm10sBtn', () => { if (LockedIn.alarms) LockedIn.alarms.scheduleTestAlarm(); });
    onClick('healthNotificationBtn', async () => { if (LockedIn.alarms) await LockedIn.alarms.requestNotificationPermission(); });

    // Screen Wake Lock
    const wakeLockCheckbox = document.getElementById('wakeLockCheckbox');
    if (wakeLockCheckbox) {
      wakeLockCheckbox.addEventListener('change', (e) => {
        if (LockedIn.alarms) LockedIn.alarms.toggleWakeLock(e.target.checked);
      });
    }

    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState === 'visible' && state.wakeLockActive && !state.wakeLockObj) {
        if (LockedIn.alarms) await LockedIn.alarms.toggleWakeLock(true);
      }
    });

    // In-App Alarm stop & snooze
    onClick('alarmStopBtn', () => { if (LockedIn.alarms) LockedIn.alarms.stopCurrentAlarm(); });
    onClick('alarmSnoozeBtn', () => { if (LockedIn.alarms) LockedIn.alarms.snoozeCurrentAlarm(); });

    // Backup actions
    onClick('exportBackupBtn', () => { if (LockedIn.backup) LockedIn.backup.exportBackupToFile(); });
    onClick('saveDriveBtn', () => { if (LockedIn.drive) LockedIn.drive.saveToGoogleDrive(); });
    onClick('sendEmailBtn', () => { if (LockedIn.backup) LockedIn.backup.sendBackupByEmail(); });
    onClick('restoreBtn', () => { if (LockedIn.backup) LockedIn.backup.initiateRestore(); });
    onClick('saveFolderBtn', () => { if (LockedIn.backup) LockedIn.backup.saveToLocalFolder(); });

    // Restore modal actions
    onClick('restoreFromFileBtn', () => {
      closeModal('restoreSourceModal');
      const input = document.getElementById('restoreFileInput');
      if (input) { input.value = ''; input.click(); }
    });

    onClick('restoreFromDriveBtn', () => {
      closeModal('restoreSourceModal');
      if (LockedIn.drive) LockedIn.drive.restoreFromGoogleDrive();
    });

    onClick('closeRestoreSourceModalBtn', () => closeModal('restoreSourceModal'));

    const restoreFileInput = document.getElementById('restoreFileInput');
    if (restoreFileInput) {
      restoreFileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0 && LockedIn.backup) {
          LockedIn.backup.handleRestoreFileSelected(e.target.files[0]);
        }
      });
    }

    onClick('confirmRestoreBtn', () => { if (LockedIn.backup) LockedIn.backup.executeRestoreOverwrite(); });
    onClick('cancelRestoreBtn', () => closeModal('restorePreviewModal'));
    onClick('closeRestoreModalBtn', () => closeModal('restorePreviewModal'));
    onClick('closeDriveRestoreModalBtn', () => closeModal('driveRestoreModal'));
    onClick('closePassphraseModalBtn', () => closeModal('passphraseModal'));

    // Profile manager & Setup wizard
    onClick('closeProfileModalBtn', () => closeModal('profileManagerModal'));
    onClick('addNewProfileBtn', () => {
      closeModal('profileManagerModal');
      const firstRunForm = document.getElementById('firstRunForm');
      if (firstRunForm) firstRunForm.reset();
      const titleEl = document.getElementById('firstRunModalTitle');
      if (titleEl) titleEl.textContent = 'Create New Profile';
      const closeBtn = document.getElementById('closeFirstRunModalBtn');
      if (closeBtn) closeBtn.style.display = 'block';
      openModal('firstRunModal');
    });

    onClick('closeFirstRunModalBtn', () => closeModal('firstRunModal'));

    const firstRunForm = document.getElementById('firstRunForm');
    if (firstRunForm) {
      firstRunForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('setupNameInput').value;
        const email = document.getElementById('setupEmailInput').value;
        const pin = document.getElementById('setupPinInput').value;
        const pinConfirm = document.getElementById('setupPinConfirmInput').value;
        const timetableChoice = document.querySelector('input[name="setupTimetableChoice"]:checked').value;

        if (pin.length < 6) {
          showToast('PIN must be at least 6 digits', 'error');
          return;
        }
        if (pin !== pinConfirm) {
          showToast('PIN confirmation does not match', 'error');
          return;
        }

        closeModal('firstRunModal');
        if (LockedIn.auth) {
          await LockedIn.auth.createProfile(name, email, pin, timetableChoice);
        }
      });
    }

    // Live update loop for Now/Next banner every 15 seconds
    setInterval(() => {
      if (!state.isLocked && state.currentTab === 'tab-today' && LockedIn.today) {
        LockedIn.today.updateNowNextBanner();
      }
    }, 15000);
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        let hadController = Boolean(navigator.serviceWorker.controller);

        navigator.serviceWorker.register('./sw.js')
          .then((registration) => {
            console.log('Service Worker registered with relative scope:', registration.scope);
            registration.update();
          })
          .catch((err) => {
            console.warn('Service Worker registration failed:', err);
          });

        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (hadController && !refreshing) {
            refreshing = true;
            window.location.reload();
          }
          hadController = true;
        });
      });
    }
  }

  async function initApp() {
    try {
      LockedIn.state.db = await LockedIn.storage.openDatabase();
      await LockedIn.storage.requestPersistentStorage();
      registerServiceWorker();
      if ('caches' in window) {
        caches.keys().then((keys) => {
          keys.forEach((k) => {
            if (k.startsWith('lockedin-') && k !== 'lockedin-cache-v6') {
              caches.delete(k);
            }
          });
        });
      }
      bindEvents();
      if (LockedIn.auth) LockedIn.auth.initInactivityListeners();
      if (LockedIn.alarms) LockedIn.alarms.startAlarmCheckerLoop();

      const profiles = await LockedIn.storage.dbGetAll('profiles');

      if (profiles.length === 0) {
        const closeBtn = document.getElementById('closeFirstRunModalBtn');
        if (closeBtn) closeBtn.style.display = 'none';
        const titleEl = document.getElementById('firstRunModalTitle');
        if (titleEl) titleEl.textContent = 'Set Up Locked In';
        LockedIn.ui.openModal('firstRunModal');
      } else {
        const lastMeta = await LockedIn.storage.dbGet('meta', 'last_active_profile');
        let selected = profiles[0];
        if (lastMeta && lastMeta.value) {
          const match = profiles.find(p => p.id === lastMeta.value);
          if (match) selected = match;
        }

        LockedIn.state.activeProfileId = selected.id;
        LockedIn.state.activeProfileMeta = selected;
        if (LockedIn.auth) LockedIn.auth.lockApp();
      }
    } catch (err) {
      console.error('Initialization error:', err);
      alert('Error initializing Locked In: ' + err.message);
    }
  }

  LockedIn.init = initApp;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();
