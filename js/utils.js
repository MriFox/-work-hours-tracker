/* 全局变量：WHT 命名空间 / state / 常量 / 节假日数据 */
(function() {
  "use strict";
  var W = window;
  var WHT = W.WHT = W.WHT || {};

  // ── 常量 ──
  WHT.APP_PREFIX = 'workHours_';
  WHT.ONE_DAY_MS = 86400000;
  WHT.CHART_MAX_HOURS = 12;
  WHT.MINUTES_PER_DAY = 24 * 60;

  // ── 全局状态 ──
  var state = { users:[], currentUser:null, currentMode:null, currentTab:'record', weekOffset:0, monthOffset:0, quarterIndex:0, quarterYear:new Date().getFullYear(), selectedDay:null, wizardData:{}, wizardStep:0, formDate:null, formStart:'09:00', formEnd:'18:00', formNote:'', formHoliday:false, recordLimit:10 };
  WHT.state = state;

  // ── 法定节假日数据 ──
  WHT.HOLIDAYS = {2024:['2024-01-01','2024-02-10','2024-02-11','2024-02-12','2024-02-13','2024-02-14','2024-02-15','2024-02-16','2024-02-17','2024-04-04','2024-04-05','2024-04-06','2024-05-01','2024-05-02','2024-05-03','2024-05-04','2024-05-05','2024-06-08','2024-06-09','2024-06-10','2024-09-15','2024-09-16','2024-09-17','2024-10-01','2024-10-02','2024-10-03','2024-10-04','2024-10-05','2024-10-06','2024-10-07'],2025:['2025-01-01','2025-01-28','2025-01-29','2025-01-30','2025-01-31','2025-02-01','2025-02-02','2025-02-03','2025-02-04','2025-04-04','2025-04-05','2025-04-06','2025-05-01','2025-05-02','2025-05-03','2025-05-04','2025-05-05','2025-05-31','2025-06-01','2025-06-02','2025-10-01','2025-10-02','2025-10-03','2025-10-04','2025-10-05','2025-10-06','2025-10-07','2025-10-08'],2026:['2026-01-01','2026-01-02','2026-01-03','2026-02-17','2026-02-18','2026-02-19','2026-02-20','2026-02-21','2026-02-22','2026-02-23','2026-04-04','2026-04-05','2026-04-06','2026-05-01','2026-05-02','2026-05-03','2026-05-04','2026-05-05','2026-06-19','2026-06-20','2026-06-21','2026-10-01','2026-10-02','2026-10-03','2026-10-04','2026-10-05','2026-10-06','2026-10-07'],2027:['2027-01-01','2027-01-02','2027-01-03','2027-02-06','2027-02-07','2027-02-08','2027-02-09','2027-02-10','2027-02-11','2027-02-12','2027-02-13','2027-04-03','2027-04-04','2027-04-05','2027-05-01','2027-05-02','2027-05-03','2027-06-12','2027-06-13','2027-06-14','2027-10-01','2027-10-02','2027-10-03','2027-10-04','2027-10-05','2027-10-06','2027-10-07'],2028:['2028-01-01','2028-01-02','2028-01-03','2028-01-26','2028-01-27','2028-01-28','2028-01-29','2028-01-30','2028-01-31','2028-02-01','2028-02-02','2028-02-03','2028-04-04','2028-04-05','2028-04-06','2028-05-01','2028-05-02','2028-05-03','2028-05-04','2028-05-05','2028-06-17','2028-06-18','2028-06-19','2028-09-15','2028-09-16','2028-09-17','2028-10-01','2028-10-02','2028-10-03','2028-10-04','2028-10-05','2028-10-06','2028-10-07']};

  // ── 工具函数 ──

  function genId() { return Date.now().toString(36) + Math.random().toString(36).substr(2,5); }
  function escapeHtml(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function today() { return new Date().toISOString().slice(0,10); }

  function isHoliday(d) {
    if (!state.currentUser) return false;
    var s = WHT.getUserSettings(); // defined in state.js, available at runtime
    if (s.holidays && s.holidays.indexOf(d) >= 0) return true;
    var y = parseInt(d.slice(0,4));
    return WHT.HOLIDAYS[y] && WHT.HOLIDAYS[y].indexOf(d) >= 0;
  }

  function isWeekend(d) { var x = new Date(d+'T00:00:00'); return x.getDay() === 0 || x.getDay() === 6; }
  function getDayOfWeek(d) { return new Date(d+'T00:00:00').getDay(); }

  function formatDate(d) {
    var x = new Date(d+'T00:00:00');
    var w = ['日','一','二','三','四','五','六'];
    return (x.getMonth()+1) + '月' + x.getDate() + '日 周' + w[x.getDay()];
  }

  function formatDateShort(d) {
    var x = new Date(d+'T00:00:00');
    return (x.getMonth()+1) + '/' + x.getDate();
  }

  function calculateHours(s, e) {
    if (!s || !e || typeof s !== 'string' || typeof e !== 'string') return 0;
    var sp = s.split(':').map(Number);
    var ep = e.split(':').map(Number);
    if (sp.length < 2 || ep.length < 2 || isNaN(sp[0]) || isNaN(ep[0])) return 0;
    var a = sp[0]*60 + sp[1];
    var b = ep[0]*60 + ep[1];
    if (b < a) b += 24*60;
    return Math.round((b-a)/60*100)/100;
  }

  function getWeekDays(off) {
    off = off || 0;
    var n = new Date();
    n.setDate(n.getDate() - (n.getDay() === 0 ? 6 : n.getDay() - 1) + off*7);
    var days = [];
    for (var i = 0; i < 7; i++) {
      var d = new Date(n);
      d.setDate(n.getDate()+i);
      days.push(d.toISOString().slice(0,10));
    }
    return days;
  }

  function getMonthDays(y, m) {
    var last = new Date(y, m+1, 0);
    var days = [];
    for (var i = 1; i <= last.getDate(); i++) {
      days.push(y + '-' + String(m+1).padStart(2,'0') + '-' + String(i).padStart(2,'0'));
    }
    return days;
  }

  function getProgressClass(pct) {
    if (pct >= 100) return 'good';
    if (pct >= 75) return 'ok';
    if (pct >= 50) return 'warn';
    return 'bad';
  }

  function toggleHoliday(d) {
    var s = WHT.getUserSettings();
    if (!s.holidays) s.holidays = [];
    var i = s.holidays.indexOf(d);
    if (i >= 0) s.holidays.splice(i,1); else s.holidays.push(d);
    WHT.saveUserSettings(s);
    WHT.renderCurrentTab(true);
  }

  /* 触觉反馈：优先原生 Haptics → 降级 Vibration API */
  function haptic(type) {
    try {
      var C = window.Capacitor;
      if (C && C.Plugins && C.Plugins.Haptics) {
        var H = C.Plugins.Haptics;
        switch (type) {
          case 'light': H.impact({style:'LIGHT'}); return;
          case 'medium': H.impact({style:'MEDIUM'}); return;
          case 'heavy': H.impact({style:'HEAVY'}); return;
          case 'delete': H.notification({type:'WARNING'}); return;
          case 'error': H.notification({type:'ERROR'}); return;
          default: H.impact({style:'LIGHT'}); return;
        }
      }
    } catch(e) {}
    if (!navigator.vibrate) return;
    switch (type) {
      case 'light':  navigator.vibrate(30); break;
      case 'medium': navigator.vibrate(50); break;
      case 'heavy':  navigator.vibrate([15,50,30]); break;
      case 'delete': navigator.vibrate([30,60,20,40,30]); break;
      case 'error':  navigator.vibrate([50,80,50]); break;
      default:       navigator.vibrate(30);
    }
  }

  // ── 导出至 WHT 命名空间 ──
  WHT.genId = genId;
  WHT.escapeHtml = escapeHtml;
  WHT.today = today;
  WHT.isHoliday = isHoliday;
  WHT.isWeekend = isWeekend;
  WHT.getDayOfWeek = getDayOfWeek;
  WHT.formatDate = formatDate;
  WHT.formatDateShort = formatDateShort;
  WHT.calculateHours = calculateHours;
  WHT.getWeekDays = getWeekDays;
  WHT.getMonthDays = getMonthDays;
  WHT.getProgressClass = getProgressClass;
  WHT.toggleHoliday = toggleHoliday;
  WHT.haptic = haptic;

})();
