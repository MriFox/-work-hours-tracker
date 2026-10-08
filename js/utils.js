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

  // ── 日期类型判定（全项目唯一权威入口） ──
  // 优先级：用户覆盖 > 内置法定节假日 > 旧自定义节假日 > 周末 > 默认工作日
  //
  // 「是不是工作日」与「算不算加班费」是两个独立维度，四种组合都有意义：
  //   weekday / workday → 计工作日，不计加班费（普通工作日、调休补班日）
  //   weekend / rest    → 不计工作日，不计加班费（周末、公司放假但非法定节假日）
  //   holiday           → 不计工作日，计加班费（法定节假日）
  // getDayType 返回 type（用于渲染）与 holiday（用于加班费判定），两者不要混用。
  function getDayType(d) {
    var s = (state.currentUser && WHT.getUserSettings) ? WHT.getUserSettings() : null;
    var ov = (s && s.dayOverrides) ? s.dayOverrides[d] : null;
    if (ov === 'workday') return { type:'workday', holiday:false, forced:true, badge:'班', label:'调休上班' };
    // 休息：不计工作日，也不算加班费（对应「公司放假、但非法定节假日，只算时长」）
    if (ov === 'rest')    return { type:'rest',    holiday:false, forced:true, badge:'休', label:'休息' };
    // 节假日：不计工作日，但算加班费
    if (ov === 'holiday') return { type:'holiday', holiday:true,  forced:true, badge:'休', label:'节假日' };
    var y = parseInt(d.slice(0,4));
    if (WHT.HOLIDAYS[y] && WHT.HOLIDAYS[y].indexOf(d) >= 0) return { type:'holiday', holiday:true, forced:false, badge:'休', label:'法定节假日' };
    if (s && s.holidays && s.holidays.indexOf(d) >= 0) return { type:'holiday', holiday:true, forced:false, badge:'休', label:'法定节假日' };
    if (isWeekend(d)) return { type:'weekend', holiday:false, forced:false, badge:'', label:'周末' };
    return { type:'weekday', holiday:false, forced:false, badge:'', label:'工作日' };
  }

  function isHoliday(d) {
    if (!state.currentUser) return false;
    return getDayType(d).holiday;
  }

  function isWeekend(d) { var x = new Date(d+'T00:00:00'); return x.getDay() === 0 || x.getDay() === 6; }
  function getDayOfWeek(d) { return new Date(d+'T00:00:00').getDay(); }

  // 统计区间内的工作日天数（统一口径，含调休补班日）
  function countWorkDays(days, modeType, flextimeConfig) {
    var fc = flextimeConfig;
    var isFlex = modeType === 'flextime' && fc && fc.startDate;
    var sm = null;
    if (isFlex) {
      sm = new Date(fc.startDate + 'T00:00:00');
      var sa = sm.getDay(); if (sa === 0) sa = 7;
      sm.setDate(sm.getDate() - (sa - 1));
    }
    return (days || []).filter(function(x) {
      var t = getDayType(x);
      if (t.type === 'workday') return true;
      // 显式休息日：即便落在周一~周五也不计工作日（不能落到下面的周末判断）
      if (t.type === 'rest') return false;
      if (t.holiday) return false;
      var w = getDayOfWeek(x);
      if (w >= 1 && w <= 5) return true;
      if (w === 6 && isFlex) {
        var dm = new Date(x + 'T00:00:00');
        var da = dm.getDay(); if (da === 0) da = 7;
        dm.setDate(dm.getDate() - (da - 1));
        var wd = Math.floor((dm - sm) / 86400000 / 7);
        return (wd % 2 === 0) ? !!fc.startIsBigWeek : !fc.startIsBigWeek;
      }
      return false;
    }).length;
  }

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

  // 显式设置某天类型：'workday'(上班) | 'rest'(休息) | 'holiday'(节假日) | 'auto'(清除覆盖)
  function setDayOverride(d, type) {
    var s = WHT.getUserSettings();
    if (!s.dayOverrides) s.dayOverrides = {};
    if (type === 'auto' || !type) delete s.dayOverrides[d];
    else s.dayOverrides[d] = type;
    WHT.saveUserSettings(s);
    WHT.renderCurrentTab(true);
  }

  // 长按循环：自动 → 上班 → 休息 → 节假日 → 自动
  function toggleHoliday(d) {
    var s = WHT.getUserSettings();
    if (!s.dayOverrides) s.dayOverrides = {};
    var cur = s.dayOverrides[d];
    var next, label;
    if (cur === undefined) { next = 'workday'; label = '上班（计工作日）'; }
    else if (cur === 'workday') { next = 'rest'; label = '休息（不算加班费）'; }
    else if (cur === 'rest') { next = 'holiday'; label = '节假日（算加班费）'; }
    else { next = null; label = '自动'; }
    if (next === null) delete s.dayOverrides[d]; else s.dayOverrides[d] = next;
    WHT.saveUserSettings(s);
    if (WHT.showToast) WHT.showToast(formatDateShort(d) + ' · ' + label, 'info', 1500);
    WHT.renderCurrentTab(true);
  }

  // 日期类型选择器 HTML（详情卡片复用）
  function dayTypePickerHtml(d) {
    var s = WHT.getUserSettings();
    var ov = (s.dayOverrides && s.dayOverrides[d]) || 'auto';
    var opts = [
      { k:'auto',    t:'自动',   hint:'跟随法定节假日与周末' },
      { k:'workday', t:'上班',   hint:'调休补班，计入工作日' },
      { k:'rest',    t:'休息',   hint:'不计入工作日，不算加班费' },
      { k:'holiday', t:'节假日', hint:'不计入工作日，按加班费计算' }
    ];
    var seg = opts.map(function(o) {
      return '<button class="daytype-opt' + (ov === o.k ? ' active' : '') + '" title="' + o.hint + '"' +
        ' onclick="event.stopPropagation();setDayOverride(\'' + d + '\',\'' + o.k + '\')">' + o.t + '</button>';
    }).join('');
    return '<div class="daytype-picker"><span class="daytype-label">日期类型</span><div class="daytype-seg">' + seg + '</div></div>';
  }

  // 系统默认（不含用户覆盖）是否为休息日
  function baseIsRest(d) {
    var s = (state.currentUser && WHT.getUserSettings) ? WHT.getUserSettings() : null;
    var y = parseInt(d.slice(0,4));
    if (WHT.HOLIDAYS[y] && WHT.HOLIDAYS[y].indexOf(d) >= 0) return true;
    if (s && s.holidays && s.holidays.indexOf(d) >= 0) return true;
    return isWeekend(d);
  }

  // 表单开关语义：勾选=休息日；取消=非休息日（默认休息时显式标为上班）
  // 注意：勾选只表示「这天不上班」，不再顺带授予加班费。
  // 需要「这天算加班费」请到日历里选「节假日」，避免一个开关同时改两个维度。
  function setRestFlag(d, isRest) {
    var s = WHT.getUserSettings();
    if (!s.dayOverrides) s.dayOverrides = {};
    if (isRest) {
      // 系统默认本就是休息（法定节假日/周末）→ 交回「自动」，保留法定节假日的加班费语义
      if (baseIsRest(d)) delete s.dayOverrides[d];
      else s.dayOverrides[d] = 'rest';
    } else if (baseIsRest(d)) {
      s.dayOverrides[d] = 'workday';
    } else {
      delete s.dayOverrides[d];
    }
    WHT.saveUserSettings(s);
  }

  // 差额颜色：负数一律红、正数一律绿。
  // 曾在「周期未过半」时退回中性灰以降低压迫感，用户反馈看不习惯，已改回。
  function diffColor(diff) {
    return diff >= 0 ? 'var(--color-success)' : 'var(--color-danger)';
  }

  // 按「已过时间比例」评估进度节奏，避免月初必然判红
  function paceClass(pct, expectedPct, isEmpty) {
    if (isEmpty) return 'empty';
    var r = expectedPct > 0 ? (pct / expectedPct) : 1;
    return r >= 1 ? 'good' : r >= 0.75 ? 'ok' : r >= 0.5 ? 'warn' : 'bad';
  }

  // ── 追赶节奏（「接下来每天需完成多少」） ──
  // 全项目单一口径出口，月度页 / 记录页 / 季度页共用，避免各页面各算一套。
  // 剩余工作日一律走 countWorkDays，因此调休补班日、自定义休息日会自动计入/剔除。

  // 'HH:MM' + 小时数 → 'HH:MM'（跨天自动回绕）
  function addHoursToTime(t, hours) {
    if (!t || !(hours > 0)) return '';
    var p = String(t).split(':');
    var base = parseInt(p[0], 10) * 60 + (parseInt(p[1], 10) || 0);
    if (isNaN(base)) return '';
    var total = Math.round(base + hours * 60);
    total = ((total % 1440) + 1440) % 1440;
    return String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0');
  }

  // 带符号小时数显示：+80.0h / -80.0h
  function fmtSignedHours(v) {
    if (typeof v !== 'number' || !isFinite(v)) v = 0;
    return (v > 0 ? '+' : '') + v.toFixed(1) + 'h';
  }

  // 当前用户今天是否已完成打卡（决定"今天"还算不算待完成的工作日）
  function isTodayDone() {
    var td = today();
    var tr = (WHT.getUserRecords() || []).find(function(x) { return x.date === td; });
    return !!(tr && (tr.status === 'done' || (tr.startTime && tr.endTime)));
  }

  // 给定日期集合中、从「今天」起算的剩余工作日数
  // 今天已打完下班卡 → 今天不计入；否则今天计入。早于今天的自动排除。
  function remainingWorkDays(days, modeType, flextimeConfig) {
    var td = today();
    var done = isTodayDone();
    return (days || []).filter(function(x) {
      if (countWorkDays([x], modeType, flextimeConfig) === 0) return false;
      if (x > td) return true;
      return x === td && !done;
    }).length;
  }

  // 常用上班时间（把「每天需完成」换算成下班时间的基准）
  // 优先级：设置里的「标准上班时间」> 常用时段首个 > 大小周上班时间 > 09:00
  // 注意：这只是「没有真实打卡时的兜底」。记录页会优先用当天真实打卡时间，
  // 见 monthPace 返回的 actualStart / actualEnd。
  function clockStartOf() {
    var s = WHT.getUserSettings();
    if (s.workStartTime) return s.workStartTime;
    if (s.commonSlots && s.commonSlots.length && s.commonSlots[0].start) return s.commonSlots[0].start;
    if (s.flextimeConfig && s.flextimeConfig.standardStart) return s.flextimeConfig.standardStart;
    return '09:00';
  }

  // 计算某个月的追赶节奏
  // status: 'chase'(还需追赶) | 'done'(已达标) | 'overdue'(工作日已用完但仍未达标)
  function monthPace(y, m) {
    var s = WHT.getUserSettings();
    var md = (WHT.getUserModes() || []).find(function(x) { return x.id === state.currentMode; });
    var mt = md && md.type;
    var fc = s.flextimeConfig;
    var days = getMonthDays(y, m);
    var ms = y + '-' + String(m + 1).padStart(2, '0');
    var recs = WHT.getUserRecords().filter(function(x) { return x.date.indexOf(ms) === 0; });

    var workDays = countWorkDays(days, mt, fc);
    var std = s.standardHours || 8;
    var target = std * workDays;

    // 节假日工时单算加班费，不冲抵本月目标（沿用各页既有口径）
    var holidayHours = recs.filter(function(x) { return isHoliday(x.date); })
                           .reduce(function(a, x) { return a + x.hours; }, 0);
    var done = recs.reduce(function(a, x) { return a + x.hours; }, 0) - holidayHours;
    var need = target - done;

    var td = today();
    var restDays = remainingWorkDays(days, mt, fc);
    var elapsedWorkDays = workDays - restDays;
    // 仅当今天落在本月、且今天仍是待完成的工作日时，才说「今天还需」
    var todayCounts = (td.indexOf(ms) === 0) &&
                      countWorkDays([td], mt, fc) > 0 && !isTodayDone();

    var status = restDays === 0 ? (need > 0 ? 'overdue' : 'done') : (need <= 0 ? 'done' : 'chase');
    var perDay = status === 'chase' ? (need / restDays) : 0;
    var isCurrentMonth = ms === td.slice(0, 7);

    // 用常用时段的上班时间推算下班时间（超出 16h/天则不换算，避免出现跨天误导）
    var clockStart = clockStartOf();
    var clockEnd = (perDay > 0 && perDay <= 16) ? addHoursToTime(clockStart, perDay) : '';

    // 记录页副文案要用「今天真实的打卡时间」，而不是设置里的固定上班时间。
    // 只在 todayCounts 为真（今天仍是待完成的工作日）时才取：
    // 已经打完下班卡时 restDays 不含今天，perDay 描述的是「以后每个工作日」，
    // 这时候套用今天的打卡时间会得出错误的收工点，故留空回退到 clockStart。
    var todayRec = todayCounts ? recs.find(function(x) { return x.date === td; }) : null;
    var actualStart = (todayRec && todayRec.startTime) ? todayRec.startTime : '';
    var actualEnd = (actualStart && perDay > 0 && perDay <= 16) ? addHoursToTime(actualStart, perDay) : '';

    // 当天进行中记录的实时工时。**只作为渲染用的附加量**，绝不并进 done ——
    // 因为 done 是「日均」（done ÷ 已工作天数）的分子，而日均的分母排除了当天；
    // 若把实时工时算进 done，日均会随分钟数一路虚高跳动。
    // 显示路径用 done + liveHours，计算路径继续用 done，两条路各自独立。
    var liveHours = 0;
    var lhToday = liveHoursOf(recs.find(function(x) { return x.date === td; }));
    if (lhToday !== null && lhToday > 0) liveHours = lhToday;

    return {
      y: y, m: m, monthStr: ms,
      standardHours: std, modeType: mt, workDays: workDays,
      target: target, done: done, holidayHours: holidayHours, need: need,
      restDays: restDays, elapsedWorkDays: elapsedWorkDays,
      perDay: perDay, status: status, todayCounts: todayCounts,
      isCurrentMonth: isCurrentMonth,
      clockStart: clockStart, clockEnd: clockEnd,
      actualStart: actualStart, actualEnd: actualEnd,
      liveHours: liveHours
    };
  }

  // ── 季度累计（跨季度结转 + 追赶） ──
  // 用途：从年中才开始用工具时，前几个季度的超/欠无法录入；用「期初结余」把它们带进来。

  // 单季度汇总：实际 / 目标 / 加班 / 工作日 / 偏差 / 分月明细
  function quarterSummary(qy, qi) {
    var s = WHT.getUserSettings();
    var q = (s.quarterConfig || [])[qi];
    var md = (WHT.getUserModes() || []).find(function(x) { return x.id === state.currentMode; });
    var mt = md && md.type;
    var empty = { actual: 0, target: 0, holidayHours: 0, workDays: 0, workedDays: 0,
                  dev: 0, days: [], perMonth: [] };
    if (!q) return empty;

    var recs = WHT.getUserRecords();
    var std = s.standardHours || 8;
    var actual = 0, target = 0, holidayHours = 0, workDays = 0, workedDays = 0;
    var allDays = [], perMonth = [];

    (q.months || []).forEach(function(m) {
      var ms = qy + '-' + String(m).padStart(2, '0');
      var mr = recs.filter(function(x) { return x.date.indexOf(ms) === 0; });
      var hh = mr.filter(function(x) { return isHoliday(x.date); })
                 .reduce(function(a, x) { return a + x.hours; }, 0);
      var ma = mr.reduce(function(a, x) { return a + x.hours; }, 0) - hh;
      var mWorked = mr.filter(function(x) { return !isHoliday(x.date) && x.status !== 'working'; }).length;
      var days = getMonthDays(qy, m - 1);
      var wd = countWorkDays(days, mt, s.flextimeConfig);
      var mtar = std * wd;

      holidayHours += hh;
      actual += ma;
      target += mtar;
      workDays += wd;
      workedDays += mWorked;
      allDays = allDays.concat(days);
      perMonth.push({
        month: m, actual: ma, target: mtar, workedDays: mWorked,
        pct: mtar > 0 ? Math.min(100, (ma / mtar) * 100) : 0
      });
    });

    return {
      actual: actual, target: target, holidayHours: holidayHours,
      workDays: workDays, workedDays: workedDays,
      dev: actual - target, days: allDays, perMonth: perMonth
    };
  }

  // 某季度是否已有记录 —— 用来区分「工具尚未启用」与「真的做了 0 小时」
  function quarterHasData(qy, qi) {
    var q = (WHT.getUserSettings().quarterConfig || [])[qi];
    if (!q || !q.months || !q.months.length) return false;
    var prefixes = q.months.map(function(m) { return qy + '-' + String(m).padStart(2, '0'); });
    return (WHT.getUserRecords() || []).some(function(x) {
      return prefixes.some(function(p) { return x.date.indexOf(p) === 0; });
    });
  }

  // 显式填写的期初结余（未填写返回 null）
  function explicitCarry(qy, qi) {
    var v = (WHT.getUserSettings().quarterCarry || {})[qy + '-' + qi];
    return (typeof v === 'number' && isFinite(v)) ? v : null;
  }

  // 季度「期初结余」：显式填写优先，未填则向前结转（跨年归零）
  // 触发方式：
  //   · 若存在显式锚点 → 从最近锚点起累加每个季度的偏差（锚点证明用户已启用工具）
  //   · 若从未填写过 → 只累加「确实有记录」的季度，避免把启用之前的空季度当成欠账
  // 正数 = 结余（超前），负数 = 欠账（落后）
  function quarterCarry(qy, qi) {
    var ex = explicitCarry(qy, qi);
    if (ex !== null) return ex;
    if (qi <= 0) return 0;

    for (var j = qi - 1; j >= 0; j--) {
      var anchor = explicitCarry(qy, j);
      if (anchor !== null) {
        for (var k = j; k < qi; k++) anchor += quarterSummary(qy, k).dev;
        return anchor;
      }
    }

    var base = 0;
    for (var k2 = 0; k2 < qi; k2++) {
      if (quarterHasData(qy, k2)) base += quarterSummary(qy, k2).dev;
    }
    return base;
  }

  // 季度累计追赶：累计偏差 = 期初结余 + 本季度偏差 → 还需多少
  // status: 'chase' | 'done' | 'overdue'
  function quarterPace(qy, qi) {
    var s = WHT.getUserSettings();
    var md = (WHT.getUserModes() || []).find(function(x) { return x.id === state.currentMode; });
    var mt = md && md.type;
    var fc = s.flextimeConfig;

    var sum = quarterSummary(qy, qi);
    var carry = quarterCarry(qy, qi);
    var cumulative = carry + sum.dev;
    var need = cumulative < 0 ? -cumulative : 0;

    var restQuarter = remainingWorkDays(sum.days, mt, fc);
    var yearDays = [];
    for (var m = 1; m <= 12; m++) yearDays = yearDays.concat(getMonthDays(qy, m - 1));
    var restYear = remainingWorkDays(yearDays, mt, fc);

    var status = need <= 0 ? 'done' : (restYear === 0 ? 'overdue' : 'chase');
    // ⚠️ 两档「还清」都必须是「当天总工时」，否则量纲不同、没法画在同一刻度上比较。
    //    · 本季度内还清：分子 = need = 本季度剩余待做 + 历史欠账（本季度的事已全在 need 里）→ 除以本季度剩余天数即当天总工时。
    //    · 到年底还清：分子还要**补上后续季度的常规目标**。
    //      漏掉它的话，算出来只是「额外要补的量」——分母跨到了后面几个季度，分子却只有本季度那点事，
    //      会给出「到年底每天只要 2.74h」这种明显不对的结果（后面季度的班照样得上）。
    //    注：qi === 3（Q4）时 restYear === restQuarter、laterTarget === 0，两档自动一致。
    var stdH = s.standardHours || 8;
    var laterTarget = Math.max(0, restYear - restQuarter) * stdH;
    var perQuarter = (status === 'chase' && restQuarter > 0) ? need / restQuarter : 0;
    var perYear = (status === 'chase' && restYear > 0) ? (need + laterTarget) / restYear : 0;

    // 下班时间换算挂在更宽松的「到年底」口径上（季度内那个常常不可达）
    var clockScope = perYear > 0 ? '到年底' : (perQuarter > 0 ? '本季度内' : '');
    // ⚠️ perQuarter / perYear 本身就是「当天需要工作的总工时」，不是「额外要补的量」。
    //    （验证：完全按标准进度时 need = 剩余待做、perQuarter 恰好等于 standardHours）
    //    所以收工时间 = 上班时间 + 该值，**绝不能再加一遍日常工时** ——
    //    曾写成 std + perQuarter，导致按进度的人看到「09:00 上班 · 03:00 下班」。
    var clockTotal = perYear > 0 ? perYear : perQuarter;
    var clockStart = clockStartOf();
    // clockEnd 仅作 API 字段保留（v0.12.3 起卡片不再用它 ——
    // 卡片改成在每一档「还清」行里各自给出下班时间，避免一处数字对应两档目标）。
    var clockEnd = (clockTotal > 0 && clockTotal <= 14) ? addHoursToTime(clockStart, clockTotal) : '';

    return {
      carry: carry, dev: sum.dev, cumulative: cumulative, need: need,
      actual: sum.actual, target: sum.target, holidayHours: sum.holidayHours,
      workDays: sum.workDays, workedDays: sum.workedDays, perMonth: sum.perMonth,
      restQuarter: restQuarter, restYear: restYear,
      perQuarter: perQuarter, perYear: perYear,
      status: status, isCurrentYear: qy === new Date().getFullYear(),
      clockScope: clockScope, clockStart: clockStart, clockEnd: clockEnd,
      clockTotal: clockTotal
    };
  }

  // 季度累计卡片（季度页）· 方案 A「载荷条」
  // 版式：标题行 → 累计仍差（大数值）→ 结转构成 → 两档「还清」载荷条 → 收工时间
  //
  // 载荷条是这张卡的核心：把「还差多少小时」换算成「每天得干到多少小时」，
  // 两条按同一刻度并列，再用一根灰线标出日常标准工时的位置——
  // 一眼就能看出「想在本季度内还清」比「拖到年底」要狠多少。
  function quarterCardHtml(p) {
    if (!p || !p.isCurrentYear) return '';
    var s = WHT.getUserSettings();
    var stdH = s.standardHours || 8;
    // 载荷条刻度：以 16h 为基准（超过就说明完全不现实），但不封顶，
    // 否则欠账特别多时两条都会顶到 100%，反而看不出差别。
    var BAR_BASE = 16;

    var cls, label, num, unit;
    if (p.status === 'done') {
      cls = 'is-done';
      label = '年度累计已达标';
      num = (p.cumulative > 0 ? '+' + p.cumulative.toFixed(1) : '0.0');
      unit = 'h 盈余';
    } else if (p.status === 'overdue') {
      cls = 'is-overdue';
      label = '今年工作日已用完';
      num = p.need.toFixed(1);
      unit = 'h 待补';
    } else {
      cls = 'is-chase';
      label = '累计仍差';
      num = p.need.toFixed(1);
      unit = 'h';
    }

    // ── 两档「还清」载荷条 ──
    // ⚠️ perQuarter / perYear = need ÷ 剩余工作日，它**本身就是「当天总工时」**：
    //    need = 全季度目标 − 已完成 + 欠账 = 「剩余待做 + 欠账」，
    //    除以剩余工作日，得到的自然就是「剩下的日子每天要做多少小时」。
    //    验证：完全按标准进度时（每天正好 9h、无欠账），perQuarter 恰好 == standardHours。
    //    所以条长 = per，参考线画在 std 处表示「日常标准」；**不能再加一遍 std**。
    //    曾误当成「额外量」写成 std + per，导致条长虚高、按进度的人也顶到 100%。
    var loads = '';
    if (p.status === 'chase') {
      // 两档永远都渲染（即便 Q4 时两者相等 —— 那时季度末就是年末，需要让用户看到这一点）
      var items = [];
      if (p.perQuarter > 0) {
        items.push({ name: '本季度内还清', per: p.perQuarter, days: p.restQuarter, tight: true });
      }
      if (p.perYear > 0) {
        items.push({
          name: '本年度内还清', per: p.perYear, days: p.restYear, tight: false,
          same: p.restYear === p.restQuarter     // 季度末即年末，两档其实是一回事
        });
      }
      if (items.length) {
        var totals = items.map(function(x) { return x.per; });
        var scale = Math.max(BAR_BASE, Math.max.apply(null, totals));
        var markPct = Math.min(100, stdH / scale * 100);
        loads = items.map(function(x, i) {
          var total = totals[i];
          var pct = Math.min(100, total / scale * 100);
          // 上色规则：两档差得明显时，标出更紧的那档（相对比较有意义）；
          // 两档几乎相等（如 Q4 时季度末=年末）则按绝对负荷判断 ——
          // 否则会把 9.5h 这种只比日常多 5% 的轻负荷也标成红色。
          var spread = items.length > 1 && Math.abs(items[0].per - items[1].per) > stdH * 0.05;
          var hard = spread ? x.tight : (total > stdH * 1.15);
          // 与日常的差值可能为负 —— 说明进度领先，只需要比标准工时更少的投入
          var delta = total - stdH;
          // 按当前上班时间推出下班点。跨过午夜的要标出天数差，
          // 否则「09:00 上班 · 03:47 下班」会被读成早上三点。
          var off = '';
          if (total > 0) {
            var p0 = String(p.clockStart || '').split(':');
            var base = parseInt(p0[0], 10) * 60 + (parseInt(p0[1], 10) || 0);
            if (!isNaN(base)) {
              var endMin = base + Math.round(total * 60);
              var days = Math.floor(endMin / 1440);
              var mm = ((endMin % 1440) + 1440) % 1440;
              var hm = String(Math.floor(mm / 60)).padStart(2, '0') + ':' +
                       String(mm % 60).padStart(2, '0');
              // 0 天 = 当天；1 天 = 次日；2 天以上直接写「N 天后」
              off = (days === 0 ? '' : days === 1 ? '次日 ' : days + ' 天后 ') + hm;
            }
          }
          return '<div class="qcum-load' + (hard ? ' is-hard' : '') + '">' +
              '<div class="qcum-load-top">' +
                '<span class="qcum-load-name">' + x.name + (x.same ? '<em>（即季度末）</em>' : '') + '</span>' +
                '<span class="qcum-load-val">' + total.toFixed(2) + '<i>h / 天</i></span>' +
              '</div>' +
              '<div class="qcum-load-track" role="img" aria-label="' +
                escapeHtml(x.name + '每天需工作 ' + total.toFixed(2) + ' 小时（日常标准 ' + stdH + ' 小时，' +
                           (delta >= 0 ? '超出 ' + delta.toFixed(2) : '少 ' + (-delta).toFixed(2)) + ' 小时）') + '">' +
                '<i class="qcum-load-fill" style="width:' + pct.toFixed(1) + '%"></i>' +
                '<s class="qcum-load-mark" style="left:' + markPct.toFixed(1) + '%"></s>' +
              '</div>' +
              '<div class="qcum-load-foot">' +
                '<span>剩 ' + x.days + ' 个工作日' +
                  (off ? ' · 需 <b>' + off + '</b> 下班' : '') + '</span>' +
                '<span>' + (delta >= 0 ? '比日常多 ' + delta.toFixed(2) + 'h'
                                       : '比日常少 ' + (-delta).toFixed(2) + 'h（进度领先）') + '</span>' +
              '</div>' +
            '</div>';
        }).join('');
      }
    }

    // 非追赶状态没得算「每天要多少」，用一行完成度补足信息
    var note = (p.status !== 'chase')
      ? '<div class="qcum-note">今年已完成 <b>' + p.actual.toFixed(1) + 'h</b> / 目标 <b>' + p.target + 'h</b></div>'
      : '';

    // 收工时间行。「按 X 上班计」里的 X 可以直接点开改（与设置页共用 editWorkStartTime）。
    // 上班时间行：只负责展示「几点上班」并作为修改入口。
    // 各档的「需几点下班」放在各自的载荷条行里，避免一处数字对应不上两档目标。
    var clock = (p.status === 'chase')
      ? '<div class="qcum-clock">' +
          '<span class="qcum-clock-dot" aria-hidden="true"></span>' +
          '按照 <span class="qcum-clock-time" role="button" tabindex="0" ' +
            'onclick="WHT.editWorkStartTime()" title="点击修改标准上班时间">' + p.clockStart + '</span> 上班' +
        '</div>'
      : '';

    return '<div class="qcum-card ' + cls + '">' +
      '<div class="qcum-head">' +
        '<span class="qcum-title"><span class="qcum-dot" aria-hidden="true"></span>年度累计结转</span>' +
        '<span class="qcum-edit" role="button" tabindex="0">设置期初结余 ›</span>' +
      '</div>' +
      '<div class="qcum-hero">' +
        '<span class="qcum-hero-label">' + label + '</span>' +
        '<span class="qcum-hero-value">' + num + '<i class="qcum-unit">' + unit + '</i></span>' +
      '</div>' +
      '<div class="qcum-compose">' +
        '<span class="qcum-compose-item">期初结余<b class="' + (p.carry < 0 ? 'neg' : p.carry > 0 ? 'pos' : '') + '">' + fmtSignedHours(p.carry) + '</b></span>' +
        '<span class="qcum-compose-op" aria-hidden="true">+</span>' +
        '<span class="qcum-compose-item">本季度结余<b class="' + (p.dev < 0 ? 'neg' : p.dev > 0 ? 'pos' : '') + '">' + fmtSignedHours(p.dev) + '</b></span>' +
      '</div>' +
      loads +
      note +
      clock +
    '</div>';
  }

  // ═══ 记录页「今日卡」 ═══
  // 把原来分开的「实时计时卡」与「今天还需完成多少」提示条合成一张卡。
  // 关键是把两者的口径统一：计时卡原本按 standardHours 走，提示条按 perDay 走，
  // 同一件事给出两个不同的收工时间。现在统一成 todayTargetOf()。

  // 时长格式化：344 → '5h 44m'
  function fmtDur(min) {
    min = Math.max(0, Math.round(min || 0));
    var h = Math.floor(min / 60), m = min % 60;
    if (h && m) return h + 'h ' + m + 'm';
    if (h) return h + 'h';
    return m + 'm';
  }

  // 今日目标 = max(标准工时, 每日需完成)
  // 只取标准工时 → 欠账很多的人会以为今天干满 9h 就够了；
  // 只取每日需完成 → 有盈余时目标会被压到 9h 以下，与实际仍要上满班不符。
  // 取两者较大值，两种情形都对得上。
  function todayTargetOf(p, std) {
    var pd = (p && p.status === 'chase') ? (p.perDay || 0) : 0;
    return Math.max(std || 8, pd);
  }

  // 今日进度。两种模式：
  //   mode='live' 已上班未下班 → 用时按当前时钟走，收工点是「预计」
  //   mode='done' 已收工       → 用时取记录里的实际工时，不随时钟变
  function dayProgress(mode, startTime, endTime, workedHours, targetHours) {
    var targetMin = Math.max(0, Math.round((targetHours || 0) * 60));
    var elapsedMin = 0, endStr = '', startMin = -1;
    if (startTime) {
      var sp = String(startTime).split(':');
      var hh = parseInt(sp[0], 10), mm = parseInt(sp[1], 10);
      if (!isNaN(hh)) startMin = hh * 60 + (isNaN(mm) ? 0 : mm);
    }
    if (mode === 'done') {
      elapsedMin = Math.round((workedHours || 0) * 60);
      endStr = endTime || '';
    } else {
      var nowMin = new Date().getHours() * 60 + new Date().getMinutes();
      if (startMin >= 0) {
        elapsedMin = nowMin - startMin;
        if (elapsedMin < 0) elapsedMin += 1440;   // 跨天
      }
      if (startMin >= 0 && targetMin > 0) {
        var e = (startMin + targetMin) % 1440;
        endStr = String(Math.floor(e / 60)).padStart(2, '0') + ':' + String(e % 60).padStart(2, '0');
      }
    }
    var remainMin = Math.max(0, targetMin - elapsedMin);
    return {
      startMin: startMin,
      elapsedMin: elapsedMin,
      remainMin: remainMin,
      overMin: Math.max(0, elapsedMin - targetMin),
      targetMin: targetMin,
      pct: targetMin > 0 ? Math.min(100, Math.round(elapsedMin / targetMin * 100)) : 0,
      endStr: endStr,
      reached: targetMin > 0 && remainMin === 0
    };
  }

  // 进行中记录的实时工时（小时）。周页 / 月度页的当日实时显示统一走这里，
  // 与记录页的实时计时同源（都基于 dayProgress），避免各页各写一套。
  //
  // 返回 null 表示「没有可显示的实时值」，调用方应回退到「进行中」文案：
  //   · 不是进行中的记录（已收工 / 无记录）
  //   · 不是今天的记录 —— 历史日期没收工的记录若用「现在」去减会得出荒谬的值
  //   · 已收工时间超过 24h —— 视为忘了打下班卡，这种数显示出来只会误导
  function liveHoursOf(rec) {
    if (!rec || !rec.startTime) return null;
    if (!(rec.status === 'working' || (!rec.endTime && rec.startTime))) return null;
    if (rec.date !== today()) return null;
    var d = dayProgress('live', rec.startTime, '', 0, 0);
    if (!d || d.elapsedMin <= 0) return 0;
    if (d.elapsedMin > 24 * 60) return null;
    return d.elapsedMin / 60;
  }

  // 记录在日历格 / 详情行里的工时显示文本。周页与月度页共用，避免两处各写一套。
  //   已收工        → '9.0h'
  //   进行中且有实时 → '5.0h'
  //   进行中但算不出 → '进行中'（历史日期未收工 / 超过 24h 忘打卡）
  function recordHoursTextOf(rec) {
    if (!rec) return '';
    var isWorking = rec.status === 'working' || (!rec.endTime && rec.startTime);
    if (!isWorking) return rec.hours.toFixed(1) + 'h';
    var h = liveHoursOf(rec);
    return h === null ? '进行中' : h.toFixed(1) + 'h';
  }

  // ── 页面实时刷新定时器 ────────────────────────────────────────────────────
  // 周页 / 月度页在「今天有进行中记录」时每 10s 重绘一次，让实时工时跟着走。
  // 只保留一个实例：重复调用会先清掉上一个，避免来回切页堆出多个 interval。
  function startPageLiveTimer(fn) {
    stopPageLiveTimer();
    if (typeof fn !== 'function') return;
    state._pageTimer = setInterval(function() {
      // 页面已被切走 → 自停，避免后台空转
      if (state.currentTab !== 'week' && state.currentTab !== 'month') { stopPageLiveTimer(); return; }
      if (!document.getElementById('pageContent')) { stopPageLiveTimer(); return; }
      fn();
    }, 10000);
  }

  function stopPageLiveTimer() {
    if (state._pageTimer) {
      clearInterval(state._pageTimer);
      state._pageTimer = null;
    }
  }

  // 今日卡内部结构：标题行 + 双栏 hero + 进度条 + 起止 meta (+ 提醒)
  // opts.mode: 'idle' | 'live' | 'done'
  function dayBodyHtml(d, opts) {
    opts = opts || {};
    var mode = opts.mode || 'idle';
    var std = opts.std || 8;
    var reached = mode === 'live' && d.reached;
    // 已收工的日子整条进度条走绿色；计时中则按是否达标在蓝/绿之间切换
    var accent = (mode === 'done' || reached) ? 'var(--color-success)' : 'var(--color-accent)';

    // ── 标题 + 状态胶囊 ──
    var title = mode === 'done' ? '今日完成' : (mode === 'idle' ? '今日安排' : '今日进度');
    var chip, chipTxt;
    if (mode === 'done') { chip = 'is-done'; chipTxt = '已收工'; }
    else if (mode === 'idle') { chip = 'is-idle'; chipTxt = '未开始'; }
    else if (reached) { chip = 'is-done'; chipTxt = '已达标'; }
    else { chip = 'is-live'; chipTxt = '计时中'; }
    var head = '<div class="day-head">' +
        '<span class="day-title">' + title + '</span>' +
        '<span class="day-chip ' + chip + '">' + chipTxt + '</span>' +
      '</div>';

    // ── 双栏 hero：左「已工作」，右随状态变化 ──
    var lVal, lLabel = '已工作', rVal, rLabel, rColor;
    if (mode === 'idle') {
      lVal = '--'; rVal = fmtDur(d.targetMin); rLabel = '今天还需'; rColor = 'var(--color-accent)';
    } else if (mode === 'done') {
      lVal = fmtDur(d.elapsedMin);
      var diffMin = d.elapsedMin - Math.round(std * 60);
      rVal = (diffMin >= 0 ? '+' : '-') + fmtDur(Math.abs(diffMin));
      rLabel = '相对标准';
      rColor = diffMin >= 0 ? 'var(--color-success)' : 'var(--color-danger)';
    } else if (reached) {
      lVal = fmtDur(d.elapsedMin);
      rVal = d.overMin > 0 ? '+' + fmtDur(d.overMin) : '已达标';
      rLabel = d.overMin > 0 ? '今日超额' : '今日目标';
      rColor = 'var(--color-success)';
    } else {
      lVal = fmtDur(d.elapsedMin); rVal = fmtDur(d.remainMin);
      rLabel = '今天还需'; rColor = 'var(--color-accent)';
    }
    var hero = '<div class="day-hero">' +
        '<div class="day-hero-col">' +
          '<span class="day-hero-value' + (mode === 'idle' ? ' is-empty' : '') + '">' + lVal + '</span>' +
          '<span class="day-hero-label">' + lLabel + '</span>' +
        '</div>' +
        '<span class="day-hero-sep" aria-hidden="true"></span>' +
        '<div class="day-hero-col">' +
          '<span class="day-hero-value" style="color:' + rColor + '">' + rVal + '</span>' +
          '<span class="day-hero-label">' + rLabel + '</span>' +
        '</div>' +
      '</div>';

    // ── 进度条 ──
    var track = '<div class="day-track-row">' +
        '<div class="day-track"><span class="day-track-fill" style="width:' + d.pct + '%;background:' + accent + '"></span></div>' +
        '<span class="day-track-pct" style="color:' + accent + '">' + d.pct + '%</span>' +
      '</div>';

    // ── 起止 meta ──
    var meta;
    if (mode === 'idle') {
      meta = '<div class="day-meta"><span class="day-meta-hint">打完上班卡开始计时</span></div>';
    } else if (mode === 'done') {
      meta = '<div class="day-meta">' +
          '<span class="day-meta-item"><b>' + escapeHtml(opts.startTime || '') + '</b> 上班</span>' +
          '<span class="day-meta-arrow" aria-hidden="true">→</span>' +
          '<span class="day-meta-item"><b>' + escapeHtml(opts.endTime || '') + '</b> 下班</span>' +
        '</div>';
    } else {
      meta = '<div class="day-meta">' +
          '<span class="day-meta-item"><b>' + escapeHtml(opts.startTime || '') + '</b> 上班</span>' +
          '<span class="day-meta-arrow" aria-hidden="true">→</span>' +
          '<span class="day-meta-item">预计 <b>' + (d.endStr || '--:--') + '</b> 下班</span>' +
        '</div>';
    }

    var remind = reached
      ? '<div class="day-remind">已够今日目标，记得打下班卡 💡</div>'
      : '';

    return head + hero + track + meta + remind;
  }

  // 计时中的卡片主体（记录页每 10s 重绘一次，所以单独出口）
  function dayLiveHtml(startTime, targetHours, std) {
    return dayBodyHtml(dayProgress('live', startTime, '', 0, targetHours),
      { mode: 'live', startTime: startTime, std: std });
  }

  // 今日卡（记录页）：完整卡片 = 主体 + 本月节奏底栏
  // ctx: { mode:'idle'|'live'|'done', startTime, endTime, hours }
  function dayCardHtml(p, ctx) {
    ctx = ctx || {};
    var mode = ctx.mode || 'idle';
    var std = (p && p.standardHours) || 8;
    var target = todayTargetOf(p, std);
    var d = dayProgress(mode === 'done' ? 'done' : mode, ctx.startTime, ctx.endTime, ctx.hours, target);

    // 底栏：本月节奏三组数字，点击进月度页。
    // 数字都带语义色（还差=红 / 每天需完成=强调色 / 超额=绿），
    // 这几项是用户最常扫的信息，不能只靠灰色小字。
    var facts = [];
    if (p) {
      if (p.status === 'done') {
        facts.push({ v: (p.need < 0 ? '+' + Math.abs(p.need).toFixed(1) : '0.0') + 'h', l: '本月超额', c: 'is-success' });
        facts.push({ v: p.done.toFixed(1) + 'h', l: '本月已完成', c: 'is-accent' });
        facts.push({ v: p.target + 'h', l: '本月目标', c: '' });
      } else if (p.status === 'overdue') {
        facts.push({ v: p.need.toFixed(1) + 'h', l: '本月还差', c: 'is-danger' });
        facts.push({ v: p.done.toFixed(1) + 'h', l: '本月已完成', c: 'is-accent' });
        facts.push({ v: p.target + 'h', l: '本月目标', c: '' });
      } else {
        facts.push({ v: p.need.toFixed(1) + 'h', l: '本月还差', c: 'is-danger' });
        facts.push({ v: p.perDay.toFixed(2) + 'h', l: '每天需完成', c: 'is-accent' });
        facts.push({ v: String(p.restDays), l: '剩余工作日', c: '' });
      }
    }
    var foot = facts.length
      ? '<div class="day-foot" onclick="openCurrentMonthFromPace()" role="button" tabindex="0" aria-label="' +
          escapeHtml(facts.map(function(f) { return f.l + ' ' + f.v; }).join('，')) + '，点击查看本月">' +
          '<div class="day-facts">' +
            facts.map(function(f, i) {
              return (i ? '<span class="day-fact-sep" aria-hidden="true"></span>' : '') +
                '<span class="day-fact"><b class="' + f.c + '">' + f.v + '</b><i>' + f.l + '</i></span>';
            }).join('') +
          '</div>' +
          '<span class="day-foot-more" aria-hidden="true">本月 ›</span>' +
        '</div>'
      : '';

    var cls = mode === 'done' ? 'is-done' : (mode === 'live' ? 'is-live' : 'is-idle');
    return '<div class="day-card ' + cls + '">' +
      '<div class="day-body" id="dayBody">' + dayBodyHtml(d, {
        mode: mode, startTime: ctx.startTime, endTime: ctx.endTime, std: std
      }) + '</div>' +
      foot +
    '</div>';
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
  WHT.getDayType = getDayType;
  WHT.isHoliday = isHoliday;
  WHT.isWeekend = isWeekend;
  WHT.getDayOfWeek = getDayOfWeek;
  WHT.countWorkDays = countWorkDays;
  WHT.setDayOverride = setDayOverride;
  WHT.dayTypePickerHtml = dayTypePickerHtml;
  WHT.setRestFlag = setRestFlag;
  WHT.formatDate = formatDate;
  WHT.formatDateShort = formatDateShort;
  WHT.calculateHours = calculateHours;
  WHT.getWeekDays = getWeekDays;
  WHT.getMonthDays = getMonthDays;
  WHT.getProgressClass = getProgressClass;
  WHT.diffColor = diffColor;
  WHT.paceClass = paceClass;
  WHT.addHoursToTime = addHoursToTime;
  WHT.fmtSignedHours = fmtSignedHours;
  WHT.remainingWorkDays = remainingWorkDays;
  WHT.clockStartOf = clockStartOf;
  WHT.monthPace = monthPace;
  WHT.quarterSummary = quarterSummary;
  WHT.quarterHasData = quarterHasData;
  WHT.quarterCarry = quarterCarry;
  WHT.quarterPace = quarterPace;
  WHT.quarterCardHtml = quarterCardHtml;
  WHT.dayCardHtml = dayCardHtml;
  WHT.dayLiveHtml = dayLiveHtml;
  WHT.dayProgress = dayProgress;
  WHT.liveHoursOf = liveHoursOf;
  WHT.recordHoursTextOf = recordHoursTextOf;
  WHT.startPageLiveTimer = startPageLiveTimer;
  WHT.stopPageLiveTimer = stopPageLiveTimer;
  WHT.todayTargetOf = todayTargetOf;
  WHT.fmtDur = fmtDur;
  WHT.toggleHoliday = toggleHoliday;
  WHT.haptic = haptic;

})();
