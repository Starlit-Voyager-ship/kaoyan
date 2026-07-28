/* ===== 考研学习中心 · GitHub Gist 跨设备同步（按账号隔离） =====
 * 用法：页面右下角出现「☁️ 同步」按钮，输入 GitHub Personal Access Token 即可上传/下载。
 * 每个账号的数据保存在独立的 private Gist 文件中（kaoyan-data-<昵称>.json），互不干扰。
 *
 * 自动同步（每天多次双向合并）：
 *  - 登录且已填 Token 后，页面加载 8 秒后首次同步，之后每 30 分钟再同步一次。
 *  - 双向合并：本地 -> Gist（推送做题/查词），Gist -> 本地（拉取夜间自动化写回的日报/周总结）。
 *  - 合并而非替换，避免覆盖自动化在 Gist 上写入的 dailyReport_/weeklyReport_ 等键。
 */
(function(){
  const user = (typeof window !== 'undefined' && window.getCurrentUser) ? window.getCurrentUser() : '';
  if (!user) return; // 未登录不注入同步按钮

  const DATA_FILE = 'kaoyan-data-' + user + '.json';
  const TOKEN_KEY = 'kaoyan-gist-token';
  const GIST_ID_KEY = 'kaoyan-gist-id-' + user;

  function getToken(){ return localStorage.getItem(TOKEN_KEY) || ''; }
  function setToken(t){ localStorage.setItem(TOKEN_KEY, t); }
  function getGistId(){ return localStorage.getItem(GIST_ID_KEY) || ''; }
  function setGistId(id){ localStorage.setItem(GIST_ID_KEY, id); }

  async function gh(method, path, body, token){
    const headers = {
      'Accept': 'application/vnd.github+json',
      'Authorization': 'Bearer ' + token,
      'X-GitHub-Api-Version': '2022-11-28'
    };
    const opts = { method, headers };
    if(body){
      headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const r = await fetch('https://api.github.com' + path, opts);
    const txt = await r.text();
    if(!r.ok) throw new Error('GitHub ' + r.status + ': ' + txt.slice(0,200));
    return txt ? JSON.parse(txt) : {};
  }

  async function findGistId(token){
    let id = getGistId();
    if(id) return id;
    const list = await gh('GET', '/gists', null, token);
    const found = (list || []).find(g => g.files && g.files[DATA_FILE]);
    if(found){ setGistId(found.id); return found.id; }
    return '';
  }

  // 返回 DATA_FILE 的解析后对象；不存在返回 null
  async function loadGistObj(token){
    const id = await findGistId(token);
    if(!id) return null;
    const g = await gh('GET', '/gists/' + id, null, token);
    const f = g.files && g.files[DATA_FILE];
    if(f && f.content) return JSON.parse(f.content);
    return null;
  }

  async function saveGistContent(token, obj, retries){
    if(retries === undefined) retries = 4;
    let content = JSON.stringify(obj);
    const id = await findGistId(token);
    for(let attempt = 0; attempt <= retries; attempt++){
      try {
        if(id){
          const g = await gh('PATCH', '/gists/' + id, {
            files: { [DATA_FILE]: { content } },
            description: '考研学习中心数据同步 - ' + user
          }, token);
          setGistId(g.id);
          return g;
        }
        const g = await gh('POST', '/gists', {
          files: { [DATA_FILE]: { content } },
          public: false,
          description: '考研学习中心数据同步 - ' + user
        }, token);
        setGistId(g.id);
        return g;
      } catch(e){
        // GitHub Gist 乐观锁：并发写同一文件返回 409（如 30 分钟自动同步 vs 19:20/19:30 自动化）。
        // 重新读取最新内容合并后再写，避免后写覆盖先写导致数据丢失。
        if(attempt < retries && /409/.test(e.message || '')){
          try {
            const fresh = await loadGistObj(token);
            if(fresh && typeof fresh === 'object'){
              for(const k in fresh){ if(!(k in obj)) obj[k] = fresh[k]; }
              content = JSON.stringify(obj);
            }
          } catch(_) {}
          continue;
        }
        throw e;
      }
    }
  }

  function collectData(){
    const data = {};
    const prefix = 'user:' + user + ':';
    for(let i=0; i<localStorage.length; i++){
      const k = localStorage.key(i);
      if(k && k.indexOf(prefix) === 0){
        data[k] = localStorage.getItem(k);
      }
    }
    return data;
  }

  function applyData(data){
    if(!data || typeof data !== 'object') return;
    const prefix = 'user:' + user + ':';
    for(const k in data){
      if(k.indexOf(prefix) === 0) localStorage.setItem(k, data[k]);
    }
  }

  // 同步合并策略（核心）：云端大于本地 —— 先以云端 Gist 为准，再用本地独有内容补缺。
  // 背景：此前对非空集合键是「本地整体覆盖云端」，导致朋友上传文章时把云端文章整段吃掉。
  // 现在对「集合型键」一律按业务键去重做「云端优先、本地补缺」合并，
  // 其余非集合键（标量/日报/周报）仍沿用 Gist 优先、本地非空才覆盖的安全规则。
  function isEmptyVal(v){ return v === null || v === undefined || v === '' || v === '[]' || v === '{}'; }

  // 集合型数组键（文章 / 数学题库·错题·薄弱点 / 查词记录 / 聊天答疑），按业务键去重
  function isSetArrayKey(k){
    return /:(articlesExtra_v1|mathAutoBank_v1|mathDailyWrong_v1|mathWeaks_v1|my-word-lookup-log|focusSessions_v1)$/.test(k)
        || /:chatLog_\d{4}-\d{2}-\d{2}$/.test(k);
  }
  // 词汇总表（二维数组，第一列为单词），按 word 去重
  function isVocabDataKey(k){ return /:vocab-quiz-data-v1$/.test(k); }
  // 映射型对象键（学习进度 / 已解决薄弱点 / 专注类目配色），按 key 去重
  function isMapKey(k){ return /:(vocab-quiz-learn-v1|mathWeakResolved_v1|focusColors_v1)$/.test(k); }

  // 取集合元素的去重键：二维数组取首元素(单词)；对象取 no|date|q|id 等
  function setItemKey(it){
    if(Array.isArray(it)) return String(it[0] ?? '');
    if(it && typeof it === 'object'){
      return (it.no || '') + '|' + (it.date || '') + '|' + (it.q || it.kp || it.id || JSON.stringify(it));
    }
    return String(it);
  }

  // 数组集合合并：云端优先，本地补云端没有的；同键冲突云端胜（云端大于本地）
  function mergeSetArray(gistRaw, localRaw){
    let g = [], l = [];
    try { g = JSON.parse(gistRaw) || []; } catch(e){ g = []; }
    try { l = JSON.parse(localRaw) || []; } catch(e){ l = []; }
    if(!Array.isArray(g)) g = [];
    if(!Array.isArray(l)) l = [];
    const map = new Map();
    g.forEach(it => map.set(setItemKey(it), it));                       // 先放云端
    l.forEach(it => { const kk = setItemKey(it); if(!map.has(kk)) map.set(kk, it); }); // 本地补缺
    return JSON.stringify(Array.from(map.values()));
  }

  // 对象集合合并（如学习进度 map）：云端优先，本地补缺失 key
  function mergeSetMap(gistRaw, localRaw){
    let g = {}, l = {};
    try { g = JSON.parse(gistRaw) || {}; } catch(e){ g = {}; }
    try { l = JSON.parse(localRaw) || {}; } catch(e){ l = {}; }
    const out = {};
    for(const kk in g) out[kk] = g[kk];                       // 云端优先
    for(const kk in l){ if(!(kk in out)) out[kk] = l[kk]; }  // 本地补缺
    return JSON.stringify(out);
  }

  // 双向合并主函数：先按 Gist 优先填充，再对集合型键做云端优先补缺合并
  function mergeNonDestructive(gistObj, local){
    const merged = {};
    const g = gistObj || {};
    const l = local || {};
    // 1) 非集合标量/单向键：Gist 先入，本地非空才覆盖；本地空不覆盖 Gist 真值
    for(const k in g) merged[k] = g[k];
    for(const k in l){
      const lv = l[k];
      if(isEmptyVal(lv)){
        if(!(k in merged) || isEmptyVal(merged[k])) merged[k] = lv;
        // 否则保留 merged（Gist 真值）
      } else {
        merged[k] = lv;
      }
    }
    // 2) 集合型键二次纠正：两端都非空时改为「云端优先 + 本地补缺」，避免本地整体覆盖云端
    for(const k in merged){
      if(!(k in g) || isEmptyVal(g[k])) continue;   // 云端为空则维持本地（首次上传）
      if(!(k in l) || isEmptyVal(l[k])) continue;   // 本地为空则维持云端
      if(isMapKey(k)){
        merged[k] = mergeSetMap(g[k], l[k]);
      } else if(isSetArrayKey(k) || isVocabDataKey(k)){
        merged[k] = mergeSetArray(g[k], l[k]);
      }
    }
    return merged;
  }

  window.KaoyanSync = {
    DATA_FILE, TOKEN_KEY, GIST_ID_KEY,
    getToken, setToken, getGistId, setGistId,
    loadGistObj, saveGistContent, collectData, applyData,
    // 手动上传：本地合并进 Gist（保留 Gist 上自动化写入的键）
    async syncToCloud(token){
      token = (token || getToken()).trim();
      if(!token) throw new Error('请输入 GitHub Token');
      const local = collectData();
      const gistObj = await loadGistObj(token) || {};
      const merged = mergeNonDestructive(gistObj, local);
      await saveGistContent(token, merged);
      setToken(token);
      return { ok: true, action: 'upload' };
    },
    // 手动下载：Gist 合并进本地
    async syncFromCloud(token){
      token = (token || getToken()).trim();
      if(!token) throw new Error('请输入 GitHub Token');
      const gistObj = await loadGistObj(token);
      if(!gistObj) throw new Error('云端没有找到 ' + DATA_FILE + '，请先用本账号上传一次。');
      applyData(gistObj);
      setToken(token);
      return { ok: true, action: 'download' };
    },
    // 自动同步：双向合并（local→Gist 且 Gist 独有键→local）
    async autoSync(token){
      token = (token || getToken()).trim();
      if(!token) throw new Error('no_token');
      const local = collectData();
      const gistObj = await loadGistObj(token) || {};
      const merged = mergeNonDestructive(gistObj, local);
      await saveGistContent(token, merged);
      applyData(merged); // 把 Gist 上的日报/周总结等独有键拉回本地
      setToken(token);
      return { ok: true, action: 'auto', keys: Object.keys(merged).length };
    }
  };

  function injectSyncButton(){
    if(window !== window.top) return;
    if(document.getElementById('kaoyan-sync-fab')) return;

    const wrap = document.createElement('div');
    wrap.id = 'kaoyan-sync-fab';
    wrap.style.cssText = 'position:fixed;bottom:18px;right:18px;z-index:99999;font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;';
    wrap.innerHTML = `
      <button id="kaoyan-sync-btn" title="跨设备同步（${user}）" style="
        width:56px;height:56px;border-radius:50%;border:none;background:linear-gradient(135deg,#6366f1,#0ea5e9);
        color:#fff;font-size:22px;cursor:pointer;box-shadow:0 6px 18px rgba(99,102,241,.35);transition:transform .15s;
        display:flex;align-items:center;justify-content:center;">☁️</button>
      <div id="kaoyan-sync-card" style="
        display:none;position:absolute;bottom:68px;right:0;width:280px;background:#fff;border:1px solid #e6e9f0;
        border-radius:16px;padding:14px;box-shadow:0 10px 30px rgba(31,39,51,.12);">
        <div style="font-size:13px;font-weight:700;color:#1f2733;margin-bottom:8px;">☁️ 跨设备同步 · 账号 <b>${user}</b></div>
        <input id="kaoyan-sync-token" type="password" placeholder="粘贴 GitHub Token" style="
          width:100%;padding:8px 10px;border:1px solid #e6e9f0;border-radius:10px;font-size:12px;margin-bottom:8px;box-sizing:border-box;">
        <div style="display:flex;gap:6px;">
          <button id="kaoyan-sync-up" style="flex:1;padding:7px 0;border-radius:8px;border:none;background:#6366f1;color:#fff;font-size:12px;cursor:pointer;font-weight:700;">上传</button>
          <button id="kaoyan-sync-down" style="flex:1;padding:7px 0;border-radius:8px;border:none;background:#eef0ff;color:#4338ca;font-size:12px;cursor:pointer;font-weight:700;">下载</button>
        </div>
        <div id="kaoyan-sync-status" style="font-size:11px;color:#7a869a;margin-top:8px;min-height:16px;"></div>
        <div style="font-size:10px;color:#94a3b8;margin-top:8px;line-height:1.5;">每账号 Gist 文件独立；Token 只存浏览器本地。数据每 30 分钟自动同步，无需手动点。</div>
      </div>
    `;
    document.body.appendChild(wrap);

    const btn = document.getElementById('kaoyan-sync-btn');
    const card = document.getElementById('kaoyan-sync-card');
    const tokenInput = document.getElementById('kaoyan-sync-token');
    const status = document.getElementById('kaoyan-sync-status');

    tokenInput.value = getToken();

    btn.addEventListener('click', () => {
      card.style.display = card.style.display === 'none' ? 'block' : 'none';
    });

    document.getElementById('kaoyan-sync-up').addEventListener('click', async () => {
      status.textContent = '上传中…';
      try{
        await KaoyanSync.syncToCloud(tokenInput.value);
        status.textContent = '✅ 已上传到 Gist';
      }catch(e){
        status.textContent = '❌ ' + e.message;
      }
    });

    document.getElementById('kaoyan-sync-down').addEventListener('click', async () => {
      status.textContent = '下载中…';
      try{
        await KaoyanSync.syncFromCloud(tokenInput.value);
        status.textContent = '✅ 已下载，刷新页面生效';
      }catch(e){
        status.textContent = '❌ ' + e.message;
      }
    });
  }

  // 自动同步调度：仅当已填 Token
  let _autoStarted = false;
  function scheduleAutoSync(){
    if(window !== window.top) return; // iframe 内不重复启动自动同步，避免顶层+各 iframe 多实例重复写 Gist
    if(_autoStarted) return;
    if(!getToken()) return;
    _autoStarted = true;
    const doSync = async () => {
      try { await window.KaoyanSync.autoSync(); } catch(e){ /* 静默失败，下次重试 */ }
    };
    setTimeout(doSync, 8000);
    setInterval(doSync, 30 * 60 * 1000);
  }
  // 手动同步后如果用户首次填了 Token，也启动自动同步
  function ensureAutoAfterToken(){
    if(getToken()) scheduleAutoSync();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', () => { injectSyncButton(); scheduleAutoSync(); });
  }else{
    injectSyncButton();
    scheduleAutoSync();
  }
  // 暴露一个在手动填 token 后触发自动同步的钩子
  window.__kaoyanEnsureAuto = ensureAutoAfterToken;
})();
