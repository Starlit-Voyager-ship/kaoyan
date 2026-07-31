/* 考研学习中心 · 多账号命名空间 (account.js)
 * - 个人数据按 user:<昵称>:<原键名> 前缀隔离
 * - 全局共享键（API Key / 代理 / 登录标记 / 迁移标记）不加前缀
 * - 首次登录：把当前浏览器里已有的无前缀个人数据迁移为「主人账号」
 * - 新增：账号删除、强制清零新账号
 * 各页面请在 <head> 最前引入本脚本：<script src="account.js"></script>（子页面用 ../account.js）
 */
(function () {
  "use strict";

  // 全局共享键（不加用户前缀）
  var GLOBAL_KEYS = new Set([
    "deepseek-api-key",
    "tr-proxy-url",
    "vocab-dir-handle",
    "kaoyan-active-user",   // 当前登录昵称
    "kaoyan-owner-user",    // 首位登录者 = 主人账号
    "kaoyan-migrated",      // 旧迁移完成标记（兼容）
    "kaoyan-owner-articles-seeded", // 主人文章已播种标记
    "kaoyan-data.json"      // Gist 同步桶（按账号改造后）
  ]);

  // 需要按账号隔离的键（数组/对象）
  var PERSONAL_BASE_KEYS = [
    "vocab-quiz-data-v1",
    "vocab-quiz-learn-v1",
    "articlesExtra_v1",
    "my-word-lookup-log",
    "mathAutoBank_v1",
    "mathDailyWrong_v1",
    "mathWeaks_v1",
    "mathWeakResolved_v1"
  ];

  function ls() { return window.localStorage; }
  function todayStr() {
    var d = new Date();
    var p = function (n) { return String(n).padStart(2, "0"); };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }

  function getCurrentUser() {
    try { return ls().getItem("kaoyan-active-user") || ""; } catch (e) { return ""; }
  }
  function setRaw(k, v) {
    try { if (v === null || v === undefined) ls().removeItem(k); else ls().setItem(k, v); } catch (e) {}
  }

  // 把原键名映射为带用户前缀的键；全局键原样返回
  function ukey(base) {
    if (GLOBAL_KEYS.has(base)) return base;
    var u = getCurrentUser();
    return u ? ("user:" + u + ":" + base) : base;
  }

  var uStorage = {
    getItem: function (b) { return ls().getItem(ukey(b)); },
    setItem: function (b, v) { return ls().setItem(ukey(b), v); },
    removeItem: function (b) { return ls().removeItem(ukey(b)); },
    key: function (i) { return ls().key(i); },
    get length() { return ls().length; }
  };

  // 各个人键的默认空值结构
  function defaultValFor(baseKey) {
    if (baseKey === "mathAutoBank_v1" || baseKey === "mathWeaks_v1" ||
        baseKey === "vocab-quiz-data-v1" || baseKey === "my-word-lookup-log" ||
        baseKey === "articlesExtra_v1") return "[]";
    if (baseKey === "vocab-quiz-learn-v1") return "{}";
    return "{}";
  }

  function initMarker(u) { return "kaoyan-init-" + u; }
  function isInitialized(u) { return ls().getItem(initMarker(u)) === "1"; }
  function markInitialized(u) { ls().setItem(initMarker(u), "1"); }

  // 检测旧版无前缀数据是否还存在
  function hasOldGlobalData() {
    for (var i = 0; i < PERSONAL_BASE_KEYS.length; i++) {
      if (ls().getItem(PERSONAL_BASE_KEYS[i]) !== null) return true;
    }
    return false;
  }

  // 把旧全局数据迁移到指定账号（仅调用方确认后使用）
  function migrateOldToUser(u) {
    if (!u) return;
    for (var j = 0; j < PERSONAL_BASE_KEYS.length; j++) {
      var baseKey = PERSONAL_BASE_KEYS[j];
      var userKey = "user:" + u + ":" + baseKey;
      var oldVal = ls().getItem(baseKey);
      if (oldVal !== null && ls().getItem(userKey) === null) {
        ls().setItem(userKey, oldVal);
      }
    }
    // 记忆曲线动态键
    for (var k = 0; k < ls().length; k++) {
      var key = ls().key(k);
      if (/^curve-daily-(seed|count)-/.test(key)) {
        var uk = "user:" + u + ":" + key;
        if (ls().getItem(uk) === null) {
          var cv = ls().getItem(key);
          if (cv !== null) ls().setItem(uk, cv);
        }
      }
    }
    ls().setItem("kaoyan-owner-user", u);
  }

  // 逐账号初始化 + 自愈迁移：保证主人旧数据（无前缀）始终能被补齐到 user:<主人>: 前缀，
  // 避免早期迁移遗漏导致主人读到空；朋友账号仍按"从零开始"清零，不继承主人数据。
  function migrate() {
    var u = getCurrentUser();
    if (!u) return;
    var isOwner = (ls().getItem("kaoyan-owner-user") || "") === u;

    for (var j = 0; j < PERSONAL_BASE_KEYS.length; j++) {
      var baseKey = PERSONAL_BASE_KEYS[j];
      var userKey = "user:" + u + ":" + baseKey;
      var userVal = ls().getItem(userKey);
      if (userVal === null) {
        // 该用户键尚未创建：主人继承旧无前缀数据，朋友清零
        var oldVal = ls().getItem(baseKey);
        if (isOwner && oldVal !== null) {
          ls().setItem(userKey, oldVal);
        } else {
          ls().setItem(userKey, defaultValFor(baseKey));
        }
      } else if (isOwner && (userVal === "[]" || userVal === "{}")) {
        // 主人该键为空结构，但旧无前缀数据存在且非空 → 自愈补齐（防早期迁移遗漏）
        var oldVal2 = ls().getItem(baseKey);
        if (oldVal2 !== null && oldVal2 !== "[]" && oldVal2 !== "{}") {
          ls().setItem(userKey, oldVal2);
        }
      }
    }

    // 每日记忆曲线种子（动态键）：主人继承旧种子，朋友不从旧种子继承
    for (var k = 0; k < ls().length; k++) {
      var key = ls().key(k);
      if (/^curve-daily-(seed|count)-/.test(key)) {
        var uk = "user:" + u + ":" + key;
        if (ls().getItem(uk) === null) {
          var cv = ls().getItem(key);
          if (isOwner && cv !== null) ls().setItem(uk, cv);
        }
      }
    }

    if (!isInitialized(u)) markInitialized(u);
    // 兼容旧标记
    ls().setItem("kaoyan-migrated", "1");
  }

  function setCurrentUser(nick) {
    nick = (nick || "").trim();
    if (!nick) return false;
    ls().setItem("kaoyan-active-user", nick);
    if (!ls().getItem("kaoyan-owner-user")) ls().setItem("kaoyan-owner-user", nick);
    migrate();
    return true;
  }

  function listUsers() {
    var set = {};
    for (var i = 0; i < ls().length; i++) {
      var m = /^user:([^:]+):/.exec(ls().key(i));
      if (m) set[m[1]] = 1;
    }
    return Object.keys(set);
  }

  function deleteUser(name) {
    name = (name || "").trim();
    if (!name) return false;
    var prefix = "user:" + name + ":";
    for (var i = ls().length - 1; i >= 0; i--) {
      var k = ls().key(i);
      if (k && k.indexOf(prefix) === 0) ls().removeItem(k);
    }
    ls().removeItem(initMarker(name));
    if (getCurrentUser() === name) ls().removeItem("kaoyan-active-user");
    return true;
  }

  function claimOldDataForCurrent() {
    var u = getCurrentUser();
    if (!u) return false;
    if (!hasOldGlobalData()) return false;
    migrateOldToUser(u);
    // 重新初始化以补齐可能遗漏的键
    ls().removeItem(initMarker(u));
    migrate();
    return true;
  }

  // 判断当前是否为总入口页面；只在总入口显示账号切换 UI
  function isMainPortal() {
    var path = (location.pathname || "").toLowerCase();
    if (path === "/" || path.endsWith("/index.html") || path.endsWith("/考研学习中心.html") || path.endsWith("/")) return true;
    // 数学中心（含各子模块）也作为主入口，保证未登录时能弹出登录框
    if (path.endsWith("/math-center.html")) return true;
    if (path.indexOf("/考研数学/") >= 0) return true;
    return false;
  }

  // ===== UI：登录遮罩 + 浮动账号条 =====
  function injectStyles() {
    var css =
      "#accOverlay{position:fixed;inset:0;background:rgba(20,24,35,.55);display:flex;align-items:center;justify-content:center;z-index:99999;}" +
      "#accOverlay .box{background:#fff;border-radius:16px;padding:26px 28px;width:min(380px,90vw);box-shadow:0 20px 60px rgba(0,0,0,.3);}" +
      "#accOverlay h3{margin:0 0 6px;font-size:19px;}" +
      "#accOverlay .sub{margin:0 0 16px;color:#7a869a;font-size:13px;}" +
      "#accNameInput{width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:10px;font-size:15px;box-sizing:border-box;}" +
      "#accErr{color:#dc2626;font-size:12px;min-height:16px;margin-top:6px;}" +
      "#accLoginBtn{width:100%;margin-top:8px;background:linear-gradient(135deg,#6366f1,#0ea5e9);color:#fff;border:none;border-radius:10px;padding:11px;font-size:15px;font-weight:700;cursor:pointer;}" +
      "#accUsers{margin-top:14px;font-size:12px;color:#7a869a;}" +
      "#accUsers .u{padding:2px 8px;background:#eef1f6;border-radius:8px;cursor:pointer;margin:2px 4px;display:inline-flex;align-items:center;gap:4px;}" +
      "#accUsers .u .del{color:#dc2626;margin-left:4px;font-weight:700;cursor:pointer;}" +
      "#accChip{position:fixed;left:14px;bottom:14px;z-index:99990;background:#fff;border:1px solid #e6e9f0;border-radius:12px;box-shadow:0 6px 20px rgba(31,39,51,.12);padding:6px 8px;font-size:13px;display:none;align-items:center;gap:6px;}" +
      "#accNameBox{display:flex;align-items:center;gap:4px;cursor:pointer;padding:5px 9px;border-radius:8px;transition:background .15s;}" +
      "#accNameBox:hover{background:#f3f4f6;}" +
      "#accClaimBtn{border:1px solid #f59e0b;background:#fff7ed;color:#92400e;border-radius:8px;padding:4px 10px;cursor:pointer;font-size:12px;}";
    var s = document.createElement("style");
    s.textContent = css;
    document.head.appendChild(s);
  }

  function buildUI() {
    injectStyles();
    var overlay = document.createElement("div");
    overlay.id = "accOverlay";
    overlay.innerHTML =
      '<div class="box">' +
      '<h3>📚 考研学习中心</h3>' +
      '<p class="sub">输入昵称进入（仅本地账号，昵称区分数据）</p>' +
      '<input id="accNameInput" placeholder="例如 xiaoming" autocomplete="off">' +
      '<div id="accErr"></div>' +
      '<button id="accLoginBtn">进入</button>' +
      '<div id="accUsers"></div>' +
      '</div>';
    document.body.appendChild(overlay);

    var chip = document.createElement("div");
    chip.id = "accChip";
    chip.innerHTML = '<span id="accNameBox">👤 <b id="accChipName"></b> ▼</span><button id="accClaimBtn" style="display:none">接管旧数据</button>';
    document.body.appendChild(chip);

    var input = overlay.querySelector("#accNameInput");
    var err = overlay.querySelector("#accErr");
    var usersBox = overlay.querySelector("#accUsers");
    var claimBtn = chip.querySelector("#accClaimBtn");

    function renderUsers() {
      var users = listUsers();
      if (users.length) {
        usersBox.innerHTML = "本机已有账号：" + users.map(function (u) {
          return '<span class="u" data-u="' + u.replace(/"/g, "") + '">' + u + '<span class="del" data-d="' + u.replace(/"/g, "") + '" title="删除该账号">×</span></span>';
        }).join("");
        Array.prototype.forEach.call(usersBox.querySelectorAll(".u"), function (el) {
          el.onclick = function (e) {
            if (e.target.classList.contains("del")) return;
            doLogin(el.getAttribute("data-u"));
          };
        });
        Array.prototype.forEach.call(usersBox.querySelectorAll(".del"), function (el) {
          el.onclick = function (e) {
            e.stopPropagation();
            var name = el.getAttribute("data-d");
            if (confirm("确定删除账号「" + name + "」？该账号的学习数据将被清空且不可恢复。")) {
              deleteUser(name);
              renderUsers();
              updateChip();
            }
          };
        });
      } else {
        usersBox.innerHTML = "";
      }
    }
    function updateChip() {
      var u = getCurrentUser();
      var nm = document.getElementById("accChipName");
      if (nm) nm.textContent = u;
      if (claimBtn) {
        var owner = ls().getItem("kaoyan-owner-user") || "";
        claimBtn.style.display = (u && hasOldGlobalData() && u !== owner) ? "inline-block" : "none";
      }
    }
    function showOverlay() {
      overlay.style.display = "flex";
      chip.style.display = "none";
      renderUsers();
      try { input.focus(); } catch (e) {}
    }
    function hideOverlay() {
      overlay.style.display = "none";
      if (window !== window.top) {
        // 嵌入主站 iframe 内：账号由父页面统一管理，不显示浮窗账号条
        chip.style.display = "none";
      } else {
        chip.style.display = "flex";
        updateChip();
      }
    }
    function doLogin(nick) {
      if (!setCurrentUser(nick)) { err.textContent = "请输入昵称"; return; }
      location.reload();
    }
    window.__accShowLogin = showOverlay;

    overlay.querySelector("#accLoginBtn").onclick = function () { doLogin(input.value); };
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") doLogin(input.value); });
    chip.querySelector("#accNameBox").onclick = function () { showOverlay(); };
    if (claimBtn) {
      claimBtn.onclick = function () {
        if (confirm("将本机旧数据（单词、文章、数学等）全部迁移到当前账号「" + getCurrentUser() + "」？")) {
          if (claimOldDataForCurrent()) {
            alert("已迁移，页面即将刷新");
            location.reload();
          } else {
            alert("没有检测到可迁移的旧数据");
          }
        }
      };
    }

    if (!getCurrentUser()) showOverlay();
    else hideOverlay();
  }

  // 暴露给页面脚本
  window.getCurrentUser = getCurrentUser;
  window.setCurrentUser = setCurrentUser;
  window.ukey = ukey;
  window.uStorage = uStorage;
  window.listUsers = listUsers;
  window.deleteUser = deleteUser;
  window.hasOldGlobalData = hasOldGlobalData;
  window.claimOldDataForCurrent = claimOldDataForCurrent;
  window.showLogin = function () { if (window.__accShowLogin) window.__accShowLogin(); };

  if (!isMainPortal()) {
    // 分中心不注入账号 UI，但 API 仍暴露给页面
  } else if (document.body) {
    buildUI();
  } else {
    document.addEventListener("DOMContentLoaded", buildUI);
  }
})();
