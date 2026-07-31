/* 新数学中心 · 统计层（stats.js）
 * 浏览器内计算归纳总结所需数据（单一统计真相）。
 * 纯函数，不依赖 DOM，便于后续 Node(gist-report) 复用。
 */
(function () {
  "use strict";

  function toDate(iso) { return (iso || "").slice(0, 10); }

  function summary(mistakes, focusSessions) {
    mistakes = mistakes || [];
    focusSessions = focusSessions || [];
    var today = (window.MathStore ? window.MathStore.todayStr() : new Date().toISOString().slice(0, 10));

    // —— 今日概览 ——
    var todayItems = mistakes.filter(function (m) { return toDate(m.createdAt) === today; });
    var mathMin = focusSessions
      .filter(function (s) {
        if (!s) return false;
        var cat = s.category || "";
        var name = s.name || "";
        return (cat === "math" || /数学/.test(name)) && toDate(s.date || s.startAt) === today;
      })
      .reduce(function (sum, x) { return sum + (Number(x.duration) || 0); }, 0);

    // —— 来源分布（按 book）——
    var byBook = {};
    mistakes.forEach(function (m) {
      var b = m.book || "其他";
      if (!byBook[b]) byBook[b] = { total: 0, points: {} };
      byBook[b].total++;
      var pts = (m.knowledgePoints || m.points || []);
      pts.forEach(function (p) { byBook[b].points[p] = (byBook[b].points[p] || 0) + 1; });
    });
    var bookList = Object.keys(byBook).map(function (b) {
      var top = Object.keys(byBook[b].points).sort(function (a, c) { return byBook[b].points[c] - byBook[b].points[a]; }).slice(0, 3);
      return { book: b, total: byBook[b].total, topPoints: top };
    }).sort(function (a, b) { return b.total - a.total; });

    // —— 知识点薄弱榜 ——
    var pts = {};
    mistakes.forEach(function (m) {
      var mps = (m.knowledgePoints || m.points || []);
      mps.forEach(function (p) {
        if (!pts[p]) pts[p] = { total: 0, resolved: 0 };
        pts[p].total++;
        if (m.status === "已掌握") pts[p].resolved++;
      });
    });
    var weakPoints = Object.keys(pts).map(function (p) {
      var total = pts[p].total, resolved = pts[p].resolved;
      return {
        point: p, total: total,
        mastery: total ? Math.round(resolved / total * 100) : 0,
        active: total - resolved
      };
    }).sort(function (a, b) { return b.active - a.active; });

    // —— 错因归因 ——
    var byReason = { "不会做": 0, "计算错": 0, "概念错": 0, "遗忘": 0 };
    mistakes.forEach(function (m) { if (byReason[m.reason] != null) byReason[m.reason]++; });
    var reasonArr = Object.keys(byReason).map(function (k) { return { reason: k, count: byReason[k] }; });

    // —— 趋势（近 14 天）——
    var trend = [];
    for (var i = 13; i >= 0; i--) {
      var d = new Date(); d.setDate(d.getDate() - i);
      var ds = d.toISOString().slice(0, 10);
      var dayItems = mistakes.filter(function (m) { return toDate(m.createdAt) === ds; });
      var mastered = dayItems.filter(function (m) { return m.status === "已掌握"; }).length;
      trend.push({
        date: ds,
        count: dayItems.length,
        mastery: dayItems.length ? Math.round(mastered / dayItems.length * 100) : 0
      });
    }

    return {
      today: {
        count: todayItems.length,
        bookKinds: bookList.length,
        activeWeak: weakPoints.filter(function (w) { return w.active > 0; }).length,
        mathMin: Math.round(mathMin / 60)
      },
      bookList: bookList,
      weakPoints: weakPoints,
      byReason: reasonArr,
      trend: trend,
      total: mistakes.length
    };
  }

  window.MathStats = { summary: summary };
})();
