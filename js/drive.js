/**
 * Locked In - Google Drive Cloud Sync Module
 * Google Identity Services (GIS) token client, Drive v3 folder upload & file restore
 */

(function () {
  'use strict';

  window.LockedIn = window.LockedIn || {};

  function getGoogleClientId() {
    return LockedIn.CONFIG.GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
  }

  async function saveToGoogleDrive() {
    const { state } = LockedIn;
    const { getTodayString } = LockedIn.time;
    const { showToast } = LockedIn.ui;
    const { generateEncryptedBackupPayload, promptBackupPassphrase, recordBackupTimestamp } = LockedIn.backup;
    const clientId = getGoogleClientId();

    if (!clientId || clientId.includes('YOUR_GOOGLE_CLIENT_ID')) {
      alert(
        'Google OAuth Client ID Not Configured\n\n' +
        'To use direct Google Drive backup, replace YOUR_GOOGLE_CLIENT_ID in config.js with your Google Cloud OAuth 2.0 Web Client ID.\n\n' +
        'In the meantime, you can use "Export Backup" (direct download) or "Send by Email" to back up right now without Google credentials.'
      );
      return;
    }

    if (typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) {
      showToast('Google Identity Services client is still loading. Check your internet connection.', 'error');
      return;
    }

    promptBackupPassphrase(
      'Save to Google Drive',
      'Enter a passphrase to encrypt your backup before uploading to Google Drive.',
      true,
      async (passphrase) => {
        try {
          showToast('Encrypting backup...', 'info');
          const encryptedJson = await generateEncryptedBackupPayload(passphrase);
          const filename = `lockedin-backup-${getTodayString()}.enc.json`;

          showToast('Connecting to Google Drive...', 'info');

          const tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: 'https://www.googleapis.com/auth/drive.file',
            callback: async (tokenResponse) => {
              if (tokenResponse && tokenResponse.access_token) {
                state.googleAccessToken = tokenResponse.access_token;
                try {
                  showToast('Uploading to Drive folder "LockedInBackups"...', 'info');
                  await uploadBackupToDrive(filename, encryptedJson, state.googleAccessToken);
                  await recordBackupTimestamp();
                  showToast('Backup saved to Google Drive!', 'success');
                } catch (upErr) {
                  showToast(`Drive upload failed: ${upErr.message}`, 'error');
                }
              } else {
                showToast('Google authorization was cancelled.', 'info');
              }
            }
          });

          tokenClient.requestAccessToken();
        } catch (err) {
          showToast(`Error: ${err.message}`, 'error');
        }
      }
    );
  }

  async function uploadBackupToDrive(filename, content, token) {
    const searchRes = await fetch(
      "https://www.googleapis.com/drive/v3/files?q=name%3D'LockedInBackups'+and+mimeType%3D'application%2Fvnd.google-apps.folder'+and+trashed%3Dfalse",
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const searchData = await searchRes.json();
    let folderId = null;

    if (searchData.files && searchData.files.length > 0) {
      folderId = searchData.files[0].id;
    } else {
      const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'LockedInBackups',
          mimeType: 'application/vnd.google-apps.folder'
        })
      });
      const createData = await createRes.json();
      folderId = createData.id;
    }

    const metadata = { name: filename, parents: [folderId] };
    const boundary = '-------LockedInUploadBoundary';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      content +
      closeDelimiter;

    const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: multipartRequestBody
    });

    if (!uploadRes.ok) {
      const errJson = await uploadRes.json();
      throw new Error(errJson.error ? errJson.error.message : 'Upload failed');
    }

    return await uploadRes.json();
  }

  async function restoreFromGoogleDrive() {
    const { state } = LockedIn;
    const { showToast } = LockedIn.ui;
    const clientId = getGoogleClientId();

    if (!clientId || clientId.includes('YOUR_GOOGLE_CLIENT_ID')) {
      alert('Google OAuth Client ID not configured in config.js. You can restore from a local backup file instead.');
      return;
    }

    if (typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) {
      showToast('Google Identity Services not loaded', 'error');
      return;
    }

    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/drive.file',
      callback: async (tokenResponse) => {
        if (tokenResponse && tokenResponse.access_token) {
          state.googleAccessToken = tokenResponse.access_token;
          try {
            showToast('Searching Drive for backups...', 'info');
            await listAndSelectDriveBackups(state.googleAccessToken);
          } catch (err) {
            showToast(`Drive error: ${err.message}`, 'error');
          }
        }
      }
    });

    tokenClient.requestAccessToken();
  }

  async function listAndSelectDriveBackups(token) {
    const { openModal, closeModal, showToast } = LockedIn.ui;
    const { escapeHtml } = LockedIn.crypto;
    const { promptRestorePassphrase } = LockedIn.backup;

    const searchFolder = await fetch(
      "https://www.googleapis.com/drive/v3/files?q=name%3D'LockedInBackups'+and+mimeType%3D'application%2Fvnd.google-apps.folder'+and+trashed%3Dfalse",
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const folderData = await searchFolder.json();

    if (!folderData.files || folderData.files.length === 0) {
      showToast('No "LockedInBackups" folder found in your Google Drive.', 'info');
      return;
    }

    const folderId = folderData.files[0].id;
    const listRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed%3Dfalse&orderBy=createdTime+desc&fields=files(id,name,createdTime,size)`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const listData = await listRes.json();
    const files = listData.files || [];

    if (files.length === 0) {
      showToast('No backup files found inside "LockedInBackups" on Drive.', 'info');
      return;
    }

    const driveListEl = document.getElementById('driveFilesList');
    if (!driveListEl) return;
    driveListEl.innerHTML = '';

    files.forEach(f => {
      const btn = document.createElement('button');
      btn.className = 'btn-secondary';
      btn.style.cssText = 'text-align: left; display: flex; justify-content: space-between; align-items: center; width: 100%; padding: 10px 14px;';
      btn.innerHTML = `
        <div>
          <strong style="font-size: 0.88rem;">${escapeHtml(f.name)}</strong>
          <div class="text-muted" style="font-size: 0.75rem;">Created: ${new Date(f.createdTime).toLocaleString()}</div>
        </div>
        <span class="text-primary font-heading" style="font-weight: 600; font-size: 0.82rem;">Select</span>
      `;

      btn.addEventListener('click', async () => {
        closeModal('driveRestoreModal');
        showToast('Downloading backup from Drive...', 'info');
        const dlRes = await fetch(`https://www.googleapis.com/drive/v3/files/${f.id}?alt=media`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const content = await dlRes.text();
        promptRestorePassphrase(content);
      });

      driveListEl.appendChild(btn);
    });

    openModal('driveRestoreModal');
  }

  LockedIn.drive = {
    getGoogleClientId,
    saveToGoogleDrive,
    uploadBackupToDrive,
    restoreFromGoogleDrive,
    listAndSelectDriveBackups
  };
})();
