/* 季度视图：Quarter Dashboard */
(function() {
  "use strict";
  var WHT = window.WHT;
  var st = WHT.state;

  function renderQuarterPage(c) {
    var s = WHT.getUserSettings();
    var qc = s.quarterConfig || [];
    var r = WHT.getUserRecords();
    var qy = st.quarterYear || new Date().getFullYear();

    if (st.quarterIndex === 0 && qc.length > 0) {
      var curMonth = new Date().getMonth() + 1;
      for (var i = 0; i < qc.length; i++) {
        if (qc[i].months && qc[i].months.indexOf(curMonth) >= 0) { st.quarterIndex = i; break; }
      }
    }

    var cq = qc[st.quarterIndex] || qc[0];
    if (!cq) {
      c.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⏰</div><div class="empty-state-text">请在设置中配置季度</div></div>';
      return;
    }

    var qT = 0, qTar = 0, qHF = 0, qDays = 0, qWorkedDays = 0;
    var monthData = cq.months.map(function(m) {
      var ms = qy + '-' + String(m).padStart(2, '0');
      var mr = r.filter(function(x) { return x.date.startsWith(ms); });
      var mt = mr.reduce(function(a, x) { return a + x.hours; }, 0);
      var workDays = WHT.getMonthDays(qy, m - 1).filter(function(x) {
        var w = WHT.getDayOfWeek(x);
        return w >= 1 && w <= 5 && !WHT.isHoliday(x);
      });
      var mtar = s.standardHours * workDays.length;
      var hh = mr.filter(function(x) { return x.isHoliday; }).reduce(function(a, x) { return a + x.hours; }, 0);
      mt -= hh; // 节假日工时不计入总工时
      qT += mt;
      qTar += mtar;
      qHF += hh * (s.holidayRate || 0);
      qDays += workDays.length;
      qWorkedDays += mr.filter(function(x) { return !x.isHoliday; }).length;
      return { name: m + '月', total: mt, target: mtar, pct: mtar > 0 ? Math.min(100, (mt / mtar) * 100) : 0 };
    });

    var diff = qT - qTar;
    var pg = qTar > 0 ? Math.min(100, (qT / qTar) * 100) : 0;
    var pClass = pg >= 100 ? 'good' : pg >= 75 ? 'ok' : pg >= 50 ? 'warn' : pg > 0 ? 'bad' : 'empty';
    var isEmpty = qT === 0;

    var radius = 80;
    var circumference = Math.PI * radius;
    var offset = circumference - (pg / 100) * circumference;
    var ringClass = isEmpty ? 'empty' : pClass;

    var qAvg = qWorkedDays > 0 ? (qT / qWorkedDays) : 0;

    var statsHtml = '<div class="quarter-stats-grid">' +
      '<div class="quarter-stat-card"><div class="quarter-stat-icon">🎯</div><div class="quarter-stat-value">' + (isEmpty ? '<span class="empty-text">待开始</span>' : qTar + 'h') + '</div><div class="quarter-stat-label">目标(h)</div></div>' +
      '<div class="quarter-stat-card"><div class="quarter-stat-icon">✅</div><div class="quarter-stat-value">' + (isEmpty ? '<span class="empty-text">待开始</span>' : qT.toFixed(1) + 'h') + '</div><div class="quarter-stat-label">实际(h)</div></div>' +
      '<div class="quarter-stat-card"><div class="quarter-stat-icon">' + (isEmpty ? '📊' : diff >= 0 ? '📈' : '📉') + '</div><div class="quarter-stat-value" style="color:' + (diff >= 0 ? 'var(--color-success)' : 'var(--color-danger)') + '">' + (isEmpty ? '<span class="empty-text">待开始</span>' : (diff >= 0 ? '+' : '') + diff.toFixed(1) + 'h') + '</div><div class="quarter-stat-label">差额(h)</div></div>' +
      '<div class="quarter-stat-card"><div class="quarter-stat-icon">💰</div><div class="quarter-stat-value">' + (qHF === 0 ? '<span class="empty-text">¥0</span>' : '¥' + qHF) + '</div><div class="quarter-stat-label">加班费(元)</div></div>' +
    '</div>';

    var ringHtml = '<div class="quarter-ring-container">' +
      '<svg class="quarter-ring" viewBox="0 0 200 110"><path class="quarter-ring-bg" d="M 10 100 A 80 80 0 0 1 190 100" /><path class="quarter-ring-fill ' + ringClass + '" d="M 10 100 A 80 80 0 0 1 190 100" stroke-dasharray="' + circumference + '" stroke-dashoffset="' + (isEmpty ? circumference : offset) + '" pathLength="' + circumference + '" /></svg>' +
      '<div class="quarter-ring-center"><div class="quarter-ring-pct">' + (isEmpty ? '待开始' : pg.toFixed(0) + '%') + '</div><div class="quarter-ring-label">' + cq.name + ' 进度</div></div>' +
      '<div class="quarter-ring-detail">已完成 <strong>' + qT.toFixed(1) + 'h</strong> · 目标 <strong>' + qTar + 'h</strong> · ' + (qWorkedDays > 0 ? '日均 <strong>' + qAvg.toFixed(1) + 'h</strong>' : '') + '</div>' +
    '</div>';

    var maxTarget = Math.max.apply(null, monthData.map(function(x) { return x.target; })) || 1;
    var chartHtml = '<div class="quarter-chart"><div class="quarter-chart-title">月度工时对比</div>' +
      monthData.map(function(x) {
        var fillPct = x.target > 0 ? Math.min(100, (x.total / x.target) * 100) : 0;
        return '<div class="quarter-chart-row"><div class="quarter-chart-label">' + x.name + '</div><div class="quarter-chart-bar"><div class="quarter-chart-fill' + (x.total === 0 ? ' empty' : '') + '" style="width:' + fillPct.toFixed(0) + '%"></div></div><div class="quarter-chart-pct">' + (x.total === 0 ? '0%' : fillPct.toFixed(0) + '%') + '</div></div>';
      }).join('') +
      '<div class="quarter-chart-legend"><span class="quarter-chart-legend-item"><span class="quarter-chart-legend-color" style="background:var(--color-accent)"></span> 已用</span><span class="quarter-chart-legend-item"><span class="quarter-chart-legend-color" style="background:var(--neutral-300)"></span> 剩余</span></div></div>';

    var detailHtml = '<div class="quarter-detail"><div class="quarter-detail-title">月份明细</div>' +
      monthData.map(function(x, i) {
        var isCurrentMonth = cq.months[i] === (new Date().getMonth() + 1) && qy === new Date().getFullYear();
        return '<div class="quarter-detail-row' + (isCurrentMonth ? ' current' : '') + '"><div class="quarter-detail-name">' + x.name + '</div><div class="quarter-detail-values"><span>实际 <strong>' + x.total.toFixed(1) + 'h</strong></span><span class="quarter-detail-sep">───</span><span>目标 <strong>' + x.target + 'h</strong></span></div></div>';
      }).join('') + '</div>';

    var emptyHtml = isEmpty ? '<div class="quarter-empty"><div class="quarter-empty-icon">⏰</div><div class="quarter-empty-title">' + cq.name + ' 刚刚开始 🌱</div><div class="quarter-empty-desc">还没有记录工时，开始第一笔记录，<br>你的季度进度将在这里呈现</div><button class="btn btn-primary quarter-empty-btn" onclick="switchTab(\'record\')">记录第一笔工时 →</button></div>' : '';
    var fabHtml = isEmpty ? '<button class="fab" onclick="switchTab(\'record\')" title="记录工时">+</button>' : '';

    var navHtml = '<div class="quarter-nav">' +
      '<div class="quarter-segment">' + qc.map(function(q, i) { return '<div class="quarter-segment-item' + (i === st.quarterIndex ? ' active' : '') + '" onclick="switchQuarter(' + i + ')">' + q.name + '</div>'; }).join('') + '</div>' +
      '<div class="quarter-year-nav"><button class="month-nav-btn" onclick="changeQuarterYear(-1)">&#9664;</button><span class="quarter-year-title">' + qy + '年</span><button class="month-nav-btn" onclick="changeQuarterYear(1)">&#9654;</button></div>' +
    '</div>';

    c.innerHTML = navHtml + statsHtml + ringHtml + chartHtml + detailHtml + emptyHtml + fabHtml;

    requestAnimationFrame(function() {
      var cards = c.querySelectorAll('.quarter-stat-card, .quarter-chart-row, .quarter-detail-row');
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

  function switchQuarter(i) { WHT.haptic('light'); st.quarterIndex = i; WHT.renderCurrentTab(true); }
  function changeQuarterYear(dir) { WHT.haptic('light'); st.quarterYear = (st.quarterYear || new Date().getFullYear()) + dir; WHT.renderCurrentTab(true); }

  WHT.renderQuarterPage = renderQuarterPage;
  WHT.switchQuarter = switchQuarter;
  WHT.changeQuarterYear = changeQuarterYear;

})();
