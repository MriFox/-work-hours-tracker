/* 季度视图：Quarter Dashboard
 * 包含：季度统计 + 进度环 + 年度累计结转（追赶）+ 月度明细（原「月度工时对比」与「月份明细」已合并）
 */
(function() {
  "use strict";
  var WHT = window.WHT;
  var st = WHT.state;

  function renderQuarterPage(c) {
    var s = WHT.getUserSettings();
    var qc = s.quarterConfig || [];
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

    // 单一口径出口：季度汇总 + 季度累计追赶
    var sum = WHT.quarterSummary(qy, st.quarterIndex);
    var cp = WHT.quarterPace(qy, st.quarterIndex);

    var qT = sum.actual;
    var qTar = sum.target;
    var qHF = sum.holidayHours * (s.holidayRate || 0);
    var diff = qT - qTar;
    var pg = qTar > 0 ? Math.min(100, (qT / qTar) * 100) : 0;
    // 同月度页：「待开始」只表示本季度完全没有记录；只记了节假日时 qT 仍为 0
    var isEmpty = !WHT.quarterHasData(qy, st.quarterIndex);

    // 进度节奏改用工作日口径（已过工作日 / 本季度总工作日），与月/周页保持一致
    var elapsedWorkDays = Math.max(0, sum.workDays - cp.restQuarter);
    var passedRatio = sum.workDays > 0 ? Math.min(1, elapsedWorkDays / sum.workDays) : 1;
    var pClass = WHT.paceClass(pg, passedRatio * 100, isEmpty);
    var diffC = WHT.diffColor(diff);

    var circumference = Math.PI * 80;
    var offset = circumference - (pg / 100) * circumference;
    var ringClass = isEmpty ? 'empty' : pClass;

    var qAvg = sum.workedDays > 0 ? (qT / sum.workedDays) : 0;

    var statsHtml = '<div class="quarter-stats-grid">' +
      '<div class="quarter-stat-card"><div class="quarter-stat-icon">🎯</div><div class="quarter-stat-value">' + (isEmpty ? '<span class="empty-text">待开始</span>' : qTar + 'h') + '</div><div class="quarter-stat-label">目标(h)</div></div>' +
      '<div class="quarter-stat-card"><div class="quarter-stat-icon">✅</div><div class="quarter-stat-value">' + (isEmpty ? '<span class="empty-text">待开始</span>' : qT.toFixed(1) + 'h') + '</div><div class="quarter-stat-label">实际(h)</div></div>' +
      '<div class="quarter-stat-card"><div class="quarter-stat-icon">' + (isEmpty ? '📊' : diff >= 0 ? '📈' : '📉') + '</div><div class="quarter-stat-value" style="color:' + diffC + '">' + (isEmpty ? '<span class="empty-text">待开始</span>' : (diff >= 0 ? '+' : '') + diff.toFixed(1) + 'h') + '</div><div class="quarter-stat-label">差额(h)</div></div>' +
      '<div class="quarter-stat-card"><div class="quarter-stat-icon">💰</div><div class="quarter-stat-value">' + (qHF === 0 ? '<span class="empty-text">¥0.00</span>' : '¥' + qHF.toFixed(2)) + '</div><div class="quarter-stat-label">加班费(元)</div></div>' +
    '</div>';

    var ringHtml = '<div class="quarter-ring-container">' +
      '<svg class="quarter-ring" viewBox="0 0 200 110"><path class="quarter-ring-bg" d="M 10 100 A 80 80 0 0 1 190 100" /><path class="quarter-ring-fill ' + ringClass + '" d="M 10 100 A 80 80 0 0 1 190 100" stroke-dasharray="' + circumference + '" stroke-dashoffset="' + (isEmpty ? circumference : offset) + '" pathLength="' + circumference + '" /></svg>' +
      '<div class="quarter-ring-center"><div class="quarter-ring-pct">' + (isEmpty ? '待开始' : pg.toFixed(0) + '%') + '</div><div class="quarter-ring-label">' + cq.name + ' 进度</div></div>' +
      '<div class="quarter-ring-detail">已完成 <strong>' + qT.toFixed(1) + 'h</strong> · 目标 <strong>' + qTar + 'h</strong> · ' + (sum.workedDays > 0 ? '日均 <strong>' + qAvg.toFixed(1) + 'h</strong>' : '') + '</div>' +
    '</div>';

    // 年度累计结转（跨季度追赶）
    var qcumHtml = WHT.quarterCardHtml(cp);

    // 月度明细：合并原「月度工时对比」的进度条与「月份明细」的数值
    var nowY = new Date().getFullYear();
    var nowM = new Date().getMonth() + 1;
    var monthsHtml = '<div class="qmonths">' +
      '<div class="qmonths-head">' +
        '<span class="qmonths-title">月份明细</span>' +
        '<span class="qmonths-hint">点击进入该月 ›</span>' +
      '</div>' +
      sum.perMonth.map(function(x) {
        var isCur = (qy === nowY && x.month === nowM);
        var aria = x.month + '月，实际 ' + x.actual.toFixed(1) + ' 小时，目标 ' + x.target + ' 小时，完成 ' + x.pct.toFixed(0) + '%' + (isCur ? '，当前月' : '');
        return '<div class="qmonths-row' + (isCur ? ' current' : '') + '" onclick="goToMonthFromQuarter(' + x.month + ')" role="button" tabindex="0" aria-label="' + aria + '">' +
          '<div class="qmonths-row-top">' +
            '<span class="qmonths-name">' + x.month + '月' + (isCur ? '<span class="qmonths-now">当前</span>' : '') + '</span>' +
            '<span class="qmonths-nums">' + x.actual.toFixed(1) + 'h / <strong>' + x.target + 'h</strong></span>' +
          '</div>' +
          '<div class="qmonths-bar"><div class="qmonths-fill' + (x.actual === 0 ? ' empty' : '') + '" style="width:' + x.pct.toFixed(0) + '%"></div></div>' +
        '</div>';
      }).join('') +
      '<div class="qmonths-total">' +
        '<span class="qmonths-total-label">合计</span>' +
        '<span class="qmonths-nums">' + qT.toFixed(1) + 'h / <strong>' + qTar + 'h</strong></span>' +
      '</div>' +
    '</div>';

    // 有结转时不再显示「还没有记录」的空状态，否则会与累计卡片自相矛盾
    var hasCarry = cp.carry !== 0 || (s.quarterCarry || {})[qy + '-' + st.quarterIndex] !== undefined;
    var showEmpty = isEmpty && !hasCarry;
    var emptyHtml = showEmpty ? '<div class="quarter-empty"><div class="quarter-empty-icon">⏰</div><div class="quarter-empty-title">' + cq.name + ' 刚刚开始 🌱</div><div class="quarter-empty-desc">还没有记录工时，开始第一笔记录，<br>你的季度进度将在这里呈现</div><button class="btn btn-primary quarter-empty-btn" onclick="switchTab(\'record\')">记录第一笔工时 →</button></div>' : '';
    var fabHtml = showEmpty ? '<button class="fab" onclick="switchTab(\'record\')" title="记录工时">+</button>' : '';

    var navHtml = '<div class="quarter-nav">' +
      '<div class="quarter-segment">' + qc.map(function(q, i) { return '<div class="quarter-segment-item' + (i === st.quarterIndex ? ' active' : '') + '" onclick="switchQuarter(' + i + ')">' + WHT.escapeHtml(q.name) + '</div>'; }).join('') + '</div>' +
      '<div class="quarter-year-nav"><button class="month-nav-btn" onclick="changeQuarterYear(-1)">&#9664;</button><span class="quarter-year-title">' + qy + '年</span><button class="month-nav-btn" onclick="changeQuarterYear(1)">&#9654;</button></div>' +
    '</div>';

    c.innerHTML = navHtml + statsHtml + ringHtml + qcumHtml + monthsHtml + emptyHtml + fabHtml;

    // 「设置期初结余」入口
    var editEl = c.querySelector('.qcum-edit');
    if (editEl) editEl.onclick = function() { editQuarterCarry(); };

    requestAnimationFrame(function() {
      var cards = c.querySelectorAll('.quarter-stat-card, .qmonths-row, .qcum-card');
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

  // ── 月份明细 → 跳到该月的月度页 ──
  function goToMonthFromQuarter(m) {
    WHT.haptic('light');
    var n = new Date();
    var qy = st.quarterYear || n.getFullYear();
    st.monthOffset = (qy - n.getFullYear()) * 12 + (m - 1 - n.getMonth());
    st.selectedDay = null;
    WHT.switchTab('month');
  }

  // ── 期初结余编辑 ──
  function carryKey() {
    return (st.quarterYear || new Date().getFullYear()) + '-' + st.quarterIndex;
  }

  function editQuarterCarry() {
    WHT.haptic('light');
    var s = WHT.getUserSettings();
    var q = (s.quarterConfig || [])[st.quarterIndex] || { name: '本季度' };
    var raw = (s.quarterCarry || {})[carryKey()];
    var hasExplicit = typeof raw === 'number';
    var auto = WHT.quarterCarry(st.quarterYear || new Date().getFullYear(), st.quarterIndex);
    var sheet = document.getElementById('userModal').querySelector('.modal-sheet');
    sheet.innerHTML =
      '<div class="modal-handle"></div>' +
      '<div class="modal-title">' + WHT.escapeHtml(q.name) + ' 期初结余</div>' +
      '<div class="modal-desc">这个季度开始之前，你的累计工时比目标多出（或欠下）多少。<br>正数 = 结余（超前），负数 = 欠账（落后）。</div>' +
      '<div class="form-group">' +
        '<label class="form-label">小时数</label>' +
        '<input type="number" class="input" id="qCarryInput" step="0.5" inputmode="decimal" placeholder="留空 = 自动继承" value="' + (hasExplicit ? raw : '') + '">' +
      '</div>' +
      '<div class="form-hint">' + (hasExplicit ? '当前为手动填写。' : '当前自动继承值：' + WHT.fmtSignedHours(auto)) + '</div>' +
      '<button class="btn btn-primary w-full mt-12" onclick="saveQuarterCarry()">保存</button>' +
      (hasExplicit ? '<button class="btn w-full mt-12" onclick="clearQuarterCarry()">清除，恢复自动继承</button>' : '');
    document.getElementById('userModal').classList.add('active');
  }

  function saveQuarterCarry() {
    WHT.haptic('medium');
    var s = WHT.getUserSettings();
    if (!s.quarterCarry) s.quarterCarry = {};
    var el = document.getElementById('qCarryInput');
    var raw = el ? String(el.value).trim() : '';
    if (raw === '') {
      delete s.quarterCarry[carryKey()];
    } else {
      var v = parseFloat(raw);
      if (isNaN(v) || !isFinite(v)) { WHT.showToast('请输入有效的数字', 'warning'); return; }
      s.quarterCarry[carryKey()] = v;
    }
    WHT.saveUserSettings(s);
    document.getElementById('userModal').classList.remove('active');
    WHT.showToast('期初结余已更新', 'success', 1500);
    WHT.renderCurrentTab(true);
  }

  function clearQuarterCarry() {
    WHT.haptic('delete');
    var s = WHT.getUserSettings();
    if (s.quarterCarry) delete s.quarterCarry[carryKey()];
    WHT.saveUserSettings(s);
    document.getElementById('userModal').classList.remove('active');
    WHT.showToast('已恢复自动继承', 'info', 1500);
    WHT.renderCurrentTab(true);
  }

  function switchQuarter(i) { WHT.haptic('light'); st.quarterIndex = i; WHT.renderCurrentTab(true); }
  function changeQuarterYear(dir) { WHT.haptic('light'); st.quarterYear = (st.quarterYear || new Date().getFullYear()) + dir; WHT.renderCurrentTab(true); }

  WHT.renderQuarterPage = renderQuarterPage;
  WHT.switchQuarter = switchQuarter;
  WHT.changeQuarterYear = changeQuarterYear;
  WHT.goToMonthFromQuarter = goToMonthFromQuarter;
  WHT.editQuarterCarry = editQuarterCarry;
  WHT.saveQuarterCarry = saveQuarterCarry;
  WHT.clearQuarterCarry = clearQuarterCarry;

})();
