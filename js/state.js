/* 数据层：DataStore 缓存层 / localStorage CRUD / 默认设置 */
(function() {
  "use strict";
  var WHT = window.WHT;

  // DataStore 缓存层 — 避免同一渲染周期内多次读取 localStorage
  WHT.DataStore = {
    _cache: {},
    get: function(key, def) {
      if (!(key in this._cache)) {
        try { this._cache[key] = JSON.parse(localStorage.getItem(key)); }
        catch(e) { this._cache[key] = null; }
      }
      return this._cache[key] !== null && this._cache[key] !== undefined
        ? this._cache[key] : (def !== undefined ? def : null);
    },
    set: function(key, val) {
      this._cache[key] = val;
      try { localStorage.setItem(key, JSON.stringify(val)); }
      catch(e) { if (typeof WHT.showToast === 'function') WHT.showToast('存储空间不足，请导出数据后清理', 'error'); }
    },
    remove: function(key) { delete this._cache[key]; localStorage.removeItem(key); },
    clear: function() { this._cache = {}; localStorage.clear(); },
    invalidate: function(key) { delete this._cache[key]; }
  };

  var DS = WHT.DataStore;
  var P = WHT.APP_PREFIX;
  var st = WHT.state;

  function loadData() { st.users = DS.get(P + 'users', []); }
  function saveUsers() { DS.set(P + 'users', st.users); }
  function saveSession(uid) { DS.set(P + '_session', uid); }
  function getSession() { return DS.get(P + '_session', null); }
  function clearSession() { DS.remove(P + '_session'); }
  function getUserSettings() { if (!st.currentUser) return {}; return DS.get(P + st.currentUser.id + '_settings') || getDefaultSettings(); }
  function saveUserSettings(s) { if (st.currentUser) DS.set(P + st.currentUser.id + '_settings', s); }
  function getUserRecords() { if (!st.currentUser) return []; return DS.get(P + st.currentUser.id + '_records', []); }
  function saveUserRecords(r) { if (st.currentUser) DS.set(P + st.currentUser.id + '_records', r); }
  function getUserCompTime() { if (!st.currentUser) return []; return DS.get(P + st.currentUser.id + '_compTime', []); }
  function saveUserCompTime(c) { if (st.currentUser) DS.set(P + st.currentUser.id + '_compTime', c); }
  function getUserModes() { if (!st.currentUser) return []; return DS.get(P + st.currentUser.id + '_modes', []); }
  function saveUserModes(m) { if (st.currentUser) DS.set(P + st.currentUser.id + '_modes', m); }

  function getDefaultSettings() {
    return {
      standardHours: 8, holidayRate: 65,
      commonSlots: [{start:'09:00',end:'18:00'},{start:'10:00',end:'19:00'}],
      darkMode: false, style: 'flat', compTimeClearCycle: 'month',
      flextimeConfig: {standardStart:'10:00',standardEnd:'19:00',exchangeRate:8,startDate:WHT.today(),startIsBigWeek:true},
      quarterConfig: [{name:'Q1',months:[1,2,3]},{name:'Q2',months:[4,5,6]},{name:'Q3',months:[7,8,9]},{name:'Q4',months:[10,11,12]}],
      holidays: []
    };
  }

  function getDefaultModes(t) {
    var m = {
      civil: [{id:WHT.genId(),name:'标准模式',type:'civil',icon:'🏛️'}],
      comprehensive: [{id:WHT.genId(),name:'综合工时',type:'comprehensive',icon:'⏰'}],
      flextime: [{id:WHT.genId(),name:'大小周',type:'flextime',icon:'📅'}],
      custom: [{id:WHT.genId(),name:'自定义模式',type:'custom',icon:'⚙️'}]
    };
    return m[t] || m.civil;
  }

  // ── 导出 ──
  WHT.loadData = loadData;
  WHT.saveUsers = saveUsers;
  WHT.saveSession = saveSession;
  WHT.getSession = getSession;
  WHT.clearSession = clearSession;
  WHT.getUserSettings = getUserSettings;
  WHT.saveUserSettings = saveUserSettings;
  WHT.getUserRecords = getUserRecords;
  WHT.saveUserRecords = saveUserRecords;
  WHT.getUserCompTime = getUserCompTime;
  WHT.saveUserCompTime = saveUserCompTime;
  WHT.getUserModes = getUserModes;
  WHT.saveUserModes = saveUserModes;
  WHT.getDefaultSettings = getDefaultSettings;
  WHT.getDefaultModes = getDefaultModes;

})();
