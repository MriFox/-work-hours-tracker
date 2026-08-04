/* 应用入口：初始化 / ModeBar / 页面路由 / 导航 */
(function() {
  "use strict";
  var W = window;
  var WHT = W.WHT;
  var st = WHT.state;

// Event listeners：切后台再回来时，如果日期变了，刷新当前页面
st._lastVisibleDate=WHT.today();
document.addEventListener('visibilitychange',function(){
  if(document.visibilityState==='visible'){
    var currentDate=WHT.today();
    if(st._lastVisibleDate!==currentDate){
      st._lastVisibleDate=currentDate;
      WHT.renderCurrentTab(true);
    }
  }
});

// History API 导航栈（TWA Back 键支持）
window.addEventListener('popstate',function(e){
  // 优先关闭打开的 modal
  var userModal=document.getElementById('userModal');
  if(userModal&&userModal.classList.contains('active')){WHT.hideUserModal();history.pushState({tab:st.currentTab},'' ,'#'+st.currentTab);return}
  var confirmDialog=document.getElementById('confirmDialog');
  if(confirmDialog&&confirmDialog.classList.contains('active')){WHT.closeConfirm(false);history.pushState({tab:st.currentTab},'' ,'#'+st.currentTab);return}
  var datePicker=document.getElementById('datePickerOverlay');
  if(datePicker&&datePicker.classList.contains('active')){WHT.closeDatePicker();history.pushState({tab:st.currentTab},'' ,'#'+st.currentTab);return}
  var timePicker=document.getElementById('timePickerOverlay');
  if(timePicker&&timePicker.classList.contains('active')){WHT.closeTimePicker();history.pushState({tab:st.currentTab},'' ,'#'+st.currentTab);return}
  var monthPicker=document.getElementById('monthPickerOverlay');
  if(monthPicker&&monthPicker.classList.contains('active')){WHT.closeMonthPicker();history.pushState({tab:st.currentTab},'' ,'#'+st.currentTab);return}
  // 然后处理 tab 切换
  if(e.state&&e.state.tab){
    st.currentTab=e.state.tab;
    document.querySelectorAll('.nav-tab').forEach(function(x){x.classList.toggle('active',x.dataset.tab===e.state.tab)});
    WHT.renderCurrentTab();
  }
});

// Mode Bar
function renderModeBar(){var m=WHT.getUserModes();document.getElementById('modeBar').innerHTML=m.map(function(x){return '<div class="mode-tab '+(x.id===(st.currentMode||m[0]?.id)?'active':'')+'" data-id="'+x.id+'" onclick="WHT.switchMode(\''+x.id+'\')">'+WHT.escapeHtml(x.icon)+' '+WHT.escapeHtml(x.name)+'</div>'}).join('')+'<div class="mode-tab-add" onclick="WHT.addNewMode()">+</div>';if(!st.currentMode&&m.length>0)st.currentMode=m[0].id;var avatar=st.currentUser?.avatar||(st.currentUser?.nickname||'?').charAt(0);var isImg=avatar&&avatar.startsWith&&avatar.startsWith('data:');document.getElementById('modeBarRight').innerHTML='<div class="mode-bar-avatar" onclick="WHT.switchTab(\'settings\')">'+(isImg?'<img src="'+avatar+'" alt="">':WHT.escapeHtml(avatar))+'</div>'}
function switchMode(mid){st.currentMode=mid;WHT.haptic('light');var m=WHT.getUserModes().find(function(x){return x.id===mid});if(m)WHT.showToast(m.icon+' '+m.name,'info',1500);document.querySelectorAll('.mode-tab').forEach(function(t){t.classList.toggle('active',t.dataset.id===mid)});WHT.renderCurrentTab(false)}
function addNewMode(){WHT.haptic('light');st.wizardData={loginType:null,isAddMode:true};st.wizardStep=0;st.wizardData.steps={};showModeSelectionWizard()}
function showModeSelectionWizard(){document.getElementById('wizardContainer').innerHTML='<div class="wizard-step"><div class="wizard-step-title">选择模式类型</div><div class="wizard-step-desc">选择要添加的工时模式</div><div class="mode-grid" style="max-width:100%"><div class="mode-card" onclick="selectAddMode(this,\'civil\')"><div class="mode-card-icon">🏛️</div><div class="mode-card-name">标准模式</div></div><div class="mode-card" onclick="selectAddMode(this,\'comprehensive\')"><div class="mode-card-icon">⏰</div><div class="mode-card-name">综合工时</div></div><div class="mode-card" onclick="selectAddMode(this,\'flextime\')"><div class="mode-card-icon">📅</div><div class="mode-card-name">大小周</div></div><div class="mode-card" onclick="selectAddMode(this,\'custom\')"><div class="mode-card-icon">⚙️</div><div class="mode-card-name">自定义</div></div></div><div class="wizard-nav"><button class="btn" onclick="cancelWizard()">取消</button></div></div>';document.getElementById('loginPage').classList.remove('active');document.getElementById('mainApp').classList.remove('active');document.getElementById('wizardPage').classList.add('active')}
function selectAddMode(el,t){el.closest('.mode-grid').querySelectorAll('.mode-card').forEach(function(c){c.classList.remove('selected')});el.classList.add('selected');st.wizardData.loginType=t;if(t==='custom'){st.wizardData.isAddMode=true;st.wizardStep=0;st.wizardData.steps={};showWizardPage()}else{var m=WHT.getUserModes();var i={civil:'🏛️',comprehensive:'⏰',flextime:'📅'};var n={civil:'标准模式',comprehensive:'综合工时',flextime:'大小周'};m.push({id:WHT.genId(),name:n[t],type:t,icon:i[t]});WHT.saveUserModes(m);st.currentMode=m[m.length-1].id;WHT.haptic('medium');cancelWizard();WHT.renderModeBar()}}

// Tab System
function switchTab(t){
  st.currentTab=t;
  WHT.haptic('light');
  WHT.stopWorkingTimer();
  document.querySelectorAll('.nav-tab').forEach(function(x){x.classList.toggle('active',x.dataset.tab===t)});
  try{history.pushState({tab:t,timestamp:Date.now()},'', '#'+t);}catch(e){}
  WHT.renderCurrentTab();
}
function renderCurrentTab(ps){
  if (!st.currentUser) {
    document.getElementById('loginPage').classList.add('active');
    document.getElementById('mainApp').classList.remove('active');
    document.getElementById('userModal').classList.remove('active');
    return;
  }
  var psVal=ps===true;var c=document.getElementById('pageContent');if(!c)return;var sp=psVal?c.scrollTop:0;try{switch(st.currentTab){case'record':WHT.renderRecordPage(c);break;case'week':WHT.renderWeekPage(c);break;case'month':WHT.renderMonthPage(c);break;case'quarter':WHT.renderQuarterPage(c);break;case'settings':WHT.renderSettingsPage(c);break}}catch(e){c.innerHTML='<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-text">页面加载出错，请重试</div></div>'}if(psVal)requestAnimationFrame(function(){c.scrollTop=sp})
}

  // ── 核心导出 ──
  WHT.renderModeBar = renderModeBar;
  WHT.switchMode = switchMode;
  WHT.addNewMode = addNewMode;
  WHT.switchTab = switchTab;
  WHT.renderCurrentTab = renderCurrentTab;
  WHT.selectAddMode = selectAddMode;

  // ── 向后兼容：HTML onclick 处理器使用的函数别名 ──
  var wAlias = [
    'haptic','genId','escapeHtml','today','isHoliday','isWeekend','getDayOfWeek','formatDate','calculateHours','getProgressClass','toggleHoliday',
    'loadData','saveUsers','getUserSettings','saveUserSettings','getUserRecords','saveUserRecords','getUserCompTime','saveUserCompTime','getUserModes','saveUserModes','getDefaultSettings','getDefaultModes',
    'showToast','showToastWithAction','showConfirm','closeConfirm',
    'toggleDarkMode','applyTheme','applyStyle','toggleStyle','getStyleLabel',
    'renderModeBar','switchMode','addNewMode','switchTab','renderCurrentTab','renderSettingsPage',
    'updateSetting','updateFlextimeSetting','renameMode','deleteMode',
    'addCommonSlot','editCommonSlot','saveCommonSlotEdit','removeCommonSlot','addQuarter','editQuarter','saveQuarterEdit','removeQuarter','toggleSettingsCollapse',
    'exportJSON','exportCSV','validateImportData','handleFileImport','clearAllData',
    'openAvatarPicker','closeAvatarPicker','updateAvatar','uploadAvatar',
    'showEditProfile','cancelEditProfile','saveProfile',
    'selectLoginMode','handleLogin','enterApp','showUserModal','hideUserModal','switchUser','addNewUser','deleteUser','finishFlextimeWizard','selectAddMode',
    'showWizardPage','renderWizardStep','cancelWizard','wizardPrev','wizardNext','selectWizardOption',
    'punchIn','punchOut','adjustPunchTime','applyPunchTimeAdjust','renderRecordPage','startWorkingTimer','stopWorkingTimer',
    'toggleManualEntry','fillTimeSlotQuick','copyYesterdayQuick','deleteTodayRecord','saveRecord','calcRecordHours',
    'editRecord','deleteRecord','toggleCompList','showAddCompTime','saveCompTime','editCompTime','updateCompTime','deleteCompTime',
    'toggleNote','toggleRecordList','loadMoreRecords','autoEarnCompTime','onRecordDateChange',
    'renderWeekPage','selectWeekDay','changeWeek','goToCurrentWeek',
    'renderMonthPage','selectMonthDay','changeMonth','goToCurrentMonth','openMonthPicker','closeMonthPicker','changePickerYear','selectPickerMonth','confirmMonthPicker',
    'renderQuarterPage','switchQuarter','changeQuarterYear',
    'openDatePicker','closeDatePicker','renderDatePicker','changePickerMonth','confirmDatePicker','selectDateDay',
    'openTimePicker','closeTimePicker','renderTimePicker','confirmTimePicker','selectHour','selectMinute','selectNow',
    'openTimePicker_wizard','openTimePicker_flex','openDatePicker_flex'
  ];
  wAlias.forEach(function(name) { if (WHT[name]) W[name] = WHT[name]; });

  // 状态对象也保持全局可访问（兼容历史代码）
  window.state = WHT.state;

  // === 延迟到所有导出完成后才执行的初始化 ===
  WHT.loadData();
  WHT.applyTheme();
  WHT.applyStyle();
  try {
    var savedUid = WHT.getSession();
    if (savedUid && st.users.length > 0) {
      var savedUser = st.users.find(function(u) { return u.id === savedUid; });
      if (savedUser) {
        st.currentUser = savedUser;
        WHT.applyTheme();
        var mm = WHT.getUserModes();
        if (mm.length > 0) { st.currentMode = mm[0].id; WHT.enterApp(); }
      }
    } else if (st.users.length === 1) {
      st.currentUser = st.users[0];
      WHT.applyTheme();
      var m = WHT.getUserModes();
      if (m.length > 0) { st.currentMode = m[0].id; WHT.enterApp(); }
    } else if (st.users.length > 1) {
      // 多用户且无session时保持登录页
    }
  } catch(e) {
    st.users = st.users || [];
    st.currentUser = null;
    st.currentMode = null;
    st.currentTab = 'record';
    st.weekOffset = 0;
    st.monthOffset = 0;
    st.quarterIndex = 0;
    st.quarterYear = new Date().getFullYear();
    st.selectedDay = null;
    st.wizardData = {};
    st.wizardStep = 0;
  }
  var civilCard = document.querySelector('.mode-card[data-type="civil"]');
  if (civilCard) civilCard.classList.add('selected');

})();
