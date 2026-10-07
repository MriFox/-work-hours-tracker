/* 周视图：本周工时统计 / 进度条 */
(function() {
  "use strict";
  var WHT = window.WHT;
  var st = WHT.state;
  var dayNames = ['日','一','二','三','四','五','六'];

  function renderWeekPage(c) {
    var d = WHT.getWeekDays(st.weekOffset);
    var r = WHT.getUserRecords();
    var s = WHT.getUserSettings();
    var ws = d.reduce(function(a, x) { var rec = r.find(function(y) { return y.date === x; }); if (rec && !WHT.isHoliday(x) && rec.status !== 'working') { a.total += rec.hours; a.days++; } return a; }, { total: 0, days: 0 });
    var wS = new Date(d[0] + 'T00:00:00');
    var wE = new Date(d[6] + 'T00:00:00');
    var md = WHT.getUserModes().find(function(x) { return x.id === st.currentMode; });
    var workDays = WHT.countWorkDays(d, md && md.type, s.flextimeConfig);
    var t = s.standardHours * workDays;
    var diff = ws.total - t;
    var isCurrentWeek = st.weekOffset === 0;
    var pct = t > 0 ? Math.min(100, Math.round(ws.total / t * 100)) : 0;
    var isEmpty = ws.total === 0;
    var todayStr = WHT.today();
    var todayIdx = d.indexOf(todayStr);
    var daysPassed = todayIdx >= 0 ? todayIdx + 1 : 7;
    var passedRatio = daysPassed / 7;
    var expectedPct = Math.min(100, Math.round(passedRatio * 100));
    var pctClass = WHT.paceClass(pct, expectedPct, isEmpty);
    var diffC = WHT.diffColor(diff, passedRatio);
    var avg = ws.days > 0 ? (ws.total / ws.days) : 0;
    var circumference = 2 * Math.PI * 80 * 180 / 360;
    var offset = isEmpty ? circumference : circumference * (1 - pct / 100);

    var hh = r.filter(function(x) { return WHT.isHoliday(x.date) && d.includes(x.date); }).reduce(function(a, x) { return a + x.hours; }, 0);
    var hf = hh * (s.holidayRate || 0);

    c.innerHTML = '<div class="week-nav">' +
      '<button class="week-nav-btn" onclick="changeWeek(-1)">&#9664;</button>' +
      '<div class="week-nav-title">' + (wS.getMonth() + 1) + '月' + wS.getDate() + '日 — ' + (wE.getMonth() + 1) + '月' + wE.getDate() + '日</div>' +
      '<div class="week-nav-right">' +
        (isCurrentWeek ? '' : '<button class="week-nav-today" onclick="goToCurrentWeek()">本周</button>') +
        '<button class="week-nav-btn" onclick="changeWeek(1)">&#9654;</button>' +
      '</div>' +
    '</div>' +
    '<div class="quarter-stats-grid">' +
      '<div class="quarter-stat-card"><div class="quarter-stat-icon">🎯</div><div class="quarter-stat-value">' + t + 'h</div><div class="quarter-stat-label">目标(h)</div></div>' +
      '<div class="quarter-stat-card"><div class="quarter-stat-icon">✅</div><div class="quarter-stat-value">' + ws.total.toFixed(1) + 'h</div><div class="quarter-stat-label">实际(h)</div></div>' +
      '<div class="quarter-stat-card"><div class="quarter-stat-icon">' + (diff >= 0 ? '📈' : '📉') + '</div><div class="quarter-stat-value" style="color:' + diffC + '">' + (diff >= 0 ? '+' : '') + diff.toFixed(1) + 'h</div><div class="quarter-stat-label">差额(h)</div></div>' +
      '<div class="quarter-stat-card"><div class="quarter-stat-icon">💰</div><div class="quarter-stat-value">' + (hf === 0 ? '<span class="empty-text">¥0.00</span>' : '¥' + hf.toFixed(2)) + '</div><div class="quarter-stat-label">加班费(元)</div></div>' +
    '</div>' +
    '<div class="week-days">' +
      d.map(function(x) {
        var rec = r.find(function(y) { return y.date === x; });
        var w = dayNames[new Date(x + 'T00:00:00').getDay()];
        var isToday = x === todayStr;
        var isSel = st.selectedDay === x;
        var cls = 'week-day';
        if (isToday) cls += ' today';
        if (isSel) cls += ' selected';
        var dt = WHT.getDayType(x);
        if (rec) cls += ' has-record';
        else if (dt.type === 'holiday') cls += ' is-holiday';
        else if (dt.type === 'workday') cls += ' is-compensatory';
        else if (dt.type === 'weekend') cls += ' is-rest';
        var xw = new Date(x + 'T00:00:00');
        var ariaLabel = (xw.getMonth() + 1) + '月' + xw.getDate() + '日 周' + w + ' ' + dt.label + (rec ? '，已记录 ' + rec.hours.toFixed(1) + ' 小时' : '');
        return '<div class="' + cls + '" onclick="selectWeekDay(\'' + x + '\')" oncontextmenu="event.preventDefault();toggleHoliday(\'' + x + '\')" role="button" tabindex="0" aria-label="' + ariaLabel + '">' +
          '<div class="week-day-name">' + w + '</div>' +
          '<div class="week-day-date">' + xw.getDate() + '</div>' +
          '<div class="week-day-hours">' + (rec ? (rec.status === 'working' || (!rec.endTime && rec.startTime) ? '进行中' : rec.hours.toFixed(1) + 'h') : '') + '</div>' +
          (dt.badge ? '<div class="holiday-badge' + (dt.badge === '班' ? ' holiday-badge-work' : '') + '" title="' + dt.label + '" aria-hidden="true">' + dt.badge + '</div>' : '') +
        '</div>';
      }).join('') +
    '</div>' +
    '<div class="quarter-ring-container">' +
      '<svg class="quarter-ring" viewBox="0 0 200 110">' +
        '<path class="quarter-ring-bg" d="M 10 100 A 80 80 0 0 1 190 100" />' +
        '<path class="quarter-ring-fill ' + pctClass + '" d="M 10 100 A 80 80 0 0 1 190 100" ' +
          'stroke-dasharray="' + circumference + '" stroke-dashoffset="' + offset + '" pathLength="' + circumference + '" />' +
      '</svg>' +
      '<div class="quarter-ring-center">' +
        '<div class="quarter-ring-pct">' + pct + '%</div>' +
        '<div class="quarter-ring-label">本周进度</div>' +
      '</div>' +
      '<div class="quarter-ring-detail">' +
        '已完成 <strong>' + ws.total.toFixed(1) + 'h</strong> · ' +
        '目标 <strong>' + t + 'h</strong> · ' +
        (ws.days > 0 ? '日均 <strong>' + avg.toFixed(1) + 'h</strong>' : '') +
      '</div>' +
    '</div>' +
    '<div id="weekDetailWrap"></div>';

    if (!st.selectedDay) st.selectedDay = d.includes(todayStr) ? todayStr : d[0];
    renderWeekDetail(st.selectedDay);

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

  function renderWeekDetail(d) {
    var el = document.getElementById('weekDetailWrap');
    if (!el) return;
    if (!d) {
      el.innerHTML = '<div class="week-detail-empty"><div class="week-detail-empty-icon">📅</div><div class="week-detail-empty-text">选择上方某天查看详细记录</div><div class="week-detail-empty-hint">或切换到「记录」页面添加工时</div></div>';
      return;
    }
    var rec = WHT.getUserRecords().find(function(x) { return x.date === d; });
    var isWorking = rec && (rec.status === 'working' || (!rec.endTime && rec.startTime));
    var dt = WHT.getDayType(d);
    var picker = WHT.dayTypePickerHtml(d);
    if (!rec) {
      el.innerHTML = '<div class="week-detail-empty"><div class="week-detail-empty-icon">📋</div><div class="week-detail-empty-text">' + WHT.formatDate(d) + ' 无记录</div><div class="week-detail-empty-hint">点击下方「记录」标签页可添加工时</div>' + picker + '</div>';
      return;
    }
    el.innerHTML = '<div class="bento week-detail">' +
      '<div class="week-detail-row"><span class="week-detail-label">日期</span><span class="week-detail-value">' + WHT.formatDate(rec.date) + '</span></div>' +
      '<div class="week-detail-row"><span class="week-detail-label">上班</span><span class="week-detail-value">' + WHT.escapeHtml(rec.startTime) + '</span></div>' +
      '<div class="week-detail-row"><span class="week-detail-label">下班</span><span class="week-detail-value">' + (isWorking ? '<span style="color:var(--color-warning)">等待中...</span>' : WHT.escapeHtml(rec.endTime)) + '</span></div>' +
      '<div class="week-detail-row"><span class="week-detail-label">工时</span><span class="week-detail-value">' + (isWorking ? '<span style="color:var(--color-warning)">进行中</span>' : rec.hours.toFixed(1) + 'h') + '</span></div>' +
      '<div class="week-detail-row"><span class="week-detail-label">类型</span><span class="week-detail-value">' + dt.label + '</span></div>' +
      (rec.note ? '<div class="week-detail-row"><span class="week-detail-label">备注</span><span class="week-detail-value">' + WHT.escapeHtml(rec.note) + '</span></div>' : '') +
      picker +
    '</div>';
  }

  function selectWeekDay(d) { WHT.haptic('light'); st.selectedDay = st.selectedDay === d ? null : d; WHT.renderCurrentTab(true); }
  function changeWeek(dir) { WHT.haptic('light'); st.weekOffset += dir; st.selectedDay = null; WHT.renderCurrentTab(true); }
  function goToCurrentWeek() { WHT.haptic('medium'); st.weekOffset = 0; st.selectedDay = null; WHT.renderCurrentTab(true); }

  WHT.renderWeekPage = renderWeekPage;
  WHT.renderWeekDetail = renderWeekDetail;
  WHT.selectWeekDay = selectWeekDay;
  WHT.changeWeek = changeWeek;
  WHT.goToCurrentWeek = goToCurrentWeek;

})();
