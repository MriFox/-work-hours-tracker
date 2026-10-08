/* 记录页：打卡模式 + 手动补录 + 调休管理 + 实时计时器 */
(function() {
  "use strict";
  var WHT = window.WHT;
  var st = WHT.state;

// ========== 今日卡（实时计时） ==========

// 今日卡主体重绘。计算口径统一在 utils.js 的 dayProgress / dayLiveHtml 里，
// 这里只负责把「今天的目标」传给它们。
function renderTimerDisplay(el, startTime, targetHours, stdHours) {
  el.innerHTML = WHT.dayLiveHtml(startTime, targetHours, stdHours);
}

function startWorkingTimer() {
  stopWorkingTimer();
  var s = WHT.getUserSettings();
  var r = WHT.getUserRecords();
  var td = WHT.today();
  var tr = r.find(function(x) { return x.date === td; });
  if (!tr || !tr.startTime) return;
  var std = s.standardHours || 8;
  var now = new Date();
  // 今日目标与今日卡同源：max(标准工时, 每日需完成)
  var targetHours = WHT.todayTargetOf(WHT.monthPace(now.getFullYear(), now.getMonth()), std);
  var el0 = document.getElementById('dayBody');
  if (el0) renderTimerDisplay(el0, tr.startTime, targetHours, std);
  st._timerInterval = setInterval(function() {
    var el = document.getElementById('dayBody');
    if (!el) { stopWorkingTimer(); return; }
    renderTimerDisplay(el, tr.startTime, targetHours, std);
  }, 10000);
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
  // 上班卡归「自然日」，不走业务日切分 ——
  // 上班卡的语义是「从此刻开始新一天的班」。若按业务日算，
  // 早班 6:30 打卡会被切分点推到前一天，这就是要避免的误伤。
  var td = WHT.naturalToday();

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

  // 若还有别的班没收工，顺带提醒一句（不阻断，仍允许开始新一天）
  var open = WHT.openRecordOf(r.filter(function(x) { return x !== rec; }));
  if (open && open.date !== td) {
    WHT.showToast('上班打卡 ' + timeStr + ' · ' + open.date.slice(5) + ' 的班还没下班', 'warning');
  } else {
    WHT.showToast('上班打卡 ' + timeStr + ' ✓');
  }

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
  // 下班卡归「最近一条未收工的记录」，**不按日期找** ——
  // 跨天加班（10-07 上班、10-08 06:00 下班）能精确落到 10-07 那条上，
  // 既不需要用时间猜测，也不会影响早班（早班时没有未收工记录，走下面的提示分支）。
  var rec = WHT.openRecordOf(r);
  if (!rec) {
    WHT.showToast('请先进行上班打卡', 'warning');
    return;
  }
  rec.endTime = timeStr;
  rec.hours = WHT.calculateHours(rec.startTime, timeStr);
  rec.status = 'done';
  WHT.saveUserRecords(r);

  // 自动累计调休（大小周模式）—— 记到记录自己的日期上，跨天时不会错记到今天
  autoEarnCompTime(rec.date, rec.hours);

  var crossDay = rec.date !== WHT.naturalToday();
  WHT.showToast('下班打卡 ' + timeStr + ' · ' + (crossDay ? rec.date.slice(5) + ' ' : '') + rec.hours.toFixed(2) + 'h ✓');

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

// 打卡卡片点击分发：待打卡→打卡；待下班→下班；已打卡→修改时间
function onPunchCardTap(el, type) {
  if (!el) return;
  if (el.classList.contains('punch-btn--idle')) {
    if (type === 'start') punchIn(); else punchOut();
    return;
  }
  if (el.classList.contains('punch-btn--prompt')) { punchOut(); return; }
  adjustPunchTime(type);
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

  var now = new Date();

  // ── 上班打卡按钮 ──
  var startBtnClass = 'punch-btn punch-btn--start';
  var startBtnIcon = '<div class="punch-btn-icon">🌅</div>';
  var startBtnTime, startBtnLabel, startBtnHint, startAria;
  if (punchState === 'idle') {
    startBtnClass += ' punch-btn--idle';
    startBtnTime = '<div class="punch-btn-time">--:--</div>';
    startBtnLabel = '<div class="punch-btn-label">上班打卡</div>';
    startBtnHint = '';
    startAria = '上班打卡，点击记录当前时间';
  } else {
    var startTimeStr = tr.startTime;
    startBtnClass += ' punch-btn--punched';
    if (punchState === 'done') startBtnClass += ' punch-btn--done';
    startBtnIcon = '<div class="punch-btn-icon" style="background:rgba(91,168,140,0.12);color:var(--color-success)">✅</div>';
    startBtnTime = '<div class="punch-btn-time">' + WHT.escapeHtml(startTimeStr) + '</div>';
    startBtnLabel = '<div class="punch-btn-label">上班打卡</div>';
    startBtnHint = '<div class="punch-btn-hint">点击修改</div>';
    startAria = '上班打卡时间 ' + startTimeStr + '，点击修改';
  }

  // ── 下班打卡按钮 ──
  var endBtnClass = 'punch-btn punch-btn--end';
  var endBtnIcon = '<div class="punch-btn-icon">🌙</div>';
  var endBtnTime, endBtnLabel, endBtnHint, endAria;
  if (punchState === 'idle') {
    endBtnClass += ' punch-btn--idle';
    endBtnTime = '<div class="punch-btn-time">--:--</div>';
    endBtnLabel = '<div class="punch-btn-label">下班打卡</div>';
    endBtnHint = '';
    endAria = '下班打卡，需先进行上班打卡';
  } else if (punchState === 'working') {
    endBtnClass += ' punch-btn--prompt';
    endBtnTime = '<div class="punch-btn-time">--:--</div>';
    endBtnLabel = '<div class="punch-btn-label">下班打卡</div>';
    endBtnHint = '';
    endAria = '下班打卡，点击记录当前时间';
  } else {
    var et = tr.endTime;
    endBtnClass += ' punch-btn--punched punch-btn--done';
    endBtnIcon = '<div class="punch-btn-icon" style="background:rgba(91,168,140,0.12);color:var(--color-success)">✅</div>';
    endBtnTime = '<div class="punch-btn-time">' + WHT.escapeHtml(et) + '</div>';
    endBtnLabel = '<div class="punch-btn-label">下班打卡</div>';
    endBtnHint = '<div class="punch-btn-hint">点击修改</div>';
    endAria = '下班打卡时间 ' + et + '，点击修改';
  }

  // ── 打卡区 HTML ──
  var punchHtml =
    '<div class="punch-card">' +
      '<div class="' + startBtnClass + '" onclick="onPunchCardTap(this,\'start\')" role="button" tabindex="0" aria-label="' + WHT.escapeHtml(startAria) + '">' +
        startBtnIcon +
        startBtnTime +
        startBtnLabel +
        startBtnHint +
      '</div>' +
      '<div class="' + endBtnClass + '" onclick="onPunchCardTap(this,\'end\')" role="button" tabindex="0" aria-label="' + WHT.escapeHtml(endAria) + '">' +
        endBtnIcon +
        endBtnTime +
        endBtnLabel +
        endBtnHint +
      '</div>' +
    '</div>';

  // 今日摘要已并入下面的「今日卡」（WHT.dayCardHtml），不再单独渲染。

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

  // ── 最近记录：表格 / 图表双视图 ──
  // 表格 = 明细管理（点行弹「详情+修改/删除」）；图表 = 趋势洞察（只读，点某天只看详情）
  var allRecords = r.slice().sort(function(a,b) { return b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime); });
  var recentHtml = renderRecordSection(allRecords);

  // ── 今日卡：把「实时计时」与「今天还需完成多少」合成一张 ──
  var pace = WHT.monthPace(now.getFullYear(), now.getMonth());
  var dayCard = WHT.dayCardHtml(pace, {
    // 打卡状态 'working' 对应今日卡的 'live'（计时中），别直接透传
    mode: punchState === 'working' ? 'live' : punchState,
    startTime: tr ? tr.startTime : '',
    endTime: tr ? tr.endTime : '',
    hours: tr ? tr.hours : 0
  });

  // ── 组装页面 ──
  c.innerHTML =
    '<div class="bento-grid-record">' +
      dayCard +
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

  // 图表横向拖动翻页（事件委托，只需绑一次）
  bindChartSwipe();

  // 启动/停止实时计时器
  stopWorkingTimer();
  if (punchState === 'working') {
    setTimeout(function() { startWorkingTimer(); }, 50);
  }
}

// ══════════ 最近记录：表格 / 图表双视图 ══════════
// 分工：表格 = 明细管理（点行弹「详情+修改/删除」）；图表 = 趋势洞察（点某天只看详情）
//
// 图表窗口刻意取「最近 30 个自然日」，与表格的「最近 N 条」不一致：
// 表格是查某天的明细（10 条够用），图表是看走向（点越多趋势越准），职责本就不同。
// 图表时间窗口的可选档位（天）。双指张开 = 放大（档位变小、看清每天），
// 双指捏合 = 缩小（档位变大、看更长的趋势）。
var CHART_SPANS = [7, 14, 30, 60, 90];
var CHART_SPAN_DEFAULT = 30;
// 表格折叠时显示的行数。3 条 = 最近三天，一屏就能看完，
// 不会把下面的「调休管理」挤到很远。
var COLLAPSED_ROWS = 3;

function renderRecordSection(allRecords) {
  if (!allRecords.length) return '';
  var view = st.recordView || WHT.getUserSettings().recordView || 'table';
  var expanded = (st.recordExpanded !== undefined)
    ? st.recordExpanded
    : !!WHT.getUserSettings().recordExpanded;

  // 折叠时不显示「加载更多」——两者职责重叠（都是往卡片里塞更多行），
  // 同时出现会让人不知道该点哪个。
  var limit = expanded ? (st.recordLimit || 10) : COLLAPSED_ROWS;
  var hasMore = expanded && allRecords.length > limit;
  var needToggle = allRecords.length > COLLAPSED_ROWS;

  var head = '<div class="record-card-header">' +
      '<div class="section-title">最近记录 (' + allRecords.length + '条)</div>' +
      '<div class="view-seg" role="tablist" aria-label="切换视图">' +
        '<button class="view-seg-btn' + (view === 'table' ? ' is-on' : '') + '" role="tab" ' +
          'aria-selected="' + (view === 'table') + '" onclick="setRecordView(\'table\')">表格</button>' +
        '<button class="view-seg-btn' + (view === 'chart' ? ' is-on' : '') + '" role="tab" ' +
          'aria-selected="' + (view === 'chart') + '" onclick="setRecordView(\'chart\')">图表</button>' +
      '</div>' +
    '</div>';

  var body = (view === 'chart')
    ? renderRecordChart(allRecords)
    : '<div class="rt-wrap">' + renderRecordTable(allRecords.slice(0, limit), allRecords) + '</div>';

  var foot = '';
  if (view === 'table') {
    if (needToggle) {
      foot += '<div class="rt-toggle" role="button" tabindex="0" onclick="toggleRecordExpand()" ' +
        'onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();toggleRecordExpand()}">' +
        (expanded ? '收起' : '展开全部 ' + allRecords.length + ' 条') +
        '<span class="rt-toggle-arrow' + (expanded ? ' is-up' : '') + '">⌄</span></div>';
    }
    if (hasMore) {
      foot += '<div class="record-load-more" onclick="loadMoreRecords()">加载更多...</div>';
    }
  }

  return '<div id="recordCard" class="record-card">' + head + body + foot + '</div>';
}

// ── 表格：按月分组，行高 32px，点行即弹操作 ──
// recs = 本页要显示的那些（被「最近 N 条」截断）；allRecords = 全部记录。
// 两个参数是必需的：月份合计必须按**该月全部记录**算 ——
// 早期版本只累加显示出来的那几条，被 limit 截断时标题会写一个偏小的假合计
// （实测：9 月实际 10 条 80.0h，界面上却写「合计 56.0h」，只算了挤进前 10 的 7 条）。
function renderRecordTable(recs, allRecords) {
  if (!recs.length) return '';

  var monthTotal = {}, monthCount = {};
  (allRecords || recs).forEach(function(r) {
    if (WHT.isOpenRecord(r)) return;              // 进行中的不计入合计
    var k = r.date.slice(0, 7);
    monthTotal[k] = (monthTotal[k] || 0) + r.hours;
    monthCount[k] = (monthCount[k] || 0) + 1;
  });

  var out = '', curKey = '', curLabel = '', shown = 0, buf = [];

  function flush() {
    if (!buf.length) return;
    var total = monthTotal[curKey] || 0;
    var all = monthCount[curKey] || 0;
    // 本页被截断时把「本页」也写出来，避免用户把行加起来对不上标题
    var part = (shown < all) ? ' · 本页 ' + shown + '/' + all + ' 条' : '';
    out += '<div class="rt-month"><span>' + curLabel + '</span>' +
           '<b>合计 ' + total.toFixed(1) + 'h' + part + '</b></div>' +
           '<div class="rt-rows">' + buf.join('') + '</div>';
    buf = []; shown = 0;
  }

  recs.forEach(function(r) {
    var key = r.date.slice(0, 7);
    if (key !== curKey) {
      flush();
      curKey = key;
      curLabel = WHT.monthLabelOf(r.date);
    }
    if (!WHT.isOpenRecord(r)) shown++;
    buf.push(rtRow(r));
  });
  flush();
  return out;
}

function rtRow(r) {
  var dt = WHT.getDayType(r.date);
  // 类型改用行首 3px 竖条，不占列宽：灰=休息/周末，橙=节假日，绿=调休上班
  var bar = dt.type === 'holiday' ? 'is-holiday'
          : dt.type === 'workday' ? 'is-workday'
          : (dt.type === 'rest' || dt.type === 'weekend') ? 'is-rest' : '';

  var open = WHT.isOpenRecord(r);
  var live = WHT.liveHoursOf(r);
  var txt, cls = '';
  if (open) {
    txt = (live === null) ? '进行中' : live.toFixed(1) + 'h';
    cls = 'is-live';
  } else {
    txt = r.hours.toFixed(1) + 'h';
    if (r.hours > (WHT.getUserSettings().standardHours || 8)) cls = 'is-over';
  }

  var wdArr = ['日','一','二','三','四','五','六'];
  var dObj = new Date(r.date + 'T00:00:00');
  // 日期来自记录，理论上可被导入的异常数据污染 → 转义后再显示；
  // 无效日期会算出 NaN，此时不显示星期，避免出现「undefined」
  var wd = isNaN(dObj.getTime()) ? '' : wdArr[dObj.getDay()];
  var dateTxt = WHT.escapeHtml(String(r.date).slice(5)) + (wd ? ' ' + wd : '');

  var id = WHT.escapeHtml(r.id);
  var aria = WHT.escapeHtml(r.date + ' ' + (dt.label || '') + ' ' + txt) + '，点击查看详情与修改';

  // 行尾不再放「⋯」—— 点整行即弹出「详情 + 修改/删除」合并弹窗，
  // 少一次点击，也把那一列宽度还给内容。
  return '<div class="rt-row" role="button" tabindex="0" aria-label="' + aria + '" ' +
      'onclick="openRecordDetail(\'' + id + '\')" ' +
      // 键盘可达：role=button + tabindex 只让它可聚焦，不按 Enter 是不会响应的
      'onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();openRecordDetail(\'' + id + '\')}">' +
      '<i class="rt-bar ' + bar + '" aria-hidden="true"></i>' +
      '<span class="rt-date">' + dateTxt + '</span>' +
      '<span class="rt-time">' + (r.startTime ? WHT.escapeHtml(r.startTime) : '—') + '</span>' +
      '<span class="rt-time">' + (open ? '—' : (r.endTime ? WHT.escapeHtml(r.endTime) : '—')) + '</span>' +
      '<span class="rt-hours ' + cls + '">' + txt + '</span>' +
    '</div>';
}

// ── 图表：最近 30 天折线（手写 SVG，与全站其它图形同源，不引入图表库） ──
// 两个刻意为之的设计：
//  ① 休息日 / 无记录日 **不画点、折线在该处断开** —— 若画成 0h，
//     视觉上像「缺勤/罢工」，而实际是正常休息；留空才是诚实的表达。
//  ② 标准工时画一条灰虚线作参照，超出的点用琥珀色标出。
function renderRecordChart(allRecords) {
  var std = WHT.getUserSettings().standardHours || 8;
  var todayStr = WHT.today();
  var byDate = {};
  allRecords.forEach(function(r) { byDate[r.date] = r; });

  // 时间窗口由「档位天数 span」+「右端偏移 endOff」两个量决定：
  //   窗口 = [今天-(span-1)-endOff, 今天-endOff]
  // 之所以不用「翻了几期」来记位置，是因为档位会变 —— 用期数记的话，
  // 从 30 天缩到 7 天时同一个期数会指向完全不同的日期。
  // 改用「右端偏移」后，**缩放时右端固定不动**，用户关注的时间段自然保持住。
  var span = currentChartSpan();
  var endOff = currentChartEnd();
  var days = [];
  for (var i = span - 1; i >= 0; i--) {
    var d = new Date();
    d.setDate(d.getDate() - i - endOff);
    var ds = WHT.localDateStr(d);
    var rec = byDate[ds] || null;
    var v = null;
    if (rec) {
      if (WHT.isOpenRecord(rec)) {
        var lv = WHT.liveHoursOf(rec);
        if (lv !== null) v = lv;
      } else {
        v = rec.hours;
      }
    }
    days.push({ date: ds, v: v, rec: rec, isToday: ds === todayStr });
  }

  var vals = [];
  days.forEach(function(x) { if (x.v !== null) vals.push(x.v); });
  if (!vals.length) {
    var rangeTxt = days[0].date.slice(5) + ' — ' + days[days.length - 1].date.slice(5);
    // ⚠️ 空状态也必须包在 .rc-wrap 里，且 chartNavHtml 放最上面。
    //   v0.17.1 踩过：原先空状态没这层容器，而手势绑定靠 `closest('.rc-wrap')` 判定，
    //   于是滑到「没有记录的那一期」后手势就失效了，怎么滑都出不去，
    //   只能点「回到最近一期」。顺带 touch-action: pan-y 也只作用在 .rc-wrap 上。
    //   结构保持一致后，空期也能继续滑动翻回去。
    var inner;
    if (endOff > 0) {
      inner = chartNavHtml(rangeTxt, false) +
        '<div class="rc-empty">' + rangeTxt + '<br><span>这段时间没有记录</span></div>' +
        '<div class="rc-back" role="button" tabindex="0" onclick="chartBackToLatest()">回到最近一期</div>';
    } else {
      // 有记录但都不在窗口内时，卡片标题写着「最近记录 (N条)」而这里说「还没有记录」，
      // 两句放一起会自相矛盾 → 点明原因并指路
      inner = chartNavHtml(rangeTxt, true) +
        '<div class="rc-empty">最近 ' + span + ' 天没有记录' +
        (allRecords.length ? '<br><span>更早的记录可点上方「‹」回看</span>' : '') + '</div>';
    }
    return '<div class="rc-wrap">' + inner + '</div>';
  }

  var top = Math.max(std, Math.max.apply(null, vals));
  top = Math.ceil(top / 2) * 2 + 2;                 // 向上取偶数 + 留余量，刻度好看

  var W = 360, H = 158, padL = 30, padR = 14, padT = 16, padB = 26;
  var plotW = W - padL - padR, plotH = H - padT - padB;
  var n = days.length, yBase = padT + plotH;

  function xAt(i) { return padL + plotW * i / (n - 1); }
  function yAt(v) { return padT + plotH * (1 - Math.min(v, top) / top); }

  // 连续段：休息日会把折线切成多段，逐段画
  var segs = [], cur = [];
  days.forEach(function(d, i) {
    if (d.v === null) { if (cur.length) { segs.push(cur); cur = []; } }
    else cur.push(i);
  });
  if (cur.length) segs.push(cur);

  var s = '';
  // 横向网格 + Y 轴刻度（0 / 标准工时 / 顶）
  [0, std, top].forEach(function(v) {
    var y = yAt(v).toFixed(1);
    s += '<line x1="' + padL + '" y1="' + y + '" x2="' + (W - padR) + '" y2="' + y + '" ' +
         'class="rc-grid' + (v === std ? ' rc-grid--std' : '') + '"/>';
    s += '<text x="' + (padL - 6) + '" y="' + y + '" class="rc-axis" text-anchor="end" ' +
         'dominant-baseline="central">' + v.toFixed(0) + 'h</text>';
  });

  // 面积 + 折线
  segs.forEach(function(seg) {
    if (seg.length < 2) return;
    var pts = seg.map(function(i) { return xAt(i).toFixed(1) + ',' + yAt(days[i].v).toFixed(1); });
    s += '<path d="M' + pts[0] + ' L' + pts.slice(1).join(' L') +
         ' L' + xAt(seg[seg.length - 1]).toFixed(1) + ',' + yBase +
         ' L' + xAt(seg[0]).toFixed(1) + ',' + yBase + ' Z" class="rc-area"/>';
    s += '<polyline points="' + pts.join(' ') + '" class="rc-line"/>';
  });

  // 数据点；超出标准工时的用琥珀色
  days.forEach(function(d, i) {
    if (d.v === null) return;
    s += '<circle cx="' + xAt(i).toFixed(1) + '" cy="' + yAt(d.v).toFixed(1) + '" r="3" ' +
         'class="rc-dot' + (d.v > std ? ' is-over' : '') + '"/>';
  });
  // 透明点击区 —— 3px 的点手指点不中，这里铺满整列
  var colW = plotW / (n - 1);
  days.forEach(function(d, i) {
    if (!d.rec) return;
    var label = d.date + (d.v === null ? ' 进行中' : ' ' + d.v.toFixed(1) + 'h');
    s += '<rect x="' + (xAt(i) - colW / 2).toFixed(1) + '" y="' + padT + '" width="' + colW.toFixed(1) +
         '" height="' + plotH + '" fill="transparent" style="cursor:pointer" ' +
         'onclick="openRecordDetail(\'' + WHT.escapeHtml(d.rec.id) + '\')">' +
         '<title>' + WHT.escapeHtml(label) + '</title></rect>';
  });
  // X 轴：首 / 1/3 / 2/3 / 末，避免 30 个标签糊在一起
  [0, Math.round((n - 1) / 3), Math.round((n - 1) * 2 / 3), n - 1].forEach(function(i) {
    var anchor = i === 0 ? 'start' : (i === n - 1 ? 'end' : 'middle');
    s += '<text x="' + xAt(i).toFixed(1) + '" y="' + (H - 8) + '" class="rc-axis" ' +
         'text-anchor="' + anchor + '">' + days[i].date.slice(5) + '</text>';
  });

  var sum = 0, over = 0;
  vals.forEach(function(v) { sum += v; if (v > std) over++; });
  var summary = '平均 <b>' + (sum / vals.length).toFixed(1) + 'h</b> · 合计 <b>' + sum.toFixed(1) + 'h</b>' +
                (over ? ' · 加班 <b>' + over + '</b> 天' : '');

  var rangeTxt2 = days[0].date.slice(5) + ' — ' + days[days.length - 1].date.slice(5);
  return '<div class="rc-wrap">' +
      chartNavHtml(rangeTxt2, endOff === 0) +
      '<svg class="rc-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" ' +
        'aria-label="' + rangeTxt2 + ' 工时折线图，共 ' + vals.length + ' 天有记录">' + s + '</svg>' +
      '<div class="rc-summary">' + summary + '</div>' +
    '</div>';
}

// 图表顶部：‹ 上一期 ｜ 当前范围 ｜ 下一期 ›
// atLatest 时「›」置灰不可点 —— 已经在最新一期，没有更近的可看
// 图表顶部：‹ 上一屏 ｜ 当前范围 ｜ 下一屏 › ｜ 档位
// atLatest 时「›」置灰不可点 —— 已经在最新，没有更近的可看。
// 末尾的「N天」既显示当前档位，也可点击循环切换 —— 给不习惯双指手势的用户留个手动入口。
function chartNavHtml(rangeTxt, atLatest) {
  var span = currentChartSpan();
  return '<div class="rc-nav">' +
      '<button class="rc-nav-btn" aria-label="往前看 ' + span + ' 天" onclick="chartShift(1)">‹</button>' +
      '<span class="rc-nav-range">' + WHT.escapeHtml(rangeTxt) + '</span>' +
      '<button class="rc-nav-btn' + (atLatest ? ' is-off' : '') + '" aria-label="往后看 ' + span + ' 天"' +
        (atLatest ? ' disabled' : ' onclick="chartShift(-1)"') + '>›</button>' +
      '<button class="rc-nav-span" aria-label="当前显示 ' + span + ' 天，点击切换时间范围" ' +
        'onclick="chartCycleSpan()">' + span + '天</button>' +
    '</div>';
}

// 图表档位（天）。内存态优先，其次读设置 ——
// reload 后 st 会被重置，只读 st 会导致「设置存了却没用」。
function currentChartSpan() {
  var v = (st.chartSpan !== undefined) ? st.chartSpan : WHT.getUserSettings().chartSpan;
  v = parseInt(v, 10);
  return CHART_SPANS.indexOf(v) >= 0 ? v : CHART_SPAN_DEFAULT;
}

// 窗口右端距今天的天数（0 = 以今天结尾）。
// 位置用「右端偏移」而不是「翻了几期」来记：档位会变，用期数记的话
// 从 30 天缩到 7 天时同一个期数会指向完全不同的日期；
// 用偏移记则**缩放时右端固定**，用户关注的时间段自然保留。
function currentChartEnd() {
  var v = (st.chartEnd !== undefined) ? st.chartEnd : WHT.getUserSettings().chartEnd;
  return Math.max(0, parseInt(v, 10) || 0);
}

// 统一写入位置 / 档位（传 null 表示该项不变）
function setChartPos(endOff, span) {
  var s = WHT.getUserSettings();
  if (endOff !== null && endOff !== undefined) {
    st.chartEnd = endOff; s.chartEnd = endOff;
    // 顺带清掉旧版字段（老版本这里存的是「期数」，语义不同，留着会误导）
    st.chartShift = 0; s.chartShift = 0;
  }
  if (span) { st.chartSpan = span; s.chartSpan = span; }
  WHT.saveUserSettings(s);
  WHT.renderCurrentTab(true);
}

// 往前("1")/往后("-1")平移一个档位宽度。下界钉在 0（最新），不允许翻到未来。
function chartShift(dir) {
  var span = currentChartSpan();
  var cur = currentChartEnd();
  var next = Math.max(0, cur + dir * span);
  if (next === cur) return;             // 已在最新，点「›」不做事
  WHT.haptic('light');
  setChartPos(next, null);
}

// 双指张开(dir=+1)放大 → 档位变小、看得清每天；捏合(dir=-1)缩小 → 档位变大、看更长趋势。
// 缩放只改档位，**右端不动**，所以关注的时间段一直留在视野里。
function chartZoom(dir) {
  var cur = CHART_SPANS.indexOf(currentChartSpan());
  var next = cur + (dir > 0 ? -1 : 1);
  if (next < 0 || next >= CHART_SPANS.length) return false;   // 已到端点，无变化
  WHT.haptic('light');
  setChartPos(currentChartEnd(), CHART_SPANS[next]);
  return true;
}

// 循环切换档位（导航栏「N天」按钮）—— 手动入口，与双指手势等价
function chartCycleSpan() {
  var cur = CHART_SPANS.indexOf(currentChartSpan());
  var next = (cur + 1) % CHART_SPANS.length;
  WHT.haptic('light');
  setChartPos(currentChartEnd(), CHART_SPANS[next]);
}

function chartBackToLatest() {
  WHT.haptic('medium');
  setChartPos(0, null);
}

// ── 视图切换（记住选择，下次打开还在同一视图） ──
function setRecordView(v) {
  WHT.haptic('light');
  st.recordView = (v === 'chart') ? 'chart' : 'table';
  var s = WHT.getUserSettings();
  s.recordView = st.recordView;
  WHT.saveUserSettings(s);
  WHT.renderCurrentTab(true);
}

// 记录弹窗：表格与图表**完全一致**，都提供「修改 / 删除 / 关闭」。
// （早期版本图表弹窗是只读的，v0.17.0 起按用户要求统一 ——
//   点图表上的某天发现要改，不该被迫切回表格再找一遍。）
function openRecordDetail(id) {
  var rec = WHT.getUserRecords().find(function(x) { return x.id === id; });
  if (!rec) return;
  WHT.haptic('light');
  var dt = WHT.getDayType(rec.date);
  var open = WHT.isOpenRecord(rec);
  var live = WHT.liveHoursOf(rec);
  var hoursTxt = open
    ? (live === null ? '<span class="rs-live">进行中</span>'
                     : '<span class="rs-live">' + live.toFixed(1) + 'h（计时中）</span>')
    : rec.hours.toFixed(1) + 'h';

  function row(k, v) { return '<div class="rs-row"><span>' + k + '</span><b>' + v + '</b></div>'; }

  // WHT.formatDate 对无效日期会输出「NaN月NaN日 周undefined」（导入损坏数据时可能遇到），
  // 这里兜一层：解析不出来就原样显示日期串，不要甩一堆 NaN 给用户。
  var dObj = new Date(rec.date + 'T00:00:00');
  var title = isNaN(dObj.getTime()) ? WHT.escapeHtml(String(rec.date)) : WHT.formatDate(rec.date);

  var idEsc = WHT.escapeHtml(rec.id);
  var actions = '<div class="rs-actions">' +
      '<button class="btn rs-act" onclick="closeRecordSheet();editRecord(\'' + idEsc + '\')">修改</button>' +
      '<button class="btn rs-act rs-danger" onclick="confirmDeleteRecord(\'' + idEsc + '\')">删除</button>' +
    '</div>';

  var sheet = document.getElementById('recordSheetBody');
  if (!sheet) return;
  sheet.innerHTML = '<div class="modal-handle"></div>' +
    '<div class="modal-title">' + title + '</div>' +
    '<div class="rs-box">' +
      row('日期类型', dt.label || '') +
      row('上班', rec.startTime ? WHT.escapeHtml(rec.startTime) : '—') +
      row('下班', open ? '—' : (rec.endTime ? WHT.escapeHtml(rec.endTime) : '—')) +
      row('工时', hoursTxt) +
    '</div>' +
    actions +
    '<button class="btn w-full mt-12" onclick="closeRecordSheet()">关闭</button>';
  document.getElementById('recordSheet').classList.add('active');
}

// 展开 / 收起表格。状态写进 settings，下次打开保持。
function toggleRecordExpand() {
  WHT.haptic('light');
  var s = WHT.getUserSettings();
  var cur = (st.recordExpanded !== undefined) ? st.recordExpanded : !!s.recordExpanded;
  var next = !cur;
  st.recordExpanded = next;
  s.recordExpanded = next;
  WHT.saveUserSettings(s);
  WHT.renderCurrentTab(true);
}

// （原「行内 ⋯ 菜单」已在 v0.16.0 合并进 openRecordDetail —— 点行即达，
//   不必先点 ⋯ 再选操作。openRecordMenu 已删除。）

// 删除前二次确认。原来列表里的「删除」是点了就删、没有确认，
// 现在点行直达弹窗，删除按钮就排在「关闭」旁边，更需要这道确认。
function confirmDeleteRecord(id) {
  closeRecordSheet();
  WHT.showConfirm('确认删除', '删除后无法恢复，确定要删除这条记录吗？', function() {
    deleteRecord(id);
  });
}

function closeRecordSheet() {
  var el = document.getElementById('recordSheet');
  if (el) el.classList.remove('active');
}

// ── 图表横向拖动翻页 ──────────────────────────────────────────────────────
// 用事件委托挂在 pageContent 上（每次重绘都会换 DOM，绑具体节点会失效）。
//
// 关键点 1：与「页面上下滚动」共存 —— 只有**横向意图明显**时才拦截。
// 关键点 2（踩过的坑）：必须在 touchmove 阶段 preventDefault。
//   只监听 touchstart/touchend 是没用的 —— 浏览器在 touchmove 时就已判定这是
//   「横向滑动」，会执行自己的默认行为（含 **前进 / 后退导航**）。
//   而应用的 tab 切换会 pushState，历史里堆着上一个 tab，
//   于是在图表上右滑看更早的时期，浏览器却「后退」跳回了上一个 tab
//   （实测：从设置页切过来后右滑，直接跳回设置页）。
//   修法：判定为横向后立刻 preventDefault，并可锁定整段手势，避免中途反复切换。
//
// 关键点 3：单指平移 与 双指缩放 用 mode 区分，互不干扰。
//   一次捏合手势只切一档 —— 因为 chartZoom 会重建图表 DOM，
//   继续沿用同一串触摸事件的目标元素已脱离文档，行为不可预期；
//   档位只有 5 个、且有视觉反馈，重新捏一次是可以接受的代价。
function bindChartSwipe() {
  var host = document.getElementById('pageContent');
  if (!host || host._chartSwipeBound) return;
  host._chartSwipeBound = true;

  var sx = 0, sy = 0;              // 单指起点
  var mode = '';                    // '' | 'pan' | 'zoom'
  var pinchStart = 0;               // 双指初始间距

  function inChart(t) { return !!(t && t.closest && t.closest('.rc-wrap')); }
  function dist(a, b) { return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); }

  host.addEventListener('touchstart', function(e) {
    if (!inChart(e.target)) { mode = ''; return; }
    if (e.touches.length >= 2) {
      // 双指 → 缩放模式，本次手势不再做平移
      mode = 'zoom';
      pinchStart = dist(e.touches[0], e.touches[1]);
      return;
    }
    mode = 'pan';
    sx = e.touches[0].clientX;
    sy = e.touches[0].clientY;
  }, { passive: true });

  // 必须 passive:false —— 否则 preventDefault() 会被浏览器忽略
  host.addEventListener('touchmove', function(e) {
    if (mode === 'zoom') {
      if (e.touches.length < 2 || !pinchStart) return;
      if (e.cancelable) e.preventDefault();     // 别让浏览器接管成整页缩放
      var ratio = dist(e.touches[0], e.touches[1]) / pinchStart;
      // 阈值给得比较宽松，避免手指略微抖动就切档
      if (ratio > 1.35 || ratio < 0.75) {
        chartZoom(ratio > 1 ? 1 : -1);          // 张开=放大(档位变小)，捏合=缩小
        pinchStart = 0;                          // 本次手势到此为止，避免连续切档
      }
      return;
    }
    if (mode !== 'pan' || e.touches.length !== 1) return;
    var t = e.touches[0];
    var dx = t.clientX - sx, dy = t.clientY - sy;
    // 位移够大才判方向，避免手指轻微抖动就锁定
    if (!axis) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      }
    }
    if (axis === 'x' && e.cancelable) {
      // 阻止浏览器把横向滑动当成滚动 / 导航手势
      e.preventDefault();
    }
  }, { passive: false });

  host.addEventListener('touchend', function(e) {
    if (mode === 'pan') {
      var t = e.changedTouches[0];
      var dx = t.clientX - sx, dy = t.clientY - sy;
      // 判定必须**独立算一次**，不能复用 touchmove 里锁定的 axis ——
      // 手指飞快轻扫（flick）时 touchmove 可能一次都不触发，
      // 那时 axis 仍是空串，翻页就会静默失效（实测过）。
      // 横向位移是纵向的 1.5 倍以上、且超过 50px → 判为翻页意图，否则放行给页面滚动
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        // 手指右滑 = 往回看（更早），左滑 = 往近看
        chartShift(dx > 0 ? 1 : -1);
      }
    }
    // 只在一根手指都不剩时才复位，避免双指变单指时被误判为平移
    if (e.touches.length === 0) { mode = ''; axis = ''; pinchStart = 0; }
  }, { passive: true });

  // 手势被系统打断（来电、通知等）时复位，避免下次进入残留状态
  host.addEventListener('touchcancel', function() {
    mode = ''; axis = ''; pinchStart = 0;
  }, { passive: true });
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
    if (h) { var isRest = WHT.getDayType(d).holiday; h.classList.toggle('active', isRest); st.formHoliday = isRest; }
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

