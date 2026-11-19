/**
 * Locked In - State & Time Utilities Module
 * Central in-memory state and pure date/time calculation functions
 */

(function () {
  'use strict';

  window.LockedIn = window.LockedIn || {};

  const CONFIG = window.LOCKEDIN_CONFIG || {
    GOOGLE_CLIENT_ID: "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com",
    APP_NAME: "Locked In",
    VERSION: "1.0.0"
  };

  const DB_NAME = 'lockedin_pwa_db';
  const DB_VERSION = 1;
  const INACTIVITY_LOCK_MS = 2 * 60 * 1000; // 2 minutes

  // Sample Timetable as specified in requirements
  const DEFAULT_SAMPLE_TIMETABLE = {
    mon_sat: [
      { id: 'ms-1', start: '06:15', end: '06:30', title: 'Wake Up & Fresh Up', note: 'Hydrate & morning routine', type: 'routine', alarm: true },
      { id: 'ms-2', start: '06:30', end: '07:45', title: 'Morning Study', note: 'Deep focus study block', type: 'study', alarm: true },
      { id: 'ms-3', start: '07:45', end: '08:00', title: 'Break', note: 'Stretch and relax', type: 'break', alarm: true },
      { id: 'ms-4', start: '08:00', end: '18:30', title: 'Bath, Breakfast & Office', note: 'Office workday and meals', type: 'routine', alarm: true },
      { id: 'ms-5', start: '18:30', end: '19:45', title: 'Travel & Dinner', note: 'Commute and healthy dinner', type: 'routine', alarm: false },
      { id: 'ms-6', start: '19:45', end: '21:00', title: 'Free Time & Partner Time', note: 'Unwind and connect', type: 'routine', alarm: false },
      { id: 'ms-7', start: '21:00', end: '22:15', title: 'Night Study', note: 'Revision & practice', type: 'study', alarm: true },
      { id: 'ms-8', start: '22:15', end: '22:30', title: 'Sleep Prep', note: 'Screen off & read', type: 'routine', alarm: true },
      { id: 'ms-9', start: '22:30', end: '06:15', title: 'Sleep', note: '7h 45m deep sleep', type: 'sleep', alarm: false }
    ],
    sunday: [
      { id: 'su-1', start: '07:30', end: '08:30', title: 'Wake Up', note: 'Relaxed Sunday morning wake up', type: 'routine', alarm: true },
      { id: 'su-2', start: '08:30', end: '10:30', title: 'Weekly Revision', note: 'Review notes and practice tests', type: 'study', alarm: true },
      { id: 'su-3', start: '10:30', end: '20:30', title: 'Full Free & Relax', note: 'Free time, hobbies, rest', type: 'routine', alarm: false },
      { id: 'su-4', start: '20:30', end: '21:30', title: 'Weekly Planning', note: 'Plan targets for next week', type: 'study', alarm: true },
      { id: 'su-5', start: '22:15', end: '06:15', title: 'Sleep', note: 'Deep restful sleep', type: 'sleep', alarm: false }
    ]
  };

  // Central Application State
  const state = {
    db: null,
    activeProfileId: null,
    activeProfileMeta: null,
    derivedKey: null, // CryptoKey in memory only
    isLocked: true,

    // Active Profile Decrypted Data
    profileInfo: { name: '', email: '', created_at: '', last_backup: null },
    timetable: { mon_sat: [], sunday: [] },
    dailyLogs: {}, // date -> { completed: [blockId, ...] }
    learningLogs: [], // [ { id, date, session, topic, notes, minutes, created_at } ]

    // View state
    selectedDate: '', // initialized below
    currentTab: 'tab-today',
    timetableEditDayType: 'mon_sat',
    learningSessionChoice: 'Morning',
    alarmsArmed: true,
    wakeLockActive: false,
    wakeLockObj: null,

    // PIN lock state
    pinInputDigits: '',
    failedPinAttempts: 0,
    lockoutUntil: 0,
    lastBackgroundTimestamp: null,

    // Alarm checking
    lastAlarmFiredKey: null,
    snoozedAlarms: [], // [ { block, expireTimestamp } ]
    activeAlarmBlock: null,

    // Google Identity in-memory token
    googleAccessToken: null,

    // Restore state
    pendingRestoreData: null,

    // File System Access Handle (laptop Chrome)
    fsDirHandle: null
  };

  // Date & Time Helpers
  function getTodayString() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function parseDateString(dateStr) {
    const parts = dateStr.split('-');
    return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  }

  function formatDateFriendly(dateStr) {
    const d = parseDateString(dateStr);
    const todayStr = getTodayString();
    const options = { weekday: 'short', month: 'short', day: 'numeric' };
    const formatted = d.toLocaleDateString(undefined, options);

    if (dateStr === todayStr) {
      return `Today, ${formatted}`;
    }
    return formatted;
  }

  function timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }

  function calculateBlockDurationMinutes(startStr, endStr) {
    const startM = timeToMinutes(startStr);
    const endM = timeToMinutes(endStr);
    if (endM < startM) {
      return (24 * 60 - startM) + endM;
    }
    return endM - startM;
  }

  function formatDurationMinutes(totalMinutes) {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }

  function isSunday(dateStr) {
    const d = parseDateString(dateStr);
    return d.getDay() === 0;
  }

  function getActiveDayTimetable(dateStr) {
    if (isSunday(dateStr)) {
      return state.timetable.sunday || [];
    }
    return state.timetable.mon_sat || [];
  }

  state.selectedDate = getTodayString();

  LockedIn.CONFIG = CONFIG;
  LockedIn.DB_NAME = DB_NAME;
  LockedIn.DB_VERSION = DB_VERSION;
  LockedIn.INACTIVITY_LOCK_MS = INACTIVITY_LOCK_MS;
  LockedIn.DEFAULT_SAMPLE_TIMETABLE = DEFAULT_SAMPLE_TIMETABLE;
  LockedIn.state = state;
  LockedIn.time = {
    getTodayString,
    parseDateString,
    formatDateFriendly,
    timeToMinutes,
    calculateBlockDurationMinutes,
    formatDurationMinutes,
    isSunday,
    getActiveDayTimetable
  };
})();
