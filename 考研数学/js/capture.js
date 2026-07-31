/* 新数学中心 · 拍题模块（capture.js）
 * 读图 → base64 → POST /api/capture（本地 capture-server.js 同源代理）
 * 代理转发到 DeepSeek 视觉接口，返回模型文本；本模块解析为结构化结果。
 * 页面使用网页里已存的 deepseek-api-key 调用（不经助理）。
 */
(function () {
  "use strict";
  var ENDPOINT = "/api/capture";          // 由 capture-server.js 提供（同源）
  var MODEL = "deepseek-v4-flash";        // 2026 DeepSeek 视觉模型

  function readImage(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };   // data URL
      reader.onerror = function () { reject(new Error("图片读取失败")); };
      reader.readAsDataURL(file);
    });
  }

  function parseResult(text) {
    if (typeof text !== "string") return (text && typeof text === "object") ? text : {};
    var s = text.trim();
    var fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) s = fence[1].trim();
    var start = s.indexOf("{"), end = s.lastIndexOf("}");
    if (start >= 0 && end > start) s = s.slice(start, end + 1);
    try {
      var obj = JSON.parse(s);
      // 规范化
      if (typeof obj.知识点 === "string") obj.知识点 = obj.知识点.split(/[,，、]/).map(function (x) { return x.trim(); }).filter(Boolean);
      if (!Array.isArray(obj.知识点)) obj.知识点 = [];
      return obj;
    } catch (e) {
      return { 题面: text, 答案: "", 解析: "", 知识点: [], 难度: "" };
    }
  }

  async function capture(file, onStatus) {
    if (!file) throw new Error("未选择图片");
    if (onStatus) onStatus("读取图片…");
    var dataUrl = await readImage(file);
    var apiKey = (window.uStorage.getItem("deepseek-api-key") || "").trim();
    if (!apiKey) throw new Error("未配置 DeepSeek Key：请在网页 DeepSeek 设置里填入 api-key");
    if (onStatus) onStatus("调用 DeepSeek 识别中…");
    var resp = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: apiKey, model: MODEL, image: dataUrl })
    });
    var data;
    try { data = await resp.json(); } catch (e) { data = {}; }
    if (!resp.ok || data.error) {
      throw new Error(data.error || ("识别服务返回 " + resp.status));
    }
    if (onStatus) onStatus("解析结果…");
    return parseResult(data.result || "");
  }

  window.MathCapture = { capture: capture, MODEL: MODEL };
})();
