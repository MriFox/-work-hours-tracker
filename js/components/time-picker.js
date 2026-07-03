/* 组件：iOS 风格时间滚轮选择器 */
(function() {
  "use strict";
  var WHT = window.WHT;

  // 时间选择器状态
  WHT._tp = { targetId: '', hour: 9, minute: 0, minuteStep: 1, scrollTimer: null };

  function openTimePicker(inputId, currentVal) {
    var tp = WHT._tp;
    tp.targetId = inputId;
    if (currentVal) {
      var parts = currentVal.split(':');
      tp.hour = parseInt(parts[0]);
      tp.minute = parseInt(parts[1]);
    } else {
      var now = new Date();
      tp.hour = now.getHours();
      tp.minute = now.getMinutes();
    }
    renderTimePicker();
    document.getElementById('timePickerOverlay').classList.add('active');
  }

  function closeTimePicker() {
    document.getElementById('timePickerOverlay').classList.remove('active');
  }

  function renderTimePicker() {
    var tp = WHT._tp;
    var hourHtml = '<div class="time-wheel-item" style="height:88px"></div>';
    for (var h = 0; h < 24; h++) {
      var cls = 'time-wheel-item';
      if (h === tp.hour) cls += ' active';
      else if (Math.abs(h - tp.hour) <= 1) cls += ' near';
      else cls += ' far';
      hourHtml += '<div class="' + cls + '" data-hour="' + h + '" onclick="selectHour(' + h + ')">' + String(h).padStart(2, '0') + '</div>';
    }
    hourHtml += '<div class="time-wheel-item" style="height:88px"></div>';
    document.getElementById('hourWheel').innerHTML = hourHtml;

    var minHtml = '<div class="time-wheel-item" style="height:88px"></div>';
    for (var m = 0; m < 60; m += tp.minuteStep) {
      var mcls = 'time-wheel-item';
      var diff = Math.abs(m - tp.minute);
      if (diff === 0 || diff === 60 - tp.minuteStep) mcls += ' active';
      else if (diff <= tp.minuteStep) mcls += ' near';
      else mcls += ' far';
      minHtml += '<div class="' + mcls + '" data-min="' + m + '" onclick="selectMinute(' + m + ')">' + String(m).padStart(2, '0') + '</div>';
    }
    minHtml += '<div class="time-wheel-item" style="height:88px"></div>';
    document.getElementById('minuteWheel').innerHTML = minHtml;

    scrollToSelected();

    var hw = document.getElementById('hourWheel');
    var mw = document.getElementById('minuteWheel');
    hw.onscroll = function() { onWheelScroll(hw, 'hour'); };
    mw.onscroll = function() { onWheelScroll(mw, 'minute'); };
  }

  function scrollToSelected() {
    setTimeout(function() {
      var hw = document.getElementById('hourWheel');
      var mw = document.getElementById('minuteWheel');
      var hourActive = hw.querySelector('.time-wheel-item.active');
      var minActive = mw.querySelector('.time-wheel-item.active');
      if (hourActive) hourActive.scrollIntoView({ block: 'center', behavior: 'instant' });
      if (minActive) minActive.scrollIntoView({ block: 'center', behavior: 'instant' });
    }, 50);
  }

  function onWheelScroll(wheel, type) {
    var tp = WHT._tp;
    clearTimeout(tp.scrollTimer);
    tp.scrollTimer = setTimeout(function() {
      var attr = type === 'hour' ? 'data-hour' : 'data-min';
      var items = wheel.querySelectorAll('.time-wheel-item[' + attr + ']');
      var wheelRect = wheel.getBoundingClientRect();
      var centerY = wheelRect.top + wheelRect.height / 2;
      var closest = null;
      var closestDist = Infinity;
      items.forEach(function(item) {
        var itemRect = item.getBoundingClientRect();
        var dist = Math.abs(itemRect.top + itemRect.height / 2 - centerY);
        if (dist < closestDist) { closestDist = dist; closest = item; }
      });
      if (closest) {
        var val = parseInt(closest.getAttribute(attr));
        if (type === 'hour') tp.hour = val;
        else tp.minute = val;
        updateWheelHighlight(wheel, type);
      }
    }, 100);
  }

  function updateWheelHighlight(wheel, type) {
    var tp = WHT._tp;
    var items = wheel.querySelectorAll('.time-wheel-item');
    var val = type === 'hour' ? tp.hour : tp.minute;
    var step = type === 'hour' ? 1 : tp.minuteStep;
    items.forEach(function(item) {
      var itemVal = parseInt(item.getAttribute('data-' + (type === 'hour' ? 'hour' : 'min')));
      if (isNaN(itemVal)) return;
      item.classList.remove('active', 'near', 'far');
      var diff = Math.abs(itemVal - val);
      if (type === 'minute' && diff > 30) diff = 60 - diff;
      if (diff === 0) item.classList.add('active');
      else if (diff <= step) item.classList.add('near');
      else item.classList.add('far');
    });
  }

  function selectHour(h) {
    WHT._tp.hour = h;
    var hw = document.getElementById('hourWheel');
    updateWheelHighlight(hw, 'hour');
    var active = hw.querySelector('.time-wheel-item.active');
    if (active) active.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function selectMinute(m) {
    WHT._tp.minute = m;
    var mw = document.getElementById('minuteWheel');
    updateWheelHighlight(mw, 'minute');
    var active = mw.querySelector('.time-wheel-item.active');
    if (active) active.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function selectNow() {
    var now = new Date();
    WHT._tp.hour = now.getHours();
    WHT._tp.minute = now.getMinutes();
    renderTimePicker();
  }

  function confirmTimePicker() {
    var tp = WHT._tp;
    var timeStr = String(tp.hour).padStart(2, '0') + ':' + String(tp.minute).padStart(2, '0');
    if (window._wizardTimeKey) {
      WHT.state.wizardData.steps[window._wizardTimeKey] = timeStr;
      window._wizardTimeKey = null;
      WHT.renderWizardStep();
    } else if (window._flexTimeKey) {
      WHT.updateFlextimeSetting(window._flexTimeKey, timeStr);
      window._flexTimeKey = null;
      WHT.renderCurrentTab(true);
    } else if (window._punchAdjustType) {
      var adjustType = window._punchAdjustType;
      window._punchAdjustType = null;
      WHT.applyPunchTimeAdjust(adjustType, timeStr);
    } else if (tp.targetId) {
      var el = document.getElementById(tp.targetId);
      if (el) { el.value = timeStr; if (el.onchange) el.onchange(); }
    }
    closeTimePicker();
  }

  function openTimePicker_wizard(key, val) {
    var tp = WHT._tp;
    var parts = val.split(':');
    tp.hour = parseInt(parts[0]);
    tp.minute = parseInt(parts[1]);
    tp.targetId = '';
    renderTimePicker();
    document.getElementById('timePickerOverlay').classList.add('active');
    window._wizardTimeKey = key;
  }

  function openTimePicker_flex(key, val) {
    var tp = WHT._tp;
    var parts = val.split(':');
    tp.hour = parseInt(parts[0]);
    tp.minute = parseInt(parts[1]);
    tp.targetId = '';
    renderTimePicker();
    document.getElementById('timePickerOverlay').classList.add('active');
    window._flexTimeKey = key;
  }

  function openDatePicker_flex(val) {
    var dp = WHT._dp;
    if (val) {
      var parts = val.split('-');
      dp.year = parseInt(parts[0]); dp.month = parseInt(parts[1]) - 1; dp.selected = val;
    } else {
      var now = new Date();
      dp.year = now.getFullYear(); dp.month = now.getMonth(); dp.selected = WHT.today();
    }
    dp.targetId = '';
    WHT.renderDatePicker();
    document.getElementById('datePickerOverlay').classList.add('active');
    window._flexDateKey = 'startDate';
  }

  // ── 导出 ──
  WHT.openTimePicker = openTimePicker;
  WHT.closeTimePicker = closeTimePicker;
  WHT.renderTimePicker = renderTimePicker;
  WHT.confirmTimePicker = confirmTimePicker;
  WHT.selectHour = selectHour;
  WHT.selectMinute = selectMinute;
  WHT.selectNow = selectNow;
  WHT.openTimePicker_wizard = openTimePicker_wizard;
  WHT.openTimePicker_flex = openTimePicker_flex;
  WHT.openDatePicker_flex = openDatePicker_flex;

})();
