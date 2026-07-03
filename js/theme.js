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

  function applyStyle(style) {
    if (!style) { var s = WHT.getUserSettings(); style = s.style || 'flat'; }
    document.documentElement.setAttribute('data-style', style);
    updateMetaTheme();
  }

  function toggleStyle() {
    WHT.haptic('light');
    var s = WHT.getUserSettings();
    var cur = s.style || 'flat';
    s.style = cur === 'flat' ? 'warm' : 'flat';
    WHT.saveUserSettings(s);
    applyStyle(s.style);
    WHT.renderCurrentTab(true);
  }

  function getStyleLabel(style) {
    return style === 'flat' ? '\u6781\u7b80' : style === 'warm' ? '\u6696\u8272' : '\u6781\u7b80';
  }

  function updateMetaTheme() {
    var dm = document.documentElement.getAttribute('data-theme') === 'dark';
    var style = document.documentElement.getAttribute('data-style') || 'flat';
    if (dm) {
      document.querySelector('meta[name="theme-color"]').setAttribute('content', style === 'flat' ? '#000000' : '#12100E');
    } else {
      document.querySelector('meta[name="theme-color"]').setAttribute('content', style === 'flat' ? '#F5F5F7' : '#F8F5F0');
    }
  }

  WHT.toggleDarkMode = toggleDarkMode;
  WHT.applyTheme = applyTheme;
  WHT.applyStyle = applyStyle;
  WHT.toggleStyle = toggleStyle;
  WHT.getStyleLabel = getStyleLabel;

})();
