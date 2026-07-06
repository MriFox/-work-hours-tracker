/* 周视图：本周工时统计 / 进度条 */
(function() {
  "use strict";
  var WHT = window.WHT;
  var st = WHT.state;
  var dayNames = ['一','二','三','四','五','六','日'];

  function renderWeekPage(c) {
    var d = WHT.getWeekDays(st.weekOffset);
    var r = WHT.getUserRecords();
    var s = WHT.getUserSettings();
    var ws = d.reduce(function(a, x) { var rec = r.find(function(y) { return y.date === x; }); if (rec && !rec.isHoliday) { a.total += rec.hours; a.days++; } return a; }, { total: 0, days: 0 });
    var wS = new Date(d[0] + 'T00:00:00');
    var wE = new Date(d[6] + 'T00:00:00');
    var md = WHT.getUserModes().find(function(x) { return x.id === st.currentMode; });
    var workDays;
    if (md && md.type === 'flextime' && s.flextimeConfig && s.flextimeConfig.startDate) {
      var fc = s.flextimeConfig;
      var wm = new Date(d[0] + 'T00:00:00'); var adj = wm.getDay(); if (adj === 0) adj = 7; wm.setDate(wm.getDate() - (adj - 1));
      var sm = new Date(fc.startDate + 'T00:00:00'); adj = sm.getDay(); if (adj === 0) adj = 7; sm.setDate(sm.getDate() - (adj - 1));
      var wkDiff = Math.round((wm - sm) / 86400000 / 7);
      var isBig = (wkDiff % 2 === 0) ? fc.startIsBigWeek : !fc.startIsBigWeek;
      workDays = d.filter(function(x) { var w = WHT.getDayOfWeek(x); return !WHT.isHoliday(x) && (w >= 1 && w <= 5 || (w === 6 && isBig)); }).length;
    } else {
      workDays = d.filter(function(x) { var w = WHT.getDayOfWeek(x); return w >= 1 && w <= 5 && !WHT.isHoliday(x); }).length;
    }
    var t = s.standardHours * workDays;
    var diff = ws.total - t;
    var isCurrentWeek = st.weekOffset === 0;
    var pct = t > 0 ? Math.min(100, Math.round(ws.total / t * 100)) : 0;
    var isEmpty = ws.total === 0;
    var todayStr = WHT.today();
    var todayIdx = d.indexOf(todayStr);
    var daysPassed = todayIdx >= 0 ? todayIdx + 1 : 7;
    var expectedPct = Math.min(100, Math.round(daysPassed / 7 * 100));
    var pctRatio = expectedPct > 0 ? pct / expectedPct : 1;
    var pctClass = isEmpty ? 'empty' : pctRatio >= 1 ? 'good' : pctRatio >= 0.75 ? 'ok' : pctRatio >= 0.5 ? 'warn' : 'bad';
    var avg = ws.days > 0 ? (ws.total / ws.days) : 0;
    var circumference = 2 * Math.PI * 80 * 180 / 360;
    var offset = isEmpty ? circumference : circumference * (1 - pct / 100);

    var hh = r.filter(function(x) { return x.isHoliday && d.includes(x.date); }).reduce(function(a, x) { return a + x.hours; }, 0);
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
      '<div class="quarter-stat-card"><div class="quarter-stat-icon">' + (diff >= 0 ? '📈' : '📉') + '</div><div class="quarter-stat-value" style="color:' + (diff >= 0 ? 'var(--color-success)' : 'var(--color-danger)') + '">' + (diff >= 0 ? '+' : '') + diff.toFixed(1) + 'h</div><div class="quarter-stat-label">差额(h)</div></div>' +
      '<div class="quarter-stat-card"><div class="quarter-stat-icon">💰</div><div class="quarter-stat-value">' + (hf === 0 ? '<span class="empty-text">¥0</span>' : '¥' + hf) + '</div><div class="quarter-stat-label">加班费(元)</div></div>' +
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
        if (rec) cls += ' has-record';
        else if (WHT.isHoliday(x)) cls += ' is-holiday';
        else if (WHT.isWeekend(x)) cls += ' is-rest';
        return '<div class="' + cls + '" onclick="selectWeekDay(\'' + x + '\')" oncontextmenu="event.preventDefault();toggleHoliday(\'' + x + '\')">' +
          '<div class="week-day-name">' + w + '</div>' +
          '<div class="week-day-date">' + new Date(x + 'T00:00:00').getDate() + '</div>' +
          '<div class="week-day-hours">' + (rec ? (rec.status === 'working' || (!rec.endTime && rec.startTime) ? '进行中' : rec.hours.toFixed(1) + 'h') : '') + '</div>' +
          (WHT.isHoliday(x) ? '<div class="holiday-badge" title="节假日">休</div>' : '') +
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
    var sd = WHT.getUserSettings();
    var isMarkedHoliday = sd.holidays && sd.holidays.indexOf(d) >= 0;
    if (!rec) {
      el.innerHTML = '<div class="week-detail-empty"><div class="week-detail-empty-icon">📋</div><div class="week-detail-empty-text">' + WHT.formatDate(d) + ' 无记录</div><div class="week-detail-empty-hint">点击下方「记录」标签页可添加工时</div><div style="margin-top:12px;display:flex;align-items:center;justify-content:center;gap:8px"><span style="font-size:13px;color:var(--text-muted)">标记节假日</span><div class="ios-toggle' + (isMarkedHoliday ? ' active' : '') + '" onclick="event.stopPropagation();toggleHoliday(\'' + d + '\')"></div></div></div>';
      return;
    }
    el.innerHTML = '<div class="bento week-detail">' +
      '<div class="week-detail-row"><span class="week-detail-label">日期</span><span class="week-detail-value">' + WHT.formatDate(rec.date) + '</span></div>' +
      '<div class="week-detail-row"><span class="week-detail-label">上班</span><span class="week-detail-value">' + WHT.escapeHtml(rec.startTime) + '</span></div>' +
      '<div class="week-detail-row"><span class="week-detail-label">下班</span><span class="week-detail-value">' + (isWorking ? '<span style="color:var(--color-warning)">等待中...</span>' : WHT.escapeHtml(rec.endTime)) + '</span></div>' +
      '<div class="week-detail-row"><span class="week-detail-label">工时</span><span class="week-detail-value">' + (isWorking ? '<span style="color:var(--color-warning)">进行中</span>' : rec.hours + 'h') + '</span></div>' +
      '<div class="week-detail-row"><span class="week-detail-label">类型</span><span class="week-detail-value">' + (rec.isHoliday ? '节假日' : WHT.isWeekend(rec.date) ? '周末' : '工作日') + '</span></div>' +
      (rec.note ? '<div class="week-detail-row"><span class="week-detail-label">备注</span><span class="week-detail-value">' + WHT.escapeHtml(rec.note) + '</span></div>' : '') +
      '<div class="week-detail-row" onclick="event.stopPropagation();toggleHoliday(\'' + d + '\')" style="cursor:pointer"><span class="week-detail-label">标记节假日</span><div class="ios-toggle' + (isMarkedHoliday ? ' active' : '') + '" onclick="event.stopPropagation();toggleHoliday(\'' + d + '\')"></div></div>' +
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
