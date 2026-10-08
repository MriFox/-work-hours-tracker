/* 数据管理：折叠逻辑 + 导入导出 + 清除数据 */
(function() {
  "use strict";
  var WHT = window.WHT;
  var st = WHT.state;

// ── 设置页折叠 ──
function getCollapseKey(){
  return 'wht-collapse-' + (st.currentUser ? st.currentUser.id : 'default');
}
function toggleSettingsCollapse(titleEl){
  var card = titleEl.parentElement.querySelector('.settings-card--collapsible');
  if (!card) return;
  var isOpen = titleEl.classList.contains('open');
  if (isOpen) {
    titleEl.classList.remove('open');
    card.classList.add('collapsed');
  } else {
    titleEl.classList.add('open');
    card.classList.remove('collapsed');
  }
  saveCollapseState();
}
function saveCollapseState(){
  var state = {};
  var groups = document.querySelectorAll('.settings-group[data-collapse]');
  groups.forEach(function(g){
    state[g.getAttribute('data-collapse')] = g.querySelector('.settings-group-title--toggler').classList.contains('open');
  });
  localStorage.setItem(getCollapseKey(), JSON.stringify(state));
}
function initSettingsCollapse(){
  var state = {};
  try { state = JSON.parse(localStorage.getItem(getCollapseKey()) || '{}'); } catch(e) {}
  var groups = document.querySelectorAll('.settings-group[data-collapse]');
  groups.forEach(function(g){
    var key = g.getAttribute('data-collapse');
    var title = g.querySelector('.settings-group-title--toggler');
    var card = g.querySelector('.settings-card--collapsible');
    if (!title || !card) return;
    // 默认展开，除非 localStorage 明确记录为 false
    if (state[key] === false) {
      title.classList.remove('open');
      card.classList.add('collapsed');
    } else {
      title.classList.add('open');
      card.classList.remove('collapsed');
    }
  });
}

// ── Data Import/Export ──
function csvEscape(s){s=String(s||'');if(s.indexOf(',')>=0||s.indexOf('"')>=0||s.indexOf('\n')>=0)return'"'+s.replace(/"/g,'""')+'"';return s}
function exportJSON(){WHT.haptic('medium');var d={users:st.users,exportDate:new Date().toISOString(),data:{}};st.users.forEach(function(u){d.data[u.id]={nickname:u.nickname,settings:WHT.DataStore.get(WHT.APP_PREFIX+u.id+'_settings',{}),records:WHT.DataStore.get(WHT.APP_PREFIX+u.id+'_records',[]),compTime:WHT.DataStore.get(WHT.APP_PREFIX+u.id+'_compTime',[]),modes:WHT.DataStore.get(WHT.APP_PREFIX+u.id+'_modes',[])}});var jsonStr=JSON.stringify(d,null,2);var blob=new Blob([jsonStr],{type:'application/json'});var filename='work-hours-'+WHT.today()+'.json';shareOrDownload(blob,filename,'application/json',jsonStr)}
function exportCSV(){WHT.haptic('medium');var r=WHT.getUserRecords();var csv=[['\u65e5\u671f','\u5f00\u59cb\u65f6\u95f4','\u7ed3\u675f\u65f6\u95f4','\u5de5\u65f6','\u8282\u5047\u65e5','\u5907\u6ce8']].concat(r.map(function(x){return[x.date,x.startTime,x.endTime,x.hours,WHT.isHoliday(x.date)?'\u662f':'\u5426',x.note||''].map(csvEscape)})).map(function(x){return x.join(',')}).join('\n');var csvContent='\ufeff'+csv;var blob=new Blob([csvContent],{type:'text/csv;charset=utf-8'});var filename='work-hours-'+WHT.today()+'.csv';shareOrDownload(blob,filename,'text/csv',csvContent)}
function shareOrDownload(blob,filename,mime,fallbackText){
  // 优先 Web Share API（Android / 现代浏览器）
  if(typeof navigator!=='undefined'&&navigator.share&&navigator.canShare){var file=new File([blob],filename,{type:mime});if(navigator.canShare({files:[file]})){navigator.share({files:[file],title:'\u5bfc\u51fa\u5de5\u65f6\u6570\u636e'}).catch(function(){});return}}
  // 兜底：显示内容让用户手动复制
  WHT.haptic('medium');
  WHT._exportFullText = fallbackText;
  document.getElementById('userModal').querySelector('.modal-title').textContent='\u5bfc\u51fa\u6570\u636e';
  document.getElementById('userModal').querySelector('.modal-sheet').innerHTML='<div class="modal-handle"></div><div class="modal-title">\u5bfc\u51fa\u6570\u636e</div><div style="padding:12px;background:var(--bg-page);border-radius:8px;max-height:50vh;overflow:auto"><pre style="font-size:11px;margin:0;white-space:pre-wrap;word-break:break-all">'+WHT.escapeHtml(fallbackText).substring(0,8000)+(fallbackText.length>8000?'\n\n... (\u663e\u793a\u5df2\u622a\u65ad\uff0c\u590d\u5236\u5c06\u83b7\u53d6\u5b8c\u6574\u6570\u636e)':'')+'</pre></div><div style="margin-top:12px;display:flex;gap:8px"><button class="btn btn-primary" style="flex:1" onclick="navigator.clipboard.writeText(WHT._exportFullText);WHT.showToast(\'\u5df2\u590d\u5236\u5b8c\u6574\u6570\u636e\');document.getElementById(\'userModal\').classList.remove(\'active\')">\u590d\u5236\u5168\u90e8</button><button class="btn" style="flex:1" onclick="document.getElementById(\'userModal\').classList.remove(\'active\')">\u5173\u95ed</button></div>';
  document.getElementById('userModal').classList.add('active');
  // 同时尝试旧版下载（电脑浏览器）
  try{var url=URL.createObjectURL(blob);var a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();document.body.removeChild(a);setTimeout(function(){URL.revokeObjectURL(url)},1000)}catch(e){}
}
function validateImportData(d){
  if(!d||typeof d!=='object')return'数据格式无效';
  if(!Array.isArray(d.users))return'用户数据格式无效';
  for(var i=0;i<d.users.length;i++){
    var u=d.users[i];
    if(!u.id||!u.nickname)return'用户 #'+(i+1)+' 缺少必要字段';
  }
  if(d.data){
    for(var uid in d.data){
      var ud=d.data[uid];
      if(ud.records&&!Array.isArray(ud.records))return'用户 '+uid+' 的记录数据格式无效';
      if(ud.records){
        for(var j=0;j<ud.records.length;j++){
          var rec=ud.records[j];
          if(!rec.date||!rec.startTime||!rec.endTime)return'记录 #'+(j+1)+' 缺少必要字段';
        }
      }
    }
  }
  return null;
}
function handleFileImport(e){var f=e.target.files[0];if(!f)return;var reader=new FileReader();reader.onload=function(ev){try{var d=JSON.parse(ev.target.result);var err=validateImportData(d);if(err){WHT.showToast('\u5bfc\u5165\u5931\u8d25\uff1a'+err,'error');return}if(d.users){var summary=d.users.map(function(u){var ud=d.data[u.id]||{};var recCount=ud.records?ud.records.length:0;var modeCount=ud.modes?ud.modes.length:0;return u.nickname+': '+recCount+'\u6761\u8bb0\u5f55, '+modeCount+'\u4e2a\u6a21\u5f0f'}).join('\n');WHT.showConfirm('\u5bfc\u5165\u6570\u636e','\u5c06\u8981\u5bfc\u5165\uff1a\n'+summary+'\n\n\u786e\u5b9a\u5408\u5e76\uff1f',function(){WHT.haptic('heavy');d.users.forEach(function(u){if(!st.users.find(function(x){return x.id===u.id}))st.users.push(u);var ud=d.data[u.id];if(ud){if(ud.settings)WHT.DataStore.set(WHT.APP_PREFIX+u.id+'_settings',ud.settings);if(ud.records)WHT.DataStore.set(WHT.APP_PREFIX+u.id+'_records',ud.records);if(ud.compTime)WHT.DataStore.set(WHT.APP_PREFIX+u.id+'_compTime',ud.compTime);if(ud.modes)WHT.DataStore.set(WHT.APP_PREFIX+u.id+'_modes',ud.modes)}});WHT.saveUsers();WHT.showToast('\u5bfc\u5165\u6210\u529f')})}}catch(err){WHT.showToast('\u5bfc\u5165\u5931\u8d25\uff1a\u6587\u4ef6\u683c\u5f0f\u9519\u8bef','error')}};reader.readAsText(f);e.target.value=''}
function clearAllData(){WHT.showConfirm('清除数据','确定要清除当前用户的所有数据吗？',function(){WHT.haptic('delete');if(st.currentUser){var p=WHT.APP_PREFIX+st.currentUser.id;WHT.DataStore.remove(p+'_settings');WHT.DataStore.remove(p+'_records');WHT.DataStore.remove(p+'_compTime');WHT.DataStore.remove(p+'_modes');st.users=st.users.filter(function(u){return u.id!==st.currentUser.id});WHT.saveUsers();st.currentUser=null;st.currentMode=null;document.getElementById('mainApp').classList.remove('active');document.getElementById('loginPage').classList.add('active')}})}

// ── 测试数据生成 ───────────────────────────────────────────────────────────
// 用途：一键铺出近 20 天的打卡记录，方便验证折叠 / 翻页 / 实时工时 / 加班配色等。
// 必须输入密钥才执行 —— 它会**替换近 20 天的记录**，不能误触。
// 只替换这 20 天，**窗口外的记录原样保留**，避免把真实数据一起清掉。
var TEST_DATA_KEY = '115511';
var TEST_DATA_DAYS = 20;

// 逐个工作日的工时：刻意有高有低 —— 加班(11~12h)、标准(9h)、少量(6.5~8h) 混合，
// 不要千篇一律，否则测不出「加班点变琥珀色」「差额正负」这些分支。
var TEST_HOURS = [9, 8.5, 10, 9.5, 12, 8, 9, 6.5, 11, 9, 10.5, 7.5, 9, 9.5, 8.5, 9];

function generateTestData() {
  var pad = function(n) { return String(n).padStart(2, '0'); };
  var fmt = function(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  };
  var now = new Date();

  // 近 20 天的日期串，[0] = 今天
  var win = [];
  for (var i = 0; i < TEST_DATA_DAYS; i++) {
    win.push(fmt(new Date(now.getTime() - i * 86400000)));
  }

  // 只清掉窗口内的旧记录；窗口外原样保留
  var kept = WHT.getUserRecords().filter(function(r) { return win.indexOf(r.date) < 0; });

  var made = [];
  var hourIdx = 0;
  for (var k = 0; k < win.length; k++) {
    var dateStr = win[k];
    var dow = new Date(dateStr + 'T00:00:00').getDay();

    // 今天固定给一条「进行中」，用来验证实时工时 / 图表实时数据点
    if (k === 0) {
      var at = new Date(now.getTime() - (2 * 3600000 + 25 * 60000));
      made.push({
        id: WHT.genId(), date: dateStr,
        startTime: pad(at.getHours()) + ':' + pad(at.getMinutes()),
        endTime: null, hours: 0, note: '',
        modeId: st.currentMode, status: 'working'
      });
      continue;
    }

    // 周末休息不生成 —— 与真实使用一致，也正好验证图表折线在休息日「断开」
    if (dow === 0 || dow === 6) continue;

    var h = TEST_HOURS[hourIdx % TEST_HOURS.length];
    hourIdx++;
    // 上班时间 8:30 / 8:45 / 9:00 轮换，避免所有行长得一模一样
    var startMin = Math.round((8.5 + (hourIdx % 3) * 0.25) * 60);
    var endMin = startMin + Math.round(h * 60);
    made.push({
      id: WHT.genId(), date: dateStr,
      startTime: pad(Math.floor(startMin / 60)) + ':' + pad(startMin % 60),
      endTime: pad(Math.floor(endMin / 60)) + ':' + pad(endMin % 60),
      hours: Math.round(h * 100) / 100,
      note: '', modeId: st.currentMode, status: 'done'
    });
  }

  WHT.saveUserRecords(kept.concat(made));

  // 生成后复位折叠/翻页，保证一进来就能看到完整数据（否则可能只显示 3 条、以为是空的）
  var s = WHT.getUserSettings();
  s.recordExpanded = true;
  s.chartShift = 0;
  WHT.saveUserSettings(s);
  st.recordExpanded = true;
  st.chartShift = 0;
  st.recordLimit = 10;

  WHT.renderCurrentTab(true);
  return made.length;
}

// 设置页入口：先说明影响，再要求输入密钥。
// 密钥写在代码里（TEST_DATA_KEY），输错只提示、不做任何改动。
function openTestDataDialog() {
  WHT.haptic('light');
  var cTitle = document.getElementById('confirmTitle');
  var cMsg = document.getElementById('confirmMsg');
  var dlg = document.getElementById('confirmDialog');
  if (!cTitle || !cMsg || !dlg) return;

  cTitle.textContent = '生成测试数据';
  cMsg.innerHTML =
    '<div style="font-size:13px;color:var(--text-muted);line-height:1.6;text-align:left">' +
      '会替换<strong>近 ' + TEST_DATA_DAYS + ' 天</strong>的打卡记录，其它日期不受影响。<br>' +
      '工时有多有少，周末休息，今天为「进行中」。<br>请输入密钥确认：' +
    '</div>' +
    '<input type="text" class="input" id="testDataKey" inputmode="numeric" ' +
      'autocomplete="off" placeholder="密钥" ' +
      'style="margin-top:8px;text-align:center;letter-spacing:3px">';

  var confirmBtn = document.querySelector('#confirmDialog .btn-primary');
  var cancelBtn = document.querySelector('#confirmDialog .btn');
  var oC = confirmBtn.textContent, oX = cancelBtn.textContent;
  confirmBtn.textContent = '生成';
  cancelBtn.textContent = '取消';
  dlg.classList.add('active');
  setTimeout(function() { var el = document.getElementById('testDataKey'); if (el) el.focus(); }, 120);

  var handler = function(ok) {
    dlg.classList.remove('active');
    confirmBtn.textContent = oC;
    cancelBtn.textContent = oX;
    // 关键：把内联 onclick 恢复回去。
    // 本文件里 renameMode / editCommonSlot 等也有同样的「劫持按钮」写法，
    // 但它们结束后不恢复，会导致之后的 showConfirm 点了没反应（既有缺陷）。
    confirmBtn.onclick = function() { WHT.closeConfirm(true); };
    cancelBtn.onclick = function() { WHT.closeConfirm(false); };
    if (!ok) return;

    var el = document.getElementById('testDataKey');
    var v = el ? String(el.value || '').trim() : '';
    if (v !== TEST_DATA_KEY) {
      WHT.haptic('delete');
      WHT.showToast('密钥不正确', 'warning');
      return;
    }
    WHT.haptic('medium');
    var n = generateTestData();
    WHT.showToast('已生成 ' + n + ' 条测试数据 ✓');
  };
  cancelBtn.onclick = function() { handler(false); };
  confirmBtn.onclick = function() { handler(true); };
}

  // ── 导出到 WHT 命名空间 ──
  WHT.toggleSettingsCollapse = toggleSettingsCollapse;
  WHT.initSettingsCollapse = initSettingsCollapse;
  WHT.exportJSON = exportJSON;
  WHT.exportCSV = exportCSV;
  WHT.validateImportData = validateImportData;
  WHT.handleFileImport = handleFileImport;
  WHT.clearAllData = clearAllData;
  WHT.generateTestData = generateTestData;
  WHT.openTestDataDialog = openTestDataDialog;

})();
