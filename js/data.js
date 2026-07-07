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
function exportJSON(){WHT.haptic('medium');var d={users:st.users,exportDate:new Date().toISOString(),data:{}};st.users.forEach(function(u){d.data[u.id]={nickname:u.nickname,settings:WHT.DataStore.get(WHT.APP_PREFIX+u.id+'_settings',{}),records:WHT.DataStore.get(WHT.APP_PREFIX+u.id+'_records',[]),compTime:WHT.DataStore.get(WHT.APP_PREFIX+u.id+'_compTime',[]),modes:WHT.DataStore.get(WHT.APP_PREFIX+u.id+'_modes',[])}});var jsonStr=JSON.stringify(d,null,2);var blob=new Blob([jsonStr],{type:'application/json'});var filename='work-hours-'+WHT.today()+'.json';shareOrDownload(blob,filename,'application/json',jsonStr)}
function exportCSV(){WHT.haptic('medium');var r=WHT.getUserRecords();var csv=[['\u65e5\u671f','\u5f00\u59cb\u65f6\u95f4','\u7ed3\u675f\u65f6\u95f4','\u5de5\u65f6','\u8282\u5047\u65e5','\u5907\u6ce8']].concat(r.map(function(x){return[x.date,x.startTime,x.endTime,x.hours,x.isHoliday?'\u662f':'\u5426',x.note||'']})).map(function(x){return x.join(',')}).join('\n');var csvContent='\ufeff'+csv;var blob=new Blob([csvContent],{type:'text/csv;charset=utf-8'});var filename='work-hours-'+WHT.today()+'.csv';shareOrDownload(blob,filename,'text/csv',csvContent)}
function shareOrDownload(blob,filename,mime,fallbackText){
  // 优先 Web Share API（Android / 现代浏览器）
  if(typeof navigator!=='undefined'&&navigator.share&&navigator.canShare){var file=new File([blob],filename,{type:mime});if(navigator.canShare({files:[file]})){navigator.share({files:[file],title:'\u5bfc\u51fa\u5de5\u65f6\u6570\u636e'}).catch(function(){});return}}
  // 兜底：显示内容让用户手动复制
  WHT.haptic('medium');
  document.getElementById('userModal').querySelector('.modal-title').textContent='\u5bfc\u51fa\u6570\u636e';
  document.getElementById('userModal').querySelector('.modal-sheet').innerHTML='<div class="modal-handle"></div><div class="modal-title">\u5bfc\u51fa\u6570\u636e</div><div style="padding:12px;background:var(--bg-page);border-radius:8px;max-height:50vh;overflow:auto"><pre style="font-size:11px;margin:0;white-space:pre-wrap;word-break:break-all">'+WHT.escapeHtml(fallbackText).substring(0,8000)+'</pre></div><div style="margin-top:12px;display:flex;gap:8px"><button class="btn btn-primary" style="flex:1" onclick="navigator.clipboard.writeText(document.querySelector(\'#userModal pre\').textContent);WHT.showToast(\'\u5df2\u590d\u5236\');document.getElementById(\'userModal\').classList.remove(\'active\')">\u590d\u5236\u5168\u90e8</button><button class="btn" style="flex:1" onclick="document.getElementById(\'userModal\').classList.remove(\'active\')">\u5173\u95ed</button></div>';
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

  // ── 导出到 WHT 命名空间 ──
  WHT.toggleSettingsCollapse = toggleSettingsCollapse;
  WHT.initSettingsCollapse = initSettingsCollapse;
  WHT.exportJSON = exportJSON;
  WHT.exportCSV = exportCSV;
  WHT.validateImportData = validateImportData;
  WHT.handleFileImport = handleFileImport;
  WHT.clearAllData = clearAllData;

})();
