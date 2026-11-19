/**
 * Locked In - Learning Log Module
 * Searchable study journal, total minutes summary, and CSV export
 */

(function () {
  'use strict';

  window.LockedIn = window.LockedIn || {};

  function renderLearningLogTab() {
    const { state } = LockedIn;
    const { formatDurationMinutes } = LockedIn.time;
    const { escapeHtml } = LockedIn.crypto;

    if (state.isLocked) return;

    const searchInput = document.getElementById('logSearchInput');
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

    const tbody = document.getElementById('learningLogTableBody');
    const emptyState = document.getElementById('learningLogEmptyState');
    const totalTimeEl = document.getElementById('logTotalTimeDisplay');
    const countEl = document.getElementById('logEntryCountDisplay');

    if (!tbody) return;
    tbody.innerHTML = '';

    const allEntries = state.learningLogs || [];
    let filtered = allEntries;

    if (query) {
      filtered = allEntries.filter(e =>
        e.topic.toLowerCase().includes(query) ||
        (e.notes && e.notes.toLowerCase().includes(query)) ||
        e.session.toLowerCase().includes(query) ||
        e.date.includes(query)
      );
    }

    const totalMinutes = filtered.reduce((acc, cur) => acc + (cur.minutes || 0), 0);
    if (totalTimeEl) totalTimeEl.textContent = formatDurationMinutes(totalMinutes);
    if (countEl) countEl.textContent = `(${filtered.length} ${filtered.length === 1 ? 'entry' : 'entries'})`;

    if (filtered.length === 0) {
      if (emptyState) emptyState.style.display = 'block';
      return;
    } else {
      if (emptyState) emptyState.style.display = 'none';
    }

    filtered.forEach(e => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="white-space: nowrap; font-weight: 500;">${escapeHtml(e.date)}</td>
        <td><span class="block-type-badge ${e.session === 'Morning' ? 'study' : 'routine'}">${escapeHtml(e.session)}</span></td>
        <td style="font-weight: 600;">${escapeHtml(e.topic)}</td>
        <td style="color: var(--color-text-muted); line-height: 1.4; max-width: 250px;">${escapeHtml(e.notes || '-')}</td>
        <td style="font-weight: 700; white-space: nowrap;">${escapeHtml(String(e.minutes))}m</td>
        <td style="text-align: center;">
          <button class="delete-btn-subtle" data-id="${escapeHtml(e.id)}" title="Delete row">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </td>
      `;

      tr.querySelector('.delete-btn-subtle').addEventListener('click', () => {
        if (LockedIn.today && LockedIn.today.deleteLearningEntry) {
          LockedIn.today.deleteLearningEntry(e.id);
        }
      });

      tbody.appendChild(tr);
    });
  }

  function exportLearningLogCsv() {
    const { state } = LockedIn;
    const { getTodayString } = LockedIn.time;
    const { downloadBlob, showToast } = LockedIn.ui;

    const entries = state.learningLogs || [];
    if (entries.length === 0) {
      showToast('No learning logs to export yet.', 'info');
      return;
    }

    const headers = ['Date', 'Session', 'Topic', 'What I Learned', 'Minutes'];
    const rows = entries.map(e => [
      e.date,
      e.session,
      e.topic,
      e.notes || '',
      e.minutes || 0
    ]);

    const csvContent = [headers, ...rows].map(row =>
      row.map(cell => {
        const text = String(cell).replace(/"/g, '""');
        return `"${text}"`;
      }).join(',')
    ).join('\r\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const filename = `lockedin-learning-log-${getTodayString()}.csv`;
    downloadBlob(blob, filename);
    showToast('Learning log saved as CSV', 'success');
  }

  LockedIn.learningLog = {
    renderLearningLogTab,
    exportLearningLogCsv
  };
})();
