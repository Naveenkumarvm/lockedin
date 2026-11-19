/**
 * Locked In - Timetable & Calendar Export Module
 * Schedule editor (Mon-Sat & Sunday), block configuration, and recurring RFC 5545 .ics generation
 */

(function () {
  'use strict';

  window.LockedIn = window.LockedIn || {};

  function renderTimetableTab() {
    const { state } = LockedIn;
    const { timeToMinutes, calculateBlockDurationMinutes, formatDurationMinutes } = LockedIn.time;
    const { escapeHtml } = LockedIn.crypto;

    if (state.isLocked) return;

    const dayType = state.timetableEditDayType;
    const blocks = state.timetable[dayType] || [];
    const container = document.getElementById('timetableBlocksList');

    const monSatBtn = document.getElementById('switchMonSatBtn');
    const sunBtn = document.getElementById('switchSunBtn');

    if (monSatBtn) monSatBtn.classList.toggle('active', dayType === 'mon_sat');
    if (sunBtn) sunBtn.classList.toggle('active', dayType === 'sunday');

    if (!container) return;
    container.innerHTML = '';

    if (blocks.length === 0) {
      container.innerHTML = `
        <div class="card" style="text-align: center; color: var(--color-text-muted); padding: 20px;">
          No blocks for this schedule. Click "Add Block" or "Reset to Sample Routine".
        </div>
      `;
      return;
    }

    blocks.sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));

    const isAndroid = /android/i.test(navigator.userAgent);

    blocks.forEach((block, idx) => {
      const card = document.createElement('div');
      card.className = 'timetable-item-card';

      const durationM = calculateBlockDurationMinutes(block.start, block.end);
      const alarmIconColor = block.alarm ? 'var(--color-primary)' : 'var(--color-text-muted)';

      card.innerHTML = `
        <div class="timetable-item-info">
          <div class="timetable-item-time">
            <span>${escapeHtml(block.start)} - ${escapeHtml(block.end)}</span>
            <span class="text-muted" style="font-size: 0.75rem; font-weight: normal;">(${formatDurationMinutes(durationM)})</span>
            <span class="block-type-badge ${escapeHtml(block.type)}">${escapeHtml(block.type)}</span>
            ${block.alarm ? `<span title="Alarm Armed" style="color: ${alarmIconColor};">🔔</span>` : ''}
          </div>
          <div class="timetable-item-title">${escapeHtml(block.title)}</div>
          ${block.note ? `<div class="timetable-item-note">${escapeHtml(block.note)}</div>` : ''}
        </div>
        <div class="timetable-item-actions">
          ${isAndroid && block.alarm ? `
            <button class="icon-btn-subtle clock-alarm" data-idx="${idx}" title="Set Android Clock Alarm" aria-label="Set Clock Alarm">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            </button>
          ` : ''}
          <button class="icon-btn-subtle edit" data-idx="${idx}" title="Edit Block">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
          <button class="icon-btn-subtle delete" data-idx="${idx}" title="Delete Block">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      `;

      if (isAndroid && block.alarm) {
        const clockBtn = card.querySelector('.icon-btn-subtle.clock-alarm');
        if (clockBtn) clockBtn.addEventListener('click', () => triggerAndroidClockAlarm(block));
      }
      card.querySelector('.icon-btn-subtle.edit').addEventListener('click', () => openBlockEditModal(dayType, block));
      card.querySelector('.icon-btn-subtle.delete').addEventListener('click', () => deleteTimetableBlock(dayType, block.id));

      container.appendChild(card);
    });

    if (LockedIn.alarms && LockedIn.alarms.updateAlarmHealthUI) {
      LockedIn.alarms.updateAlarmHealthUI();
    }

    if (LockedIn.backup && LockedIn.backup.updateBackupStatusUI) {
      LockedIn.backup.updateBackupStatusUI();
    }
  }

  function triggerAndroidClockAlarm(block) {
    const [h, m] = block.start.split(':');
    const hour = parseInt(h, 10);
    const minutes = parseInt(m, 10);
    const title = encodeURIComponent(block.title);
    const intentUrl = `intent:#Intent;action=android.intent.action.SET_ALARM;i.android.intent.extra.HOUR=${hour};i.android.intent.extra.MINUTES=${minutes};s.android.intent.extra.MESSAGE=${title};b.android.intent.extra.SKIP_UI=true;end`;

    try {
      window.location.href = intentUrl;
      LockedIn.ui.showToast(`Requesting alarm for ${block.start} in Android Clock...`, 'info');
    } catch (e) {
      console.warn('Android clock alarm intent blocked:', e);
      LockedIn.ui.showToast('Clock intent blocked by Android Chrome policy. Please use "Add all alarms to my phone calendar".', 'info');
    }
  }

  function openBlockEditModal(dayType, block = null) {
    const { openModal } = LockedIn.ui;

    const modalTitle = document.getElementById('blockEditModalTitle');
    const idInput = document.getElementById('blockEditId');
    const dayTypeInput = document.getElementById('blockEditDayType');
    const startInput = document.getElementById('blockStartTime');
    const endInput = document.getElementById('blockEndTime');
    const titleInput = document.getElementById('blockTitle');
    const notesInput = document.getElementById('blockNotes');
    const typeSelect = document.getElementById('blockType');
    const alarmCheckbox = document.getElementById('blockAlarmEnabled');

    dayTypeInput.value = dayType;

    if (block) {
      if (modalTitle) modalTitle.textContent = 'Edit Timetable Block';
      idInput.value = block.id;
      startInput.value = block.start;
      endInput.value = block.end;
      titleInput.value = block.title;
      notesInput.value = block.note || '';
      typeSelect.value = block.type;
      alarmCheckbox.checked = !!block.alarm;
    } else {
      if (modalTitle) modalTitle.textContent = 'Add Timetable Block';
      idInput.value = '';
      startInput.value = '08:00';
      endInput.value = '09:00';
      titleInput.value = '';
      notesInput.value = '';
      typeSelect.value = 'study';
      alarmCheckbox.checked = true;
    }

    openModal('blockEditModal');
  }

  async function saveTimetableBlockFromForm(e) {
    e.preventDefault();
    const { state } = LockedIn;
    const { saveActiveProfileRecord } = LockedIn.storage;
    const { closeModal, showToast } = LockedIn.ui;

    const idInput = document.getElementById('blockEditId');
    const dayTypeInput = document.getElementById('blockEditDayType');
    const startInput = document.getElementById('blockStartTime');
    const endInput = document.getElementById('blockEndTime');
    const titleInput = document.getElementById('blockTitle');
    const notesInput = document.getElementById('blockNotes');
    const typeSelect = document.getElementById('blockType');
    const alarmCheckbox = document.getElementById('blockAlarmEnabled');

    const dayType = dayTypeInput.value || 'mon_sat';
    const isEdit = !!idInput.value;
    const blockId = idInput.value || `block_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const newBlock = {
      id: blockId,
      start: startInput.value,
      end: endInput.value,
      title: titleInput.value.trim(),
      note: notesInput.value.trim(),
      type: typeSelect.value,
      alarm: alarmCheckbox.checked
    };

    if (newBlock.alarm && 'Notification' in window && Notification.permission === 'default') {
      if (LockedIn.alarms && LockedIn.alarms.requestNotificationPermission) {
        await LockedIn.alarms.requestNotificationPermission();
      }
    }

    if (!state.timetable[dayType]) {
      state.timetable[dayType] = [];
    }

    if (isEdit) {
      const idx = state.timetable[dayType].findIndex(b => b.id === blockId);
      if (idx > -1) {
        state.timetable[dayType][idx] = newBlock;
      }
    } else {
      state.timetable[dayType].push(newBlock);
    }

    await saveActiveProfileRecord('timetable', state.timetable);
    closeModal('blockEditModal');
    renderTimetableTab();
    if (LockedIn.today && LockedIn.today.renderTodayTab) {
      LockedIn.today.renderTodayTab();
    }
    showToast(isEdit ? 'Block updated.' : 'Block added.', 'success');
  }

  async function deleteTimetableBlock(dayType, blockId) {
    const { state } = LockedIn;
    const { saveActiveProfileRecord } = LockedIn.storage;
    const { showToast } = LockedIn.ui;

    if (!confirm('Are you sure you want to delete this block?')) return;

    if (state.timetable[dayType]) {
      state.timetable[dayType] = state.timetable[dayType].filter(b => b.id !== blockId);
      await saveActiveProfileRecord('timetable', state.timetable);
      renderTimetableTab();
      if (LockedIn.today && LockedIn.today.renderTodayTab) {
        LockedIn.today.renderTodayTab();
      }
      showToast('Block deleted.', 'info');
    }
  }

  async function resetTimetableToSample() {
    const { state } = LockedIn;
    const { getSampleTimetable } = LockedIn.state;
    const { saveActiveProfileRecord } = LockedIn.storage;
    const { showToast } = LockedIn.ui;

    if (!confirm('Reset schedule to the default sample routine? Custom blocks will be replaced.')) return;

    state.timetable = getSampleTimetable();
    await saveActiveProfileRecord('timetable', state.timetable);
    renderTimetableTab();
    if (LockedIn.today && LockedIn.today.renderTodayTab) {
      LockedIn.today.renderTodayTab();
    }
    showToast('Timetable reset to sample routine.', 'success');
  }

  function exportToCalendarIcs() {
    const { state } = LockedIn;
    const { timeToMinutes } = LockedIn.time;
    const { downloadBlob, showToast } = LockedIn.ui;

    let monSatBlocks = (state.timetable.mon_sat || []).filter(b => b.alarm);
    let sunBlocks = (state.timetable.sunday || []).filter(b => b.alarm);

    if (monSatBlocks.length === 0 && sunBlocks.length === 0) {
      monSatBlocks = (state.timetable.mon_sat || []).filter(b => b.type !== 'sleep');
      sunBlocks = (state.timetable.sunday || []).filter(b => b.type !== 'sleep');
    }

    const now = new Date();
    const currentDay = now.getDay();
    const daysUntilNextMon = ((8 - currentDay) % 7) || 7;
    const nextMon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilNextMon);

    const daysUntilNextSun = ((7 - currentDay) % 7) || 7;
    const nextSun = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilNextSun);

    function formatIcsDateTime(baseDate, timeStr, addDays = 0) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() + addDays);
      const parts = timeStr.split(':');
      d.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);

      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      const ss = '00';
      return `${y}${m}${day}T${hh}${mm}${ss}`;
    }

    let ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Locked In//Study Routine Tracker//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Locked In Schedule'
    ];

    monSatBlocks.forEach((b, idx) => {
      const startM = timeToMinutes(b.start);
      const endM = timeToMinutes(b.end);
      const spansMidnight = endM < startM;

      const dtStart = formatIcsDateTime(nextMon, b.start);
      const dtEnd = formatIcsDateTime(nextMon, b.end, spansMidnight ? 1 : 0);

      ics.push(
        'BEGIN:VEVENT',
        `UID:lockedin-ms-${idx}-${b.id}@lockedin.pwa`,
        `SUMMARY:Locked In: ${b.title}`,
        `DESCRIPTION:${b.note || b.title} [Type: ${b.type}]`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR,SA',
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        `DESCRIPTION:Locked In: ${b.title}`,
        'TRIGGER:-PT0M',
        'END:VALARM',
        'END:VEVENT'
      );
    });

    sunBlocks.forEach((b, idx) => {
      const startM = timeToMinutes(b.start);
      const endM = timeToMinutes(b.end);
      const spansMidnight = endM < startM;

      const dtStart = formatIcsDateTime(nextSun, b.start);
      const dtEnd = formatIcsDateTime(nextSun, b.end, spansMidnight ? 1 : 0);

      ics.push(
        'BEGIN:VEVENT',
        `UID:lockedin-su-${idx}-${b.id}@lockedin.pwa`,
        `SUMMARY:Locked In: ${b.title}`,
        `DESCRIPTION:${b.note || b.title} [Type: ${b.type}]`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        'RRULE:FREQ=WEEKLY;BYDAY=SU',
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        `DESCRIPTION:Locked In: ${b.title}`,
        'TRIGGER:-PT0M',
        'END:VALARM',
        'END:VEVENT'
      );
    });

    ics.push('END:VCALENDAR');

    const icsContent = ics.join('\r\n');
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    downloadBlob(blob, 'lockedin.ics');
    showToast('Calendar export downloaded (lockedin.ics)', 'success');
  }

  LockedIn.timetable = {
    renderTimetableTab,
    openBlockEditModal,
    saveTimetableBlockFromForm,
    deleteTimetableBlock,
    resetTimetableToSample,
    exportToCalendarIcs,
    triggerAndroidClockAlarm
  };
})();
