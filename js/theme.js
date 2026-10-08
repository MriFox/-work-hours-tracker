/* 主题：深色模式 + 视觉风格切换 */
(function() {
  "use strict";
  var WHT = window.WHT;

  function toggleDarkMode() {
    WHT.haptic('light');
    var s = WHT.getUserSettings();
    s.darkMode = !s.darkMode;
    WHT.saveUserSettings(s);
    applyTheme(s.darkMode);
    WHT.renderCurrentTab(true);
  }

  function applyTheme(dark) {
    if (dark === undefined) { var s = WHT.getUserSettings(); dark = s.darkMode; }
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : '');
    updateMetaTheme();
  }

  // 视觉风格只剩「极简」一种（v0.14.2 移除暖色）。
  // 保留这个函数是因为 app.js 初始化与登录流程都在调用它；
  // 同时把老用户残留的 'warm' 静默迁回 'flat'（warm 的 CSS 规则已全部删除）。
  function applyStyle() {
    var s = WHT.getUserSettings();
    if (s.style && s.style !== 'flat') {
      s.style = 'flat';
      WHT.saveUserSettings(s);
    }
    document.documentElement.setAttribute('data-style', 'flat');
    updateMetaTheme();
  }

  function updateMetaTheme() {
    var dm = document.documentElement.getAttribute('data-theme') === 'dark';
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dm ? '#000000' : '#F5F5F7');
  }

  WHT.toggleDarkMode = toggleDarkMode;
  WHT.applyTheme = applyTheme;
  WHT.applyStyle = applyStyle;

})();
