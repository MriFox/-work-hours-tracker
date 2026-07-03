/* 组件：自定义日期选择器 */
(function() {
  "use strict";
  var WHT = window.WHT;

  // 日期选择器状态（time-picker.js 的 openDatePicker_flex 也需要访问）
  WHT._dp = { targetId: '', year: 0, month: 0, selected: '' };

  function openDatePicker(inputId, currentVal) {
    var dp = WHT._dp;
    dp.targetId = inputId;
    if (currentVal) {
      var parts = currentVal.split('-');
      dp.year = parseInt(parts[0]); dp.month = parseInt(parts[1]) - 1; dp.selected = currentVal;
    } else {
      var now = new Date();
      dp.year = now.getFullYear(); dp.month = now.getMonth(); dp.selected = WHT.today();
    }
    renderDatePicker();
    document.getElementById('datePickerOverlay').classList.add('active');
  }

  function closeDatePicker() { document.getElementById('datePickerOverlay').classList.remove('active'); }

  function renderDatePicker() {
    var dp = WHT._dp;
    document.getElementById('datePickerTitle').textContent = dp.year + '年' + (dp.month + 1) + '月';
    var firstDay = new Date(dp.year, dp.month, 1).getDay();
    var daysInMonth = new Date(dp.year, dp.month + 1, 0).getDate();
    var startDay = firstDay === 0 ? 6 : firstDay - 1;
    var todayStr = WHT.today();
    var html = '';
    for (var i = 0; i < startDay; i++) html += '<div class="picker-day empty"></div>';
    for (var d = 1; d <= daysInMonth; d++) {
      var ds = dp.year + '-' + String(dp.month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      var cls = ['picker-day'];
      if (ds === todayStr) cls.push('today');
      if (ds === dp.selected) cls.push('selected');
      html += '<button class="' + cls.join(' ') + '" onclick="selectDateDay(\'' + ds + '\')">' + d + '</button>';
    }
    document.getElementById('datePickerDays').innerHTML = html;
  }

  function selectDateDay(ds) { WHT._dp.selected = ds; renderDatePicker(); }

  function changePickerMonth(dir) {
    var dp = WHT._dp;
    dp.month += dir;
    if (dp.month > 11) { dp.month = 0; dp.year++; }
    if (dp.month < 0) { dp.month = 11; dp.year--; }
    renderDatePicker();
  }

  function confirmDatePicker() {
    var dp = WHT._dp;
    if (window._flexDateKey) {
      WHT.updateFlextimeSetting(window._flexDateKey, dp.selected);
      window._flexDateKey = null;
      closeDatePicker();
      WHT.renderCurrentTab(true);
      return;
    }
    if (dp.targetId) {
      var el = document.getElementById(dp.targetId);
      if (el) { el.value = dp.selected; if (el.onchange) el.onchange(); }
    }
    closeDatePicker();
  }

  WHT.openDatePicker = openDatePicker;
  WHT.closeDatePicker = closeDatePicker;
  WHT.renderDatePicker = renderDatePicker;
  WHT.changePickerMonth = changePickerMonth;
  WHT.confirmDatePicker = confirmDatePicker;
  WHT.selectDateDay = selectDateDay;

})();
