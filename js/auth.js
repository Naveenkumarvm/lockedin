/**
 * Locked In - Authentication & Profile Security Module
 * Zero-Knowledge PBKDF2 PIN authentication, multi-profile isolation & auto-lock
 */

(function () {
  'use strict';

  window.LockedIn = window.LockedIn || {};

  async function createProfile(name, email, pin, timetableChoice) {
    const { state, DEFAULT_SAMPLE_TIMETABLE } = LockedIn;
    const { arrayBufferToBase64, deriveKeyFromSecret, encryptData, escapeHtml } = LockedIn.crypto;
    const { dbPut, saveActiveProfileRecord } = LockedIn.storage;
    const { updateProfileUI, showToast } = LockedIn.ui;

    const saltBytes = crypto.getRandomValues(new Uint8Array(16));
    const saltBase64 = arrayBufferToBase64(saltBytes);
    const key = await deriveKeyFromSecret(pin, saltBytes);

    const verification = await encryptData(key, { magic: 'LOCKEDIN_VERIFIED_V1' });

    const profileId = 'prof_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    const profileMeta = {
      id: profileId,
      name: name.trim(),
      salt: saltBase64,
      pin_length: pin.length,
      verificationIv: verification.iv,
      verificationCiphertext: verification.ciphertext,
      created_at: new Date().toISOString(),
      last_backup: null
    };

    await dbPut('profiles', profileMeta);
    await dbPut('meta', { key: 'last_active_profile', value: profileId });

    state.activeProfileId = profileId;
    state.activeProfileMeta = profileMeta;
    state.derivedKey = key;
    state.isLocked = false;
    state.failedPinAttempts = 0;
    state.lockoutUntil = 0;

    state.profileInfo = {
      name: name.trim(),
      email: email.trim(),
      created_at: profileMeta.created_at,
      last_backup: null
    };

    if (timetableChoice === 'sample') {
      state.timetable = JSON.parse(JSON.stringify(DEFAULT_SAMPLE_TIMETABLE));
    } else {
      state.timetable = { mon_sat: [], sunday: [] };
    }

    state.dailyLogs = {};
    state.learningLogs = [];

    await saveActiveProfileRecord('profile_info', state.profileInfo);
    await saveActiveProfileRecord('timetable', state.timetable);
    await saveActiveProfileRecord('daily_logs', state.dailyLogs);
    await saveActiveProfileRecord('learning_logs', state.learningLogs);

    updateProfileUI();
    if (LockedIn.renderAll) LockedIn.renderAll();
    showToast(`Welcome, ${escapeHtml(name)}! Your profile is locked in.`, 'success');
  }

  async function unlockWithPin(pin) {
    const { state, DEFAULT_SAMPLE_TIMETABLE } = LockedIn;
    const { base64ToUint8Array, deriveKeyFromSecret, decryptData } = LockedIn.crypto;
    const { loadActiveProfileRecord } = LockedIn.storage;
    const { closeModal, updateProfileUI, showToast } = LockedIn.ui;

    if (!state.activeProfileMeta) return false;

    if (Date.now() < state.lockoutUntil) {
      const waitSec = Math.ceil((state.lockoutUntil - Date.now()) / 1000);
      showPinError(`Too many failed attempts. Wait ${waitSec}s.`);
      return false;
    }

    try {
      const saltBytes = base64ToUint8Array(state.activeProfileMeta.salt);
      const testKey = await deriveKeyFromSecret(pin, saltBytes);

      const verifiedObj = await decryptData(
        testKey,
        state.activeProfileMeta.verificationIv,
        state.activeProfileMeta.verificationCiphertext
      );

      if (verifiedObj && verifiedObj.magic === 'LOCKEDIN_VERIFIED_V1') {
        state.derivedKey = testKey;
        state.isLocked = false;
        state.failedPinAttempts = 0;
        state.lockoutUntil = 0;

        state.profileInfo = await loadActiveProfileRecord('profile_info', {
          name: state.activeProfileMeta.name,
          email: '',
          created_at: state.activeProfileMeta.created_at,
          last_backup: state.activeProfileMeta.last_backup
        });
        state.timetable = await loadActiveProfileRecord('timetable', JSON.parse(JSON.stringify(DEFAULT_SAMPLE_TIMETABLE)));
        state.dailyLogs = await loadActiveProfileRecord('daily_logs', {});
        state.learningLogs = await loadActiveProfileRecord('learning_logs', []);

        closeModal('pinModalBackdrop');
        updateProfileUI();
        if (LockedIn.renderAll) LockedIn.renderAll();
        showToast('App Unlocked', 'success');
        return true;
      }
    } catch (err) {
      // Failed decryption
    }

    state.failedPinAttempts++;
    state.pinInputDigits = '';
    updatePinDots();

    if (state.failedPinAttempts >= 5) {
      state.lockoutUntil = Date.now() + 30000;
      showPinError('5 wrong attempts. Locked for 30 seconds.');
    } else {
      const remaining = 5 - state.failedPinAttempts;
      showPinError(`Incorrect PIN. ${remaining} attempts before delay.`);
    }

    return false;
  }

  function lockApp() {
    const { state } = LockedIn;
    const { clearDecryptedDisplay, openModal } = LockedIn.ui;

    state.derivedKey = null;
    state.isLocked = true;
    state.pinInputDigits = '';

    clearDecryptedDisplay();
    renderPinDots();
    clearPinError();

    const pinNameEl = document.getElementById('pinProfileName');
    if (pinNameEl) {
      pinNameEl.textContent = state.activeProfileMeta ? `Enter PIN for ${state.activeProfileMeta.name}` : 'Enter PIN';
    }
    openModal('pinModalBackdrop');
  }

  function initInactivityListeners() {
    const { state, INACTIVITY_LOCK_MS } = LockedIn;

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        state.lastBackgroundTimestamp = Date.now();
      } else {
        if (state.lastBackgroundTimestamp) {
          const elapsed = Date.now() - state.lastBackgroundTimestamp;
          state.lastBackgroundTimestamp = null;
          if (elapsed >= INACTIVITY_LOCK_MS && !state.isLocked && state.activeProfileMeta) {
            lockApp();
          }
        }
      }
    });

    window.addEventListener('blur', () => {
      if (!state.lastBackgroundTimestamp) {
        state.lastBackgroundTimestamp = Date.now();
      }
    });

    window.addEventListener('focus', () => {
      if (state.lastBackgroundTimestamp) {
        const elapsed = Date.now() - state.lastBackgroundTimestamp;
        state.lastBackgroundTimestamp = null;
        if (elapsed >= INACTIVITY_LOCK_MS && !state.isLocked && state.activeProfileMeta) {
          lockApp();
        }
      }
    });
  }

  async function openProfileManager() {
    const { state } = LockedIn;
    const { dbGetAll } = LockedIn.storage;
    const { openModal, closeModal } = LockedIn.ui;
    const { escapeHtml } = LockedIn.crypto;

    const listEl = document.getElementById('profilesListContainer');
    if (!listEl) return;
    listEl.innerHTML = '';

    const profiles = await dbGetAll('profiles');

    profiles.forEach(p => {
      const isCurrent = p.id === state.activeProfileId;
      const card = document.createElement('div');
      card.style.cssText = `
        display: flex; align-items: center; justify-content: space-between; padding: 12px 14px;
        background-color: ${isCurrent ? 'var(--color-primary-soft)' : 'var(--color-surface-subtle)'};
        border: 1px solid ${isCurrent ? 'var(--color-primary)' : 'var(--color-border)'};
        border-radius: var(--radius-sm);
      `;

      card.innerHTML = `
        <div>
          <strong style="font-size: 0.95rem;">${escapeHtml(p.name)}</strong>
          ${isCurrent ? '<span class="text-primary" style="font-size: 0.75rem; margin-left: 6px; font-weight: 600;">(Active)</span>' : ''}
          <div class="text-muted" style="font-size: 0.75rem;">Created: ${new Date(p.created_at).toLocaleDateString()}</div>
        </div>
        <button class="btn-secondary" style="padding: 6px 12px; font-size: 0.8rem;" ${isCurrent ? 'disabled' : ''}>
          ${isCurrent ? 'Current' : 'Switch'}
        </button>
      `;

      if (!isCurrent) {
        card.querySelector('button').addEventListener('click', async () => {
          closeModal('profileManagerModal');
          await switchProfile(p.id);
        });
      }

      listEl.appendChild(card);
    });

    openModal('profileManagerModal');
  }

  async function switchProfile(targetProfileId) {
    const { state } = LockedIn;
    const { dbGet, dbPut } = LockedIn.storage;

    const profile = await dbGet('profiles', targetProfileId);
    if (!profile) return;

    state.activeProfileId = profile.id;
    state.activeProfileMeta = profile;
    state.failedPinAttempts = 0;
    state.lockoutUntil = 0;
    state.pinInputDigits = '';
    await dbPut('meta', { key: 'last_active_profile', value: profile.id });

    lockApp();
  }

  function renderPinDots() {
    const { state } = LockedIn;
    const container = document.querySelector('.pin-display');
    if (!container) return;
    const count = (state.activeProfileMeta && state.activeProfileMeta.pin_length) ? state.activeProfileMeta.pin_length : 6;
    container.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const dot = document.createElement('span');
      dot.className = `pin-dot ${i < state.pinInputDigits.length ? 'filled' : ''}`;
      dot.id = `pindot-${i}`;
      container.appendChild(dot);
    }
  }

  function updatePinDots() {
    const { state } = LockedIn;
    const count = (state.activeProfileMeta && state.activeProfileMeta.pin_length) ? state.activeProfileMeta.pin_length : 6;
    for (let i = 0; i < count; i++) {
      const dot = document.getElementById(`pindot-${i}`);
      if (dot) {
        if (i < state.pinInputDigits.length) {
          dot.classList.add('filled');
        } else {
          dot.classList.remove('filled');
        }
      }
    }
  }

  function showPinError(msg) {
    const errEl = document.getElementById('pinErrorMsg');
    if (errEl) errEl.textContent = msg;
  }

  function clearPinError() {
    const errEl = document.getElementById('pinErrorMsg');
    if (errEl) errEl.textContent = '';
  }

  function handlePinKey(key) {
    const { state } = LockedIn;
    const { closeModal } = LockedIn.ui;

    if (Date.now() < state.lockoutUntil) {
      const waitSec = Math.ceil((state.lockoutUntil - Date.now()) / 1000);
      showPinError(`Please wait ${waitSec}s.`);
      return;
    }

    if (key === 'del') {
      if (state.pinInputDigits.length > 0) {
        state.pinInputDigits = state.pinInputDigits.slice(0, -1);
        updatePinDots();
        clearPinError();
      }
      return;
    }

    if (key === 'switch') {
      closeModal('pinModalBackdrop');
      openProfileManager();
      return;
    }

    const targetLength = (state.activeProfileMeta && state.activeProfileMeta.pin_length) ? state.activeProfileMeta.pin_length : 6;

    if (state.pinInputDigits.length < targetLength) {
      state.pinInputDigits += key;
      updatePinDots();
      clearPinError();

      if (state.pinInputDigits.length === targetLength) {
        setTimeout(async () => {
          if (state.pinInputDigits.length === targetLength) {
            await unlockWithPin(state.pinInputDigits);
          }
        }, 120);
      }
    }
  }

  LockedIn.auth = {
    createProfile,
    unlockWithPin,
    lockApp,
    initInactivityListeners,
    openProfileManager,
    switchProfile,
    renderPinDots,
    updatePinDots,
    showPinError,
    clearPinError,
    handlePinKey
  };
})();
