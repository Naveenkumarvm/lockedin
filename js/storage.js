/**
 * Locked In - IndexedDB & Profile Storage Module
 * Encrypted data storage at rest with PBKDF2 + AES-GCM
 */

(function () {
  'use strict';

  window.LockedIn = window.LockedIn || {};

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(LockedIn.DB_NAME, LockedIn.DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('profiles')) {
          db.createObjectStore('profiles', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('encrypted_records')) {
          db.createObjectStore('encrypted_records', { keyPath: ['profileId', 'recordType'] });
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function dbGet(storeName, key) {
    return new Promise((resolve, reject) => {
      const tx = LockedIn.state.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function dbGetAll(storeName) {
    return new Promise((resolve, reject) => {
      const tx = LockedIn.state.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  function dbPut(storeName, value) {
    return new Promise((resolve, reject) => {
      const tx = LockedIn.state.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(value);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function dbDelete(storeName, key) {
    return new Promise((resolve, reject) => {
      const tx = LockedIn.state.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async function requestPersistentStorage() {
    if (navigator.storage && navigator.storage.persist) {
      try {
        await navigator.storage.persist();
      } catch (err) {
        console.warn('Storage persist request error:', err);
      }
    }
  }

  async function saveActiveProfileRecord(recordType, plainObj) {
    const { state } = LockedIn;
    if (!state.activeProfileId || !state.derivedKey) return;
    const encrypted = await LockedIn.crypto.encryptData(state.derivedKey, plainObj);
    await dbPut('encrypted_records', {
      profileId: state.activeProfileId,
      recordType: recordType,
      iv: encrypted.iv,
      ciphertext: encrypted.ciphertext,
      updated_at: new Date().toISOString()
    });
  }

  async function loadActiveProfileRecord(recordType, defaultValue) {
    const { state } = LockedIn;
    if (!state.activeProfileId || !state.derivedKey) return defaultValue;
    try {
      const record = await dbGet('encrypted_records', [state.activeProfileId, recordType]);
      if (!record) return defaultValue;
      return await LockedIn.crypto.decryptData(state.derivedKey, record.iv, record.ciphertext);
    } catch (err) {
      console.error(`Failed to decrypt ${recordType}:`, err);
      return defaultValue;
    }
  }

  LockedIn.storage = {
    openDatabase,
    dbGet,
    dbGetAll,
    dbPut,
    dbDelete,
    requestPersistentStorage,
    saveActiveProfileRecord,
    loadActiveProfileRecord
  };
})();
