/* 登录页：用户选择 / 模式选择 / 进入应用 */
(function() {
  "use strict";
  var WHT = window.WHT;

  function selectLoginMode(el) {
    WHT.haptic('light');
    document.querySelectorAll('.mode-card').forEach(function(c) { c.classList.remove('selected'); });
    el.classList.add('selected');
    WHT.state.wizardData.loginType = el.dataset.type;
    checkLoginBtn();
  }

  function checkLoginBtn() {
    document.getElementById('loginBtn').disabled = !document.getElementById('nicknameInput').value.trim();
  }

  document.getElementById('nicknameInput').addEventListener('input', checkLoginBtn);
  document.getElementById('nicknameInput').addEventListener('keydown', function(e) { if (e.key === 'Enter') handleLogin(); });

  function handleLogin() {
    var n = document.getElementById('nicknameInput').value.trim();
    if (!n) return;
    var t = WHT.state.wizardData.loginType || 'civil';
    if (t === 'custom') {
      WHT.state.wizardData.nickname = n;
      WHT.state.wizardStep = 0;
      WHT.state.wizardData.steps = {};
      WHT.showWizardPage();
      return;
    }
    if (t === 'flextime') {
      WHT.state.wizardData.nickname = n;
      WHT.state.wizardData.loginType = t;
      WHT.state.wizardStep = 0;
      WHT.state.wizardData.steps = {};
      showFlextimeWizard();
      return;
    }
    var u = WHT.state.users.find(function(x) { return x.nickname === n; });
    if (!u) { u = { id: WHT.genId(), nickname: n, createdAt: WHT.today(), avatar: '👨‍💻' }; WHT.state.users.push(u); WHT.saveUsers(); }
    WHT.state.currentUser = u;
    if (WHT.getUserModes().length === 0) WHT.saveUserModes(WHT.getDefaultModes(t));
    WHT.saveUserSettings(WHT.getUserSettings());
    enterApp();
  }

  function enterApp() {
    if (!WHT.state.currentUser) {
      document.getElementById('loginPage').classList.add('active');
      document.getElementById('mainApp').classList.remove('active');
      document.getElementById('userModal').classList.remove('active');
      return;
    }
    try {
      WHT.haptic('heavy');
      WHT.applyTheme();
      WHT.applyStyle();
      WHT.saveSession(WHT.state.currentUser.id);
      document.getElementById('loginPage').classList.remove('active');
      var mainApp = document.getElementById('mainApp');
      mainApp.classList.add('active');
      // 强制 layout 计算，确保 pageContent 高度已就绪
      mainApp.offsetHeight;
      var pc = document.getElementById('pageContent');
      if (pc) pc.offsetHeight;
      WHT.renderModeBar();
      WHT.switchTab('record');
    } catch(e) {
      console.error('enterApp error', e);
      // 吞掉异常，防止传播到 app.js 的 catch block（会清空 currentUser）
    }
  }

  function showUserModal() {
    var st = WHT.state;
    var canDelete = st.users.length > 1;
    document.getElementById('userList').innerHTML = st.users.map(function(u) {
      var av = u.avatar || u.nickname.charAt(0);
      var isI = av && av.startsWith && av.startsWith('data:');
      var avHtml = isI ? '<img src="' + av + '" class="user-list-avatar-img" alt="">' : WHT.escapeHtml(av);
      var isCurrent = st.currentUser && u.id === st.currentUser.id;
      var delBtn = (!isCurrent && canDelete) ? '<button class="user-list-delete" onclick="event.stopPropagation();deleteUser(\'' + WHT.escapeHtml(u.id) + '\')" title="删除用户">&times;</button>' : '';
      return '<div class="user-list-item ' + (isCurrent ? 'active' : '') + '" onclick="switchUser(\'' + WHT.escapeHtml(u.id) + '\')"><div class="user-list-avatar">' + avHtml + '</div><div class="user-list-name">' + WHT.escapeHtml(u.nickname) + '</div>' + delBtn + (isCurrent ? '<div class="user-list-check">\u2713</div>' : '') + '</div>';
    }).join('');
    document.getElementById('userModal').classList.add('active');
  }

  function hideUserModal() { document.getElementById('userModal').classList.remove('active'); }

  function switchUser(uid) {
    WHT.haptic('medium');
    var u = WHT.state.users.find(function(x) { return x.id === uid; });
    if (!u) return;
    WHT.state.currentUser = u;
    WHT.saveUserSettings(WHT.getUserSettings());
    WHT.saveSession(uid);
    if (WHT.getUserModes().length === 0) WHT.saveUserModes(WHT.getDefaultModes('civil'));
    hideUserModal();
    enterApp();
  }

  function addNewUser() {
    hideUserModal();
    document.getElementById('loginPage').classList.add('active');
    document.getElementById('mainApp').classList.remove('active');
    document.getElementById('nicknameInput').value = '';
    document.getElementById('loginBtn').disabled = true;
    document.getElementById('nicknameInput').focus();
  }

  function deleteUser(uid) {
    var st = WHT.state;
    var u = st.users.find(function(x) { return x.id === uid; });
    if (!u) return;
    WHT.showConfirm('删除用户', '确定要删除用户「' + u.nickname + '」吗？\n该用户的记录不会被删除，仅移除用户账号。', function() {
      WHT.haptic('delete');
      st.users = st.users.filter(function(x) { return x.id !== uid; });
      WHT.saveUsers();
      // 如果删除的是当前用户，切换到第一个
      if (st.currentUser && st.currentUser.id === uid) {
        st.currentUser = st.users[0];
      }
      showUserModal();
      WHT.renderModeBar();
      WHT.renderCurrentTab(true);
    });
  }

  function showFlextimeWizard() {
    var fc = WHT.getDefaultSettings().flextimeConfig;
    document.getElementById('wizardContainer').innerHTML = '<div class="wizard-step"><div class="wizard-step-title">大小周设置</div><div class="wizard-step-desc">确认起始日期和大小周类型</div><div class="form-group"><label class="form-label">起始日期</label><input type="text" class="input" id="flexStartDate" value="' + WHT.today() + '" readonly onclick="openDatePicker(\'flexStartDate\',this.value)" style="cursor:pointer"></div><div class="form-group"><label class="form-label">起始为</label><select class="input" id="flexStartType"><option value="big">大周（6天）</option><option value="small">小周（5天）</option></select></div><div class="wizard-nav"><button class="btn" onclick="cancelWizard()">取消</button><button class="btn btn-primary" onclick="finishFlextimeWizard()">确认</button></div></div>';
    document.getElementById('loginPage').classList.remove('active');
    document.getElementById('mainApp').classList.remove('active');
    document.getElementById('wizardPage').classList.add('active');
  }

  function finishFlextimeWizard() {
    WHT.haptic('heavy');
    var n = WHT.state.wizardData.nickname;
    var startDate = document.getElementById('flexStartDate').value;
    var startIsBig = document.getElementById('flexStartType').value === 'big';
    var u = WHT.state.users.find(function(x) { return x.nickname === n; });
    if (!u) { u = { id: WHT.genId(), nickname: n, createdAt: WHT.today(), avatar: '👨‍💻' }; WHT.state.users.push(u); WHT.saveUsers(); }
    WHT.state.currentUser = u;
    WHT.saveUserModes(WHT.getDefaultModes('flextime'));
    var st = WHT.getUserSettings();
    st.flextimeConfig.startDate = startDate;
    st.flextimeConfig.startIsBigWeek = startIsBig;
    WHT.saveUserSettings(st);
    document.getElementById('wizardPage').classList.remove('active');
    enterApp();
  }

  document.getElementById('userModal').addEventListener('click', function(e) { if (e.target === e.currentTarget) hideUserModal(); });

  // ── 导出 ──
  WHT.selectLoginMode = selectLoginMode;
  WHT.handleLogin = handleLogin;
  WHT.enterApp = enterApp;
  WHT.showUserModal = showUserModal;
  WHT.hideUserModal = hideUserModal;
  WHT.switchUser = switchUser;
  WHT.deleteUser = deleteUser;
  WHT.addNewUser = addNewUser;
  WHT.finishFlextimeWizard = finishFlextimeWizard;

})();
