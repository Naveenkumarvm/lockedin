/**
 * Locked In - UI Helpers Module
 * Modal management, toast notifications, DOM sanitization helpers
 */

(function () {
  'use strict';

  window.LockedIn = window.LockedIn || {};

  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
  }

  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
  }

  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function clearDecryptedDisplay() {
    const blocksContainer = document.getElementById('blocksListContainer');
    if (blocksContainer) blocksContainer.innerHTML = '';

    const todayLearnings = document.getElementById('todayLearningsContainer');
    if (todayLearnings) todayLearnings.innerHTML = '';

    const tbody = document.getElementById('learningLogTableBody');
    if (tbody) tbody.innerHTML = '';

    const chartBars = document.getElementById('chartBarsWrap');
    if (chartBars) chartBars.innerHTML = '';

    const topicsList = document.getElementById('reportTopicsList');
    if (topicsList) topicsList.innerHTML = '';

    const timetableList = document.getElementById('timetableBlocksList');
    if (timetableList) timetableList.innerHTML = '';
  }

  function updateProfileUI() {
    const { state } = LockedIn;
    const nameEl = document.getElementById('topProfileName');
    if (nameEl) {
      nameEl.textContent = state.profileInfo.name || (state.activeProfileMeta ? state.activeProfileMeta.name : 'User');
    }
  }

  LockedIn.ui = {
    openModal,
    closeModal,
    showToast,
    downloadBlob,
    clearDecryptedDisplay,
    updateProfileUI
  };
})();
