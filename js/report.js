/**
 * Locked In - Weekly Report & Analytics Module
 * 7-day completion bar chart, 80%+ threshold colors, streak & topic summaries
 */

(function () {
  'use strict';

  window.LockedIn = window.LockedIn || {};

  function renderReportTab() {
    const { state } = LockedIn;
    const { formatDurationMinutes } = LockedIn.time;
    const { escapeHtml } = LockedIn.crypto;
    const { calculateDayStats, calculate80PercentStreak } = LockedIn.today;

    if (state.isLocked) return;

    const barsWrap = document.getElementById('chartBarsWrap');
    if (!barsWrap) return;
    barsWrap.innerHTML = '';

    const now = new Date();
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dateNum = String(d.getDate()).padStart(2, '0');
      const dateKey = `${y}-${m}-${dateNum}`;
      const dayName = i === 0 ? 'Today' : d.toLocaleDateString(undefined, { weekday: 'short' });
      days.push({ key: dateKey, label: dayName, dateObj: d });
    }

    let totalPercentSum = 0;
    let totalStudyMinutesSum = 0;
    let bestDayObj = null;
    let bestPercent = -1;

    days.forEach(day => {
      const stats = calculateDayStats(day.key);
      totalPercentSum += stats.percent;
      totalStudyMinutesSum += stats.studyMinutes;

      if (stats.percent > bestPercent) {
        bestPercent = stats.percent;
        bestDayObj = { label: day.label, key: day.key, percent: stats.percent };
      }

      const col = document.createElement('div');
      col.className = 'chart-col';

      const barHeightPct = Math.max(stats.percent, 4);
      const isHighScore = stats.percent >= 80;

      col.innerHTML = `
        <span class="chart-pct-label">${stats.percent}%</span>
        <div class="chart-bar ${isHighScore ? 'high-score' : ''}" style="height: ${barHeightPct}%;" title="${day.label} (${day.key}): ${stats.percent}% (${stats.completedCount}/${stats.totalTickable} blocks)"></div>
        <span class="chart-day-label">${escapeHtml(day.label)}</span>
      `;

      barsWrap.appendChild(col);
    });

    const avgPercent = Math.round(totalPercentSum / 7);
    const streak = calculate80PercentStreak();

    const avgEl = document.getElementById('reportAvgPercent');
    const totalStudyEl = document.getElementById('reportTotalStudy');
    const streakEl = document.getElementById('reportStreak');
    const bestDayEl = document.getElementById('reportBestDay');
    const bestDaySubEl = document.getElementById('reportBestDaySub');

    if (avgEl) avgEl.textContent = `${avgPercent}%`;
    if (totalStudyEl) totalStudyEl.textContent = formatDurationMinutes(totalStudyMinutesSum);
    if (streakEl) streakEl.textContent = `${streak} ${streak === 1 ? 'day' : 'days'}`;

    if (bestDayEl) {
      if (bestDayObj && bestPercent > 0) {
        bestDayEl.textContent = `${bestDayObj.label} (${bestPercent}%)`;
        if (bestDaySubEl) bestDaySubEl.textContent = bestDayObj.key;
      } else {
        bestDayEl.textContent = '--';
        if (bestDaySubEl) bestDaySubEl.textContent = 'No study completed yet';
      }
    }

    renderReportTopics();
  }

  function renderReportTopics() {
    const { state } = LockedIn;
    const { formatDurationMinutes } = LockedIn.time;
    const { escapeHtml } = LockedIn.crypto;

    const listEl = document.getElementById('reportTopicsList');
    const countEl = document.getElementById('reportTopicCount');
    if (!listEl) return;
    listEl.innerHTML = '';

    const logs = state.learningLogs || [];
    const topicMap = {};

    logs.forEach(e => {
      const t = (e.topic || '').trim();
      if (!t) return;
      if (!topicMap[t]) {
        topicMap[t] = { topic: t, totalMin: 0, sessions: 0 };
      }
      topicMap[t].totalMin += (e.minutes || 0);
      topicMap[t].sessions++;
    });

    const topicsArr = Object.values(topicMap).sort((a, b) => b.totalMin - a.totalMin);

    if (countEl) countEl.textContent = `${topicsArr.length} ${topicsArr.length === 1 ? 'topic' : 'topics'}`;

    if (topicsArr.length === 0) {
      listEl.innerHTML = '<div class="text-muted" style="font-size: 0.85rem; padding: 10px 0;">No learning topics recorded yet. Log your studies in the Today tab!</div>';
      return;
    }

    topicsArr.forEach(t => {
      const row = document.createElement('div');
      row.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background-color: var(--color-surface-subtle); border-radius: var(--radius-sm); border: 1px solid var(--color-border-subtle);';
      row.innerHTML = `
        <div>
          <strong style="font-size: 0.9rem;">${escapeHtml(t.topic)}</strong>
          <span class="text-muted" style="font-size: 0.75rem; margin-left: 6px;">(${t.sessions} ${t.sessions === 1 ? 'session' : 'sessions'})</span>
        </div>
        <span class="text-primary font-heading" style="font-weight: 700; font-size: 0.9rem;">${formatDurationMinutes(t.totalMin)}</span>
      `;
      listEl.appendChild(row);
    });
  }

  LockedIn.report = {
    renderReportTab,
    renderReportTopics
  };
})();
