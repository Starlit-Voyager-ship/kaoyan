/**
 * AI 学习助理 · 主逻辑（单界面版）
 *
 * 设计：一个统一的 AI 助理界面（不分学科），类似对话式 AI 助手。
 *   ┌─ 聊天引擎（消息收发、渲染、历史持久化）
 *   ├─ DeepSeek 调用（浏览器直连 api.deepseek.com，失败回退 /api/chat 代理）
 *   ├─ 收录流程（弹窗 → 来源/错因/知识点 → 知识点空则 AI 分析 → storage 入库）
 *   └─ 预留接口（英语拍照传文章 / 政治 / 专业课，代码层预留，UI 不显示学科切换）
 */

(function () {
  'use strict';
  console.log('🚀 main.js v=13 LOADED at', new Date().toLocaleTimeString());  // ← 缓存排查标记，删除此行前请确认聊天正常

  /* ══════════════════════════════════════
     0. 预留接口配置（扩展点）
     ══════════════════════════════════════
     说明：本界面是"单一 AI 助理"，不分数学/英语/政治。
     但为后续重构预留了接口，未来可在代码层激活，无需重写结构：
       - englishCaptureReady：英语拍照传文章功能的接入开关
       - politicsUrl / majorUrl：政治 / 专业课中心的外部链接
       - window.AIAssistant：对外暴露的控制对象
     */
  var EXT = {
    // 英语中心：后续重构完英语后，把拍照传文章功能接到这里。
    // 设为 true 后由 capture 模块注入入口，无需改本文件主流程。
    englishCaptureReady: false,
    englishCaptureHook: null,   // function(imageData) -> 处理后入库（预留给英语中心实现）
    // 政治中心 / 专业课中心：外部链接（未来点击跳转或内嵌）
    politicsUrl: null,
    majorUrl: null
  };

  var MODEL = 'deepseek-chat';
  var BASE_URL = 'https://api.deepseek.com/v1';  // 对话模型默认 DeepSeek
  var VISION_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';  // 视觉模型默认千问 VL
  var VISION_MODEL = 'qwen-vl-max';

  /* ══════════════════════════════════════
     0.5 模型直连（绕开沙箱代理，用浏览器网络）
     ────────────────────────────────────────
     沙箱到阿里云网络不稳定，故优先让浏览器直连模型 API
     （DeepSeek / 千问 均支持 CORS）。直连失败（CORS/网络）
     时回退到本地 /api 代理。
     ══════════════════════════════════════ */
  function callChatDirect(apiKey, baseUrl, model, messages, stream) {
    var url = baseUrl.replace(/\/+$/, '') + '/chat/completions';
    console.log('[DEBUG] 直连 DeepSeek:', url, '| stream:', stream);
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({ model: model, messages: messages, stream: !!stream })
    }).catch(function (e) {
      // CORS / 网络错误 → 回退本地代理
      console.log('[DEBUG] 直连失败，回退 /api/chat:', e.message);
      return fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey, baseUrl: baseUrl, model: model, messages: messages, stream: !!stream })
      });
    });
  }

  function callVisionDirect(vKey, vBase, vModel, image, prompt) {
    var url = vBase.replace(/\/+$/, '') + '/chat/completions';
    console.log('[DEBUG] 直连千问VL:', url);
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + vKey },
      body: JSON.stringify({
        model: vModel,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: image, detail: 'high' } }
          ]
        }],
        max_tokens: 4096
      })
    }).then(function (r) {
      if (!r.ok) return r.json().then(function (j) { throw new Error((j.error && (j.error.message || j.error)) || ('视觉模型 ' + r.status)); });
      return r.json();
    }).then(function (j) {
      var out = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
      if (!out.trim()) throw new Error('视觉模型返回空内容');
      return out;
    }).catch(function (e) {
      // 直连失败（CORS/网络/空内容）→ 回退本地代理
      console.log('[DEBUG] 直连千问失败，回退 /api/vision:', e.message);
      return fetch('/api/vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visionBaseUrl: vBase, visionKey: vKey, visionModel: vModel, image: image, prompt: prompt })
      }).then(function (r) {
        if (!r.ok) return r.json().then(function (d) { throw new Error(d.error || r.status); });
        return r.json();
      }).then(function (j) { if (j.error) throw new Error(j.error); return j.text || ''; });
    });
  }

  /* ══════════════════════════════════════
     1. 状态
     ══════════════════════════════════════ */
  var state = {
    messages: [],
    pendingImage: null,
    pendingImageData: null,
    isStreaming: false,
    lastQuestion: null,
    chatHistoryKey: 'ai-assistant-chat'
  };

  /* ══════════════════════════════════════
     2. DOM 引用
     ══════════════════════════════════════ */
  var $ = function (s) { return document.querySelector(s); };
  var chatArea = $('#chatArea');
  var chatInner = $('#chatInner');
  var msgInput = $('#msgInput');
  var imgPreview = $('#imgPreview');
  var imgRemove = $('#imgRemove');
  var fileInput = $('#fileInput');
  var btnUpload = $('#btnUpload');
  var btnSend = $('#btnSend');
  var modalMask = $('#modalMask');
  var mBook = $('#mBook');
  var mReason = $('#mReason');
  var mPoints = $('#mPoints');
  var mNote = $('#mNote');
  var mAnalyzing = $('#mAnalyzing');
  var modalConfirm = $('#modalConfirm');
  var modalCancel = $('#modalCancel');
  var toastEl = $('#toast');
  var connStatus = $('#connStatus');
  var connDot = $('#connDot');
  var connText = $('#connText');
  var btnSettings = $('#btnSettings');
  var keyMask = $('#keyMask');
  var apiKeyInput = $('#apiKeyInput');
  var baseUrlInput = $('#baseUrlInput');
  var modelInput = $('#modelInput');
  var visionKeyInput = $('#visionKeyInput');
  var visionBaseUrlInput = $('#visionBaseUrlInput');
  var visionModelInput = $('#visionModelInput');
  var keyStatus = $('#keyStatus');
  var keySave = $('#keySave');
  var keyCancel = $('#keyCancel');

  /* ══════════════════════════════════════
     3. 初始化
     ══════════════════════════════════════ */
  function init() {
    var savedModel = uStorage.getItem('deepseek-model');
    if (savedModel) MODEL = savedModel;
    var savedBase = uStorage.getItem('deepseek-base-url');
    if (savedBase) BASE_URL = savedBase;
    var savedVModel = uStorage.getItem('vision-model');
    if (savedVModel) VISION_MODEL = savedVModel;
    var savedVBase = uStorage.getItem('vision-base-url');
    if (savedVBase) VISION_BASE_URL = savedVBase;
    loadHistory();
    bindEvents();
    autoResizeInput();
    checkConnection();
    exposeAPI();
  }

  function loadHistory() {
    try {
      var raw = uStorage.getItem(state.chatHistoryKey);
      if (raw) {
        var parsed = JSON.parse(raw);
        state.messages = Array.isArray(parsed) ? parsed : [];
      }
    } catch (e) {
      // uStorage 可能不可用（iframe 中），降级到原生 localStorage
      try {
        var raw2 = localStorage.getItem(state.chatHistoryKey);
        if (raw2) { state.messages = JSON.parse(raw2); }
      } catch (e2) { state.messages = []; }
    }
    renderMessages();
  }

  function saveHistory() {
    // 存储时去掉图片 base64 数据（太大，会撑爆 localStorage）
    var toSave = state.messages.slice(-200).map(function (m) {
      var copy = { role: m.role, content: m.content || '', time: m.time || '' };
      if (m.images && m.images.length) copy.hasImages = true;  // 标记有图但不存数据
      if (m.ocrText) copy.ocrText = m.ocrText;
      return copy;
    });
    var serialized = JSON.stringify(toSave);
    try {
      uStorage.setItem(state.chatHistoryKey, serialized);
    } catch (e) {
      // 降级
      try { localStorage.setItem(state.chatHistoryKey, serialized); } catch (e2) {}
    }
  }

  function bindEvents() {
    // 图片选择（保留 fileInput 供内部使用）
    fileInput.addEventListener('change', handleFileSelect);

    // 移除图片
    imgRemove.addEventListener('click', clearPendingImage);
    imgPreview.addEventListener('click', function () { fileInput.click(); });

    // 发送
    btnSend.addEventListener('click', handleSend);

    // 上传收录
    btnUpload.addEventListener('click', handleUpload);

    // Enter 发送 / Shift+Enter 换行
    msgInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });
    msgInput.addEventListener('input', autoResizeInput);

    // 粘贴图片（Ctrl+V）
    msgInput.addEventListener('paste', handlePaste);
    document.addEventListener('paste', handlePaste);

    // 拖拽图片到聊天区
    chatArea.addEventListener('dragover', function (e) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
    chatArea.addEventListener('drop', handleDrop);

    // 弹窗
    modalCancel.addEventListener('click', closeModal);
    modalMask.addEventListener('click', function (e) {
      if (e.target === modalMask) closeModal();
    });
    modalConfirm.addEventListener('click', handleModalConfirm);
    mBook.addEventListener('change', validateModal);
    mPoints.addEventListener('input', validateModal);

    // Key 设置弹窗
    btnSettings.addEventListener('click', openKeyModal);
    keyCancel.addEventListener('click', closeKeyModal);
    keyMask.addEventListener('click', function (e) { if (e.target === keyMask) closeKeyModal(); });
    keySave.addEventListener('click', handleKeySave);
  }

  /* ══════════════════════════════════════
     3.5. Key 设置
     ══════════════════════════════════════ */
  function openKeyModal() {
    var existing = uStorage.getItem('deepseek-api-key');
    apiKeyInput.value = existing || '';
    baseUrlInput.value = uStorage.getItem('deepseek-base-url') || BASE_URL;
    modelInput.value = uStorage.getItem('deepseek-model') || MODEL;
    visionKeyInput.value = uStorage.getItem('vision-api-key') || '';
    visionBaseUrlInput.value = uStorage.getItem('vision-base-url') || VISION_BASE_URL;
    visionModelInput.value = uStorage.getItem('vision-model') || VISION_MODEL;
    keyStatus.textContent = existing
      ? '✅ 当前已保存配置，修改后点击保存即可更新'
      : '⚠️ 尚未设置，请填入后保存';
    keyStatus.style.color = existing ? 'var(--accent-teal)' : 'var(--warn)';
    keyMask.classList.add('show');
    setTimeout(function () { apiKeyInput.focus(); }, 100);
  }
  function closeKeyModal() { keyMask.classList.remove('show'); }

  function handleKeySave() {
    var key = apiKeyInput.value.trim();
    if (!key) { showToast('请输入对话模型 Key'); return; }
    var base = baseUrlInput.value.trim() || BASE_URL;
    var mdl = modelInput.value.trim() || MODEL;
    var vKey = visionKeyInput.value.trim() || '';
    var vBase = visionBaseUrlInput.value.trim() || VISION_BASE_URL;
    var vMdl = visionModelInput.value.trim() || VISION_MODEL;
    uStorage.setItem('deepseek-api-key', key);
    uStorage.setItem('deepseek-base-url', base);
    uStorage.setItem('deepseek-model', mdl);
    uStorage.setItem('vision-api-key', vKey);
    uStorage.setItem('vision-base-url', vBase);
    uStorage.setItem('vision-model', vMdl);
    BASE_URL = base; MODEL = mdl; VISION_BASE_URL = vBase; VISION_MODEL = vMdl;
    closeKeyModal();
    showToast('✅ 配置已保存（对话:' + mdl + ' / 视觉:' + vMdl + '）');
    checkConnection();
  }

  /** 对外暴露控制接口（预留扩展点） */
  function exposeAPI() {
    window.AIAssistant = {
      sendMessage: function (text, image) {
        if (image) { state.pendingImage = image; }
        if (text) { msgInput.value = text; }
        handleSend();
      },
      getMessages: function () { return state.messages.slice(); },
      openUpload: handleUpload,
      setEnglishCapture: function (fn) {
        EXT.englishCaptureReady = true;
        EXT.englishCaptureHook = fn;
      },
      setCenterLink: function (name, url) {
        if (name === 'politics') EXT.politicsUrl = url;
        if (name === 'major') EXT.majorUrl = url;
      },
      EXT: EXT
    };
  }

  /* ══════════════════════════════════════
     4. 图片处理
     ══════════════════════════════════════ */
  function handleFileSelect(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { showToast('请选择图片文件'); return; }
    if (file.size > 10 * 1024 * 1024) { showToast('图片过大，请控制在 10MB 以内'); return; }

    var reader = new FileReader();
    reader.onload = function (ev) {
      state.pendingImage = ev.target.result;
      state.pendingImageData = file;
      imgPreview.src = ev.target.result;
      imgPreview.classList.add('show');
    };
    reader.readAsDataURL(file);
    fileInput.value = '';
  }

  function clearPendingImage() {
    state.pendingImage = null;
    state.pendingImageData = null;
    clearPendingImageUI();
  }
  function clearPendingImageUI() {
    imgPreview.src = '';
    imgPreview.classList.remove('show');
  }

  /** 压缩图片：缩小到 maxSide 像素，转 JPEG quality，返回 Promise<dataURL> */
  function compressImage(dataUrl, maxSide, quality) {
    maxSide = maxSide || 1024;
    quality = quality || 0.8;
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        var w = img.width, h = img.height;
        if (w <= maxSide && h <= maxSide) { resolve(dataUrl); return; } // 已经够小
        var scale = Math.min(maxSide / w, maxSide / h);
        var cw = Math.round(w * scale), ch = Math.round(h * scale);
        var c = document.createElement('canvas');
        c.width = cw; c.height = ch;
        var ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, cw, ch);
        resolve(c.toDataURL('image/jpeg', quality));
      };
      img.src = dataUrl;
    });
  }

  /** 粘贴图片（Ctrl+V） */
  function handlePaste(e) {
    var items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (var i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        e.preventDefault();
        var file = items[i].getAsFile();
        if (file) {
          var reader = new FileReader();
          reader.onload = function (ev) {
            state.pendingImage = ev.target.result;
            state.pendingImageData = file;
            imgPreview.src = ev.target.result;
            imgPreview.classList.add('show');
            showToast('📷 图片已粘贴，点击「发送」发出');
          };
          reader.readAsDataURL(file);
        }
        return;
      }
    }
  }

  /** 拖拽图片到聊天区 */
  function handleDrop(e) {
    e.preventDefault();
    var files = e.dataTransfer && e.dataTransfer.files;
    if (!files || !files.length) return;
    var file = files[0];
    if (!file.type.startsWith('image/')) { showToast('请拖入图片文件'); return; }
    if (file.size > 10 * 1024 * 1024) { showToast('图片过大，请控制在 10MB 以内'); return; }
    var reader = new FileReader();
    reader.onload = function (ev) {
      state.pendingImage = ev.target.result;
      state.pendingImageData = file;
      imgPreview.src = ev.target.result;
      imgPreview.classList.add('show');
      showToast('📷 图片已放入，点击「发送」发出');
    };
    reader.readAsDataURL(file);
  }

  /* ══════════════════════════════════════
     5. 发送 & AI 对话
     ══════════════════════════════════════ */
  function handleSend() {
    var text = msgInput.value.trim();
    var hasImg = !!state.pendingImage;
    if (!text && !hasImg) { showToast('请输入内容或添加图片'); return; }
    if (state.isStreaming) { showToast('AI 正在回复中，请稍候…'); return; }

    var userMsg = {
      role: 'user',
      content: text,
      images: hasImg ? [state.pendingImage] : [],
      time: new Date().toISOString()
    };
    if (text || hasImg) state.lastQuestion = userMsg;

    state.messages.push(userMsg);
    renderMessage(userMsg);
    saveHistory();

    msgInput.value = '';
    clearPendingImage();
    autoResizeInput();

    callDeepSeek(userMsg);
  }

  /** 调视觉模型（千问 VL）提取图片文字，返回 Promise<string> */
  function ocrImage(dataUrl) {
    var vKey = uStorage.getItem('vision-api-key');
    var vBase = uStorage.getItem('vision-base-url') || VISION_BASE_URL;
    var vModel = uStorage.getItem('vision-model') || VISION_MODEL;
    if (!vKey) return Promise.reject(new Error('未配置视觉模型 Key'));
    // 先压缩图片（最大 1024px，JPEG 0.8）→ 大幅减少传输时间
    return compressImage(dataUrl, 1024, 0.8).then(function (compressed) {
      var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var timer = controller ? setTimeout(function () { controller.abort(); }, 20000) : null;
      return callVisionDirect(vKey, vBase, vModel, compressed, '请准确识别这张图片中的所有文字内容，保留原有格式（公式用 LaTeX 表示）。只输出识别到的文字，不要解释。')
      .catch(function (e) {
        if (timer) clearTimeout(timer);
        if (e.name === 'AbortError') throw new Error('视觉模型响应超时');
        throw e;
      });
    });
  }

  /** 读取 SSE 流，每收到一个 token 调用 onToken */
  function readStream(response, onToken) {
    console.log('[DEBUG] readStream 开始, body:', !!response.body);
    var reader = response.body.getReader();
    var decoder = new TextDecoder();
    var buf = '';
    function read() {
      return reader.read().then(function (result) {
        if (result.done) return;
        buf += decoder.decode(result.value, { stream: true });
        var lines = buf.split('\n');
        buf = lines.pop(); // 最后一行可能不完整
        for (var i = 0; i < lines.length; i++) {
          var line = lines[i].trim();
          if (!line || line === 'data: [DONE]') continue;
          if (line.indexOf('data: ') === 0) {
            try {
              var j = JSON.parse(line.slice(6));
              if (j.error) throw new Error(j.error);  // 服务端下发的错误事件
              if (j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content) {
                onToken(j.choices[0].delta.content);
              }
            } catch (e) {
              if (e.message && /模型|余额|额度|鉴权|Authentication|invalid|quota/i.test(e.message)) {
                throw e;  // 常见的 key/额度错误，抛给上层处理
              }
              // 其它解析错误忽略
            }
          }
        }
        return read();
      });
    }
    return read();
  }

  function callDeepSeek(userMsg) {
    state.isStreaming = true;
    btnSend.disabled = true;
    btnUpload.disabled = true;
    showTyping();

    var apiKey = uStorage.getItem('deepseek-api-key');
    var baseUrl = uStorage.getItem('deepseek-base-url') || BASE_URL;
    var model = uStorage.getItem('deepseek-model') || MODEL;
    var vKey = uStorage.getItem('vision-api-key');

    if (!apiKey) {
      removeTyping();
      appendAIMessage('⚠️ 未检测到对话模型 API Key。\n\n请点击右上角 ⚙️ 填入 DeepSeek Key。');
      state.isStreaming = false; btnSend.disabled = false; btnUpload.disabled = false;
      return;
    }

    // 取最近 20 条上下文
    var recent = state.messages.slice(-20);

    // ① 先把含图且未 OCR 的消息交给视觉模型（千问 VL）提取文字
    var pendingOCR = [];
    for (var i = 0; i < recent.length; i++) {
      var m = recent[i];
      if (m.images && m.images.length && !m.ocrText) {
        pendingOCR.push(m);
      }
    }
    if (pendingOCR.length && !vKey) {
      removeTyping();
      appendAIMessage('⚠️ 检测到图片，但未配置视觉模型（千问 VL）Key。\n\n请点击 ⚙️ 在「视觉模型」区填入千问 Key。');
      state.isStreaming = false; btnSend.disabled = false; btnUpload.disabled = false;
      return;
    }

    var ocrChain = Promise.resolve();
    pendingOCR.forEach(function (m) {
      ocrChain = ocrChain.then(function () {
        return ocrImage(m.images[0]).then(function (txt) {
          m.ocrText = txt;
          // 同步更新聊天区里该消息的图片下方展示 OCR 摘要
          updateMsgOcrNote(m);
          saveHistory();
        }).catch(function (e) {
          m.ocrText = '[图片识别失败：' + e.message + ']';
        });
      });
    });

    ocrChain.then(function () {
      // ② 组装纯文本 messages（图片 → OCR 文字）
      var apiMessages = [
        {
          role: 'system',
          content: '你是「AI 学习助理」，一位专业的考研辅导老师。你的任务是：\n' +
            '1. 解答数学/英语/政治/专业课问题，步骤清晰、用中文\n' +
            '2. 公式用 LaTeX 格式（如 $\\int_0^1 x^2 dx$）\n' +
            '3. 如果用户发了题目图片（会以【图片内容识别】标注），先理解题意再解答\n' +
            '4. 回答要完整：给出解题思路→详细步骤→最终答案→涉及的知识点\n' +
            '5. 如果题目信息不全，指出缺少什么条件\n' +
            '6. 保持简洁但不要敷衍，不要只回复一两个字'
        }
      ];
      for (var k = 0; k < recent.length; k++) {
        var mm = recent[k];
        var txt = mm.content || '';
        if (mm.ocrText) {
          txt = (txt ? txt + '\n\n' : '') + '【图片内容识别】\n' + mm.ocrText;
        }
        apiMessages.push({ role: mm.role, content: txt });
      }

      // ③ 转发给 DeepSeek 解答（流式输出，用户实时看到文字）
      removeTyping();
      var aiMsg = { role: 'assistant', content: '', images: [], time: new Date().toISOString() };
      state.messages.push(aiMsg);
      renderMessage(aiMsg);  // 先渲染空气泡
      var bubbleEl = chatInner.querySelector('.msg.ai:last-child .msg-bubble');

      console.log('[DEBUG] 发送请求到 DeepSeek, messages:', apiMessages.length, '条, stream:true');
      callChatDirect(apiKey, baseUrl, model, apiMessages, true)
      .then(function (r) {
        console.log('[DEBUG] DeepSeek 响应 status:', r.status, 'ok:', r.ok);
        if (!r.ok) return r.json().then(function (d) { throw new Error(d.error || r.status); });
        console.log('[DEBUG] 开始读流...');
        return readStream(r, function (token) {
          console.log('[DEBUG] 收到 token:', JSON.stringify(token));
          aiMsg.content += token;
          if (bubbleEl) bubbleEl.innerHTML = renderMarkdown(aiMsg.content);
          throttleRenderMath();
          scrollToBottom();
        });
      })
      .then(function () {
        console.log('[DEBUG] 流式结束, 总内容长度:', aiMsg.content.length);
        // 最终再完整渲染一次（清除节流残留）
        if (_mathTimer) { clearTimeout(_mathTimer); _mathTimer = null; }
        renderMath();
        state.isStreaming = false; btnSend.disabled = false; btnUpload.disabled = false;
      })
      .catch(function (err) {
        console.log('[DEBUG] 出错:', err.message, err.stack);
        // 流式中途出错：保留已收到的内容，追加错误提示
        aiMsg.content += '\n\n❌ 出错：' + err.message;
        if (bubbleEl) bubbleEl.innerHTML = renderMarkdown(aiMsg.content);
        if (_mathTimer) { clearTimeout(_mathTimer); _mathTimer = null; }
        renderMath();
        saveHistory();
        state.isStreaming = false; btnSend.disabled = false; btnUpload.disabled = false;
      });
    }).catch(function (err) {
      // OCR 阶段的未捕获错误（如超时、视觉模型未配置等）
      removeTyping();
      appendAIMessage('❌ 图片识别失败：' + err.message + '\n\n图片将以原始形式发送给对话模型尝试处理。');
      // 降级：不带 OCR 直接发（图片会被忽略，至少文字能过）
      var apiMessages = [
        {
          role: 'system',
          content: '你是「AI 学习助理」，一位专业的考研辅导老师。请用中文详细解答用户的问题，给出完整思路和步骤，公式用 LaTeX。不要只回复一两个字。'
        }
      ];
      var recent2 = state.messages.slice(-20);
      for (var k = 0; k < recent2.length; k++) {
        apiMessages.push({ role: recent2[k].role, content: recent2[k].content || '' });
      }
      removeTyping();
      var aiMsg2 = { role: 'assistant', content: '', images: [], time: new Date().toISOString() };
      state.messages.push(aiMsg2);
      renderMessage(aiMsg2);
      var bubbleEl2 = chatInner.querySelector('.msg.ai:last-child .msg-bubble');
      callChatDirect(apiKey, baseUrl, model, apiMessages, true)
      .then(function (r) {
        if (!r.ok) return r.json().then(function (d) { throw new Error(d.error || r.status); });
        return readStream(r, function (token) {
          aiMsg2.content += token;
          if (bubbleEl2) bubbleEl2.innerHTML = renderMarkdown(aiMsg2.content);
          throttleRenderMath();
          scrollToBottom();
        });
      })
      .then(function () {
        if (_mathTimer) { clearTimeout(_mathTimer); _mathTimer = null; }
        renderMath(); saveHistory(); state.isStreaming = false; btnSend.disabled = false; btnUpload.disabled = false; })
      .catch(function (e2) {
        aiMsg2.content += '\n\n❌ 出错：' + e2.message;
        if (bubbleEl2) bubbleEl2.innerHTML = renderMarkdown(aiMsg2.content);
        if (_mathTimer) { clearTimeout(_mathTimer); _mathTimer = null; }
        renderMath();
        saveHistory();
        state.isStreaming = false; btnSend.disabled = false; btnUpload.disabled = false;
      });
    });
  }

  /** OCR 完成后仅写入状态，下次渲染（或重载）即显示；不在此重渲染以免清掉打字提示 */
  function updateMsgOcrNote(msg) {
    // ocrText 已写入 msg，saveHistory 在调用处执行；此处留空即可
  }

  /* ══════════════════════════════════════
     6. 消息渲染
     ══════════════════════════════════════ */
  function renderMessages() {
    var kids = chatInner.children;
    for (var i = kids.length - 1; i >= 0; i--) {
      chatInner.removeChild(kids[i]);
    }
    if (state.messages.length > 0) {
      for (var j = 0; j < state.messages.length; j++) renderMessage(state.messages[j], false);
      scrollToBottom();
    }
  }

  function renderMessage(msg, doScroll) {
    doScroll = doScroll !== false;
    var isUser = msg.role === 'user';
    var div = document.createElement('div');
    div.className = 'msg ' + (isUser ? 'user' : 'ai');

    var avatar = document.createElement('div');
    avatar.className = 'msg-avatar';
    avatar.textContent = isUser ? '👤' : '🤖';

    var body = document.createElement('div');
    body.className = 'msg-body';

    if (msg.images && msg.images.length) {
      for (var i = 0; i < msg.images.length; i++) {
        var img = document.createElement('img');
        img.className = 'msg-img';
        img.src = msg.images[i];
        img.onclick = function () { window.open(this.src, '_blank'); };
        body.appendChild(img);
      }
    } else if (msg.hasImages) {
      var ph = document.createElement('div');
      ph.className = 'img-placeholder';
      ph.textContent = '📷 图片（刷新后不保留原图）';
      body.appendChild(ph);
    }
    // 显示 OCR 识别结果（折叠）
    if (msg.ocrText) {
        var ocr = document.createElement('details');
        ocr.className = 'msg-ocr';
        var sum = document.createElement('summary');
        sum.textContent = '📄 图片识别内容';
        var ot = document.createElement('div');
        ot.className = 'msg-ocr-text';
        ot.textContent = msg.ocrText;
        ocr.appendChild(sum);
        ocr.appendChild(ot);
        body.appendChild(ocr);
      }

    // 消息气泡（始终创建，流式输出时先显示空气泡再逐步填充）
    var bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    if (isUser) bubble.textContent = msg.content || '';
    else bubble.innerHTML = msg.content ? renderMarkdown(msg.content) : '<span class="typing-placeholder"></span>';
    body.appendChild(bubble);

    var time = document.createElement('span');
    time.className = 'msg-time';
    time.textContent = formatTime(msg.time);
    body.appendChild(time);

    div.appendChild(avatar);
    div.appendChild(body);
    chatInner.appendChild(div);
    if (doScroll) scrollToBottom();
  }

  function appendAIMessage(text) {
    var msg = { role: 'assistant', content: text, images: [], time: new Date().toISOString() };
    state.messages.push(msg);
    renderMessage(msg);
    saveHistory();
  }

  /** 触发 MathJax 渲染（带重试，因脚本可能异步加载） */
  function renderMath() {
    if (window.MathJax && window.MathJax.typesetPromise) {
      try { window.MathJax.typesetPromise(); } catch (e) {}
    } else {
      var tries = 0;
      var t = setInterval(function () {
        if (window.MathJax && window.MathJax.typesetPromise) {
          clearInterval(t);
          try { window.MathJax.typesetPromise(); } catch (e) {}
        } else if (++tries > 40) clearInterval(t);
      }, 200);
    }
  }

  /* ══════════════════════════════════════
     7. 收录流程
     ══════════════════════════════════════ */
  function handleUpload() {
    if (!state.lastQuestion && !msgInput.value.trim()) {
      showToast('请先发送一个问题或题目再收录');
      return;
    }
    openModal();
  }

  function openModal() {
    mBook.value = '';
    mReason.value = '';
    mPoints.value = '';
    mNote.value = '';
    mAnalyzing.classList.remove('show');
    modalConfirm.disabled = true;
    modalMask.classList.add('show');
    setTimeout(function () { mBook.focus(); }, 100);
  }
  function closeModal() { modalMask.classList.remove('show'); }

  function validateModal() { modalConfirm.disabled = !mBook.value; }

  function handleModalConfirm() {
    if (!mBook.value) { showToast('请选择来源'); return; }
    var book = mBook.value;
    var reason = mReason.value;
    var points = mPoints.value.trim();
    var note = mNote.value.trim();
    var qText = state.lastQuestion ? state.lastQuestion.content : '';
    var qImg = state.lastQuestion && state.lastQuestion.images ? state.lastQuestion.images[0] : null;

    if (!points) analyzeAndSave(book, reason, note, qText, qImg);
    else doSave(book, reason, points, note, qText, qImg);
  }

  /** 调 AI 分析知识点后再入库（图片先走视觉模型 OCR） */
  function analyzeAndSave(book, reason, note, qText, qImg) {
    mAnalyzing.classList.add('show');
    modalConfirm.disabled = true;
    var apiKey = uStorage.getItem('deepseek-api-key');
    var baseUrl = uStorage.getItem('deepseek-base-url') || BASE_URL;
    var model = uStorage.getItem('deepseek-model') || MODEL;
    if (!apiKey) { mAnalyzing.classList.remove('show'); showToast('未设置 API Key'); return; }

    // 图片先 OCR
    var ocrPromise = qImg
      ? ocrImage(qImg).catch(function (e) { return '[图片识别失败：' + e.message + ']'; })
      : Promise.resolve('');

    ocrPromise.then(function (ocrTxt) {
      var fullText = (qText || '') + (ocrTxt ? '\n\n【图片内容】\n' + ocrTxt : '');
      var content = '请分析以下题目涉及的知识点（用中文逗号分隔，最多5个），只返回知识点列表本身，不要其他解释：\n\n' + fullText;

      callChatDirect(apiKey, baseUrl, model, [{ role: 'user', content: content }], false)
      .then(function (r) {
        if (!r.ok) return r.json().then(function (d) { throw new Error(d.error || r.status); });
        return r.json();
      })
      .then(function (data) {
        mAnalyzing.classList.remove('show');
        var analyzed = '';
        if (data.choices && data.choices[0]) {
          analyzed = data.choices[0].message.content.trim()
            .replace(/^[：:\s]+/, '').replace(/[；;。，,\s]+$/, '');
        }
        if (!analyzed) analyzed = '待分类';
        mPoints.value = analyzed;
        modalConfirm.disabled = false;
        showToast('已识别知识点：' + analyzed + '，请确认后点击收录');
      })
      .catch(function (err) {
        mAnalyzing.classList.remove('show');
        showToast('知识点分析失败：' + err.message + '\n你可以手动填写知识点');
        modalConfirm.disabled = false;
      });
    });
  }

  /** 实际入库 */
  function doSave(book, reason, points, note, qText, qImg) {
    var record = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      problem: qText || '[图片题目]',
      answer: '',
      solution: '',
      book: book,
      reason: reason || null,
      knowledgePoints: points ? points.split(/[,，]/).map(function (s) { return s.trim(); }) : [],
      note: note || null,
      status: '攻克中',
      wrongCount: 1,
      resolvedCount: 0,
      source: '💬',
      from: 'AI学习助理',
      image: qImg || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (typeof MathStore !== 'undefined') MathStore.addMistake(record);
    else {
      var key = 'mathMistakes_v1';
      var raw = uStorage.getItem(key);
      var list = [];
      try { list = raw ? JSON.parse(raw) : []; } catch (e) { list = []; }
      list.push(record);
      uStorage.setItem(key, JSON.stringify(list));
    }

    closeModal();
    showToast('✅ 已收录到「' + book + '」');
    appendAIMessage('📥 已将本题收录到错题本（来源：' + book
      + (points ? '，知识点：' + points : '') + '）。继续问我就行！');
    // 通知父框架（数学中心）有新收录，点亮归纳总结徽标
    try { if (window.parent && window.parent !== window) window.parent.postMessage({ type: "newMistake" }, "*"); } catch (e) {}
  }

  /* ══════════════════════════════════════
     8. UI 工具
     ══════════════════════════════════════ */
  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () { toastEl.classList.remove('show'); }, 2600);
  }
  showToast._t = 0;

  function scrollToBottom() {
    requestAnimationFrame(function () { chatArea.scrollTop = chatArea.scrollHeight; });
  }

  function formatTime(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    var p = function (n) { return n < 10 ? '0' + n : '' + n; };
    return p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function showTyping() {
    var el = document.createElement('div');
    el.className = 'msg ai';
    el.id = 'typingIndicator';
    el.innerHTML = '<div class="msg-avatar">🤖</div><div class="typing"><span></span><span></span><span></span></div>';
    chatInner.appendChild(el);
    scrollToBottom();
  }
  function removeTyping() {
    var el = document.getElementById('typingIndicator');
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function autoResizeInput() {
    msgInput.style.height = 'auto';
    msgInput.style.height = Math.min(msgInput.scrollHeight, 130) + 'px';
  }

  function checkConnection() {
    var isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.hostname === '';
    var hasApiKey = !!(localStorage.getItem('deepseek-api-key') || '');
    if (!isLocal) {
      // GitHub Pages / 线上环境：走浏览器直连，不依赖本地代理
      connDot.style.background = hasApiKey ? '#22c55e' : '#fbbf24';
      connText.textContent = hasApiKey ? '云端直连' : '未配置 Key';
      return;
    }
    // 本地环境：检测 capture-server 代理
    fetch('/api/health', { method: 'GET' })
      .then(function (r) {
        if (r.ok) {
          connDot.style.background = '#22c55e';
          connText.textContent = '已连接';
        } else { connDot.style.background = '#fbbf24'; connText.textContent = '服务异常'; }
      })
      .catch(function () {
        connDot.style.background = '#ef4444';
        connText.textContent = '未连接（需启动服务）';
      });
  }

  /* ══════════════════════════════════════
     9. 轻量 Markdown + LaTeX 渲染
     ══════════════════════════════════════ */
  function renderMarkdown(text) {
    if (!text) return '';
    // 先转义 HTML 特殊字符（但保留我们后面要生成的标签）
    var s = text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // ── 保护 LaTeX 块不被后续 Markdown 规则破坏 ──
    var latexPlaceholders = [];
    // 保护行间公式 $$...$$
    s = s.replace(/\$\$([\s\S]+?)\$\$/g, function (_, tex) {
      var idx = latexPlaceholders.length;
      latexPlaceholders.push('$$' + tex + '$$');
      return '\x00LDBL' + idx + '\x00';
    });
    // 保护行内公式 $...$（匹配非贪婪，排除已处理的 $$）
    s = s.replace(/\$([^\$\n]+?)\$/g, function (_, tex) {
      var idx = latexPlaceholders.length;
      latexPlaceholders.push('$' + tex + '$');
      return '\x00LINL' + idx + '\x00';
    });

    // ── Markdown 渲染（在受保护的文本上操作）──
    s = s
      .replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code class="lang-$1">$2</code></pre>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`\n]+)`/g, '<code>$1</code>');

    // 列表：识别连续的 <li> 行，包入 <ul>
    s = s.replace(/((?:<li>.*<\/?(?:br|p)?>?\n?)+)/g, '<ul>$1</ul>');
    // 有序列表同理
    s = s.replace(/(<li>\d+\. .*<\/?(?:br|p)?>?\n?)+/g, '<ol>$&</ol>');

    // 段落与换行
    s = s.replace(/\n\n+/g, '</p><p>');
    s = s.replace(/\n/g, '<br>');

    // ── 恢复 LaTeX 占位符 ──
    s = s.replace(/\x00LDBL(\d+)\x00/g, function (_, idx) {
      return latexPlaceholders[parseInt(idx)];
    });
    s = s.replace(/\x00LINL(\d+)\x00/g, function (_, idx) {
      return latexPlaceholders[parseInt(idx)];
    });

    return '<p>' + s + '</p>';
  }

  /** 流式输出期间节流触发 MathJax（避免每 token 都 typeset） */
  var _mathTimer = null;
  function throttleRenderMath() {
    if (_mathTimer) return;
    _mathTimer = setTimeout(function () {
      _mathTimer = null;
      renderMath();
    }, 300);  // 每 300ms 至多渲染一次
  }

  /* ══════════════════════════════════════
     启动
     ══════════════════════════════════════ */
  init();

})();
