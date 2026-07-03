/* 组件：确认对话框 */
(function() {
  "use strict";
  var WHT = window.WHT;
  var confirmCallback = null;

  function showConfirm(t, m, cb) {
    document.getElementById('confirmTitle').textContent = t;
    document.getElementById('confirmMsg').textContent = m;
    document.getElementById('confirmDialog').classList.add('active');
    confirmCallback = cb;
  }

  function closeConfirm(ok) {
    document.getElementById('confirmDialog').classList.remove('active');
    if (ok && confirmCallback) confirmCallback();
    confirmCallback = null;
  }

  WHT.showConfirm = showConfirm;
  WHT.closeConfirm = closeConfirm;

})();