function loadMoreRecords() {
  // 「加载更多」只在展开状态下渲染，但保险起见仍确保展开态，
  // 否则点了没反应（折叠时 limit 恒为 COLLAPSED_ROWS）。
  st.recordExpanded = true;
  var s = WHT.getUserSettings();
  s.recordExpanded = true;
  WHT.saveUserSettings(s);
  st.recordLimit = (st.recordLimit || 10) + 10;
  WHT.renderCurrentTab(true);
}

function saveRecord() {
  var d = (document.getElementById('recordDate')||{}).value;
  var s = (document.getElementById('recordStart')||{}).value;
  var e = (document.getElementById('recordEnd')||{}).value;
  var n = (document.getElementById('recordNote')||{}).value || '';
  var h = document.getElementById('recordHoliday');
  var isH = h ? h.classList.contains('active') : WHT.getDayType(d).holiday;
  if (!d || !s || !e) { WHT.showToast('请填写完整信息', 'warning'); return; }
  var hrs = WHT.calculateHours(s, e);
  var r = WHT.getUserRecords();
  var ex = r.findIndex(function(x) { return x.date === d; });
  var rec = { id: ex >= 0 ? r[ex].id : WHT.genId(), date: d, startTime: s, endTime: e, hours: hrs, isHoliday: isH, note: n, modeId: st.currentMode, status: 'done' };
  if (ex >= 0) r[ex] = rec; else r.push(rec);
  WHT.saveUserRecords(r);
  if (h) WHT.setRestFlag(d, isH);
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
  st.formDate = r.date; st.formStart = r.startTime; st.formEnd = r.endTime; st.formNote = r.note || ''; st.formHoliday = WHT.getDayType(r.date).holiday;
  var dateEl = document.getElementById('recordDate');
  var startEl = document.getElementById('recordStart');
  var endEl = document.getElementById('recordEnd');
  var noteEl = document.getElementById('recordNote');
  if (dateEl) dateEl.value = r.date;
  if (startEl) startEl.value = r.startTime;
  if (endEl) endEl.value = r.endTime || '';
  if (noteEl) noteEl.value = r.note || '';
  var h = document.getElementById('recordHoliday');
  if (h) h.classList.toggle('active', WHT.getDayType(r.date).holiday);
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
  WHT.onPunchCardTap = onPunchCardTap;
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
  WHT.loadMoreRecords = loadMoreRecords;
  WHT.autoEarnCompTime = autoEarnCompTime;
  WHT.onRecordDateChange = onRecordDateChange;
  // 最近记录双视图
  WHT.setRecordView = setRecordView;
  WHT.openRecordDetail = openRecordDetail;
  WHT.toggleRecordExpand = toggleRecordExpand;
  WHT.closeRecordSheet = closeRecordSheet;
  WHT.confirmDeleteRecord = confirmDeleteRecord;
  WHT.chartShift = chartShift;
  WHT.chartZoom = chartZoom;
  WHT.chartCycleSpan = chartCycleSpan;
  WHT.chartBackToLatest = chartBackToLatest;

})();
