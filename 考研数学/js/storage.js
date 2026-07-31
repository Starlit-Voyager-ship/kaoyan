/* 新数学中心 · 数据层（storage.js）
 * 基于 account.js 暴露的 window.uStorage（按账号前缀隔离）
 * 主收录库：mathMistakes_v1
 * 旧数据一次性迁移：mathDailyWrong_v1 / mathAutoBank_v1 → mathMistakes_v1
 */
(function () {
  "use strict";
  var BASE = "mathMistakes_v1";

  function getMistakes() {
    try { return JSON.parse(window.uStorage.getItem(BASE) || "[]") || []; }
    catch (e) { return []; }
  }
  function setMistakes(arr) {
    window.uStorage.setItem(BASE, JSON.stringify(arr));
  }
  function uid() {
    return "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function todayStr() {
    var d = new Date(), p = function (n) { return String(n).padStart(2, "0"); };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }

  function addMistake(rec) {
    var arr = getMistakes();
    rec = rec || {};
    rec.id = rec.id || uid();
    rec.createdAt = rec.createdAt || new Date().toISOString();
    rec.reviews = rec.reviews || 0;
    rec.status = rec.status || "攻克中";
    rec.entry = rec.entry || "手动";
    arr.unshift(rec);
    setMistakes(arr);
    return rec;
  }
  function updateMistake(id, patch) {
    var arr = getMistakes(), i = -1;
    for (var k = 0; k < arr.length; k++) { if (arr[k].id === id) { i = k; break; } }
    if (i < 0) return null;
    arr[i] = Object.assign({}, arr[i], patch);
    setMistakes(arr);
    return arr[i];
  }
  function deleteMistake(id) {
    setMistakes(getMistakes().filter(function (r) { return r.id !== id; }));
  }
  function getById(id) {
    return getMistakes().filter(function (r) { return r.id === id; })[0] || null;
  }

  // 旧版错题一次性迁移（仅首次）
  function migrateIfNeeded() {
    if (window.uStorage.getItem("mathMigrated_v3") === "1") return;
    var arr = getMistakes(), migrated = 0;
    try {
      var wrong = JSON.parse(window.uStorage.getItem("mathDailyWrong_v1") || "{}");
      if (wrong && typeof wrong === "object") {
        Object.keys(wrong).forEach(function (date) {
          (wrong[date] || []).forEach(function (it) {
            if (it && it.q) {
              arr.push({
                id: uid(), problem: it.q || "", answer: it.a || "", solution: "",
                book: "旧版迁移", points: it.kp ? [it.kp] : [], reason: "", note: "",
                entry: "旧版迁移", status: "攻克中", reviews: 0, createdAt: date, migrated: true
              });
              migrated++;
            }
          });
        });
      }
    } catch (e) {}
    try {
      var bank = JSON.parse(window.uStorage.getItem("mathAutoBank_v1") || "[]");
      if (Array.isArray(bank)) {
        bank.forEach(function (t) {
          if (t && (t.weak || t.res !== "✅") && t.q) {
            arr.push({
              id: uid(), problem: t.q || "", answer: t.a || "", solution: "",
              book: "旧版迁移", points: t.kp ? [t.kp] : [], reason: "", note: "",
              entry: "旧版迁移", status: "攻克中", reviews: 0, createdAt: new Date().toISOString(), migrated: true
            });
            migrated++;
          }
        });
      }
    } catch (e) {}
    if (migrated) setMistakes(arr);
    window.uStorage.setItem("mathMigrated_v3", "1");
  }

  // ── 聚合统计（供错题/归纳/题集模块复用）──
  function normPoints(r) {
    var p = r.knowledgePoints || r.points;
    if (!p) return [];
    return Array.isArray(p) ? p : [p];
  }
  function getBookStats() {
    var arr = getMistakes(), map = {};
    arr.forEach(function (r) {
      var b = r.book || "其他";
      if (!map[b]) map[b] = { book: b, total: 0, 攻克中: 0, 已掌握: 0 };
      map[b].total++;
      if (r.status === "已掌握") map[b].已掌握++; else map[b].攻克中++;
    });
    return Object.keys(map).map(function (k) { return map[k]; })
      .sort(function (a, b) { return b.total - a.total; });
  }
  function getReasonStats() {
    var arr = getMistakes(), map = {};
    arr.forEach(function (r) {
      var reason = r.reason || "未标注";
      map[reason] = (map[reason] || 0) + 1;
    });
    var order = ["不会做", "计算错", "概念错", "遗忘", "未标注", "其他"];
    return Object.keys(map).map(function (k) { return { reason: k, count: map[k] }; })
      .sort(function (a, b) {
        var ia = order.indexOf(a.reason), ib = order.indexOf(b.reason);
        if (ia < 0) ia = 99; if (ib < 0) ib = 99;
        return ia - ib || b.count - a.count;
      });
  }
  // 薄弱点：按知识点聚合，掌握率 = 已掌握/(攻克中+已掌握)
  function getWeakStats() {
    var arr = getMistakes(), map = {};
    arr.forEach(function (r) {
      normPoints(r).forEach(function (kp) {
        if (!kp) return;
        if (!map[kp]) map[kp] = { name: kp, total: 0, 攻克中: 0, 已掌握: 0 };
        map[kp].total++;
        if (r.status === "已掌握") map[kp].已掌握++; else map[kp].攻克中++;
      });
    });
    return Object.keys(map).map(function (k) {
      var v = map[k];
      var rate = v.total ? Math.round(v.已掌握 / v.total * 100) : 0;
      return { name: k, total: v.total, 攻克中: v.攻克中, 已掌握: v.已掌握, rate: rate };
    }).sort(function (a, b) { return a.rate - b.rate || b.total - a.total; });
  }
  function getFocusMinutesToday() {
    try {
      var raw = window.uStorage.getItem("focusSessions_v1");
      if (!raw) return 0;
      var list = JSON.parse(raw) || [];
      var t = todayStr();
      var mins = 0;
      list.forEach(function (s) {
        if (s && s.date === t && (s.category === "math" || !s.category)) {
          mins += Number(s.duration) || 0;
        }
      });
      return Math.round(mins);
    } catch (e) { return 0; }
  }
  function getTodayOverview() {
    var arr = getMistakes(), t = todayStr();
    var today = arr.filter(function (r) {
      return (r.createdAt || "").slice(0, 10) === t;
    });
    var books = {}, newWeak = 0, seen = {};
    today.forEach(function (r) {
      var b = r.book || "其他";
      books[b] = (books[b] || 0) + 1;
      normPoints(r).forEach(function (kp) {
        if (kp && !seen[kp]) { seen[kp] = 1; newWeak++; }
      });
    });
    return {
      count: today.length,
      books: books,
      newWeak: newWeak,
      focusMinutes: getFocusMinutesToday()
    };
  }
  // 近 N 天：每天收录量 + 当天已掌握率
  function getDailyTrend(days) {
    days = days || 14;
    var arr = getMistakes(), out = [];
    var d = new Date();
    for (var i = days - 1; i >= 0; i--) {
      var day = new Date(d.getTime() - i * 86400000);
      var key = day.getFullYear() + "-" + String(day.getMonth() + 1).padStart(2, "0") + "-" + String(day.getDate()).padStart(2, "0");
      var dayItems = arr.filter(function (r) { return (r.createdAt || "").slice(0, 10) === key; });
      var mastered = 0;
      dayItems.forEach(function (r) { if (r.status === "已掌握") mastered++; });
      out.push({
        date: key,
        count: dayItems.length,
        rate: dayItems.length ? Math.round(mastered / dayItems.length * 100) : 0
      });
    }
    return out;
  }
  function getAllStats() {
    var arr = getMistakes();
    return {
      total: arr.length,
      active: arr.filter(function (r) { return r.status !== "已掌握"; }).length,
      mastered: arr.filter(function (r) { return r.status === "已掌握"; }).length,
      books: getBookStats(),
      reasons: getReasonStats(),
      weak: getWeakStats(),
      today: getTodayOverview(),
      trend14: getDailyTrend(14),
      trend7: getDailyTrend(7)
    };
  }

  window.MathStore = {
    getMistakes: getMistakes,
    addMistake: addMistake,
    updateMistake: updateMistake,
    deleteMistake: deleteMistake,
    getById: getById,
    todayStr: todayStr,
    uid: uid,
    migrateIfNeeded: migrateIfNeeded,
    // 聚合统计
    normPoints: normPoints,
    getBookStats: getBookStats,
    getReasonStats: getReasonStats,
    getWeakStats: getWeakStats,
    getFocusMinutesToday: getFocusMinutesToday,
    getTodayOverview: getTodayOverview,
    getDailyTrend: getDailyTrend,
    getAllStats: getAllStats
  };
})();
