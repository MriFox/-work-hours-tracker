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

  // 差额颜色：周期未过半时用中性色，避免刚开始就一片红
  function diffColor(diff, passedRatio) {
    if (diff >= 0) return 'var(--color-success)';
    return (passedRatio >= 0.5) ? 'var(--color-danger)' : 'var(--text-secondary)';
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

    return {
      y: y, m: m, monthStr: ms,
      standardHours: std, modeType: mt, workDays: workDays,
      target: target, done: done, holidayHours: holidayHours, need: need,
      restDays: restDays, elapsedWorkDays: elapsedWorkDays,
      perDay: perDay, status: status, todayCounts: todayCounts,
      isCurrentMonth: isCurrentMonth,
      clockStart: clockStart, clockEnd: clockEnd,
      actualStart: actualStart, actualEnd: actualEnd
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
    var perQuarter = (status === 'chase' && restQuarter > 0) ? need / restQuarter : 0;
    var perYear = (status === 'chase' && restYear > 0) ? need / restYear : 0;

    // 下班时间换算挂在更宽松的「到年底」口径上（季度内那个常常不可达）
    var clockScope = perYear > 0 ? '到年底' : (perQuarter > 0 ? '本季度内' : '');
    var clockBase = perYear > 0 ? perYear : perQuarter;
    var clockStart = clockStartOf();
    var clockEnd = (clockBase > 0 && clockBase <= 16) ? addHoursToTime(clockStart, clockBase) : '';

    return {
      carry: carry, dev: sum.dev, cumulative: cumulative, need: need,
      actual: sum.actual, target: sum.target, holidayHours: sum.holidayHours,
      workDays: sum.workDays, workedDays: sum.workedDays, perMonth: sum.perMonth,
      restQuarter: restQuarter, restYear: restYear,
      perQuarter: perQuarter, perYear: perYear,
      status: status, isCurrentYear: qy === new Date().getFullYear(),
      clockScope: clockScope, clockStart: clockStart, clockEnd: clockEnd
    };
  }

  // 季度累计卡片（季度页）
  function quarterCardHtml(p) {
    if (!p || !p.isCurrentYear) return '';
    var cls, title, num, footer = '';
    if (p.status === 'done') {
      cls = 'is-done';
      title = '年度累计已达标';
      num = (p.cumulative > 0 ? fmtSignedHours(p.cumulative) : '0.0h');
    } else if (p.status === 'overdue') {
      cls = 'is-overdue';
      title = '今年工作日已用完';
      num = p.need.toFixed(1) + 'h';
    } else {
      cls = 'is-chase';
      title = '累计仍差';
      num = p.need.toFixed(1) + 'h';
    }

    var horizons = '';
    if (p.status === 'chase') {
      if (p.perQuarter > 0) {
        horizons += '<div class="qcum-horizon">' +
          '<span class="qcum-horizon-label">本季度内还清</span>' +
          '<span class="qcum-horizon-value">' + p.perQuarter.toFixed(2) + '<span class="qcum-horizon-unit">h/天</span></span>' +
          '<span class="qcum-horizon-days">剩 ' + p.restQuarter + ' 天</span>' +
        '</div>';
      }
      if (p.perYear > 0 && p.restYear !== p.restQuarter) {
        horizons += '<div class="qcum-horizon">' +
          '<span class="qcum-horizon-label">到年底还清</span>' +
          '<span class="qcum-horizon-value">' + p.perYear.toFixed(2) + '<span class="qcum-horizon-unit">h/天</span></span>' +
          '<span class="qcum-horizon-days">剩 ' + p.restYear + ' 天</span>' +
        '</div>';
      }
      if (p.clockEnd) {
        footer = '<div class="qcum-clock"><span class="qcum-clock-dot" aria-hidden="true"></span>' +
          '按 ' + p.clockStart + ' 上班计 · ' + p.clockScope + '约 <strong>' + p.clockEnd + '</strong> 下班</div>';
      }
    }

    return '<div class="qcum-card ' + cls + '">' +
      '<div class="qcum-head">' +
        '<span class="qcum-tag">年度累计结转</span>' +
        '<span class="qcum-edit">设置期初结余 ›</span>' +
      '</div>' +
      '<div class="qcum-chips">' +
        '<span class="qcum-chip">期初结余 <strong class="' + (p.carry < 0 ? 'neg' : p.carry > 0 ? 'pos' : '') + '">' + fmtSignedHours(p.carry) + '</strong></span>' +
        '<span class="qcum-chip">本季度 <strong class="' + (p.dev < 0 ? 'neg' : p.dev > 0 ? 'pos' : '') + '">' + fmtSignedHours(p.dev) + '</strong></span>' +
      '</div>' +
      '<div class="qcum-main">' +
        '<span class="qcum-label">' + title + '</span>' +
        '<span class="qcum-value">' + num + '</span>' +
      '</div>' +
      horizons +
      footer +
    '</div>';
  }

  // 追赶卡片（月度页）：完整信息
  function paceCardHtml(p) {
    if (!p) return '';
    var cls, label, num, sub, clock = '';
    if (p.status === 'done') {
      cls = 'is-done';
      label = p.need < 0 ? '本月已达标，超额' : '本月已达标';
      num = (p.need < 0 ? '+' + Math.abs(p.need).toFixed(1) : '0.0') + 'h';
      sub = '已完成 ' + p.done.toFixed(1) + 'h · 目标 ' + p.target + 'h';
    } else if (p.status === 'overdue') {
      cls = 'is-overdue';
      label = p.isCurrentMonth === false ? '该月工作日已结束' : '本月工作日已用完';
      num = p.need.toFixed(1) + 'h';
      // 只有当月才能靠「加调休补班日」补救，过去月份只能补录
      sub = p.isCurrentMonth === false
        ? '还差这么多 · 可补录记录'
        : '还差这么多 · 可补录记录，或把周末设为上班';
    } else {
      cls = 'is-chase';
      label = '接下来每天需完成';
      num = p.perDay.toFixed(2) + 'h';
      sub = '剩余 ' + p.restDays + ' 个工作日 · 共需完成 ' + p.need.toFixed(1) + 'h';
      if (p.clockEnd) {
        clock = '<div class="pace-clock"><span class="pace-clock-dot" aria-hidden="true"></span>' +
          p.clockStart + ' 上班 → 约 <strong>' + p.clockEnd + '</strong> 下班</div>';
      }
    }
    return '<div class="pace-card ' + cls + '">' +
      '<div class="pace-card-head"><span class="pace-card-tag">按工作日节奏</span></div>' +
      '<div class="pace-card-main">' +
        '<span class="pace-card-label">' + label + '</span>' +
        '<span class="pace-card-value">' + num + '</span>' +
      '</div>' +
      '<div class="pace-card-sub">' + sub + '</div>' +
      clock +
    '</div>';
  }

  // 追赶提示条（记录页）：一行，点击进月度页
  function paceHintHtml(p) {
    if (!p) return '';
    var cls, main, sub, aria;
    if (p.status === 'done') {
      cls = 'is-done';
      main = '本月已达标';
      sub = p.need < 0 ? '超额 ' + Math.abs(p.need).toFixed(1) + 'h，可以早点收工了' : '刚好完成本月目标';
      aria = main + '，' + sub;
    } else if (p.status === 'overdue') {
      cls = 'is-overdue';
      main = '本月工作日已用完';
      sub = '还差 ' + p.need.toFixed(1) + 'h，可补录记录';
      aria = main + '，' + sub;
    } else {
      cls = 'is-chase';
      var who = p.todayCounts ? '今天还需 ' : '每个工作日还需 ';
      main = who + '<span class="pace-hint-value">' + p.perDay.toFixed(2) + 'h</span>';
      // 记录页：优先用今天真实的打卡时间倒推收工点（打了卡就按打卡时间算），
      // 没打卡 / 今天已收工（perDay 描述的是以后的工作日）时才退回设置里的常用上班时间。
      var cStart = p.actualStart || p.clockStart;
      var cEnd = p.actualStart ? p.actualEnd : p.clockEnd;
      var clockTxt = cEnd ? cStart + ' 上班 → 约 ' + cEnd + ' 下班 · ' : '';
      sub = clockTxt + '本月还差 ' + p.need.toFixed(1) + 'h';
      aria = who + p.perDay.toFixed(2) + '小时，' +
             (cEnd ? cStart + '上班约 ' + cEnd + ' 下班，' : '') +
             '本月还差 ' + p.need.toFixed(1) + '小时';
    }
    return '<div class="pace-hint ' + cls + '" onclick="openCurrentMonthFromPace()" role="button" tabindex="0" aria-label="' + aria + '">' +
      '<div class="pace-hint-text">' +
        '<div class="pace-hint-main">' + main + '</div>' +
        '<div class="pace-hint-sub">' + sub + '</div>' +
      '</div>' +
      '<span class="pace-hint-more" aria-hidden="true">本月 ›</span>' +
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
  WHT.paceCardHtml = paceCardHtml;
  WHT.paceHintHtml = paceHintHtml;
  WHT.toggleHoliday = toggleHoliday;
  WHT.haptic = haptic;

})();
