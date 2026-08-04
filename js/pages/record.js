/* 记录页：打卡模式 + 手动补录 + 调休管理 + 实时计时器 */
(function() {
  "use strict";
  var WHT = window.WHT;
  var st = WHT.state;

// ========== 实时计时器 ==========

function renderTimerDisplay(el, tr, stdHoursMin) {
  var now = new Date();
  var startParts = tr.startTime.split(':').map(Number);
  var startMin = startParts[0] * 60 + startParts[1];
  var nowMin = now.getHours() * 60 + now.getMinutes();
  var elapsedMin = nowMin - startMin;
  if (elapsedMin < 0) elapsedMin += 24 * 60;
  var elapsedH = Math.floor(elapsedMin / 60);
  var elapsedM = elapsedMin % 60;
  var ratio = stdHoursMin > 0 ? Math.min(1, elapsedMin / stdHoursMin) : 0;
  var pct = Math.round(ratio * 100);
  var endMin = startMin + stdHoursMin;
  if (endMin >= 24 * 60) endMin -= 24 * 60;
  var endStr = String(Math.floor(endMin / 60)).padStart(2,'0') + ':' + String(endMin % 60).padStart(2,'0');
  var elapsedStr = (elapsedH > 0 ? elapsedH + 'h ' : '') + elapsedM + 'm';
  var color;
  if (ratio < 0.75) color = 'var(--color-accent)';
  else if (ratio < 1.0) color = 'var(--color-success)';
  else if (ratio < 1.25) color = 'var(--color-warning)';
  else color = 'var(--color-danger)';

  el.innerHTML =
    '<div class="timer-bar-row">' +
      '<span class="timer-bar-start">' + WHT.escapeHtml(tr.startTime) + '</span>' +
      '<span class="timer-bar-time" style="color:' + color + '">' + elapsedStr + '</span>' +
      '<span class="timer-bar-end">' + endStr + '</span>' +
    '</div>' +
    '<div class="timer-bar-track">' +
      '<div class="timer-bar-fill" style="width:' + pct + '%;background:' + color + '"></div>' +
    '</div>' +
    '<div class="timer-bar-meta">' +
      '<span class="timer-bar-worked">' + (elapsedMin / 60).toFixed(1) + 'h / ' + (stdHoursMin / 60) + 'h</span>' +
      '<span class="timer-bar-pct" style="color:' + color + '">' + pct + '%</span>' +
    '</div>';
}

function startWorkingTimer() {
  stopWorkingTimer();
  var s = WHT.getUserSettings();
  var r = WHT.getUserRecords();
  var td = WHT.today();
  var tr = r.find(function(x) { return x.date === td; });
  if (!tr || !tr.startTime) return;
  var stdHoursMin = (s.standardHours || 8) * 60;
  st._timerInterval = setInterval(function() {
    var el = document.getElementById('workingTimer');
    if (!el) { stopWorkingTimer(); return; }
    renderTimerDisplay(el, tr, stdHoursMin);
  }, 10000);
  // 立即渲染一次
  var el = document.getElementById('workingTimer');
  if (el) renderTimerDisplay(el, tr, stdHoursMin);
}

function stopWorkingTimer() {
  if (st._timerInterval) {
    clearInterval(st._timerInterval);
    st._timerInterval = null;
  }
}

// ========== 打卡核心逻辑 ==========

function punchIn() {
  WHT.haptic('medium');
  var now = new Date();
  var h = now.getHours();
  var m = now.getMinutes();
  var timeStr = String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0');
  var r = WHT.getUserRecords();
  var td = WHT.today();

  // 检查今天是否已有记录
  var ex = r.findIndex(function(x) { return x.date === td; });
  var rec;
  if (ex >= 0) {
    // 已有记录（可能是手动补录的），更新开始时间
    rec = r[ex];
    rec.startTime = timeStr;
    rec.status = rec.endTime ? 'done' : 'working';
    r[ex] = rec;
  } else {
    rec = { id: WHT.genId(), date: td, startTime: timeStr, endTime: null, hours: 0, isHoliday: WHT.isHoliday(td), note: '', modeId: st.currentMode, status: 'working' };
    r.push(rec);
  }
  WHT.saveUserRecords(r);
  st.formDate = td; st.formStart = timeStr;

  WHT.showToast('上班打卡 ' + timeStr + ' ✓');

  // 添加打卡动画
  WHT.renderCurrentTab(true);
  setTimeout(function() {
    var btn = document.querySelector('.punch-btn--start');
    if (btn) { btn.classList.add('punch-btn--just-punched'); setTimeout(function() { btn.classList.remove('punch-btn--just-punched'); }, 500); }
  }, 50);
}

function punchOut() {
  WHT.haptic('medium');
  var now = new Date();
  var h = now.getHours();
  var m = now.getMinutes();
  var timeStr = String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0');
  var r = WHT.getUserRecords();
  var td = WHT.today();
  var ex = r.findIndex(function(x) { return x.date === td; });
  if (ex < 0) {
    WHT.showToast('请先进行上班打卡', 'warning');
    return;
  }
  var rec = r[ex];
  rec.endTime = timeStr;
  rec.hours = WHT.calculateHours(rec.startTime, timeStr);
  rec.status = 'done';
  r[ex] = rec;
  WHT.saveUserRecords(r);

  // 自动累计调休（大小周模式）
  autoEarnCompTime(td, rec.hours);

  WHT.showToast('下班打卡 ' + timeStr + ' · 今日 ' + rec.hours.toFixed(2) + 'h ✓');

  WHT.renderCurrentTab(true);
  setTimeout(function() {
    var btn = document.querySelector('.punch-btn--end');
    if (btn) { btn.classList.add('punch-btn--just-punched'); setTimeout(function() { btn.classList.remove('punch-btn--just-punched'); }, 500); }
  }, 50);
}

// 调整打卡时间（点击已打卡的时间数字）
function adjustPunchTime(type) {
  var r = WHT.getUserRecords();
  var td = WHT.today();
  var rec = r.find(function(x) { return x.date === td; });
  if (!rec) return;

  var val = type === 'start' ? rec.startTime : rec.endTime;
  if (!val) return;

  // 使用现有时间选择器，通过全局标记传递回调
  window._punchAdjustType = type;
  var parts = val.split(':');
  WHT._tp.hour = parseInt(parts[0]);
  WHT._tp.minute = parseInt(parts[1]);
  WHT._tp.minuteStep = 1;
  WHT._tp.targetId = '';
  WHT.renderTimePicker();
  document.getElementById('timePickerOverlay').classList.add('active');
}

// 时间选择器确认后的回调 — 在 time-picker.js 的 confirmTimePicker 中触发
function applyPunchTimeAdjust(type, timeStr) {
  var r = WHT.getUserRecords();
  var td = WHT.today();
  var ex = r.findIndex(function(x) { return x.date === td; });
  if (ex < 0) return;
  var rec = r[ex];

  if (type === 'start') {
    rec.startTime = timeStr;
    // 如果已经下班打卡，重新计算工时
    if (rec.endTime) rec.hours = WHT.calculateHours(timeStr, rec.endTime);
  } else if (type === 'end') {
    rec.endTime = timeStr;
    rec.hours = WHT.calculateHours(rec.startTime, timeStr);
    rec.status = 'done';
  }
  r[ex] = rec;
  WHT.saveUserRecords(r);

  if (rec.endTime) autoEarnCompTime(rec.date, rec.hours);

  WHT.haptic('light');
  WHT.showToast(type === 'start' ? '上班时间已更新' : '下班时间已更新');
  WHT.renderCurrentTab(true);
}

// ========== 记录页渲染 ==========

function renderRecordPage(c) {
  var s = WHT.getUserSettings();
  var r = WHT.getUserRecords();
  var m = WHT.getUserModes();
  var md = m.find(function(x) { return x.id === st.currentMode; });
  var tr = r.find(function(x) { return x.date === WHT.today(); });
  var isF = md && md.type === 'flextime';
  var isC = md && md.type === 'comprehensive';
  var isCu = md && md.type === 'custom';

  // ── 打卡状态判定 ──
  var punchState = 'idle';       // idle | working | done
  if (tr) {
    if (tr.status === 'working' || (!tr.endTime && tr.startTime)) {
      punchState = 'working';
    } else if (tr.status === 'done' || (tr.startTime && tr.endTime)) {
      punchState = 'done';
    }
  }

  // ── 日期头部 ──
  var now = new Date();
  var weekNames = ['日','一','二','三','四','五','六'];
  var dateHeader = now.getMonth()+1 + '月' + now.getDate() + '日 周' + weekNames[now.getDay()];

  // ── 上班打卡按钮 ──
  var startBtnClass = 'punch-btn punch-btn--start';
  var startBtnIcon = '<div class="punch-btn-icon">🌅</div>';
  var startBtnTime, startBtnLabel;
  if (punchState === 'idle') {
    startBtnClass += ' punch-btn--idle';
    startBtnTime = '<div class="punch-btn-time">--:--</div>';
    startBtnLabel = '<div class="punch-btn-label">上班打卡</div>';
  } else {
    var startTimeStr = tr.startTime;
    startBtnClass += ' punch-btn--punched';
    if (punchState === 'done') startBtnClass += ' punch-btn--done';
    startBtnIcon = '<div class="punch-btn-icon" style="background:rgba(91,168,140,0.12);color:var(--color-success)">✅</div>';
    startBtnTime = '<div class="punch-btn-time" onclick="event.stopPropagation();adjustPunchTime(\'start\')">' + WHT.escapeHtml(startTimeStr) + '</div>';
    startBtnLabel = '<div class="punch-btn-label">上班打卡</div>';
  }

  // ── 下班打卡按钮 ──
  var endBtnClass = 'punch-btn punch-btn--end';
  var endBtnIcon = '<div class="punch-btn-icon">🌙</div>';
  var endBtnTime, endBtnLabel;
  if (punchState === 'idle') {
    endBtnClass += ' punch-btn--idle';
    endBtnTime = '<div class="punch-btn-time">--:--</div>';
    endBtnLabel = '<div class="punch-btn-label">下班打卡</div>';
  } else if (punchState === 'working') {
    endBtnClass += ' punch-btn--prompt';
    endBtnTime = '<div class="punch-btn-time">--:--</div>';
    endBtnLabel = '<div class="punch-btn-label">下班打卡</div>';
  } else {
    var et = tr.endTime;
    endBtnClass += ' punch-btn--punched punch-btn--done';
    endBtnIcon = '<div class="punch-btn-icon" style="background:rgba(91,168,140,0.12);color:var(--color-success)">✅</div>';
    endBtnTime = '<div class="punch-btn-time" onclick="event.stopPropagation();adjustPunchTime(\'end\')">' + WHT.escapeHtml(et) + '</div>';
    endBtnLabel = '<div class="punch-btn-label">下班打卡</div>';
  }

  // ── 打卡区 HTML ──
  var punchHtml =
    '<div class="punch-card">' +
      '<div class="' + startBtnClass + '" onclick="if(this.classList.contains(\'punch-btn--idle\'))punchIn()">' +
        startBtnIcon +
        startBtnTime +
        startBtnLabel +
      '</div>' +
      '<div class="' + endBtnClass + '" onclick="if(this.classList.contains(\'punch-btn--prompt\')||this.classList.contains(\'punch-btn--idle\'))punchOut()">' +
        endBtnIcon +
        endBtnTime +
        endBtnLabel +
      '</div>' +
    '</div>';

  // ── 今日摘要（仅完成状态显示） ──
  var summaryHtml = '';
  if (punchState === 'done') {
    var std = s.standardHours || 8;
    var diff = tr.hours - std;
    var diffStr = (diff >= 0 ? '+' : '') + diff.toFixed(1) + 'h';
    var diffColor = diff >= 0 ? 'var(--color-success)' : 'var(--color-danger)';
    var isOvertime = diff > 0;
    summaryHtml =
      '<div class="punch-summary">' +
        '<div class="punch-summary-icon">' + (isOvertime ? '🔥' : '🎉') + '</div>' +
        '<div class="punch-summary-title">' + (isOvertime ? '今天辛苦了！' : '今日打卡完成') + '</div>' +
        '<div class="punch-summary-row">' +
          '<span class="punch-summary-time" onclick="adjustPunchTime(\'start\')" title="点击修改上班时间">' + WHT.escapeHtml(tr.startTime) + '</span>' +
          '<span class="punch-summary-sep">—</span>' +
          '<span class="punch-summary-time" onclick="adjustPunchTime(\'end\')" title="点击修改下班时间">' + WHT.escapeHtml(tr.endTime) + '</span>' +
          '<span class="punch-summary-sep">|</span>' +
          '<strong>' + tr.hours.toFixed(1) + 'h</strong>' +
        '</div>' +
        '<div class="punch-summary-diff" style="color:' + diffColor + '">相对标准' + std + 'h：<strong>' + diffStr + '</strong></div>' +
        '<div class="punch-summary-hint">点击时间可修改</div>' +
      '</div>';
  } else if (punchState === 'working') {
    // 已上班未下班：显示实时计时器
    var stdHoursVal = (s && s.standardHours) ? s.standardHours : 8;
    // 检查是否已过下班时间（提醒）
    var startParts = tr.startTime.split(':').map(Number);
    var expectedEndMin = startParts[0] * 60 + startParts[1] + stdHoursVal * 60;
    if (expectedEndMin >= 24 * 60) expectedEndMin -= 24 * 60;
    var nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    var isOverdue = nowMin >= expectedEndMin;
    summaryHtml =
      '<div class="today-status today-status--working">' +
        '<div class="today-status-icon">⏳</div>' +
        '<div class="today-status-row">' +
          '<div class="today-status-label">上班时间</div>' +
          '<div class="today-status-value" style="cursor:pointer" onclick="adjustPunchTime(\'start\')">' + WHT.escapeHtml(tr.startTime) + '</div>' +
        '</div>' +
        '<div id="workingTimer" class="working-timer"></div>' +
        (isOverdue ? '<div class="punch-reminder"><span>💡</span> 今天还没打下班卡，去补录吧</div>' : '') +
      '</div>';
  } else {
    // 未打卡
    summaryHtml =
      '<div class="today-status">' +
        '<div style="font-size:18px">👋</div>' +
        '<div style="font-size:13px;color:var(--text-secondary)">' + dateHeader + ' · 今天还没打卡</div>' +
      '</div>';
  }

  // ── 快捷时段 ──
  var qs = '';
  (s.commonSlots||[]).forEach(function(x) {
    qs += '<button class="quick-slot" onclick="fillTimeSlotQuick(\'' + x.start + '\',\'' + x.end + '\')">' + x.start + '-' + x.end + '</button>';
  });
  if (isF && s.flextimeConfig) {
    qs += '<button class="quick-slot" onclick="fillTimeSlotQuick(\'' + s.flextimeConfig.standardStart + '\',\'' + s.flextimeConfig.standardEnd + '\')">标准时段</button>';
  }
  var yd = new Date(Date.now()-WHT.ONE_DAY_MS).toISOString().slice(0,10);
  var yr = r.find(function(x) { return x.date === yd; });
  if (yr) qs += '<button class="quick-slot" onclick="copyYesterdayQuick()">复制昨天</button>';
  var qsHtml = qs ? '<div class="quick-slots">' + qs + '</div>' : '';

  // ── 手动补录（折叠在下） ──
  var manualHtml =
    '<div class="manual-section">' +
      '<button class="manual-toggle-btn" id="manualToggleBtn" onclick="toggleManualEntry()">' +
        '<span>📝 手动补录</span>' +
        '<span class="toggle-icon" id="manualToggleIcon">▶</span>' +
      '</button>' +
      '<div class="manual-content" id="manualContent">' +
        '<div class="bento record-form" style="margin-top:0">' +
          '<div class="form-section-title">手动录入</div>' +
          qsHtml +
          '<div class="form-group">' +
            '<label class="form-label">日期</label>' +
            '<input type="text" class="form-input" id="recordDate" value="' + WHT.today() + '" data-picker="date" readonly onclick="WHT.openDatePicker(\'recordDate\',this.value)" onchange="onRecordDateChange()">' +
          '</div>' +
          '<div class="form-row">' +
            '<div class="form-group">' +
              '<label class="form-label">开始</label>' +
              '<input type="text" class="form-input" id="recordStart" value="09:00" data-picker="time" readonly onclick="WHT.openTimePicker(\'recordStart\',this.value)" onchange="calcRecordHours()">' +
            '</div>' +
            '<div class="form-group">' +
              '<label class="form-label">结束</label>' +
              '<input type="text" class="form-input" id="recordEnd" value="18:00" data-picker="time" readonly onclick="WHT.openTimePicker(\'recordEnd\',this.value)" onchange="calcRecordHours()">' +
            '</div>' +
          '</div>' +
          '<div class="form-group">' +
            '<label class="form-label">工时</label>' +
            '<input type="text" class="form-input readonly" id="recordHours" value="9.00h" readonly>' +
          '</div>' +
          ((isC||isCu) ? '<div class="form-group" style="display:flex;align-items:center;justify-content:space-between"><label class="form-label" style="margin-bottom:0">节假日</label><div class="toggle" id="recordHoliday" onclick="this.classList.toggle(\'active\')" role="switch" aria-checked="false"></div></div>' : '') +
          '<div class="form-note" onclick="toggleNote()">' +
            '<span class="form-note-toggle">📝 备注（可选）</span>' +
            '<span id="noteExpandIcon">▶</span>' +
          '</div>' +
          '<div class="hidden" id="noteSection">' +
            '<textarea class="input" id="recordNote" placeholder="添加备注..." style="min-height:64px;resize:vertical;margin-bottom:var(--space-2)"></textarea>' +
          '</div>' +
          '<div class="form-actions">' +
            '<button class="btn btn-primary" onclick="saveRecord()">保存记录</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';

  // ── 调休管理（大小周模式） ──
  var ch = '';
  if (isF) {
    var comp = WHT.getUserCompTime();
    var bal = comp.reduce(function(a,x) { return a + (x.type==='earn'?x.hours:-x.hours); }, 0);
    var tm = new Date().toISOString().slice(0,7);
    var me = comp.filter(function(x) { return x.date.startsWith(tm) && x.type==='earn'; }).reduce(function(a,x) { return a + x.hours; }, 0);
    var mu = comp.filter(function(x) { return x.date.startsWith(tm) && x.type==='use'; }).reduce(function(a,x) { return a + x.hours; }, 0);
    ch =
      '<div class="comp-section">' +
        '<div class="section-header"><div class="section-title">调休管理</div></div>' +
        '<div class="comp-stats">' +
          '<div class="bento bento-mini"><div class="month-stat-header"><span class="month-stat-icon">🏦</span><span class="month-stat-label">余额</span></div><div class="month-stat-value">' + bal.toFixed(1) + 'h</div></div>' +
          '<div class="bento bento-mini"><div class="month-stat-header"><span class="month-stat-icon">📥</span><span class="month-stat-label">本月累计</span></div><div class="month-stat-value">' + me.toFixed(1) + 'h</div></div>' +
          '<div class="bento bento-mini"><div class="month-stat-header"><span class="month-stat-icon">📤</span><span class="month-stat-label">本月使用</span></div><div class="month-stat-value">' + mu.toFixed(1) + 'h</div></div>' +
        '</div>' +
        '<button id="compToggleBtn" class="comp-toggle-btn" onclick="toggleCompList()">▶ 展开记录 (' + comp.length + '条)</button>' +
        '<div id="compList" class="comp-list hidden">' +
          comp.slice(-8).reverse().map(function(x) {
            return '<div class="comp-list-item">' +
              '<div class="comp-list-item-info">' +
                '<div class="comp-list-item-date">' + WHT.escapeHtml(x.date) + '</div>' +
                '<div class="comp-list-item-detail">' + (x.type==='late'?'晚来':'调休') + ' ' + x.hours + 'h</div>' +
                (x.note ? '<div class="comp-list-item-note">' + WHT.escapeHtml(x.note) + '</div>' : '') +
              '</div>' +
              '<div class="comp-list-item-actions">' +
                '<button class="btn-sm" onclick="editCompTime(\'' + WHT.escapeHtml(x.id) + '\')">修改</button>' +
                '<button class="btn-sm btn-sm-danger" onclick="deleteCompTime(\'' + WHT.escapeHtml(x.id) + '\')">删除</button>' +
              '</div>' +
            '</div>';
          }).join('') +
          (comp.length===0 ? '<div class="empty-state" style="padding:12px"><div class="empty-state-text">暂无调休记录</div></div>' : '') +
          '<button class="btn-sm btn-sm-add" onclick="showAddCompTime()">+ 新增调休使用</button>' +
        '</div>' +
      '</div>';
  }

  // ── 最近记录 ──
  var allRecords = r.slice().sort(function(a,b) { return b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime); });
  var rr = allRecords.slice(0, st.recordLimit || 10);
  var hasMore = allRecords.length > (st.recordLimit || 10);

  var recentHtml = '';
  if (rr.length > 0) {
    recentHtml =
      '<div id="recordCard" class="record-card">' +
        '<div class="record-card-header">' +
          '<div class="section-title">最近记录 (' + allRecords.length + '条)</div>' +
          (rr.length > 3 ? '<button id="recordToggleBtn" class="record-toggle-btn" onclick="toggleRecordList()">▶ 展开</button>' : '') +
        '</div>' +
        '<div class="record-list-body" id="recordList">' +
          rr.slice(0, 3).map(renderRecordItem).join('') +
        '</div>' +
        '<div class="record-list-body hidden" id="recordListHidden">' +
          rr.slice(3).map(renderRecordItem).join('') +
        '</div>' +
        (hasMore ? '<div class="record-load-more" onclick="loadMoreRecords()">加载更多...</div>' : '') +
      '</div>';
  }

  // ── 组装页面 ──
  c.innerHTML =
    '<div class="bento-grid-record">' +
      summaryHtml +
      punchHtml +
      manualHtml +
      ch +
      recentHtml +
    '</div>';

  // ── 恢复展开状态 ──
  if (st._compListExpanded && document.getElementById('compList')) {
    document.getElementById('compList').classList.remove('hidden');
    var ctb = document.getElementById('compToggleBtn');
    if (ctb) { ctb.classList.add('expanded'); ctb.innerHTML = '▼ 收起记录 (' + WHT.getUserCompTime().length + '条)'; }
  }
  if (st._manualExpanded) {
    var mc = document.getElementById('manualContent');
    var mtb = document.getElementById('manualToggleBtn');
    var mti = document.getElementById('manualToggleIcon');
    if (mc) mc.classList.add('expanded');
    if (mtb) mtb.classList.add('expanded');
    if (mti) mti.textContent = '▼';
  }

  // 启动/停止实时计时器
  stopWorkingTimer();
  if (punchState === 'working') {
    setTimeout(function() { startWorkingTimer(); }, 50);
  }
}

// ── 展示记录项（过滤掉 working 状态只在手动补录和最近列表中隐藏） ──
function renderRecordItem(r) {
  var b = [];
  if (r.isHoliday) b.push('<span class="badge badge-holiday">节假日</span>');
  if (WHT.isWeekend(r.date)) b.push('<span class="badge badge-weekend">周末</span>');
  var isWorking = r.status === 'working' || (!r.endTime && r.startTime);
  var timeDisplay = isWorking
    ? WHT.escapeHtml(r.startTime) + ' - <span style="color:var(--color-warning);font-weight:600">进行中</span>'
    : WHT.escapeHtml(r.startTime) + ' - ' + WHT.escapeHtml(r.endTime) + ' <span class="hours">' + r.hours + 'h</span>';
  return '<div class="record-item">' +
    '<div class="record-item-main">' +
      '<div class="record-item-date">' + WHT.formatDate(r.date) + '</div>' +
      '<div class="record-item-time">' + timeDisplay + '</div>' +
      (b.length ? '<div style="margin-top:2px">' + b.join('') + '</div>' : '') +
      (r.note ? '<div style="font-size:11px;color:var(--text-muted);margin-top:1px">' + WHT.escapeHtml(r.note) + '</div>' : '') +
    '</div>' +
    '<div class="record-item-actions">' +
      '<button class="btn-sm" onclick="editRecord(\'' + WHT.escapeHtml(r.id) + '\')">修改</button>' +
      '<button class="btn-sm btn-sm-danger" onclick="deleteRecord(\'' + WHT.escapeHtml(r.id) + '\')">删除</button>' +
    '</div>' +
  '</div>';
}

// ── 快捷时段：直接打卡（一键填入上下班时间） ──
function fillTimeSlotQuick(s, e) {
  WHT.haptic('light');
  var td = WHT.today();
  var r = WHT.getUserRecords();
  var ex = r.findIndex(function(x) { return x.date === td; });
  var rec = ex >= 0 ? r[ex] : { id: WHT.genId(), date: td, isHoliday: WHT.isHoliday(td), note: '', modeId: st.currentMode };
  rec.startTime = s;
  rec.endTime = e;
  rec.hours = WHT.calculateHours(s, e);
  rec.status = 'done';
  if (ex >= 0) r[ex] = rec; else r.push(rec);
  WHT.saveUserRecords(r);
  autoEarnCompTime(td, rec.hours);
  WHT.showToast('已记录 ' + s + ' - ' + e + ' ✓');
  WHT.renderCurrentTab(true);
}

function copyYesterdayQuick() {
  WHT.haptic('medium');
  var yd = new Date(Date.now()-WHT.ONE_DAY_MS).toISOString().slice(0,10);
  var yr = WHT.getUserRecords().find(function(x) { return x.date === yd; });
  if (!yr) { WHT.showToast('昨天没有记录', 'warning'); return; }
  fillTimeSlotQuick(yr.startTime, yr.endTime);
}

// ── 删除今日记录 ──
function deleteTodayRecord() {
  WHT.showConfirm('删除今日记录', '确定要删除今天的打卡记录吗？', function() {
    WHT.haptic('delete');
    var r = WHT.getUserRecords();
    var td = WHT.today();
    var filtered = r.filter(function(x) { return x.date !== td; });
    WHT.saveUserRecords(filtered);
    WHT.showToast('今日记录已删除');
    WHT.renderCurrentTab(true);
  });
}

// ========== 手动补录相关（折叠区） ==========

function toggleManualEntry() {
  WHT.haptic('light');
  var mc = document.getElementById('manualContent');
  var mtb = document.getElementById('manualToggleBtn');
  var mti = document.getElementById('manualToggleIcon');
  if (!mc || !mtb || !mti) return;
  mc.classList.toggle('expanded');
  mtb.classList.toggle('expanded');
  mti.textContent = mc.classList.contains('expanded') ? '▼' : '▶';
  st._manualExpanded = mc.classList.contains('expanded');
}

function calcRecordHours() {
  var s = (document.getElementById('recordStart')||{}).value;
  var e = (document.getElementById('recordEnd')||{}).value;
  if (s && e) {
    var el = document.getElementById('recordHours');
    if (el) el.value = WHT.calculateHours(s,e).toFixed(2) + 'h';
  }
}

function onRecordDateChange() {
  var d = (document.getElementById('recordDate')||{}).value;
  if (d) st.formDate = d;
  var r = WHT.getUserRecords().find(function(x) { return x.date === d; });
  if (r) {
    var startEl = document.getElementById('recordStart');
    var endEl = document.getElementById('recordEnd');
    var noteEl = document.getElementById('recordNote');
    if (startEl) startEl.value = r.startTime;
    if (endEl) endEl.value = r.endTime || '';
    if (noteEl) noteEl.value = r.note || '';
    st.formStart = r.startTime; st.formEnd = r.endTime; st.formNote = r.note || '';
    var h = document.getElementById('recordHoliday');
    if (h) { h.classList.toggle('active', r.isHoliday); st.formHoliday = r.isHoliday; }
    calcRecordHours();
    WHT.showToast('📝 该日期已有记录，已加载', 'info');
  } else {
    st.formStart = '09:00'; st.formEnd = '18:00'; st.formNote = ''; st.formHoliday = false;
  }
}

function toggleNote() {
  WHT.haptic('light');
  var s = document.getElementById('noteSection');
  var i = document.getElementById('noteExpandIcon');
  if (!s || !i) return;
  s.classList.toggle('hidden');
  i.textContent = s.classList.contains('hidden') ? '▶' : '▼';
}

function toggleRecordList() {
  WHT.haptic('light');
  var hidden = document.getElementById('recordListHidden');
  var b = document.getElementById('recordToggleBtn');
  if (!hidden || !b) return;
  hidden.classList.toggle('hidden');
  b.innerHTML = hidden.classList.contains('hidden') ? '▶ 展开' : '▼ 收起';
}

function loadMoreRecords() {
  st.recordLimit = (st.recordLimit || 10) + 10;
  WHT.renderCurrentTab(true);
}

function saveRecord() {
  var d = (document.getElementById('recordDate')||{}).value;
  var s = (document.getElementById('recordStart')||{}).value;
  var e = (document.getElementById('recordEnd')||{}).value;
  var n = (document.getElementById('recordNote')||{}).value || '';
  var h = document.getElementById('recordHoliday');
  var isH = h ? h.classList.contains('active') : WHT.isHoliday(d);
  if (!d || !s || !e) { WHT.showToast('请填写完整信息', 'warning'); return; }
  var hrs = WHT.calculateHours(s, e);
  var r = WHT.getUserRecords();
  var ex = r.findIndex(function(x) { return x.date === d; });
  var rec = { id: ex >= 0 ? r[ex].id : WHT.genId(), date: d, startTime: s, endTime: e, hours: hrs, isHoliday: isH, note: n, modeId: st.currentMode, status: 'done' };
  if (ex >= 0) r[ex] = rec; else r.push(rec);
  WHT.saveUserRecords(r);
  autoEarnCompTime(d, hrs);
  st.formDate = d; st.formStart = s; st.formEnd = e; st.formNote = n; st.formHoliday = isH;
  var form = document.querySelector('.record-form');
  if (form) { form.style.borderLeft = ''; delete form.dataset.editing; }
  var btn = document.querySelector('.record-form .btn-primary');
  if (btn) { btn.textContent = '保存记录'; btn.style.background = ''; }
  WHT.haptic('medium');
  WHT.showToast(ex >= 0 ? '工时已更新 ✓' : '工时已保存 ✓');
  WHT.renderCurrentTab(true);
}

function autoEarnCompTime(date, hours) {
  var settings = WHT.getUserSettings();
  var m = WHT.getUserModes();
  var md = m.find(function(x) { return x.id === st.currentMode; });
  if (md && md.type === 'flextime') {
    var ot = hours - settings.standardHours;
    if (ot > 0) {
      var comp = WHT.getUserCompTime();
      // 检查今天是否已有 earn 记录，避免重复
      var todayEarn = comp.find(function(x) { return x.date === date && x.type === 'earn'; });
      if (todayEarn) {
        todayEarn.hours = ot;
      } else {
        comp.push({ id: WHT.genId(), date: date, type: 'earn', hours: ot, note: '每日加班累计' });
      }
      WHT.saveUserCompTime(comp);
    }
  }
}

function deleteRecord(id) {
  WHT.haptic('delete');
  var records = WHT.getUserRecords();
  var deleted = records.find(function(r) { return r.id === id; });
  var filtered = records.filter(function(r) { return r.id !== id; });
  WHT.saveUserRecords(filtered);
  WHT.renderCurrentTab(true);
  WHT.showToastWithAction('记录已删除','error','撤销',function() {
    var current = WHT.getUserRecords();
    current.push(deleted);
    current.sort(function(a,b) { return b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime); });
    WHT.saveUserRecords(current);
    WHT.renderCurrentTab(true);
  });
}

