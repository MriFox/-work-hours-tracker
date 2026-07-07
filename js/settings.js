/* 设置页：渲染 + 设置项更新 + 头像/资料编辑 + 常用时段/季度 CRUD */
(function() {
  "use strict";
  var WHT = window.WHT;
  var st = WHT.state;

// ═══ iOS 风格设置页 ═══
function renderSettingsPage(c) {
  var s = WHT.getUserSettings();
  var m = WHT.getUserModes();
  var md = m.find(function(x) { return x.id === st.currentMode; });
  var isF = md && md.type === 'flextime';
  var fc = s.flextimeConfig || {};

  function h(s) { return WHT.escapeHtml(s); }

  // 模式管理列表行
  var modeRows = m.map(function(x) {
    return '<div class="settings-row">' +
      '<div class="settings-row-left">' +
        '<span class="settings-icon" style="font-size:14px">' + h(x.icon) + '</span>' +
        '<div><div class="settings-label">' + h(x.name) + '</div><div class="mode-list-type">' + h(x.type) + '</div></div>' +
      '</div>' +
      '<div class="settings-row-actions">' +
        '<button class="btn-sm" onclick="event.stopPropagation();renameMode(\'' + h(x.id) + '\')">重命名</button>' +
        (m.length > 1 ? '<button class="btn-sm btn-sm-danger" onclick="event.stopPropagation();deleteMode(\'' + h(x.id) + '\')">删除</button>' : '') +
      '</div>' +
    '</div>';
  }).join('');

  // 常用时段列表行
  var slotRows = s.commonSlots.map(function(x, i) {
    return '<div class="settings-row">' +
      '<div class="settings-row-left"><span class="settings-label">' + h(x.start) + ' – ' + h(x.end) + '</span></div>' +
      '<div class="settings-row-actions">' +
        '<button class="btn-sm" onclick="event.stopPropagation();editCommonSlot(' + i + ')">修改</button>' +
        '<button class="btn-sm btn-sm-danger" onclick="event.stopPropagation();removeCommonSlot(' + i + ')">删除</button>' +
      '</div>' +
    '</div>';
  }).join('');

  // 季度配置列表行
  var quarterRows = (s.quarterConfig || []).map(function(q, i) {
    return '<div class="settings-row">' +
      '<div class="settings-row-left">' +
        '<span class="settings-label">' + h(q.name) + '</span>' +
        '<span class="settings-value">' + (q.months || []).join(',') + '月</span>' +
      '</div>' +
      '<div class="settings-row-actions">' +
        '<button class="btn-sm" onclick="event.stopPropagation();editQuarter(' + i + ')">修改</button>' +
        '<button class="btn-sm btn-sm-danger" onclick="event.stopPropagation();removeQuarter(' + i + ')">删除</button>' +
      '</div>' +
    '</div>';
  }).join('');

  // 大小周专属区块
  var flextimeBlock = isF ? '' +
    '<div class="settings-group">' +
      '<div class="settings-group-title">大小周配置</div>' +
      '<div class="settings-card">' +
        '<div class="settings-input-row">' +
          '<span class="settings-label">兑换比例</span>' +
          '<div class="settings-item-right"><input type="number" inputmode="decimal" class="input" value="' + (fc.exchangeRate || 8) + '" onchange="updateFlextimeSetting(\'exchangeRate\',parseFloat(this.value))"><span class="settings-input-unit">h/次</span></div>' +
        '</div>' +
        '<div class="settings-row settings-row--tap" onclick="openTimePicker_flex(\'standardStart\',\'' + h(fc.standardStart || '') + '\')">' +
          '<div class="settings-row-left"><span class="settings-label">上班时间</span></div>' +
          '<div class="settings-item-right"><span class="settings-value">' + h(fc.standardStart || '10:00') + '</span><span class="settings-chevron">›</span></div>' +
        '</div>' +
        '<div class="settings-row settings-row--tap" onclick="openTimePicker_flex(\'standardEnd\',\'' + h(fc.standardEnd || '') + '\')">' +
          '<div class="settings-row-left"><span class="settings-label">下班时间</span></div>' +
          '<div class="settings-item-right"><span class="settings-value">' + h(fc.standardEnd || '19:00') + '</span><span class="settings-chevron">›</span></div>' +
        '</div>' +
        '<div class="settings-row settings-row--tap" onclick="openDatePicker_flex(\'' + h(fc.startDate || '') + '\')">' +
          '<div class="settings-row-left"><span class="settings-label">起始日期</span></div>' +
          '<div class="settings-item-right"><span class="settings-value">' + h(fc.startDate || WHT.today()) + '</span><span class="settings-chevron">›</span></div>' +
        '</div>' +
        '<div class="settings-row settings-row--tap" onclick="var sel=this.querySelector(\'select\');if(sel)sel.focus()">' +
          '<div class="settings-row-left"><span class="settings-label">起始为</span></div>' +
          '<div class="settings-item-right"><select class="input" style="width:80px;height:32px;font-size:15px;text-align:center;padding:0 4px;background:var(--bg-input);border-radius:8px;border:none" onchange="updateFlextimeSetting(\'startIsBigWeek\',this.value===\'\\u5927\\u5468\')"><option ' + (fc.startIsBigWeek ? 'selected' : '') + '>大周</option><option ' + (!fc.startIsBigWeek ? 'selected' : '') + '>小周</option></select></div>' +
        '</div>' +
      '</div>' +
    '</div>' : '';

  c.innerHTML =
    '<div class="settings-content">' +

      // ── 用户（置顶） ──
      (function() {
        var u = st.currentUser;
        var av = u?.avatar || (u?.nickname || '?').charAt(0);
        var isI = av && av.startsWith && av.startsWith('data:');
        var nick = h(u?.nickname || '');
        return '<div class="settings-group">' +
          '<div class="settings-group-title">用户</div>' +
          '<div class="settings-card settings-user-card">' +
            '<div class="settings-user-hero" id="userProfileHero">' +
              '<div class="settings-user-hero-avatar" onclick="openAvatarPicker()">' +
                (isI ? '<img src="' + av + '" class="settings-user-hero-avatar-img" alt="">' : '<div class="settings-user-hero-avatar-text">' + h(av) + '</div>') +
                '<div class="settings-user-avatar-edit">编辑</div>' +
              '</div>' +
              '<div class="settings-user-hero-name">' + nick + '</div>' +
              '<button class="settings-user-edit-btn" onclick="showEditProfile()">编辑资料</button>' +
            '</div>' +
            '<div class="settings-user-edit" id="userProfileEdit" style="display:none">' +
              '<div class="settings-input-row" style="padding:0 0 8px 0;border-bottom:none">' +
                '<span class="settings-label">用户名</span>' +
                '<div class="settings-item-right"><input type="text" class="input" id="userNicknameInput" value="' + nick + '" maxlength="20" style="width:120px"><button class="btn-sm" onclick="saveProfile()" style="margin-left:4px">保存</button></div>' +
              '</div>' +
              '<button class="btn-sm" onclick="cancelEditProfile()" style="width:100%">取消</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="settings-group" style="margin-top:-12px">' +
          '<div class="settings-card">' +
            '<div class="settings-row settings-row--tap" onclick="showUserModal()">' +
              '<span class="settings-label">切换用户</span>' +
              '<span class="settings-chevron">›</span>' +
            '</div>' +
          '</div>' +
        '</div>';
      })() +

      // ── 模式管理 ──
      '<div class="settings-group">' +
        '<div class="settings-group-title">模式管理</div>' +
        '<div class="settings-card">' +
          modeRows +
          '<div class="settings-add-btn" onclick="addNewMode()">+ 添加模式</div>' +
        '</div>' +
      '</div>' +

      // ── 外观（置顶） ──
      '<div class="settings-group">' +
        '<div class="settings-group-title">外观</div>' +
        '<div class="settings-card">' +
          '<div class="settings-row" onclick="toggleDarkMode()" style="cursor:pointer">' +
            '<span class="settings-label">深色模式</span>' +
            '<div class="ios-toggle' + (s.darkMode ? ' active' : '') + '" onclick="event.stopPropagation();toggleDarkMode()"></div>' +
          '</div>' +
          '<div class="settings-row settings-row--tap" onclick="toggleStyle()">' +
            '<span class="settings-label">视觉风格</span>' +
            '<div class="settings-item-right"><span class="settings-value">' + WHT.getStyleLabel(s.style) + '</span><span class="settings-chevron">›</span></div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      // ── 打卡参数 ──
      '<div class="settings-group">' +
        '<div class="settings-group-title">打卡参数</div>' +
        '<div class="settings-card">' +
          '<div class="settings-input-row">' +
            '<span class="settings-label">每日标准工时</span>' +
            '<div class="settings-item-right"><input type="number" inputmode="decimal" class="input" value="' + s.standardHours + '" onchange="updateSetting(\'standardHours\',parseFloat(this.value))"><span class="settings-input-unit">h</span></div>' +
          '</div>' +
          '<div class="settings-input-row">' +
            '<span class="settings-label">节假日加班费</span>' +
            '<div class="settings-item-right"><input type="number" inputmode="decimal" class="input" value="' + s.holidayRate + '" onchange="updateSetting(\'holidayRate\',parseFloat(this.value))"><span class="settings-input-unit">¥/h</span></div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      flextimeBlock +

      // ── 常用时段 ──
      '<div class="settings-group" data-collapse="slots">' +
        '<div class="settings-group-title settings-group-title--toggler" onclick="toggleSettingsCollapse(this)"><span class="settings-collapse-arrow">▸</span> 常用时段</div>' +
        '<div class="settings-card settings-card--collapsible">' +
          (slotRows || '<div class="settings-row"><span class="settings-label" style="color:var(--text-muted)">暂无自定义时段</span></div>') +
          '<div class="settings-add-btn" onclick="addCommonSlot()">+ 添加时段</div>' +
        '</div>' +
      '</div>' +

      // ── 季度配置 ──
      '<div class="settings-group" data-collapse="quarters">' +
        '<div class="settings-group-title settings-group-title--toggler" onclick="toggleSettingsCollapse(this)"><span class="settings-collapse-arrow">▸</span> 季度配置</div>' +
        '<div class="settings-card settings-card--collapsible">' +
          (quarterRows || '<div class="settings-row"><span class="settings-label" style="color:var(--text-muted)">使用默认季度</span></div>') +
          '<div class="settings-add-btn" onclick="addQuarter()">+ 添加季度</div>' +
        '</div>' +
      '</div>' +

      // ── 数据管理 ──
      '<div class="settings-group" data-collapse="data">' +
        '<div class="settings-group-title settings-group-title--toggler" onclick="toggleSettingsCollapse(this)"><span class="settings-collapse-arrow">▸</span> 数据管理</div>' +
        '<div class="settings-card settings-card--collapsible">' +
          '<div class="settings-row settings-row--tap" onclick="exportJSON()">' +
            '<span class="settings-label">导出数据</span>' +
            '<span class="settings-chevron">›</span>' +
          '</div>' +
          '<div class="settings-row settings-row--tap" onclick="document.getElementById(\'fileInput\').click()">' +
            '<span class="settings-label">导入数据</span>' +
            '<span class="settings-chevron">›</span>' +
          '</div>' +
          '<div class="settings-row settings-row--tap" onclick="exportCSV()">' +
            '<span class="settings-label">导出 CSV</span>' +
            '<span class="settings-chevron">›</span>' +
          '</div>' +
        '</div>' +
      '</div>' +

      // ── 清除数据 ──
      '<div class="settings-group">' +
        '<div class="settings-card">' +
          '<div class="settings-danger-btn" onclick="clearAllData()">清除当前用户所有数据</div>' +
        '</div>' +
      '</div>' +

      // ── 关于 ──
      '<div class="settings-about">' +
        '<div class="settings-about-name">工时记录</div>' +
        '<div class="settings-about-version">v0.5.7</div>' +
      '</div>' +

    '</div>';

  requestAnimationFrame(WHT.initSettingsCollapse);
}

function openAvatarPicker() {
  var ov = document.getElementById('avatarPickerOverlay');
  if (ov) { ov.remove(); return; }
  var g = [
'😀','😎','🤓','👨‍💻','👩‍💻','🔥','⭐','💼','💰',
'🎯','🚀','💎','🎨','📊','🏆','🌞','🌈','🎵',
'🍕','🐱','🐶','🦊','🌻','⚡'
  ];
  var htm = '<div class="avatar-picker-overlay" id="avatarPickerOverlay" onclick="closeAvatarPicker()">' +
    '<div class="avatar-picker" onclick="event.stopPropagation()">' +
      '<div class="avatar-picker-title">选择头像</div>' +
      '<div class="avatar-picker-emojis">' +
        g.map(function(e) { return '<button class="avatar-picker-emoji" onclick="updateAvatar(\'' + e + '\')">' + e + '</button>'; }).join('') +
      '</div>' +
      '<label class="avatar-picker-upload"><input type="file" accept="image/*" onchange="uploadAvatar(this)" style="display:none">📷 从相册选择</label>' +
      '<button class="btn-sm" onclick="closeAvatarPicker()" style="margin-top:8px;width:100%">取消</button>' +
    '</div></div>';
  document.body.insertAdjacentHTML('beforeend', htm);
}
function closeAvatarPicker() { var el = document.getElementById('avatarPickerOverlay'); if (el) el.remove(); }
function updateAvatar(val) {
  var u = st.currentUser; if (!u) return;
  u.avatar = val; WHT.saveUsers();
  WHT.renderModeBar(); WHT.renderCurrentTab(true); closeAvatarPicker();
}
function uploadAvatar(input) {
  var file = input.files[0]; if (!file) return;
  var r = new FileReader();
  r.onload = function(e) {
    var img = new Image();
    img.onload = function() {
      var cnv = document.createElement('canvas');
      var s = Math.min(img.width, img.height, 128);
      cnv.width = s; cnv.height = s;
      var ctx = cnv.getContext('2d');
      var sx = (img.width - s) / 2, sy = (img.height - s) / 2;
      ctx.drawImage(img, sx, sy, s, s, 0, 0, s, s);
      updateAvatar(cnv.toDataURL('image/jpeg', 0.8));
    };
    img.src = e.target.result;
  };
  r.readAsDataURL(file);
}
function showEditProfile() {
  var hero = document.getElementById('userProfileHero');
  var edit = document.getElementById('userProfileEdit');
  if (hero) hero.style.display = 'none';
  if (edit) edit.style.display = 'block';
  var inp = document.getElementById('userNicknameInput');
  if (inp) setTimeout(function() { inp.focus(); inp.select(); }, 100);
}
function cancelEditProfile() {
  var hero = document.getElementById('userProfileHero');
  var edit = document.getElementById('userProfileEdit');
  if (hero) hero.style.display = '';
  if (edit) edit.style.display = 'none';
}
function saveProfile() {
  var inp = document.getElementById('userNicknameInput');
  var val = (inp?.value || '').trim();
  if (!val) { WHT.showToast('用户名不能为空', 'warning'); return; }
  var u = st.currentUser; if (!u) return;
  if (st.users.some(function(x) { return x.id !== u.id && x.nickname === val; })) {
    WHT.showToast('用户名已存在', 'warning'); return;
  }
  u.nickname = val;
  WHT.saveUsers();
  WHT.renderModeBar(); WHT.renderCurrentTab(true);
  WHT.showToast('用户名已更新');
}
function updateSetting(k,v){WHT.haptic('light');var s=WHT.getUserSettings();s[k]=v;WHT.saveUserSettings(s);WHT.renderCurrentTab(true)}
function updateFlextimeSetting(k,v){WHT.haptic('light');var s=WHT.getUserSettings();s.flextimeConfig[k]=v;WHT.saveUserSettings(s);WHT.renderCurrentTab(true)}
function renameMode(id){var modes=WHT.getUserModes();var m=modes.find(function(x){return x.id===id});if(!m)return;document.getElementById('confirmTitle').textContent='重命名模式';document.getElementById('confirmMsg').innerHTML='<input type="text" class="input" id="renameInput" value="'+WHT.escapeHtml(m.name)+'" maxlength="20" style="margin-top:8px">';var confirmBtn=document.querySelector('#confirmDialog .btn-primary');var cancelBtn=document.querySelector('#confirmDialog .btn');var origConfirm=confirmBtn.textContent;var origCancel=cancelBtn.textContent;confirmBtn.textContent='确认';cancelBtn.textContent='取消';document.getElementById('confirmDialog').classList.add('active');var handler=function(ok){document.getElementById('confirmDialog').classList.remove('active');confirmBtn.textContent=origConfirm;cancelBtn.textContent=origCancel;if(ok){var input=document.getElementById('renameInput');if(input&&input.value.trim()){m.name=input.value.trim();WHT.haptic('medium');WHT.saveUserModes(modes);WHT.renderModeBar();WHT.renderCurrentTab(true)}}};cancelBtn.onclick=function(){handler(false)};confirmBtn.onclick=function(){handler(true)}}
function deleteMode(id){WHT.showConfirm('确认删除','确定要删除这个模式吗？',function(){WHT.haptic('delete');var m=WHT.getUserModes().filter(function(x){return x.id!==id});WHT.saveUserModes(m);if(st.currentMode===id&&m.length>0)st.currentMode=m[0].id;WHT.renderModeBar();WHT.renderCurrentTab(true)})}
function editCommonSlot(i){WHT.haptic('light');var s=WHT.getUserSettings();var slot=s.commonSlots[i];if(!slot)return;document.getElementById('userModal').querySelector('.modal-title').textContent='编辑时段';document.getElementById('userModal').querySelector('.modal-sheet').innerHTML='<div class="modal-handle"></div><div class="modal-title">编辑时段</div><div class="form-group"><label class="form-label">开始时间</label><input type="text" class="input" id="slotEditStart" value="'+WHT.escapeHtml(slot.start)+'" data-picker="time" readonly onclick="WHT.openTimePicker(\'slotEditStart\',this.value)"></div><div class="form-group"><label class="form-label">结束时间</label><input type="text" class="input" id="slotEditEnd" value="'+WHT.escapeHtml(slot.end)+'" data-picker="time" readonly onclick="WHT.openTimePicker(\'slotEditEnd\',this.value)"></div><button class="btn btn-primary w-full mt-12" onclick="saveCommonSlotEdit('+i+')">保存</button>';document.getElementById('userModal').classList.add('active')}
function saveCommonSlotEdit(i){WHT.haptic('medium');var s=WHT.getUserSettings();if(!s.commonSlots[i])return;var start=document.getElementById('slotEditStart').value;var end=document.getElementById('slotEditEnd').value;if(!start||!end){WHT.showToast('请填写开始和结束时间','warning');return}s.commonSlots[i]={start:start,end:end};WHT.saveUserSettings(s);document.getElementById('userModal').classList.remove('active');WHT.renderCurrentTab(true)}
function editQuarter(i){WHT.haptic('light');var s=WHT.getUserSettings();var q=s.quarterConfig[i];if(!q)return;var mNames='一二三四五六七八九十十一十二'.split('');var mChecks=[1,2,3,4,5,6,7,8,9,10,11,12].map(function(m){return'<label style="display:inline-flex;align-items:center;gap:4px;margin:3px 6px;font-size:13px"><input type="checkbox" value="'+m+'" '+(q.months.indexOf(m)>=0?'checked':'')+'>'+mNames[m-1]+'月</label>'}).join('');document.getElementById('userModal').querySelector('.modal-title').textContent='编辑季度';document.getElementById('userModal').querySelector('.modal-sheet').innerHTML='<div class="modal-handle"></div><div class="modal-title">编辑季度</div><div class="form-group"><label class="form-label">名称</label><input type="text" class="input" id="quarterEditName" value="'+WHT.escapeHtml(q.name)+'" maxlength="20"></div><div class="form-group"><label class="form-label">月份</label><div id="quarterEditMonths" style="padding:8px 0">'+mChecks+'</div></div><button class="btn btn-primary w-full mt-12" onclick="saveQuarterEdit('+i+')">保存</button>';document.getElementById('userModal').classList.add('active')}
function saveQuarterEdit(i){WHT.haptic('medium');var s=WHT.getUserSettings();if(!s.quarterConfig[i])return;var name=document.getElementById('quarterEditName').value.trim();if(!name){WHT.showToast('请输入名称','warning');return}var months=[];document.querySelectorAll('#quarterEditMonths input:checked').forEach(function(cb){months.push(parseInt(cb.value))});if(months.length===0){WHT.showToast('请至少选一个月','warning');return}s.quarterConfig[i]={name:name,months:months};WHT.saveUserSettings(s);document.getElementById('userModal').classList.remove('active');WHT.renderCurrentTab(true)}
function addCommonSlot(){WHT.haptic('medium');var s=WHT.getUserSettings();s.commonSlots.push({start:'09:00',end:'18:00'});WHT.saveUserSettings(s);WHT.renderCurrentTab(true)}
function removeCommonSlot(i){WHT.showConfirm('\u786e\u8ba4\u5220\u9664','\u786e\u5b9a\u5220\u9664\u8fd9\u4e2a\u5e38\u7528\u65f6\u6bb5\u5417\uff1f',function(){WHT.haptic('delete');var s=WHT.getUserSettings();s.commonSlots.splice(i,1);WHT.saveUserSettings(s);WHT.renderCurrentTab(true)})}
function addQuarter(){WHT.haptic('medium');var s=WHT.getUserSettings();s.quarterConfig.push({name:'Q'+(s.quarterConfig.length+1),months:[]});WHT.saveUserSettings(s);WHT.renderCurrentTab(true)}
function removeQuarter(i){WHT.showConfirm('\u786e\u8ba4\u5220\u9664','\u786e\u5b9a\u5220\u9664\u8fd9\u4e2a\u5b63\u5ea6\u914d\u7f6e\u5417\uff1f',function(){WHT.haptic('delete');var s=WHT.getUserSettings();s.quarterConfig.splice(i,1);WHT.saveUserSettings(s);WHT.renderCurrentTab(true)})}

  // ── 导出到 WHT 命名空间 ──
  WHT.renderSettingsPage = renderSettingsPage;
  WHT.updateSetting = updateSetting;
  WHT.updateFlextimeSetting = updateFlextimeSetting;
  WHT.renameMode = renameMode;
  WHT.deleteMode = deleteMode;
  WHT.editCommonSlot = editCommonSlot;
  WHT.saveCommonSlotEdit = saveCommonSlotEdit;
  WHT.editQuarter = editQuarter;
  WHT.saveQuarterEdit = saveQuarterEdit;
  WHT.addCommonSlot = addCommonSlot;
  WHT.removeCommonSlot = removeCommonSlot;
  WHT.addQuarter = addQuarter;
  WHT.removeQuarter = removeQuarter;
  WHT.openAvatarPicker = openAvatarPicker;
  WHT.closeAvatarPicker = closeAvatarPicker;
  WHT.updateAvatar = updateAvatar;
  WHT.uploadAvatar = uploadAvatar;
  WHT.showEditProfile = showEditProfile;
  WHT.cancelEditProfile = cancelEditProfile;
  WHT.saveProfile = saveProfile;

})();
