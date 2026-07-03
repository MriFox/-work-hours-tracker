/* 模式向导：自定义模式的创建流程 */
(function() {
  "use strict";
  var WHT = window.WHT;

  var WIZARD_STEPS = [
    {key:'name', title:'模式名称', desc:'为你的自定义模式起个名字', type:'input', placeholder:'例如：弹性工时'},
    {key:'hours', title:'每日标准工时', desc:'设置每天的标准工作小时数', type:'number', default:8},
    {key:'workday', title:'工作日规则', desc:'选择工作日的安排方式', type:'select', options:[{value:'weekdays',label:'周一到周五'},{value:'flextime',label:'大小周'}]},
    {key:'startTime', title:'标准上班时间', desc:'设置每天的标准上班时间', type:'time', default:'09:00'},
    {key:'endTime', title:'标准下班时间', desc:'设置每天的标准下班时间', type:'time', default:'18:00'},
    {key:'compTime', title:'启用调休', desc:'是否启用调休系统', type:'toggle', default:false},
    {key:'holiday', title:'法定节假日', desc:'是否启用法定节假日计算', type:'toggle', default:true}
  ];

  function showWizardPage() {
    renderWizardStep();
    document.getElementById('loginPage').classList.remove('active');
    document.getElementById('mainApp').classList.remove('active');
    document.getElementById('wizardPage').classList.add('active');
  }

  function renderWizardStep() {
    var st = WHT.state;
    var s = WIZARD_STEPS[st.wizardStep];
    var dots = WIZARD_STEPS.map(function(_, i) {
      return '<div class="wizard-progress-dot ' + (i < st.wizardStep ? 'done' : '') + ' ' + (i === st.wizardStep ? 'active' : '') + '"></div>';
    }).join('');
    var c = '';
    if (s.type === 'input') {
      c = '<input type="text" class="input" value="' + (st.wizardData.steps[s.key] || '') + '" placeholder="' + (s.placeholder || '') + '" oninput="state.wizardData.steps[\'' + s.key + '\']=this.value">';
    } else if (s.type === 'number') {
      var defVal = st.wizardData.steps[s.key] !== undefined ? st.wizardData.steps[s.key] : s.default;
      c = '<input type="number" class="input" style="text-align:center" value="' + defVal + '" min="1" max="24" step="0.5" oninput="state.wizardData.steps[\'' + s.key + '\']=parseFloat(this.value)">';
    } else if (s.type === 'time') {
      c = '<input type="text" class="input" style="text-align:center;cursor:pointer" value="' + (st.wizardData.steps[s.key] || s.default) + '" readonly onclick="openTimePicker_wizard(\'' + s.key + '\',\'' + (st.wizardData.steps[s.key] || s.default) + '\')">';
    } else if (s.type === 'select') {
      c = '<div class="wizard-options">' + s.options.map(function(o) {
        return '<div class="wizard-option ' + (st.wizardData.steps[s.key] === o.value ? 'selected' : '') + '" onclick="selectWizardOption(\'' + s.key + '\',\'' + o.value + '\')">' + o.label + '</div>';
      }).join('') + '</div>';
    } else if (s.type === 'toggle') {
      var v = st.wizardData.steps[s.key] !== undefined ? st.wizardData.steps[s.key] : s.default;
      c = '<div style="display:flex;align-items:center;justify-content:center;gap:14px;padding:20px 0"><span style="color:var(--text-muted)">关闭</span><div class="toggle ' + (v ? 'active' : '') + '" onclick="state.wizardData.steps[\'' + s.key + '\']=!state.wizardData.steps[\'' + s.key + '\'];renderWizardStep()"></div><span>开启</span></div>';
    }

    document.getElementById('wizardContainer').innerHTML =
      '<div class="wizard-progress">' + dots + '</div>' +
      '<div class="wizard-step">' +
        '<div class="wizard-step-title">' + s.title + '</div>' +
        '<div class="wizard-step-desc">' + s.desc + '</div>' + c +
        '<div class="wizard-nav">' +
          (st.wizardStep > 0 ? '<button class="btn" onclick="wizardPrev()">上一步</button>' : '') +
          '<button class="btn btn-primary" onclick="wizardNext()" ' + (s.type === 'input' && !st.wizardData.steps[s.key] ? 'disabled' : '') + '>' + (st.wizardStep === WIZARD_STEPS.length - 1 ? '完成' : '下一步') + '</button>' +
        '</div>' +
      '</div>';
  }

  function selectWizardOption(k, v) { WHT.haptic('light'); WHT.state.wizardData.steps[k] = v; renderWizardStep(); }

  function wizardPrev() { WHT.haptic('light'); if (WHT.state.wizardStep > 0) { WHT.state.wizardStep--; renderWizardStep(); } }

  function wizardNext() {
    WHT.haptic('light');
    var st = WHT.state;
    var s = WIZARD_STEPS[st.wizardStep];
    if (s.type === 'input' && !st.wizardData.steps[s.key]) return;
    if (st.wizardStep < WIZARD_STEPS.length - 1) { st.wizardStep++; renderWizardStep(); }
    else finishWizard();
  }

  function cancelWizard() {
    var st = WHT.state;
    document.getElementById('wizardPage').classList.remove('active');
    if (st.currentUser) { document.getElementById('mainApp').classList.add('active'); WHT.renderModeBar(); WHT.switchTab(st.currentTab); }
    else document.getElementById('loginPage').classList.add('active');
  }

  function finishWizard() {
    var st = WHT.state;
    var steps = st.wizardData.steps;
    var mid = WHT.genId();
    var m = WHT.getUserModes();
    if (st.wizardData.isAddMode) {
      m.push({ id: mid, name: steps.name || '自定义模式', type: 'custom', icon: '⚙️' });
      WHT.saveUserModes(m);
      st.currentMode = mid;
    } else {
      var u = st.users.find(function(x) { return x.nickname === st.wizardData.nickname; });
      if (!u) { u = { id: WHT.genId(), nickname: st.wizardData.nickname, createdAt: WHT.today(), avatar: '👨‍💻' }; st.users.push(u); WHT.saveUsers(); }
      st.currentUser = u;
      m.push({ id: mid, name: steps.name || '自定义模式', type: 'custom', icon: '⚙️' });
      WHT.saveUserModes(m);
      st.currentMode = mid;
      var s = WHT.getUserSettings();
      s.standardHours = steps.hours || 8;
      WHT.saveUserSettings(s);
    }
    document.getElementById('wizardPage').classList.remove('active');
    WHT.enterApp();
  }

  // ── 导出 ──
  WHT.showWizardPage = showWizardPage;
  WHT.renderWizardStep = renderWizardStep;
  WHT.cancelWizard = cancelWizard;
  WHT.wizardPrev = wizardPrev;
  WHT.wizardNext = wizardNext;
  WHT.selectWizardOption = selectWizardOption;

})();
