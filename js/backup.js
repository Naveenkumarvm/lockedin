/**
 * Locked In - Safe Backup & Restore Module
 * Encrypted JSON backups (PBKDF2 + AES-GCM), Web Share email, Restore preview & File System Access
 */

(function () {
  'use strict';

  window.LockedIn = window.LockedIn || {};

  async function generateEncryptedBackupPayload(passphrase) {
    const { state } = LockedIn;
    const { arrayBufferToBase64, deriveKeyFromSecret, encryptData } = LockedIn.crypto;

    const saltBytes = crypto.getRandomValues(new Uint8Array(16));
    const backupKey = await deriveKeyFromSecret(passphrase, saltBytes);

    const backupPayload = {
      app: 'Locked In',
      version: 1,
      format: 'lockedin-encrypted-v1',
      exported_at: new Date().toISOString(),
      profile: {
        name: state.profileInfo.name,
        email: state.profileInfo.email,
        created_at: state.profileInfo.created_at
      },
      timetable: state.timetable,
      daily_logs: state.dailyLogs,
      learning_logs: state.learningLogs
    };

    const encrypted = await encryptData(backupKey, backupPayload);

    return JSON.stringify({
      app: 'Locked In',
      version: 1,
      format: 'lockedin-encrypted-v1',
      exported_at: backupPayload.exported_at,
      salt: arrayBufferToBase64(saltBytes),
      iv: encrypted.iv,
      ciphertext: encrypted.ciphertext
    }, null, 2);
  }

  async function decryptBackupPayload(jsonString, passphrase) {
    const { base64ToUint8Array, deriveKeyFromSecret, decryptData } = LockedIn.crypto;

    const envelope = JSON.parse(jsonString);
    if (!envelope || envelope.format !== 'lockedin-encrypted-v1' || !envelope.salt || !envelope.iv || !envelope.ciphertext) {
      throw new Error('Invalid Locked In backup file format.');
    }

    const saltBytes = base64ToUint8Array(envelope.salt);
    const backupKey = await deriveKeyFromSecret(passphrase, saltBytes);

    return await decryptData(backupKey, envelope.iv, envelope.ciphertext);
  }

  async function recordBackupTimestamp() {
    const { state } = LockedIn;
    const { dbPut, saveActiveProfileRecord } = LockedIn.storage;

    const nowIso = new Date().toISOString();
    state.profileInfo.last_backup = nowIso;
    if (state.activeProfileMeta) {
      state.activeProfileMeta.last_backup = nowIso;
      await dbPut('profiles', state.activeProfileMeta);
    }
    await saveActiveProfileRecord('profile_info', state.profileInfo);
    updateBackupStatusUI();
  }

  function updateBackupStatusUI() {
    const { state } = LockedIn;
    const lastBackupDisplay = document.getElementById('lastBackupDisplay');
    const warningBanner = document.getElementById('backupWarningBanner');
    const warningText = document.getElementById('backupWarningText');

    const lastBackup = state.profileInfo.last_backup;

    if (!lastBackup) {
      if (lastBackupDisplay) lastBackupDisplay.textContent = 'Never';
      if (warningBanner) warningBanner.style.display = 'flex';
      if (warningText) warningText.textContent = 'You have not created a backup yet! Back up your data to keep it safe.';
      return;
    }

    const backupDate = new Date(lastBackup);
    const daysAgo = Math.floor((Date.now() - backupDate.getTime()) / (1000 * 60 * 60 * 24));

    if (lastBackupDisplay) {
      lastBackupDisplay.textContent = `${backupDate.toLocaleDateString()} (${daysAgo === 0 ? 'Today' : `${daysAgo}d ago`})`;
    }

    if (daysAgo >= 7) {
      if (warningBanner) warningBanner.style.display = 'flex';
      if (warningText) warningText.textContent = `Last backup was ${daysAgo} days ago. Back up your data now to avoid losing progress!`;
    } else {
      if (warningBanner) warningBanner.style.display = 'none';
    }
  }

  function promptBackupPassphrase(title, desc, confirmRequired, onProceed) {
    const { openModal, closeModal, showToast } = LockedIn.ui;

    const modalTitle = document.getElementById('passphraseModalTitle');
    const modalDesc = document.getElementById('passphraseModalDesc');
    const confirmGroup = document.getElementById('passphraseConfirmGroup');
    const passInput = document.getElementById('passphraseInput');
    const confirmInput = document.getElementById('passphraseConfirmInput');
    const form = document.getElementById('passphraseForm');

    if (modalTitle) modalTitle.textContent = title;
    if (modalDesc) modalDesc.textContent = desc;

    if (confirmGroup) {
      confirmGroup.style.display = confirmRequired ? 'flex' : 'none';
    }

    passInput.value = '';
    confirmInput.value = '';

    form.onsubmit = (e) => {
      e.preventDefault();
      const p1 = passInput.value;
      const p2 = confirmInput.value;

      if (!p1) {
        showToast('Passphrase is required', 'error');
        return;
      }

      if (confirmRequired && p1 !== p2) {
        showToast('Passphrases do not match', 'error');
        return;
      }

      closeModal('passphraseModal');
      onProceed(p1);
    };

    openModal('passphraseModal');
    passInput.focus();
  }

  function exportBackupToFile() {
    const { getTodayString } = LockedIn.time;
    const { downloadBlob, showToast } = LockedIn.ui;

    promptBackupPassphrase(
      'Export Backup',
      'Choose a strong passphrase to encrypt your backup file. You will need this to restore.',
      true,
      async (passphrase) => {
        try {
          showToast('Encrypting backup...', 'info');
          const encryptedJson = await generateEncryptedBackupPayload(passphrase);
          const filename = `lockedin-backup-${getTodayString()}.enc.json`;
          const blob = new Blob([encryptedJson], { type: 'application/json' });
          downloadBlob(blob, filename);
          await recordBackupTimestamp();
          showToast('Backup exported successfully', 'success');
        } catch (err) {
          showToast(`Export error: ${err.message}`, 'error');
        }
      }
    );
  }

  function sendBackupByEmail() {
    const { state } = LockedIn;
    const { getTodayString } = LockedIn.time;
    const { downloadBlob, showToast } = LockedIn.ui;

    promptBackupPassphrase(
      'Send Backup by Email',
      'Enter a passphrase to encrypt your backup before sharing via email.',
      true,
      async (passphrase) => {
        try {
          showToast('Encrypting backup...', 'info');
          const encryptedJson = await generateEncryptedBackupPayload(passphrase);
          const filename = `lockedin-backup-${getTodayString()}.enc.json`;
          const blob = new Blob([encryptedJson], { type: 'application/json' });
          const file = new File([blob], filename, { type: 'application/json' });

          const userEmail = state.profileInfo.email || '';

          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: 'Locked In Backup',
              text: `Locked In encrypted backup for ${userEmail}. Created on ${new Date().toLocaleDateString()}.`,
              files: [file]
            });
            await recordBackupTimestamp();
            showToast('Backup shared successfully', 'success');
          } else {
            downloadBlob(blob, filename);
            await recordBackupTimestamp();
            if (userEmail) {
              window.open(`mailto:${encodeURIComponent(userEmail)}?subject=${encodeURIComponent('Locked In Backup')}`);
            }
            showToast('Backup downloaded. Please attach to email.', 'info');
          }
        } catch (err) {
          if (err.name !== 'AbortError') {
            showToast(`Share error: ${err.message}`, 'error');
          }
        }
      }
    );
  }

  function initiateRestore() {
    LockedIn.ui.openModal('restoreSourceModal');
  }

  async function handleRestoreFileSelected(file) {
    if (!file) return;
    try {
      const text = await file.text();
      promptRestorePassphrase(text);
    } catch (err) {
      LockedIn.ui.showToast(`Read file error: ${err.message}`, 'error');
    }
  }

  function promptRestorePassphrase(rawJsonContent) {
    const { showToast } = LockedIn.ui;

    promptBackupPassphrase(
      'Decrypt Backup',
      'Enter the backup passphrase you used when creating this backup.',
      false,
      async (passphrase) => {
        try {
          showToast('Decrypting backup...', 'info');
          const decryptedData = await decryptBackupPayload(rawJsonContent, passphrase);
          LockedIn.state.pendingRestoreData = decryptedData;
          showRestorePreviewModal(decryptedData);
        } catch (err) {
          showToast('Decryption failed: incorrect passphrase or invalid file.', 'error');
        }
      }
    );
  }

  function showRestorePreviewModal(data) {
    const pNameEl = document.getElementById('previewProfileName');
    const pEmailEl = document.getElementById('previewEmail');
    const pDateEl = document.getElementById('previewExportDate');
    const pDaysEl = document.getElementById('previewDaysCount');
    const pLogsEl = document.getElementById('previewLogsCount');
    const pMonSatEl = document.getElementById('previewMonSatCount');
    const pSunEl = document.getElementById('previewSunCount');

    if (pNameEl) pNameEl.textContent = data.profile ? data.profile.name : 'Unknown';
    if (pEmailEl) pEmailEl.textContent = data.profile ? data.profile.email : 'None';
    if (pDateEl) pDateEl.textContent = data.exported_at ? new Date(data.exported_at).toLocaleString() : '--';
    if (pDaysEl) pDaysEl.textContent = Object.keys(data.daily_logs || {}).length;
    if (pLogsEl) pLogsEl.textContent = (data.learning_logs || []).length;
    if (pMonSatEl) pMonSatEl.textContent = (data.timetable && data.timetable.mon_sat) ? data.timetable.mon_sat.length : 0;
    if (pSunEl) pSunEl.textContent = (data.timetable && data.timetable.sunday) ? data.timetable.sunday.length : 0;

    LockedIn.ui.openModal('restorePreviewModal');
  }

  async function executeRestoreOverwrite() {
    const { state } = LockedIn;
    const { saveActiveProfileRecord } = LockedIn.storage;
    const { closeModal, showToast } = LockedIn.ui;

    if (!state.pendingRestoreData) return;
    const data = state.pendingRestoreData;

    try {
      showToast('Restoring data...', 'info');

      if (data.timetable) state.timetable = data.timetable;
      if (data.daily_logs) state.dailyLogs = data.daily_logs;
      if (data.learning_logs) state.learningLogs = data.learning_logs;
      if (data.profile && data.profile.email) {
        state.profileInfo.email = data.profile.email;
      }

      await saveActiveProfileRecord('timetable', state.timetable);
      await saveActiveProfileRecord('daily_logs', state.dailyLogs);
      await saveActiveProfileRecord('learning_logs', state.learningLogs);
      await saveActiveProfileRecord('profile_info', state.profileInfo);

      state.pendingRestoreData = null;
      closeModal('restorePreviewModal');

      if (LockedIn.renderAll) LockedIn.renderAll();
      showToast('Backup restored successfully!', 'success');
    } catch (err) {
      showToast(`Restore failed: ${err.message}`, 'error');
    }
  }

  async function saveToLocalFolder() {
    const { state } = LockedIn;
    const { getTodayString } = LockedIn.time;
    const { showToast } = LockedIn.ui;
    const { escapeHtml } = LockedIn.crypto;

    if (!('showDirectoryPicker' in window)) {
      showToast('File System Access API is not supported on this device/browser. Use "Export Backup" instead.', 'info');
      return;
    }

    promptBackupPassphrase(
      'Save to Local Folder',
      'Enter a passphrase to encrypt your backup before saving to your selected local folder.',
      true,
      async (passphrase) => {
        try {
          showToast('Select destination folder...', 'info');
          const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
          state.fsDirHandle = dirHandle;

          showToast('Encrypting backup...', 'info');
          const encryptedJson = await generateEncryptedBackupPayload(passphrase);
          const filename = `lockedin-backup-${getTodayString()}.enc.json`;

          const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(encryptedJson);
          await writable.close();

          await recordBackupTimestamp();

          const folderStatusEl = document.getElementById('fsFolderStatus');
          if (folderStatusEl) {
            folderStatusEl.textContent = `✓ Saved to "${escapeHtml(dirHandle.name)}" (${filename})`;
          }

          showToast(`Backup saved directly to folder "${dirHandle.name}"`, 'success');
        } catch (err) {
          if (err.name !== 'AbortError') {
            showToast(`Folder write error: ${err.message}`, 'error');
          }
        }
      }
    );
  }

  LockedIn.backup = {
    generateEncryptedBackupPayload,
    decryptBackupPayload,
    recordBackupTimestamp,
    updateBackupStatusUI,
    promptBackupPassphrase,
    exportBackupToFile,
    sendBackupByEmail,
    initiateRestore,
    handleRestoreFileSelected,
    promptRestorePassphrase,
    showRestorePreviewModal,
    executeRestoreOverwrite,
    saveToLocalFolder
  };
})();
