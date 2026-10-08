/* 月度视图：Month Dashboard */
(function() {
  "use strict";
  var WHT = window.WHT;
  var st = WHT.state;

  // 实时刷新时置 true → 跳过四卡的入场动画，否则每 10s 会闪一次
  var _suppressAnim = false;

  // 10s 心跳：重绘整页，让当天的进度环 / 已完成 / 差额 / 日历格跟着时间走。
  // 复用 renderCurrentTab(true) 以保留滚动位置；选中日期存在 st.selectedDay 里，不会丢。
  function refreshMonthLive() {
    if (st.currentTab !== 'month') { WHT.stopPageLiveTimer(); return; }
    var c = document.getElementById('pageContent');
    if (!c) { WHT.stopPageLiveTimer(); return; }
    _suppressAnim = true;
    WHT.renderCurrentTab(true);
    _suppressAnim = false;
  }

  function renderMonthPage(c) {
    var n = new Date();
    var totalMonths = n.getFullYear() * 12 + n.getMonth() + st.monthOffset;
    var y = Math.floor(totalMonths / 12);
    var m = ((totalMonths % 12) + 12) % 12;
    var ms = y + '-' + String(m + 1).padStart(2, '0');
    var d = WHT.getMonthDays(y, m);
    var r = WHT.getUserRecords();
    var s = WHT.getUserSettings();
    var md = WHT.getUserModes().find(function(x) { return x.id === st.currentMode; });
    var mr = r.filter(function(x) { return x.date.startsWith(ms); });
    // 追赶口径统一由 WHT.monthPace 计算（目标 / 已完成 / 剩余工作日 / 日均需求）
    var pace = WHT.monthPace(y, m);
    // 当天进行中的实时工时：只加进「显示口径」，让进度环 / 已完成 / 差额当天就实时走动。
    // 绝不能并进 pace.done —— 那是「日均」的分子，而日均的分母排除了当天，
    // 混进来会让日均随分钟虚高跳动（用户明确要求日均维持「打完下班卡再算」）。
    var live = pace.liveHours || 0;
    var doneSettled = pace.done;          // 已收工工时：算日均用
    var th = doneSettled + live;          // 已完成（含今天实时）：进度环/四卡用
    var tar = pace.target;
    var workDays = pace.workDays;
    // diff 沿用既有语义：正数 = 超额领先，负数 = 还差（pace.need 是「还需」，故取反）
    var diff = th - tar;
    var pg = tar > 0 ? Math.min(100, (th / tar) * 100) : 0;
    // 空状态按「有没有记录」判定，而不是「已收工工时是不是 0」：
    // 只在节假日上过班、或今天刚打上班卡时，都不该整页显示「待开始」。
    var isEmpty = mr.length === 0;
    // 进度节奏改用工作日口径（已过工作日 / 本月总工作日），与追赶提示同源
    var passedRatio = workDays > 0 ? Math.min(1, pace.elapsedWorkDays / workDays) : 1;
    var ringClass = WHT.paceClass(pg, passedRatio * 100, isEmpty);
    var diffC = WHT.diffColor(diff);

    // 调休余额
    var cb = 0;
    if (md && md.type === 'flextime') {
      var comp = WHT.getUserCompTime();
      cb = comp.reduce(function(a, x) { return a + (x.type === 'earn' ? x.hours : -x.hours); }, 0);
    }

    var hf = pace.holidayHours * (s.holidayRate || 0);

    var radius = 80;
    var circumference = Math.PI * radius;
    var offset = circumference - (pg / 100) * circumference;

    // 日均 = 已收工工时 ÷ 已工作天数（两者都排除当天）→ 不受实时工时影响
    var monthWorkedDays = mr.filter(function(x) { return !WHT.isHoliday(x.date) && x.status !== 'working'; }).length;
    var monthAvg = monthWorkedDays > 0 ? (doneSettled / monthWorkedDays) : 0;

    var statsHtml = '<div class="quarter-stats-grid">' +
      '<div class="quarter-stat-card">' +
        '<div class="quarter-stat-icon">🎯</div>' +
        '<div class="quarter-stat-value">' + (isEmpty ? '<span class="empty-text">待开始</span>' : tar + 'h') + '</div>' +
        '<div class="quarter-stat-label">目标(h)</div>' +
      '</div>' +
      '<div class="quarter-stat-card">' +
        '<div class="quarter-stat-icon">✅</div>' +
        '<div class="quarter-stat-value">' + (isEmpty ? '<span class="empty-text">待开始</span>' : th.toFixed(1) + 'h') + '</div>' +
        '<div class="quarter-stat-label">实际(h)</div>' +
      '</div>' +
      '<div class="quarter-stat-card">' +
        '<div class="quarter-stat-icon">' + (diff >= 0 ? '📈' : '📉') + '</div>' +
        '<div class="quarter-stat-value" style="color:' + diffC + '">' +
          (isEmpty ? '<span class="empty-text">待开始</span>' : (diff >= 0 ? '+' : '') + diff.toFixed(1) + 'h') +
        '</div>' +
        '<div class="quarter-stat-label">差额(h)</div>' +
      '</div>' +
      (md && md.type === 'flextime' ?
        '<div class="quarter-stat-card">' +
          '<div class="quarter-stat-icon">🏝️</div>' +
          '<div class="quarter-stat-value">' + cb.toFixed(1) + 'h</div>' +
          '<div class="quarter-stat-label">调休余额</div>' +
        '</div>' :
        '<div class="quarter-stat-card">' +
          '<div class="quarter-stat-icon">💰</div>' +
          '<div class="quarter-stat-value">' + (hf === 0 ? '<span class="empty-text">¥0.00</span>' : '¥' + hf.toFixed(2)) + '</div>' +
          '<div class="quarter-stat-label">加班费(元)</div>' +
        '</div>'
      ) +
    '</div>';

    var ringHtml = '<div class="quarter-ring-container">' +
      '<svg class="quarter-ring" viewBox="0 0 200 110">' +
        '<path class="quarter-ring-bg" d="M 10 100 A 80 80 0 0 1 190 100" />' +
        '<path class="quarter-ring-fill ' + ringClass + '" d="M 10 100 A 80 80 0 0 1 190 100" ' +
          'stroke-dasharray="' + circumference + '" stroke-dashoffset="' + (isEmpty ? circumference : offset) + '" pathLength="' + circumference + '" />' +
      '</svg>' +
      '<div class="quarter-ring-center">' +
        '<div class="quarter-ring-pct">' + (isEmpty ? '待开始' : pg.toFixed(0) + '%') + '</div>' +
        '<div class="quarter-ring-label">' + (m + 1) + '月 进度</div>' +
      '</div>' +
      '<div class="quarter-ring-detail">' +
        '已完成 <strong>' + th.toFixed(1) + 'h</strong> · ' +
        '目标 <strong>' + tar + 'h</strong> · ' +
        (monthWorkedDays > 0 ? '日均 <strong>' + monthAvg.toFixed(1) + 'h</strong>' : '') +
      '</div>' +
    '</div>';

    var navHtml = '<div class="month-nav">' +
      '<button class="month-nav-btn" onclick="changeMonth(-1)">&#9664;</button>' +
      '<div class="month-nav-title" onclick="openMonthPicker()" style="cursor:pointer;-webkit-tap-highlight-color:transparent">' + y + '年' + (m + 1) + '月</div>' +
      '<div class="month-nav-right">' +
        (st.monthOffset !== 0 ? '<button class="month-nav-today" onclick="goToCurrentMonth()">本月</button>' : '') +
        '<button class="month-nav-btn" onclick="changeMonth(1)">&#9654;</button>' +
      '</div>' +
    '</div>';

    var fd = new Date(y, m, 1).getDay();
    var startOffset = fd === 0 ? 6 : fd - 1;
    var calCells = '';
    for (var i = 0; i < startOffset; i++) calCells += '<div class="calendar-day empty"></div>';
    d.forEach(function(x) {
      var rec = r.find(function(y) { return y.date === x; });
      var cls = ['calendar-day'];
      var dt = WHT.getDayType(x);
      if (x === WHT.today()) cls.push('today');
      if (rec) {
        cls.push('has-record');
      } else if (dt.type === 'holiday') {
        cls.push('is-holiday');
      } else if (dt.type === 'workday') {
        cls.push('is-compensatory');
      } else if (dt.type === 'rest') {
        cls.push('is-rest');
      } else if (dt.type === 'weekend') {
        cls.push(md && md.type === 'comprehensive' ? 'is-weekend' : 'is-rest');
      }
      if (st.selectedDay === x) cls.push('calendar-day-selected');
      var xd = new Date(x + 'T00:00:00');
      var recText = rec ? WHT.recordHoursTextOf(rec) : '';
      var ariaLabel = (xd.getMonth() + 1) + '月' + xd.getDate() + '日 ' + dt.label +
        (rec ? (recText === '进行中' ? '，进行中' : '，已记录 ' + recText) : '');
      calCells += '<div class="' + cls.join(' ') + '" onclick="selectMonthDay(\'' + x + '\')" oncontextmenu="event.preventDefault();toggleHoliday(\'' + x + '\')" role="button" tabindex="0" aria-label="' + ariaLabel + '">' +
        xd.getDate() +
        (rec ? '<div class="calendar-day-hours">' + recText + '</div>' : '') +
        (dt.badge ? '<div class="calendar-day-holiday-badge' + (dt.badge === '班' ? ' is-work' : '') + '" title="' + dt.label + '" aria-hidden="true">' + dt.badge + '</div>' : '') +
      '</div>';
    });

    var calHtml = '<div class="bento bento-wide calendar">' +
      '<div class="calendar-header"><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span></div>' +
      '<div class="calendar-grid">' + calCells + '</div>' +
      '<div class="calendar-hint">点击日期可设置「上班 / 休息 / 节假日」</div>' +
    '</div>';

    // 「接下来每天需完成」卡片已按要求移除；该信息保留在记录页今日卡的底栏。
    c.innerHTML = navHtml + statsHtml + ringHtml + calHtml + '<div id="monthDetail"></div>';

    if (!st.selectedDay) st.selectedDay = d.includes(WHT.today()) ? WHT.today() : d[0];
    renderMonthDetail(st.selectedDay);

    // 今天有进行中的记录 → 启动 10s 心跳（只此一处，切页或未收工消失时自停）
    if (WHT.liveHoursOf(mr.find(function(x) { return x.date === WHT.today(); })) !== null) {
      WHT.startPageLiveTimer(refreshMonthLive);
    } else {
      WHT.stopPageLiveTimer();
    }

    if (!_suppressAnim) requestAnimationFrame(function() {
      var cards = c.querySelectorAll('.quarter-stat-card');
      cards.forEach(function(card, i) {
        card.style.opacity = '0';
        card.style.transform = 'translateY(8px)';
        setTimeout(function() {
          card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
          card.style.opacity = '1';
          card.style.transform = 'translateY(0)';
        }, 50 + i * 50);
      });
    });
  }

  function renderMonthDetail(d) {
    var r = WHT.getUserRecords().find(function(x) { return x.date === d; });
    var el = document.getElementById('monthDetail');
    if (!el) return;
    var dt = WHT.getDayType(d);
    var picker = WHT.dayTypePickerHtml(d);
    if (r) {
      var isWorking = r.status === 'working' || (!r.endTime && r.startTime);
      // 与日历格同源：进行中且有实时值就直接显示它
      var hoursText = WHT.recordHoursTextOf(r);
      el.innerHTML = '<div class="bento week-detail">' +
        '<div class="week-detail-row"><span class="week-detail-label">日期</span><span class="week-detail-value">' + WHT.formatDate(r.date) + '</span></div>' +
        '<div class="week-detail-row"><span class="week-detail-label">上班</span><span class="week-detail-value">' + WHT.escapeHtml(r.startTime) + '</span></div>' +
        '<div class="week-detail-row"><span class="week-detail-label">下班</span><span class="week-detail-value">' + (isWorking ? '<span style="color:var(--color-warning)">等待中...</span>' : WHT.escapeHtml(r.endTime)) + '</span></div>' +
        '<div class="week-detail-row"><span class="week-detail-label">工时</span><span class="week-detail-value">' + (hoursText === '进行中' ? '<span style="color:var(--color-warning)">进行中</span>' : hoursText) + '</span></div>' +
        '<div class="week-detail-row"><span class="week-detail-label">类型</span><span class="week-detail-value">' + dt.label + '</span></div>' +
        (r.note ? '<div class="week-detail-row"><span class="week-detail-label">备注</span><span class="week-detail-value">' + WHT.escapeHtml(r.note) + '</span></div>' : '') +
        picker +
      '</div>';
    } else {
      el.innerHTML = '<div class="empty-state" style="padding:12px"><div class="empty-state-text">当天无记录</div>' + picker + '</div>';
    }
  }

  function selectMonthDay(d) { WHT.haptic('light'); st.selectedDay = st.selectedDay === d ? null : d; WHT.renderCurrentTab(true); }
  function changeMonth(dir) { WHT.haptic('light'); st.monthOffset += dir; st.selectedDay = null; WHT.renderCurrentTab(true); }
  function goToCurrentMonth() { WHT.haptic('medium'); st.monthOffset = 0; st.selectedDay = null; WHT.renderCurrentTab(true); }

  // 记录页的追赶提示条点击入口：回到本月并切到月度页
  function openCurrentMonthFromPace() {
    WHT.haptic('light');
    st.monthOffset = 0;
    st.selectedDay = null;
    WHT.switchTab('month');
  }

  // ── 月份快速选择器 ──
  var mpYear = 0;

  function openMonthPicker() {
    WHT.haptic('light');
    var n = new Date();
    var totalMonths = n.getFullYear() * 12 + n.getMonth() + st.monthOffset;
    mpYear = Math.floor(totalMonths / 12);
    renderMonthPicker();
    document.getElementById('monthPickerOverlay').classList.add('active');
  }

  function closeMonthPicker() {
    document.getElementById('monthPickerOverlay').classList.remove('active');
  }

  function renderMonthPicker() {
    document.getElementById('monthPickerYear').textContent = mpYear + '年';
    var n = new Date();
    var curTotalMonths = n.getFullYear() * 12 + n.getMonth() + st.monthOffset;
    var curYear = Math.floor(curTotalMonths / 12);
    var curMonth = ((curTotalMonths % 12) + 12) % 12;
    var grid = '';
    for (var i = 0; i < 12; i++) {
      var cls = 'picker-month-cell';
      if (mpYear === curYear && i === curMonth) cls += ' selected';
      if (i === n.getMonth() && mpYear === n.getFullYear()) cls += ' current';
      grid += '<button class="' + cls + '" onclick="selectPickerMonth(' + i + ')">' + (i + 1) + '月</button>';
    }
    document.getElementById('monthPickerGrid').innerHTML = grid;
  }

  function changePickerYear(dir) {
    WHT.haptic('light');
    mpYear += dir;
    renderMonthPicker();
  }

  function selectPickerMonth(m) {
    WHT.haptic('medium');
    var n = new Date();
    st.monthOffset = (mpYear - n.getFullYear()) * 12 + (m - n.getMonth());
    st.selectedDay = null;
    closeMonthPicker();
    WHT.renderCurrentTab(true);
  }

  function confirmMonthPicker() {
    var grid = document.getElementById('monthPickerGrid');
    var selected = grid.querySelector('.picker-month-cell.selected');
    if (selected) {
      var monthText = selected.textContent;
      var m = parseInt(monthText) - 1;
      selectPickerMonth(m);
    } else {
      closeMonthPicker();
    }
  }

  WHT.renderMonthPage = renderMonthPage;
  WHT.selectMonthDay = selectMonthDay;
  WHT.changeMonth = changeMonth;
  WHT.goToCurrentMonth = goToCurrentMonth;
  WHT.openCurrentMonthFromPace = openCurrentMonthFromPace;
  WHT.openMonthPicker = openMonthPicker;
  WHT.closeMonthPicker = closeMonthPicker;
  WHT.changePickerYear = changePickerYear;
  WHT.selectPickerMonth = selectPickerMonth;
  WHT.confirmMonthPicker = confirmMonthPicker;

})();