function editRecord(id) {
  var r = WHT.getUserRecords().find(function(x) { return x.id === id; });
  if (!r) return;
  st.formDate = r.date; st.formStart = r.startTime; st.formEnd = r.endTime; st.formNote = r.note || ''; st.formHoliday = r.isHoliday;
  var dateEl = document.getElementById('recordDate');
  var startEl = document.getElementById('recordStart');
  var endEl = document.getElementById('recordEnd');
  var noteEl = document.getElementById('recordNote');
  if (dateEl) dateEl.value = r.date;
  if (startEl) startEl.value = r.startTime;
  if (endEl) endEl.value = r.endTime || '';
  if (noteEl) noteEl.value = r.note || '';
  var h = document.getElementById('recordHoliday');
  if (h) h.classList.toggle('active', r.isHoliday);
  calcRecordHours();
  // 展开手动补录区
  var mc = document.getElementById('manualContent');
  var mtb = document.getElementById('manualToggleBtn');
  var mti = document.getElementById('manualToggleIcon');
  if (mc && !mc.classList.contains('expanded')) {
    mc.classList.add('expanded'); mtb.classList.add('expanded'); mti.textContent = '▼';
    st._manualExpanded = true;
  }
  var btn = document.querySelector('.record-form .btn-primary');
  if (btn) { btn.textContent = '更新记录'; btn.style.background = 'var(--color-accent-hover)'; }
  var form = document.querySelector('.record-form');
  if (form) { form.style.borderLeft = '3px solid var(--color-accent)'; form.dataset.editing = id; }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggleCompList() {
  WHT.haptic('light');
  var l = document.getElementById('compList');
  var b = document.getElementById('compToggleBtn');
  if (!l || !b) return;
  l.classList.toggle('hidden');
  b.classList.toggle('expanded');
  b.innerHTML = l.classList.contains('hidden') ? '▶ 展开记录 (' + WHT.getUserCompTime().length + '条)' : '▼ 收起记录';
  st._compListExpanded = !l.classList.contains('hidden');
}

function showAddCompTime() {
  document.getElementById('userModal').querySelector('.modal-title').textContent = '新增调休使用';
  document.getElementById('userModal').querySelector('.modal-sheet').innerHTML =
    '<div class="modal-handle"></div>' +
    '<div class="modal-title">新增调休使用</div>' +
    '<div class="form-group"><label class="form-label">类型</label><select class="input" id="compType"><option value="late">晚来</option><option value="fullDay">调休全天</option></select></div>' +
    '<div class="form-group"><label class="form-label">小时数</label><input type="number" class="input" id="compHours" value="1" min="0.5" step="0.5"></div>' +
    '<div class="form-group"><label class="form-label">日期</label><input type="text" class="input" id="compDate" value="' + WHT.today() + '" readonly onclick="WHT.openDatePicker(\'compDate\',this.value)" style="cursor:pointer"></div>' +
    '<div class="form-group"><label class="form-label">备注</label><input type="text" class="input" id="compNote" placeholder="可选"></div>' +
    '<button class="btn btn-primary w-full mt-12" onclick="saveCompTime()">保存</button>';
  document.getElementById('userModal').classList.add('active');
}

function saveCompTime() {
  WHT.haptic('medium');
  var t = (document.getElementById('compType')||{}).value;
  var h = parseFloat((document.getElementById('compHours')||{}).value);
  var d = (document.getElementById('compDate')||{}).value;
  var n = (document.getElementById('compNote')||{}).value;
  if (!h || !d) return;
  var c = WHT.getUserCompTime();
  c.push({ id: WHT.genId(), date: d, type: t, hours: h, note: n });
  WHT.saveUserCompTime(c);
  document.getElementById('userModal').classList.remove('active');
  WHT.renderCurrentTab(true);
}

function editCompTime(id) {
  var c = WHT.getUserCompTime().find(function(x) { return x.id === id; });
  if (!c) return;
  document.getElementById('userModal').querySelector('.modal-title').textContent = '编辑调休';
  document.getElementById('userModal').querySelector('.modal-sheet').innerHTML =
    '<div class="modal-handle"></div>' +
    '<div class="modal-title">编辑调休</div>' +
    '<div class="form-group"><label class="form-label">类型</label><select class="input" id="compType"><option value="late"' + (c.type==='late'?' selected':'') + '>晚来</option><option value="fullDay"' + (c.type==='fullDay'?' selected':'') + '>调休全天</option></select></div>' +
    '<div class="form-group"><label class="form-label">小时数</label><input type="number" class="input" id="compHours" value="' + c.hours + '" min="0.5" step="0.5"></div>' +
    '<div class="form-group"><label class="form-label">日期</label><input type="text" class="input" id="compDate" value="' + WHT.escapeHtml(c.date) + '" readonly onclick="WHT.openDatePicker(\'compDate\',this.value)" style="cursor:pointer"></div>' +
    '<div class="form-group"><label class="form-label">备注</label><input type="text" class="input" id="compNote" value="' + WHT.escapeHtml(c.note||'') + '"></div>' +
    '<button class="btn btn-primary w-full mt-12" onclick="updateCompTime(\'' + WHT.escapeHtml(id) + '\')">更新</button>';
  document.getElementById('userModal').classList.add('active');
}

function updateCompTime(id) {
  WHT.haptic('medium');
  var c = WHT.getUserCompTime();
  var i = c.findIndex(function(x) { return x.id === id; });
  if (i < 0) return;
  c[i] = Object.assign({}, c[i], { type: (document.getElementById('compType')||{}).value, hours: parseFloat((document.getElementById('compHours')||{}).value), date: (document.getElementById('compDate')||{}).value, note: (document.getElementById('compNote')||{}).value });
  WHT.saveUserCompTime(c);
  document.getElementById('userModal').classList.remove('active');
  WHT.renderCurrentTab(true);
}

function deleteCompTime(id) {
  WHT.haptic('delete');
  var comp = WHT.getUserCompTime();
  var deleted = comp.find(function(x) { return x.id === id; });
  var filtered = comp.filter(function(x) { return x.id !== id; });
  WHT.saveUserCompTime(filtered);
  WHT.renderCurrentTab(true);
  WHT.showToastWithAction('调休记录已删除','error','撤销',function() {
    var current = WHT.getUserCompTime();
    current.push(deleted);
    WHT.saveUserCompTime(current);
    WHT.renderCurrentTab(true);
  });
}

  // ── 导出 ──
  WHT.punchIn = punchIn;
  WHT.punchOut = punchOut;
  WHT.adjustPunchTime = adjustPunchTime;
  WHT.applyPunchTimeAdjust = applyPunchTimeAdjust;
  WHT.renderRecordPage = renderRecordPage;
  WHT.renderTimerDisplay = renderTimerDisplay;
  WHT.startWorkingTimer = startWorkingTimer;
  WHT.stopWorkingTimer = stopWorkingTimer;
  WHT.toggleManualEntry = toggleManualEntry;
  WHT.fillTimeSlotQuick = fillTimeSlotQuick;
  WHT.copyYesterdayQuick = copyYesterdayQuick;
  WHT.deleteTodayRecord = deleteTodayRecord;
  WHT.saveRecord = saveRecord;
  WHT.calcRecordHours = calcRecordHours;
  WHT.editRecord = editRecord;
  WHT.deleteRecord = deleteRecord;
  WHT.toggleCompList = toggleCompList;
  WHT.showAddCompTime = showAddCompTime;
  WHT.saveCompTime = saveCompTime;
  WHT.updateCompTime = updateCompTime;
  WHT.deleteCompTime = deleteCompTime;
  WHT.editCompTime = editCompTime;
  WHT.toggleNote = toggleNote;
  WHT.toggleRecordList = toggleRecordList;
  WHT.loadMoreRecords = loadMoreRecords;
  WHT.autoEarnCompTime = autoEarnCompTime;
  WHT.onRecordDateChange = onRecordDateChange;

})();
