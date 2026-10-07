/* 月度视图：Month Dashboard */
(function() {
  "use strict";
  var WHT = window.WHT;
  var st = WHT.state;

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
    var th = pace.done;
    var tar = pace.target;
    var workDays = pace.workDays;
    // diff 沿用既有语义：正数 = 超额领先，负数 = 还差（pace.need 是「还需」，故取反）
    var diff = th - tar;
    var pg = tar > 0 ? Math.min(100, (th / tar) * 100) : 0;
    // 「待开始」只表示本月完全没有记录。若沿用 th === 0，则「只在节假日上过班」
    // 也会被判定成未开始，整页显示「待开始」，与旁边的加班费自相矛盾。
    var isEmpty = !mr.some(function(x) { return x.status !== 'working'; });
    // 进度节奏改用工作日口径（已过工作日 / 本月总工作日），与追赶提示同源
    var passedRatio = workDays > 0 ? Math.min(1, pace.elapsedWorkDays / workDays) : 1;
    var ringClass = WHT.paceClass(pg, passedRatio * 100, isEmpty);
    var diffC = WHT.diffColor(diff, passedRatio);

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

    var monthWorkedDays = mr.filter(function(x) { return !WHT.isHoliday(x.date) && x.status !== 'working'; }).length;
    var monthAvg = monthWorkedDays > 0 ? (th / monthWorkedDays) : 0;

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

    // 节假日工时进加班费、不进目标，实际显示 0 时容易被误判成「加班费没算」
    var holidayNote = pace.holidayHours > 0
      ? '<div class="stat-note">节假日 <strong>' + pace.holidayHours.toFixed(1) + 'h</strong> 已计入加班费，不计入目标工时</div>'
      : '';

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
      var ariaLabel = (xd.getMonth() + 1) + '月' + xd.getDate() + '日 ' + dt.label + (rec ? '，已记录 ' + rec.hours.toFixed(1) + ' 小时' : '');
      calCells += '<div class="' + cls.join(' ') + '" onclick="selectMonthDay(\'' + x + '\')" oncontextmenu="event.preventDefault();toggleHoliday(\'' + x + '\')" role="button" tabindex="0" aria-label="' + ariaLabel + '">' +
        xd.getDate() +
        (rec ? '<div class="calendar-day-hours">' + (rec.status === 'working' || (!rec.endTime && rec.startTime) ? '进行中' : rec.hours.toFixed(1) + 'h') + '</div>' : '') +
        (dt.badge ? '<div class="calendar-day-holiday-badge' + (dt.badge === '班' ? ' is-work' : '') + '" title="' + dt.label + '" aria-hidden="true">' + dt.badge + '</div>' : '') +
      '</div>';
    });

    var calHtml = '<div class="bento bento-wide calendar">' +
      '<div class="calendar-header"><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span></div>' +
      '<div class="calendar-grid">' + calCells + '</div>' +
      '<div class="calendar-hint">点击日期可设置「上班 / 休息 / 节假日」</div>' +
    '</div>';

    var paceHtml = WHT.paceCardHtml(pace);

    c.innerHTML = navHtml + statsHtml + holidayNote + ringHtml + paceHtml + calHtml + '<div id="monthDetail"></div>';

    if (!st.selectedDay) st.selectedDay = d.includes(WHT.today()) ? WHT.today() : d[0];
    renderMonthDetail(st.selectedDay);

    requestAnimationFrame(function() {
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
      el.innerHTML = '<div class="bento week-detail">' +
        '<div class="week-detail-row"><span class="week-detail-label">日期</span><span class="week-detail-value">' + WHT.formatDate(r.date) + '</span></div>' +
        '<div class="week-detail-row"><span class="week-detail-label">上班</span><span class="week-detail-value">' + WHT.escapeHtml(r.startTime) + '</span></div>' +
        '<div class="week-detail-row"><span class="week-detail-label">下班</span><span class="week-detail-value">' + (isWorking ? '<span style="color:var(--color-warning)">等待中...</span>' : WHT.escapeHtml(r.endTime)) + '</span></div>' +
        '<div class="week-detail-row"><span class="week-detail-label">工时</span><span class="week-detail-value">' + (isWorking ? '<span style="color:var(--color-warning)">进行中</span>' : r.hours.toFixed(1) + 'h') + '</span></div>' +
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
