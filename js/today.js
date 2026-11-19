/**
 * Locked In - Today Checklist & Progress Module
 * Daily routine tracker, progress ring, 80%+ streak, and learning log input
 */

(function () {
  'use strict';

  window.LockedIn = window.LockedIn || {};

  function calculateDayStats(dateStr) {
    const { state } = LockedIn;
    const { getActiveDayTimetable, calculateBlockDurationMinutes } = LockedIn.time;

    const blocks = getActiveDayTimetable(dateStr);
    const tickableBlocks = blocks.filter(b => b.type !== 'sleep');
    const dayLog = state.dailyLogs[dateStr] || { completed: [] };
    const completedSet = new Set(dayLog.completed || []);

    let completedTickableCount = 0;
    let completedStudyMinutes = 0;

    for (const b of blocks) {
      if (completedSet.has(b.id)) {
        if (b.type !== 'sleep') {
          completedTickableCount++;
        }
        if (b.type === 'study') {
          completedStudyMinutes += calculateBlockDurationMinutes(b.start, b.end);
        }
      }
    }

    const percent = tickableBlocks.length > 0
      ? Math.round((completedTickableCount / tickableBlocks.length) * 100)
      : 0;

    return {
      totalTickable: tickableBlocks.length,
      completedCount: completedTickableCount,
      percent: percent,
      studyMinutes: completedStudyMinutes
    };
  }

  function calculate80PercentStreak() {
    const { state } = LockedIn;
    const { getTodayString } = LockedIn.time;

    let streak = 0;
    const now = new Date();
    const todayStr = getTodayString();
    const todayStats = calculateDayStats(todayStr);

    let checkDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (todayStats.percent >= 80) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      checkDate.setDate(checkDate.getDate() - 1);
    }

    while (true) {
      const y = checkDate.getFullYear();
      const m = String(checkDate.getMonth() + 1).padStart(2, '0');
      const d = String(checkDate.getDate()).padStart(2, '0');
      const dateKey = `${y}-${m}-${d}`;

      if (!state.dailyLogs[dateKey]) break;

      const stats = calculateDayStats(dateKey);
      if (stats.percent >= 80) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  }

  function renderTodayTab() {
    const { state } = LockedIn;
    const { getTodayString, formatDateFriendly, formatDurationMinutes, isSunday } = LockedIn.time;

    if (state.isLocked) return;

    const dateStr = state.selectedDate;
    const stats = calculateDayStats(dateStr);
    const streak = calculate80PercentStreak();

    const dateMainEl = document.getElementById('dateDisplayMain');
    const dateSubEl = document.getElementById('dateDisplaySub');
    if (dateMainEl) dateMainEl.textContent = formatDateFriendly(dateStr);
    if (dateSubEl) {
      dateSubEl.textContent = dateStr === getTodayString() ? 'Today' : 'Click to jump to Today';
    }

    const dayTypeTagEl = document.getElementById('scheduleDayTypeTag');
    if (dayTypeTagEl) {
      dayTypeTagEl.textContent = isSunday(dateStr) ? 'Sunday Routine' : 'Mon – Sat Routine';
    }

    const ringCircle = document.getElementById('todayProgressCircle');
    const percentEl = document.getElementById('todayProgressPercent');
    const circumference = 301.59;
    const offset = circumference - (stats.percent / 100) * circumference;

    if (ringCircle) {
      ringCircle.style.strokeDashoffset = offset;
      if (stats.percent >= 80) {
        ringCircle.classList.add('success');
      } else {
        ringCircle.classList.remove('success');
      }
    }
    if (percentEl) {
      percentEl.textContent = `${stats.percent}%`;
    }

    const statBlocksDoneEl = document.getElementById('statBlocksDone');
    const statStudyTimeEl = document.getElementById('statStudyTime');
    const statStreakEl = document.getElementById('statStreak');

    if (statBlocksDoneEl) statBlocksDoneEl.textContent = `${stats.completedCount} / ${stats.totalTickable}`;
    if (statStudyTimeEl) statStudyTimeEl.textContent = formatDurationMinutes(stats.studyMinutes);
    if (statStreakEl) statStreakEl.textContent = `${streak}🔥`;

    renderBlocksList(dateStr);
    renderTodayLearnings(dateStr);
    updateNowNextBanner();
  }

  function renderBlocksList(dateStr) {
    const { state } = LockedIn;
    const { getActiveDayTimetable, getTodayString, timeToMinutes, calculateBlockDurationMinutes, formatDurationMinutes } = LockedIn.time;
    const { escapeHtml } = LockedIn.crypto;

    const container = document.getElementById('blocksListContainer');
    if (!container) return;
    container.innerHTML = '';

    const blocks = getActiveDayTimetable(dateStr);
    const dayLog = state.dailyLogs[dateStr] || { completed: [] };
    const completedSet = new Set(dayLog.completed || []);
    const isToday = dateStr === getTodayString();

    const nowMinutes = (() => {
      const n = new Date();
      return n.getHours() * 60 + n.getMinutes();
    })();

    if (blocks.length === 0) {
      container.innerHTML = `
        <div class="card" style="text-align: center; color: var(--color-text-muted); padding: 24px;">
          No schedule blocks defined. Head over to the Timetable tab to add blocks or reset to sample routine.
        </div>
      `;
      return;
    }

    blocks.forEach((block) => {
      const isDone = completedSet.has(block.id);
      const startM = timeToMinutes(block.start);
      const endM = timeToMinutes(block.end);
      const durationM = calculateBlockDurationMinutes(block.start, block.end);

      let isCurrent = false;
      if (isToday) {
        if (endM < startM) {
          isCurrent = nowMinutes >= startM || nowMinutes < endM;
        } else {
          isCurrent = nowMinutes >= startM && nowMinutes < endM;
        }
      }

      const card = document.createElement('div');
      card.className = `block-card ${isDone ? 'is-done' : ''} ${isCurrent ? 'is-now' : ''}`;

      let nowTagHtml = isCurrent ? '<span class="block-now-tag">NOW</span>' : '';
      let alarmActiveClass = block.alarm ? 'alarm-active' : '';

      let tickButtonHtml = '';
      if (block.type !== 'sleep') {
        tickButtonHtml = `
          <button class="block-tick-btn ${isDone ? 'ticked' : ''}" data-id="${escapeHtml(block.id)}" title="${isDone ? 'Mark Incomplete' : 'Mark Done'}">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </button>
        `;
      } else {
        tickButtonHtml = `
          <div style="width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; color: var(--color-text-muted);" title="Sleep block (no checklist)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
          </div>
        `;
      }

      card.innerHTML = `
        ${nowTagHtml}
        <div class="block-time-col">
          <span class="block-time">${escapeHtml(block.start)} - ${escapeHtml(block.end)}</span>
          <span class="block-duration">${formatDurationMinutes(durationM)}</span>
        </div>
        <div class="block-info-col">
          <div class="block-title-row">
            <span class="block-title">${escapeHtml(block.title)}</span>
            <span class="block-type-badge ${escapeHtml(block.type)}">${escapeHtml(block.type)}</span>
          </div>
          ${block.note ? `<div class="block-rule">${escapeHtml(block.note)}</div>` : ''}
        </div>
        <div class="block-actions-col">
          <button class="block-bell-btn ${alarmActiveClass}" data-bell-id="${escapeHtml(block.id)}" title="Toggle In-App Alarm">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
          </button>
          ${tickButtonHtml}
        </div>
      `;

      const tickBtn = card.querySelector('.block-tick-btn');
      if (tickBtn) {
        tickBtn.addEventListener('click', () => toggleBlockDone(block.id));
      }

      const bellBtn = card.querySelector('.block-bell-btn');
      if (bellBtn) {
        bellBtn.addEventListener('click', () => toggleBlockAlarm(block.id));
      }

      container.appendChild(card);
    });
  }

  async function toggleBlockDone(blockId) {
    const { state } = LockedIn;
    const { saveActiveProfileRecord } = LockedIn.storage;

    const dateStr = state.selectedDate;
    if (!state.dailyLogs[dateStr]) {
      state.dailyLogs[dateStr] = { completed: [] };
    }

    const completed = state.dailyLogs[dateStr].completed || [];
    const index = completed.indexOf(blockId);

    if (index > -1) {
      completed.splice(index, 1);
    } else {
      completed.push(blockId);
      if (LockedIn.alarms && LockedIn.alarms.playPositiveTick) {
        LockedIn.alarms.playPositiveTick();
      }
    }

    state.dailyLogs[dateStr].completed = completed;
    await saveActiveProfileRecord('daily_logs', state.dailyLogs);
    renderTodayTab();
    if (LockedIn.report && LockedIn.report.renderReportTab) {
      LockedIn.report.renderReportTab();
    }
  }

  async function toggleBlockAlarm(blockId) {
    const { state } = LockedIn;
    const { isSunday } = LockedIn.time;
    const { saveActiveProfileRecord } = LockedIn.storage;
    const { showToast } = LockedIn.ui;

    const dayType = isSunday(state.selectedDate) ? 'sunday' : 'mon_sat';
    const blockList = state.timetable[dayType] || [];
    const block = blockList.find(b => b.id === blockId);
    if (block) {
      block.alarm = !block.alarm;
      await saveActiveProfileRecord('timetable', state.timetable);
      if (block.alarm && 'Notification' in window && Notification.permission === 'default') {
        showToast('Enable notifications to receive alerts when study blocks start.', 'info');
        if (LockedIn.alarms && LockedIn.alarms.requestNotificationPermission) {
          await LockedIn.alarms.requestNotificationPermission();
        }
      }
      renderTodayTab();
      if (LockedIn.timetable && LockedIn.timetable.renderTimetableTab) {
        LockedIn.timetable.renderTimetableTab();
      }
      showToast(`Alarm for "${block.title}" ${block.alarm ? 'enabled' : 'disabled'}.`, 'info');
    }
  }

  function updateNowNextBanner() {
    const { getTodayString, getActiveDayTimetable, timeToMinutes } = LockedIn.time;

    const nowTitleEl = document.getElementById('nowTitle');
    const nowRemainingEl = document.getElementById('nowRemaining');
    const nextTitleEl = document.getElementById('nextTitle');
    const nextTimeEl = document.getElementById('nextTime');

    if (!nowTitleEl || !nextTitleEl) return;

    const todayStr = getTodayString();
    const blocks = getActiveDayTimetable(todayStr);

    if (blocks.length === 0) {
      nowTitleEl.textContent = 'No schedule blocks set';
      nowRemainingEl.textContent = '';
      nextTitleEl.textContent = 'Set blocks in Timetable';
      nextTimeEl.textContent = '';
      return;
    }

    const n = new Date();
    const currentM = n.getHours() * 60 + n.getMinutes();

    let currentBlock = null;
    let nextBlock = null;

    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      const startM = timeToMinutes(b.start);
      const endM = timeToMinutes(b.end);

      let inBlock = false;
      if (endM < startM) {
        inBlock = currentM >= startM || currentM < endM;
      } else {
        inBlock = currentM >= startM && currentM < endM;
      }

      if (inBlock) {
        currentBlock = b;
        nextBlock = blocks[(i + 1) % blocks.length];
        break;
      }
    }

    if (currentBlock) {
      nowTitleEl.textContent = currentBlock.title;
      const endM = timeToMinutes(currentBlock.end);
      let remM = 0;
      if (endM < currentM) {
        remM = (24 * 60 - currentM) + endM;
      } else {
        remM = endM - currentM;
      }
      nowRemainingEl.textContent = `ends in ${remM}m`;

      if (nextBlock) {
        nextTitleEl.textContent = nextBlock.title;
        nextTimeEl.textContent = `at ${nextBlock.start}`;
      }
    } else {
      let upcoming = null;
      let minDiff = Infinity;

      for (const b of blocks) {
        const startM = timeToMinutes(b.start);
        let diff = startM - currentM;
        if (diff < 0) diff += 24 * 60;
        if (diff < minDiff) {
          minDiff = diff;
          upcoming = b;
        }
      }

      nowTitleEl.textContent = 'Between scheduled blocks';
      nowRemainingEl.textContent = '';

      if (upcoming) {
        nextTitleEl.textContent = upcoming.title;
        nextTimeEl.textContent = `starts in ${minDiff}m (${upcoming.start})`;
      } else {
        nextTitleEl.textContent = 'All blocks complete';
        nextTimeEl.textContent = '';
      }
    }
  }

  function renderTodayLearnings(dateStr) {
    const { state } = LockedIn;
    const { escapeHtml } = LockedIn.crypto;

    const container = document.getElementById('todayLearningsContainer');
    if (!container) return;
    container.innerHTML = '';

    const todayEntries = (state.learningLogs || []).filter(item => item.date === dateStr);

    if (todayEntries.length === 0) {
      container.innerHTML = '<div style="font-size: 0.8rem; color: var(--color-text-muted); padding: 4px 0;">No learning notes logged for this date yet.</div>';
      return;
    }

    todayEntries.forEach(entry => {
      const itemEl = document.createElement('div');
      itemEl.className = 'learning-item';
      itemEl.innerHTML = `
        <div class="learning-item-body">
          <div class="learning-item-header">
            <span class="learning-item-topic">${escapeHtml(entry.topic)}</span>
            <span class="learning-item-session">${escapeHtml(entry.session)}</span>
          </div>
          ${entry.notes ? `<div class="learning-item-notes">${escapeHtml(entry.notes)}</div>` : ''}
          <div class="learning-item-meta">${escapeHtml(String(entry.minutes))} minutes</div>
        </div>
        <button class="delete-btn-subtle" title="Delete note" data-entry-id="${escapeHtml(entry.id)}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      `;

      itemEl.querySelector('.delete-btn-subtle').addEventListener('click', () => {
        deleteLearningEntry(entry.id);
      });

      container.appendChild(itemEl);
    });
  }

  async function addLearningEntry(topic, session, notes, minutes) {
    const { state } = LockedIn;
    const { saveActiveProfileRecord } = LockedIn.storage;
    const { showToast } = LockedIn.ui;

    const entry = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      date: state.selectedDate,
      session: session,
      topic: topic.trim(),
      notes: notes.trim(),
      minutes: parseInt(minutes, 10) || 0,
      created_at: new Date().toISOString()
    };

    state.learningLogs.unshift(entry);
    await saveActiveProfileRecord('learning_logs', state.learningLogs);

    renderTodayTab();
    if (LockedIn.learningLog && LockedIn.learningLog.renderLearningLogTab) {
      LockedIn.learningLog.renderLearningLogTab();
    }
    if (LockedIn.report && LockedIn.report.renderReportTab) {
      LockedIn.report.renderReportTab();
    }
    showToast('Learning note saved', 'success');
  }

  async function deleteLearningEntry(id) {
    const { state } = LockedIn;
    const { saveActiveProfileRecord } = LockedIn.storage;
    const { showToast } = LockedIn.ui;

    state.learningLogs = state.learningLogs.filter(item => item.id !== id);
    await saveActiveProfileRecord('learning_logs', state.learningLogs);

    renderTodayTab();
    if (LockedIn.learningLog && LockedIn.learningLog.renderLearningLogTab) {
      LockedIn.learningLog.renderLearningLogTab();
    }
    if (LockedIn.report && LockedIn.report.renderReportTab) {
      LockedIn.report.renderReportTab();
    }
    showToast('Note deleted', 'info');
  }

  LockedIn.today = {
    calculateDayStats,
    calculate80PercentStreak,
    renderTodayTab,
    renderBlocksList,
    toggleBlockDone,
    toggleBlockAlarm,
    updateNowNextBanner,
    renderTodayLearnings,
    addLearningEntry,
    deleteLearningEntry
  };
})();
