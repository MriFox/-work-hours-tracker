/* Toast 通知组件 */
(function() {
  "use strict";
  var WHT = window.WHT;

  function showToast(msg, type, duration) {
    type = type || 'info';
    duration = duration || 3000;
    var container = document.getElementById('toastContainer');
    if (!container) return;

    var existing = container.querySelectorAll('.toast:not(.removing)');
    if (existing.length >= 2) {
      var oldest = existing[0];
      oldest.classList.add('removing');
      setTimeout(function() { oldest.remove(); }, 200);
    }

    var icons = { success: '\u2713', error: '\u2717', info: '\u2139', warning: '\u26a0' };
    var el = document.createElement('div');
    el.className = 'toast toast-' + type;
    el.innerHTML = '<span class="toast-icon">' + (icons[type] || icons.info) + '</span><span class="toast-msg">' + msg + '</span>';
    el.addEventListener('click', function() {
      el.classList.add('removing');
      setTimeout(function() { el.remove(); }, 200);
    });
    container.appendChild(el);

    setTimeout(function() {
      if (el.isConnected) {
        el.classList.add('removing');
        setTimeout(function() { el.remove(); }, 200);
      }
    }, duration);
  }

  function showToastWithAction(msg, type, actionLabel, actionCallback, duration) {
    type = type || 'info';
    duration = duration || 4000;
    var container = document.getElementById('toastContainer');
    if (!container) return;

    var existing = container.querySelectorAll('.toast:not(.removing)');
    if (existing.length >= 2) {
      var oldest = existing[0];
      oldest.classList.add('removing');
      setTimeout(function() { oldest.remove(); }, 200);
    }

    var icons = { success: '\u2713', error: '\u2717', info: '\u2139', warning: '\u26a0' };
    var el = document.createElement('div');
    el.className = 'toast toast-' + type;
    el.innerHTML = '<span class="toast-icon">' + (icons[type] || icons.info) + '</span><span class="toast-msg">' + msg + '</span><button class="toast-action">' + actionLabel + '</button>';

    var actionBtn = el.querySelector('.toast-action');
    actionBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      if (actionCallback) actionCallback();
      el.classList.add('removing');
      setTimeout(function() { el.remove(); }, 200);
    });

    el.addEventListener('click', function() {
      el.classList.add('removing');
      setTimeout(function() { el.remove(); }, 200);
    });

    container.appendChild(el);

    setTimeout(function() {
      if (el.isConnected) {
        el.classList.add('removing');
        setTimeout(function() { el.remove(); }, 200);
      }
    }, duration);

    return el;
  }

  WHT.showToast = showToast;
  WHT.showToastWithAction = showToastWithAction;

})();
