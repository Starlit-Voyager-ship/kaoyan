/* ============================================================
   学习宠物 · 桌面宠物组件（嵌入考研学习中心父页面）
   - 浮动在页面之上（position:fixed），切换 tab 一直显示
   - 数据按账号隔离（使用 account.js 的 uStorage）
   - 入口按钮固定在左下角「账号切换」上方
   ============================================================ */
(function () {
  'use strict';

  /* ============ 样式（仅组件级） ============ */
  var CSS = [
    ':root{--indigo:#6366f1;--sky:#0ea5e9;--green:#22c55e;--red:#ef4444;--gray:#cbd5e1;--ink:#1e293b;--muted:#64748b;--card:#fff;}',
    '/* === 宠物本体 === */',
    '#pet{position:fixed;z-index:9999;width:130px;height:150px;display:none;cursor:grab;user-select:none;touch-action:none;filter:drop-shadow(0 6px 14px rgba(0,0,0,.18));}',
    '#pet.dragging{cursor:grabbing;}',
    '#pet img{width:100%;height:100%;object-fit:contain;image-rendering:pixelated;transform:scaleX(var(--dir,1));transition:transform .2s;background:transparent;min-height:40px;}',
    '#pet.aimes.walking img{animation:pet-bob .45s ease-in-out infinite;}',
    '@keyframes pet-bob{0%,100%{transform:translateY(0) scaleX(var(--dir,1));}50%{transform:translateY(-3px) scaleX(var(--dir,1));}}',
    '#pet.bear img{animation:bear-idle 2.2s ease-in-out infinite;}',
    '@keyframes bear-idle{0%,100%{transform:translateY(0) rotate(0deg) scaleX(var(--dir,1));}25%{transform:translateY(-2px) rotate(1deg) scaleX(var(--dir,1));}75%{transform:translateY(-1px) rotate(-1deg) scaleX(var(--dir,1));}}',
    '#pet.bear.walking img{animation:bear-walk .38s ease-in-out infinite;}',
    '@keyframes bear-walk{0%,100%{transform:translateY(0) scaleY(1) scaleX(var(--dir,1));}30%{transform:translateY(-7px) scaleY(1.04) scaleX(var(--dir,1));}60%{transform:translateY(0) scaleY(.96) scaleX(var(--dir,1));}}',
    '#pet.bear.dragging img{animation:none;transform:scale(1.08) scaleX(var(--dir,1));}',
    '#pet.bear.hugging img{animation:bear-hug .5s ease-in-out 3;}',
    '@keyframes bear-hug{0%,100%{transform:rotate(0deg) scaleX(var(--dir,1));}33%{transform:rotate(-8deg) scale(1.05) scaleX(var(--dir,1));}66%{transform:rotate(8deg) scale(1.05) scaleX(var(--dir,1));}}',
    '#pet .shadow{position:absolute;bottom:-6px;left:10%;width:80%;height:12px;border-radius:50%;background:rgba(0,0,0,.15);filter:blur(4px);}',
    '#pet .bubble{position:absolute;top:-48px;left:50%;transform:translateX(-50%);background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:6px 12px;font-size:13px;max-width:200px;white-space:normal;line-height:1.5;text-align:center;box-shadow:0 4px 12px rgba(0,0,0,.12);opacity:0;transition:.25s;pointer-events:none;}',
    '#pet .bubble.show{opacity:1;}',
    '/* === 入口按钮（左下角账号条上方） === */',
    '#petEntry{position:fixed;left:14px;bottom:58px;z-index:9998;display:flex;align-items:center;gap:8px;border:none;background:linear-gradient(135deg,#ec4899,#a855f7);color:#fff;padding:10px 16px;border-radius:999px;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 8px 22px rgba(236,72,153,.42);animation:petfloaty 2.2s ease-in-out infinite;}',
    '@keyframes petfloaty{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}',
    '/* === 抽屉面板 === */',
    '#panel{position:fixed;top:0;right:0;height:100%;width:360px;max-width:92vw;z-index:9998;background:var(--card);box-shadow:-10px 0 30px rgba(0,0,0,.12);transform:translateX(105%);transition:transform .3s ease;display:flex;flex-direction:column;font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;color:var(--ink);}',
    '#panel.open{transform:translateX(0);}',
    '.p-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:14px 16px;border-bottom:1px solid #f1f5f9;flex-wrap:wrap;}',
    '.p-title{font-size:17px;font-weight:700;display:flex;align-items:center;gap:8px;}',
    '.p-title input{border:none;border-bottom:2px dashed var(--gray);width:80px;font-size:16px;font-weight:700;outline:none;}',
    '.lvl{background:linear-gradient(135deg,#ec4899,#a855f7);color:#fff;font-size:11px;font-weight:700;padding:2px 9px;border-radius:999px;}',
    '.coins{display:flex;align-items:center;gap:5px;font-weight:700;color:#ea580c;background:#fff7ed;border:1px solid #fed7aa;padding:4px 10px;border-radius:999px;font-size:14px;}',
    '.p-close{border:none;background:#f1f5f9;border-radius:10px;width:34px;height:34px;font-size:18px;cursor:pointer;color:var(--muted);}',
    '.p-body{padding:14px 16px;overflow-y:auto;flex:1;}',
    '.stats{display:grid;grid-template-columns:1fr 1fr;gap:9px 14px;margin-bottom:14px;}',
    '.stat{display:flex;align-items:center;gap:7px;font-size:13px;}',
    '.stat .ico{width:20px;text-align:center;}',
    '.stat .lab{width:36px;color:var(--muted);}',
    '.bar{flex:1;height:9px;background:#eef1f6;border-radius:999px;overflow:hidden;}',
    '.bar>i{display:block;height:100%;border-radius:999px;transition:width .4s;}',
    '.tabs{display:flex;gap:6px;margin:6px 0 14px;}',
    '.tab{flex:1;text-align:center;padding:9px 4px;border-radius:10px;cursor:pointer;background:#eef1f6;color:var(--muted);font-weight:600;font-size:13px;border:1px solid transparent;transition:all .15s;}',
    '.tab:hover{background:#f0e6f6;}',
    '.tab.active{background:#fdf4ff;color:#a855f7;border-color:#f9a8d4;font-weight:700;}',
    '.panel{display:none;}.panel.active{display:block;}',
    '/* === 照顾 tab === */',
    '.care-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;}',
    '.care-btn{border:1px solid #e2e8f0;background:#f8fafc;border-radius:12px;padding:14px;text-align:left;font-size:14px;font-weight:600;cursor:pointer;color:var(--ink);transition:all .15s;}',
    '.care-btn small{display:block;color:var(--muted);font-weight:500;font-size:11px;margin-top:4px;}',
    '.care-btn:hover{border-color:#ec4899;background:#fdf4ff;transform:translateY(-1px);}',
    '/* === 商店 tab === */',
    '.shop-section-title{font-size:13px;font-weight:700;color:var(--muted);margin:8px 0 6px;padding-bottom:4px;border-bottom:1px solid #f1f5f9;}',
    '.shop-section-title:first-child{margin-top:0;}',
    '.shop{display:grid;grid-template-columns:1fr 1fr;gap:9px;}',
    '.item{border:1px solid #e2e8f0;border-radius:12px;padding:10px;text-align:center;background:#f8fafc;transition:all .15s;}',
    '.item:hover{border-color:#f9a8d4;box-shadow:0 2px 8px rgba(0,0,0,.06);}',
    '.item .ic{font-size:28px;}',
    '.item .nm{font-weight:700;font-size:13px;margin-top:2px;}',
    '.item .ds{font-size:11px;color:var(--muted);min-height:26px;margin-top:2px;}',
    '.item button{margin-top:6px;border:none;border-radius:9px;padding:6px 12px;font-weight:700;background:linear-gradient(135deg,#ec4899,#a855f7);color:#fff;font-size:12px;cursor:pointer;transition:all .15s;}',
    '.item button:hover{transform:scale(1.05);}',
    '.item button:disabled{background:var(--gray);cursor:not-allowed;transform:none;}',
    '.item.owned{border-color:#bbf7d0;background:#f0fdf4;}',
    '.item.owned button{background:var(--green);}',
    '.item .equip{background:var(--sky);}',
    '/* === 学习 tab === */',
    '.earn-info{display:grid;gap:8px;margin-bottom:10px;}',
    '.earn-card{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 14px;border:1px solid #e2e8f0;border-radius:11px;background:linear-gradient(135deg,#f8fafc,#f0f9ff);}',
    '.earn-card .left{display:flex;align-items:center;gap:8px;}',
    '.earn-card .icon{font-size:22px;}',
    '.earn-card .info{font-size:13px;}',
    '.earn-card .info b{display:block;font-size:14px;color:var(--ink);}',
    '.earn-card .info span{color:var(--muted);font-size:11px;}',
    '.earn-card .rate{font-size:14px;font-weight:700;color:#ea580c;white-space:nowrap;background:#fff7ed;padding:3px 10px;border-radius:999px;border:1px solid #fed7aa;}',
    '.study-summary{background:linear-gradient(135deg,#eef2ff,#fdf4ff);border:1px solid #c7d2fe;border-radius:12px;padding:12px;font-size:13px;line-height:1.8;}',
    '.study-summary b{color:#6366f1;}',
    '.auto-care-status{display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:10px;font-size:13px;margin-bottom:8px;transition:all .2s;}',
    '.auto-care-status.on{background:#f0fdf4;border:1px solid #bbf7d0;color:#15803d;}',
    '.auto-care-status.off{background:#f8fafc;border:1px solid #e2e8f0;color:var(--muted);}',
    '.auto-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;}',
    '.on .auto-dot{background:#22c55e;box-shadow:0 0 6px #22c55e66;}',
    '.off .auto-dot{background:#cbd5e1;}',
    '/* === 设置 tab === */',
    '.set-row{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:14px;}',
    '.set-row:last-child{border-bottom:none;}',
    '.set-row input{border:1px solid #e2e8f0;border-radius:8px;padding:4px 8px;font-size:14px;outline:none;width:90px;}',
    '.set-row select{border:1px solid #e2e8f0;border-radius:8px;padding:4px 8px;font-size:14px;outline:none;background:#fff;}',
    '.switch{position:relative;width:44px;height:24px;flex-shrink:0;}',
    '.switch input{opacity:0;width:0;height:0;}',
    '.switch .slider{position:absolute;inset:0;background:#cbd5e1;border-radius:24px;cursor:pointer;transition:.2s;}',
    '.switch .slider::before{content:"";position:absolute;height:18px;width:18px;left:3px;bottom:3px;background:#fff;border-radius:50%;transition:.2s;}',
    '.switch input:checked+.slider{background:#22c55e;}',
    '.switch input:checked+.slider::before{transform:translateX(20px);}',
    '.danger{background:var(--red);color:#fff;border:none;border-radius:9px;padding:8px 16px;font-weight:700;cursor:pointer;transition:all .15s;}',
    '.danger:hover{background:#dc2626;}',
    '/* === 事件日志 === */',
    '.event-log{max-height:140px;overflow-y:auto;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px;margin-top:8px;font-size:12px;line-height:1.7;}',
    '.event-log .empty{color:var(--muted);text-align:center;padding:12px 0;}',
    '.event-log-item{padding:3px 0;border-bottom:1px dashed #f1f5f9;display:flex;gap:6px;align-items:flex-start;}',
    '.event-log-item:last-child{border-bottom:none;}',
    '.event-log-item .time{color:var(--muted);white-space:nowrap;font-size:11px;}',
    '.event-log-item .msg{flex:1;}',
    '.event-log-item.auto{color:#059669;}',
    '.hint{font-size:12px;color:var(--muted);line-height:1.6;margin-top:8px;}',
    '.hint code{background:#f1f5f9;padding:1px 5px;border-radius:4px;font-size:11px;}',
    '#toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%) translateY(20px);background:var(--ink);color:#fff;padding:10px 18px;border-radius:11px;font-size:14px;opacity:0;pointer-events:none;transition:.3s;z-index:10000;max-width:320px;text-align:center;line-height:1.4;}',
    '#toast.show{opacity:1;transform:translateX(-50%) translateY(0);}',
    '/* === 宠物选择弹窗 === */',
    '#pickModal{position:fixed;inset:0;z-index:10002;background:rgba(0,0,0,.45);display:none;align-items:center;justify-content:center;backdrop-filter:blur(4px);}',
    '#pickModal.open{display:flex;}',
    '.pick-inner{background:#fff;border-radius:24px;padding:28px 24px;max-width:420px;width:92vw;box-shadow:0 24px 60px rgba(0,0,0,.2);text-align:center;}',
    '.pick-inner h2{margin:0 0 4px;font-size:20px;color:var(--ink);}',
    '.pick-inner p{margin:0 0 20px;color:var(--muted);font-size:14px;}',
    '.pick-options{display:flex;gap:16px;justify-content:center;}',
    '.pick-card{width:150px;border:2px solid #e2e8f0;border-radius:18px;padding:16px 12px;cursor:pointer;transition:all .2s;text-align:center;background:#fafbfc;}',
    '.pick-card:hover{border-color:#a855f7;transform:translateY(-4px);box-shadow:0 8px 24px rgba(168,85,247,.15);}',
    '.pick-card.selected{border-color:#a855f7;background:#fdf4ff;box-shadow:0 0 0 3px rgba(168,85,247,.2);}',
    '.pick-card .preview{width:110px;height:110px;margin:0 auto 10px;border-radius:14px;overflow:hidden;background:linear-gradient(135deg,#f0e6f6,#eef2f7);display:flex;align-items:center;justify-content:center;}',
    '.pick-card .preview img{width:90px;height:90px;object-fit:contain;}',
    '.pick-card .name{font-size:16px;font-weight:700;color:var(--ink);}',
    '.pick-card .desc{font-size:11px;color:var(--muted);margin-top:4px;}',
    '.pick-confirm{margin-top:22px;}',
    '.pick-confirm button{width:100%;padding:12px;border:none;border-radius:14px;font-size:16px;font-weight:700;color:#fff;background:linear-gradient(135deg,#ec4899,#a855f7);cursor:pointer;box-shadow:0 8px 22px rgba(236,72,153,.35);transition:all .15s;}',
    '.pick-confirm button:hover{transform:translateY(-1px);box-shadow:0 10px 28px rgba(236,72,153,.45);}',
    '.pick-confirm button:disabled{background:var(--gray);box-shadow:none;cursor:not-allowed;transform:none;}',
    '@keyframes rise{0%{opacity:1;transform:translateY(0)}100%{opacity:0;transform:translateY(-50px)}}'
  ].join('\n');
  var se = document.createElement('style');
  se.textContent = CSS;
  document.head.appendChild(se);

  /* ============ DOM 结构（动态注入） ============ */
  var DOM = [
    '<button id="petEntry">✨ 领取宠物</button>',
    '<div id="pet">',
    '  <div class="bubble" id="bubble"></div>',
    '  <img id="petImg" src="" alt="宠物" draggable="false">',
    '  <div class="shadow"></div>',
    '</div>',
    '<div id="pickModal">',
    '  <div class="pick-inner">',
    '    <h2>🌸 选择你的伙伴</h2>',
    '    <p>每位同学只能领养一只宠物哦～选个喜欢的吧！</p>',
    '    <div class="pick-options">',
    '      <div class="pick-card" data-species="aimes">',
    '        <div class="preview"><img src="学习宠物/gifs/ameath_content.png" alt="爱弥丝"></div>',
    '        <div class="name">🌸 爱弥丝</div>',
    '        <div class="desc">来自鸣潮的电子精灵<br>GIF 动画 · 活泼可爱</div>',
    '      </div>',
    '      <div class="pick-card" data-species="bear">',
    '        <div class="preview"><img src="学习宠物/gifs/bear-glasses.png" alt="博士熊"></div>',
    '        <div class="name">🐻 博士熊</div>',
    '        <div class="desc">戴眼镜的学霸小熊<br>安静陪伴 · 温柔治愈</div>',
    '      </div>',
    '    </div>',
    '    <div class="pick-confirm">',
    '      <button id="pickConfirmBtn" disabled>确认领养</button>',
    '    </div>',
    '  </div>',
    '</div>',
    '<div id="panel">',
    '  <div class="p-head">',
    '    <div class="p-title">',
    '      <input id="petName" value="爱弥丝" maxlength="6" title="改名">',
    '      <span class="lvl" id="lvl">Lv.1</span>',
    '    </div>',
    '    <div style="display:flex;align-items:center;gap:8px;">',
    '      <div class="coins">🪙 <span id="coinNum">0</span></div>',
    '      <button class="p-close" id="panelClose">✕</button>',
    '    </div>',
    '  </div>',
    '  <div class="p-body">',
    '    <div class="stats" id="stats"></div>',
    '    <div class="auto-care-status" id="autoCareStatus"><span class="auto-dot"></span><span id="autoCareText">自动照顾：开启中</span></div>',
    '    <div class="tabs">',
    '      <div class="tab active" data-t="care">🤲 照顾</div>',
    '      <div class="tab" data-t="shop">🛒 商店</div>',
    '      <div class="tab" data-t="study">📚 学习</div>',
    '      <div class="tab" data-t="set">⚙️ 设置</div>',
    '    </div>',
    '    <div class="panel active" id="p-care">',
    '      <div class="care-grid">',
    '        <button class="care-btn" data-act="feed">🍚 喂饭<small>饱食+25（🪙10）</small></button>',
    '        <button class="care-btn" data-act="water">💧 喂水<small>喝水+30（🪙8）</small></button>',
    '        <button class="care-btn" data-act="play">🎾 陪玩<small>心情+20 清洁+15（🪙30）</small></button>',
    '        <button class="care-btn" data-act="clean">🧼 洗澡<small>清洁+40（🪙20）</small></button>',
    '      </div>',
    '      <p class="hint">💡 手动照顾或让TA自己来。点TA可以免费「抱抱」+3 心情。</p>',
    '    </div>',
    '    <div class="panel" id="p-shop">',
    '      <div class="shop-section-title">🍱 食物 & 饮品</div>',
    '      <div class="shop" id="shop-food"></div>',
    '      <div class="shop-section-title">🎀 装饰与用品</div>',
    '      <div class="shop" id="shop-decor"></div>',
    '      <p class="hint">购买消耗品立即生效；装饰品永久保留，可随时装备/卸下。<br>开启自动照顾后，宠物会自己花币买这些，约 <b>300~350 🪙/天</b>。</p>',
    '    </div>',
    '    <div class="panel" id="p-study">',
    '      <div class="earn-info">',
    '        <div class="earn-card"><div class="left"><span class="icon">📐</span><div class="info"><b>专注学习</b><span>每分钟自动入账</span></div></div><div class="rate">+1 🪙/分</div></div>',
    '        <div class="earn-card"><div class="left"><span class="icon">📖</span><div class="info"><b>背单词</b><span>每词自动入账</span></div></div><div class="rate">+2 🪙/词</div></div>',
    '        <div class="earn-card"><div class="left"><span class="icon">📝</span><div class="info"><b>数学收录</b><span>每道题自动入账</span></div></div><div class="rate">+5 🪙/道</div></div>',
    '      </div>',
    '      <div class="study-summary">今日统计：<br>⏱ 专注 <b id="tFocus">0</b> 分钟 &nbsp;·&nbsp; 📖 单词 <b id="tWord">0</b> 个<br>📝 数学 <b id="tMath">0</b> 道 &nbsp;·&nbsp; 🪙 共赚 <b id="tCoin">0</b> 币<br>🤖 自动花费 <b id="tAutoSpend">0</b> 币</div>',
    '      <div class="event-log" id="eventLog"><div class="empty">暂无互动记录…开始学习后TA会在这里冒泡～</div></div>',
    '    </div>',
    '    <div class="panel" id="p-set">',
    '      <div class="set-row"><span>宠物名字</span><input id="setName" value="爱弥丝" maxlength="6"></div>',
    '      <div class="set-row"><span>自动照顾</span><label class="switch"><input type="checkbox" id="autoCareToggle"><span class="slider"></span></label></div>',
    '      <div class="set-row"><span>移动间隔</span><select id="moveIntervalSel"><option value="1">1 分钟（活跃）</option><option value="3">3 分钟</option><option value="5" selected>5 分钟（默认）</option><option value="10">10 分钟（安静）</option><option value="30">30 分钟（懒散）</option></select></div>',
    '      <div class="set-row"><span>放生宠物</span><button class="danger" id="releaseBtn">确认放生</button></div>',
    '      <p class="hint">进度按当前登录账号隔离（localStorage）。<br>学习事件由主页面自动推送。</p>',
    '    </div>',
    '  </div>',
    '</div>',
    '<div id="toast"></div>'
  ].join('\n');
  document.body.insertAdjacentHTML('beforeend', DOM);

  /* ============ 可配置项 ============ */
  var KEY = 'pet-state-v1';
  var GIF_BASE = 'https://gitee.com/lzy-buaa-jdi/ameath/raw/master/gifs/';
  var GIF_LOCAL = '学习宠物/gifs/';
  var storage = null;

  /* ============ 宠物种族配置 ============ */
  var SPECIES = {
    aimes: {
      name: '爱弥丝', defaultName: '爱弥丝',
      gifs: { idle: ['idle1.gif','idle2.gif','idle3.gif','idle4.gif'], move: 'move.gif', drag: 'drag.gif', screen: ['screen1.gif','screen2.gif','screen3.gif','screen4.gif','screen5.gif','screen6.gif','screen7.gif'], main: 'ameath_content.png' },
      cssClass: 'aimes'
    },
    bear: {
      name: '博士熊', defaultName: '小博',
      gifs: { idle: ['bear-glasses.png'], move: 'bear-glasses.png', drag: 'bear-glasses.png', screen: ['bear-glasses.png'], main: 'bear-glasses.png' },
      cssClass: 'bear'
    }
  };

  /* ============ 数据模型 ============ */
  var DECAY = { full: 8.0, water: 10.0, energy: 1.0, clean: 5.0, mood: 5.0 };
  var EARN_RULE = { focus: 1, word: 2, math: 5 };
  var SHOP_FOOD = [
    { id: 'rice', name: '饭团', icon: '🍙', cost: 10, type: 'consume', effect: { full: 25 }, desc: '饱食 +25' },
    { id: 'noodle', name: '泡面', icon: '🍜', cost: 25, type: 'consume', effect: { full: 50 }, desc: '饱食 +50' },
    { id: 'water', name: '矿泉水', icon: '💧', cost: 8, type: 'consume', effect: { water: 30 }, desc: '喝水 +30' },
    { id: 'juice', name: '果汁', icon: '🥤', cost: 18, type: 'consume', effect: { water: 50 }, desc: '喝水 +50' }
  ];
  var SHOP_DECOR = [
    { id: 'ball', name: '小皮球', icon: '🎾', cost: 30, type: 'consume', effect: { mood: 25 }, desc: '心情 +25' },
    { id: 'soap', name: '沐浴露', icon: '🧼', cost: 20, type: 'consume', effect: { clean: 40 }, desc: '清洁 +40' },
    { id: 'hat', name: '学士帽', icon: '🎓', cost: 80, type: 'perm', desc: '永久：戴学士帽' },
    { id: 'bow', name: '蝴蝶结', icon: '🎀', cost: 60, type: 'perm', desc: '永久：戴蝴蝶结' },
    { id: 'home', name: '舒适小窝', icon: '🏠', cost: 120, type: 'perm', desc: '永久：脚下小窝' }
  ];
  var SHOP = SHOP_FOOD.concat(SHOP_DECOR);
  var CARE = {
    feed: { cost: 10, effect: { full: 25 }, emo: '🍚' },
    water: { cost: 8, effect: { water: 30 }, emo: '💧' },
    play: { cost: 30, effect: { mood: 20, clean: 15 }, emo: '🎾' },
    clean: { cost: 20, effect: { clean: 40 }, emo: '🧼' }
  };
  var REACTIONS = {
    wordWrong: { msgs: ['这都不会？哼～再想想！😏','哎呀又错了，你是不是在梦游呀～','这个单词已经记错第 N 次了哦，认真点嘛！','要不要我帮你记？…才不要呢，自己背！👅','错啦错啦～不过没关系，再来一次就好啦','主人你今天的脑子是不是落在家里了～'], emoji: '🤪', moodChange: -2, anim: 'screen' },
    wordCorrect: { msgs: ['答对啦！真棒～继续保持 💪','nice！这个单词已经被你拿下了 ✨','嗯嗯，就是这个意思，主人越来越厉害了～','又对一个！离上岸又近了一步 🎯'], emoji: '🌟', moodChange: +3, anim: 'screen' },
    focusDone: { msgs: function (data) { var m = data && data.min || 0; if (m >= 120) return ['天呐 ' + m + ' 分钟！！主人你也太拼了吧，休息一下眼睛吧～👀', m + ' 分钟专注！这就是上岸的姿态吗！佩服佩服 🫡']; if (m >= 60) return ['哇 ' + m + ' 分钟！很棒哦，喝口水歇会儿吧～💧','专注 ' + m + ' 分钟，效率满满！给你点赞 👍']; return ['不错不错，' + m + ' 分钟的专注，稳扎稳打～📝', m + ' 分钟～继续加油，我看好你哦 😊']; }, emoji: '💪', moodChange: +5, anim: 'screen' },
    mathWrong: { msgs: ['数学题又翻车了？让我看看…嗯确实有点难 😅','别慌别慌，错题是宝贝，整理一下就好啦～','这道题…我也觉得烦，但为了考研忍忍吧！','计算错了还是思路错了？下次细心点哦～','没事没事，哪有不犯错的，重要的是搞懂它！'], emoji: '🤔', moodChange: -1, anim: 'idle' },
    milestone: { msgs: function (data) { if (!data) return ['里程碑达成！🎉']; if (data.type === 'words') return ['哇！今天背了 ' + data.n + ' 个单词！词汇量暴涨中 📈', data.n + ' 个单词入手！离英语大神又近一步 ✍️']; if (data.type === 'focus') return [data.n + ' 分钟专注时长！这种毅力一定能上岸 🔥', '累计专注 ' + data.n + ' 分钟！你是真的卷王啊…🫡']; return ['太厉害了！又一个里程碑达成 🏆']; }, emoji: '🎉', moodChange: +8, anim: 'screen' }
  };

  /* ========== 运行时变量 ========== */
  var state = null, gifOk = false;
  var pet = null, petImg = null;
  var currentAnim = 'idle';
  var selectedSpecies = null;
  var x = 0, y = 0, dir = 1, speed = 0.9;
  var walking = false, dragging = false, target = null;
  var MOVE_INTERVAL = 5 * 60 * 1000;
  var nextMoveAt = Date.now() + MOVE_INTERVAL;
  var IDLE_CYCLE = 3500; // 空闲时每隔几秒切换一个随机 idle GIF
  var nextIdleCycleAt = Date.now() + IDLE_CYCLE;
  var M = 12, PW = 130, PH = 150;
  var AUTO_CARE_INTERVAL = 3 * 60 * 1000;
  var nextAutoCareAt = 0;
  var AUTO_RESERVE = 30;
  var AUTO_THRESHOLD = 35;

  /* ============ 工具 ============ */
  function todayStr() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function pad0(n) { return n < 10 ? '0' + n : '' + n; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function clampStat(k, dv) { state.stats[k] = Math.max(0, Math.min(100, state.stats[k] + dv)); }
  function moodCategory() { var m = state.stats.mood; return m >= 70 ? 'happy' : m >= 40 ? 'ok' : 'sad'; }
  function curGifs() { return SPECIES[state.species || 'aimes'].gifs; }
  function curClass() { return SPECIES[state.species || 'aimes'].cssClass; }

  /* ============ 存储适配 ============ */
  function defaultStorage() {
    return {
      get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
      set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
    };
  }
  // account.js 的 uStorage 暴露的是 getItem/setItem，这里统一成 get/set
  function normStorage(s) {
    if (!s) return defaultStorage();
    if (typeof s.get === 'function' && typeof s.set === 'function') return s;
    return {
      get: function (k) { try { return s.getItem(k); } catch (e) { return null; } },
      set: function (k, v) { try { s.setItem(k, v); } catch (e) { } },
      remove: function (k) { try { s.removeItem(k); } catch (e) { } }
    };
  }
  function load() {
    try { var s = JSON.parse(storage.get(KEY)); if (s && s.stats) return s; } catch (e) { }
    return null;
  }
  function save() { storage.set(KEY, JSON.stringify(state)); }

  /* ============ 状态 ============ */
  function freshState(species) {
    species = species || 'aimes';
    var sp = SPECIES[species];
    return {
      name: sp.defaultName, owned: false, coins: 200, exp: 0, level: 1,
      species: species,
      stats: { mood: 80, full: 70, water: 70, energy: 70, clean: 70 }, lastSeen: Date.now(),
      inventory: {}, equipped: {},
      today: { focus: 0, word: 0, math: 0, coin: 0, autoSpend: 0, date: todayStr() },
      eventLog: [], moveInterval: 5, autoCare: true
    };
  }
  function applyDecay() {
    var now = Date.now(); var h = Math.min((now - state.lastSeen) / 3600000, 240);
    if (h > 0) for (var k in DECAY) state.stats[k] = Math.max(0, state.stats[k] - DECAY[k] * h);
    if (state.today.date !== todayStr()) state.today = { focus: 0, word: 0, math: 0, coin: 0, autoSpend: 0, date: todayStr() };
    state.lastSeen = now;
    if (!state.eventLog) state.eventLog = [];
    if (state.moveInterval === undefined) state.moveInterval = 5;
    if (state.autoCare === undefined) state.autoCare = true;
    if (!state.today.autoSpend && state.today) state.today.autoSpend = 0;
    if (!SPECIES[state.species]) state.species = 'aimes';
    if (!state._bonusGiven) { state.coins = (state.coins || 0) + 200; state._bonusGiven = true; save(); }
  }

  /* ============ 渲染（种族感知） ============ */
  var _gifRetryCount = 0;
  function setPetGif(anim) {
    currentAnim = anim;
    var gifs = curGifs();
    var filename;
    if (anim === 'move') filename = gifs.move;
    else if (anim === 'drag') filename = gifs.drag;
    else if (anim === 'screen') filename = gifs.screen[Math.floor(Math.random() * gifs.screen.length)];
    else if (anim === 'idle') filename = gifs.idle[Math.floor(Math.random() * gifs.idle.length)];
    else filename = gifs.main;
    var localUrl = GIF_LOCAL + filename;
    // 博士熊：静态图直接设
    if (state.species === 'bear') { petImg.src = localUrl; return; }
    // 爱弥丝：本地 GIF 直接设（我们自己的文件，信任它）
    petImg.src = localUrl;
    // 后台静默探测：仅在首次确认 GIF 可用
    if (!gifOk) {
      var probe = new Image();
      probe.onload = function () { gifOk = true; _gifRetryCount = 0; };
      probe.onerror = function () {
        _gifRetryCount++;
        if (_gifRetryCount <= 1) { petImg.src = GIF_BASE + filename; }
        else { petImg.src = GIF_LOCAL + gifs.main; gifOk = true; }
      };
      probe.src = localUrl;
    }
  }
  function updatePetVisual() {
    if (dragging) setPetGif('drag');
    else if (walking) setPetGif('move');
    else setPetGif('idle');
  }
  function syncSpeciesClass() {
    pet.classList.remove('aimes', 'bear', 'hugging');
    pet.classList.add(curClass());
  }

  /* ============ 渲染 ============ */
  function renderHeader() {
    document.getElementById('petName').value = state.name;
    document.getElementById('setName').value = state.name;
    document.getElementById('coinNum').textContent = state.coins;
    document.getElementById('lvl').textContent = 'Lv.' + state.level;
  }
  function renderStats() {
    var defs = [
      { k: 'mood', ico: '😊', lab: '心情' }, { k: 'full', ico: '🍚', lab: '饱食' },
      { k: 'water', ico: '💧', lab: '喝水' }, { k: 'energy', ico: '⚡', lab: '精力' },
      { k: 'clean', ico: '🧼', lab: '清洁' }
    ];
    var colors = { mood: '#f59e0b', full: '#22c55e', water: '#0ea5e9', energy: '#6366f1', clean: '#14b8a6' };
    var html = '';
    defs.forEach(function (d) {
      var v = Math.round(state.stats[d.k]);
      html += '<div class="stat"><span class="ico">' + d.ico + '</span><span class="lab">' + d.lab + '</span>' +
        '<span class="bar"><i style="width:' + v + '%;background:' + colors[d.k] + '"></i></span>' +
        '<span style="width:26px;text-align:right;color:#64748b">' + v + '</span></div>';
    });
    var need = state.level * 100, expIn = state.exp % need;
    html += '<div class="stat" style="grid-column:1/3"><span class="ico">⭐</span><span class="lab">成长</span>' +
      '<span class="bar"><i style="width:' + Math.round(expIn / need * 100) + '%;background:linear-gradient(90deg,#ec4899,#a855f7)"></i></span>' +
      '<span style="color:#64748b">' + expIn + '/' + need + '</span></div>';
    document.getElementById('stats').innerHTML = html;
  }
  function renderShop() {
    function renderItem(it) {
      var owned = !!state.inventory[it.id], eq = !!state.equipped[it.id];
      var btn;
      if (it.type === 'perm') {
        btn = owned
          ? '<button class="equip" data-equip="' + it.id + '">' + (eq ? '卸下' : '装备') + '</button>'
          : '<button ' + (state.coins < it.cost ? 'disabled' : '') + ' data-buy="' + it.id + '">🪙' + it.cost + '</button>';
      } else {
        btn = '<button ' + (state.coins < it.cost ? 'disabled' : '') + ' data-buy="' + it.id + '">🪙' + it.cost + '</button>';
      }
      return '<div class="item ' + (owned ? 'owned' : '') + '"><div class="ic">' + it.icon + '</div><div class="nm">' + it.name + '</div>' +
        '<div class="ds">' + it.desc + '</div>' + btn + '</div>';
    }
    document.getElementById('shop-food').innerHTML = SHOP_FOOD.map(renderItem).join('');
    document.getElementById('shop-decor').innerHTML = SHOP_DECOR.map(renderItem).join('');
  }
  function renderStudy() {
    document.getElementById('tFocus').textContent = state.today.focus;
    document.getElementById('tWord').textContent = state.today.word;
    document.getElementById('tMath').textContent = state.today.math;
    document.getElementById('tCoin').textContent = state.today.coin;
    document.getElementById('tAutoSpend').textContent = (state.today.autoSpend || 0);
    renderEventLog();
    renderAutoCareStatus();
  }
  function renderAutoCareStatus() {
    var el = document.getElementById('autoCareStatus');
    var txt = document.getElementById('autoCareText');
    if (state.autoCare) { el.className = 'auto-care-status on'; txt.textContent = '🤖 自动照顾：运行中'; }
    else { el.className = 'auto-care-status off'; txt.textContent = '😴 自动照顾：已关闭'; }
    var chk = document.getElementById('autoCareToggle');
    if (chk && chk.checked !== state.autoCare) chk.checked = state.autoCare;
  }
  function renderEventLog() {
    var el = document.getElementById('eventLog');
    if (!state.eventLog || state.eventLog.length === 0) { el.innerHTML = '<div class="empty">暂无互动记录…开始学习后TA会在这里冒泡～</div>'; return; }
    el.innerHTML = state.eventLog.slice(-20).map(function (e) {
      var cls = e.isAuto ? ' event-log-item auto' : ' event-log-item';
      return '<div class="' + cls + '"><span class="time">' + e.time + '</span><span class="msg">' + e.msg + '</span></div>';
    }).join('');
    el.scrollTop = el.scrollHeight;
  }
  function renderAll() { renderHeader(); renderStats(); renderShop(); renderStudy(); updateBubble(); }

  /* ============ 行为 ============ */
  function toast(m) {
    var t = document.getElementById('toast'); t.textContent = m; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('show'); }, 1800);
  }
  function floatEmoji(ch) {
    var r = pet.getBoundingClientRect();
    var f = document.createElement('div'); f.textContent = ch; f.style.cssText =
      'position:fixed;left:' + (r.left + r.width / 2 - 10) + 'px;top:' + r.top + 'px;font-size:22px;pointer-events:none;z-index:10001;animation:rise 1s ease-out forwards;';
    document.body.appendChild(f); setTimeout(function () { f.remove(); }, 1000);
  }
  function addExp(n) {
    state.exp += n;
    var nl = Math.floor(state.exp / (state.level * 100)) + 1;
    if (nl > state.level) { state.level = nl; toast('🎉 升级！Lv.' + nl); }
  }
  function care(act) {
    var c = CARE[act]; if (state.coins < c.cost) { toast('币不够～'); return; }
    state.coins -= c.cost; for (var k in c.effect) clampStat(k, c.effect[k]);
    floatEmoji(c.emo); save(); renderAll();
  }
  function buy(id) {
    var it = SHOP.find(function (x) { return x.id === id; }); if (!it || state.coins < it.cost) { toast('币不够'); return; }
    state.coins -= it.cost;
    if (it.type === 'consume') { for (var k in it.effect) clampStat(k, it.effect[k]); toast('使用了 ' + it.name); }
    else { state.inventory[id] = true; state.equipped[id] = true; toast('获得 ' + it.name + '，已装备🎉'); }
    save(); renderAll();
  }
  function toggleEquip(id) { state.equipped[id] = !state.equipped[id]; save(); renderAll(); }
  function earn(type, amt) {
    var coins = amt * EARN_RULE[type];
    state.coins += coins; state.today[type] += amt; state.today.coin += coins;
    if (type === 'focus') state.stats.energy = Math.min(100, state.stats.energy + amt * 0.3);
    save(); renderAll();
  }
  function hug() {
    clampStat('mood', 3); floatEmoji('💕'); setPetGif('screen'); save(); renderAll();
    if (state.species === 'bear') { pet.classList.add('hugging'); setTimeout(function () { pet.classList.remove('hugging'); }, 1500); }
    setTimeout(function () { if (!walking && !dragging) setPetGif('idle'); }, 2500);
  }
  function release() {
    var petName = state.name || 'TA';
    if (!confirm('确定要放生 ' + petName + ' 吗？所有进度清零，需重新领取。')) return;
    state = freshState(); save(); hidePet(); toast(petName + ' 回到了原来的地方 ✨');
  }
  function rename() {
    var v = document.getElementById('petName').value.trim() || (SPECIES[state.species] ? SPECIES[state.species].defaultName : '宠物');
    state.name = v; document.getElementById('setName').value = v; save();
  }
  function changeMoveInterval() {
    var min = parseInt(document.getElementById('moveIntervalSel').value) || 5;
    state.moveInterval = min; MOVE_INTERVAL = min * 60 * 1000; nextMoveAt = Date.now() + MOVE_INTERVAL; save();
    toast('移动间隔已改为 ' + min + ' 分钟');
  }
  function toggleAutoCare() {
    state.autoCare = !!document.getElementById('autoCareToggle').checked; save(); renderAutoCareStatus();
    toast(state.autoCare ? '🤖 自动照顾已开启' : '😴 自动照顾已关闭');
  }

  /* ========== 自动照顾系统 ========== */
  function runAutoCare() {
    if (!state.owned || !state.autoCare) return;
    var s = state.stats;
    var needs = [];
    if (s.full < AUTO_THRESHOLD) needs.push({ stat: 'full', priority: s.full, items: SHOP_FOOD.filter(function (it) { return it.effect.full; }) });
    if (s.water < AUTO_THRESHOLD) needs.push({ stat: 'water', priority: s.water, items: SHOP_FOOD.filter(function (it) { return it.effect.water; }) });
    if (s.clean < AUTO_THRESHOLD) needs.push({ stat: 'clean', priority: s.clean, items: SHOP_FOOD.concat(SHOP_DECOR).filter(function (it) { return it.effect.clean; }) });
    if (s.mood < AUTO_THRESHOLD) needs.push({ stat: 'mood', priority: s.mood, items: SHOP_FOOD.concat(SHOP_DECOR).filter(function (it) { return it.effect.mood; }) });
    if (s.energy < AUTO_THRESHOLD) needs.push({ stat: 'energy', priority: s.energy, rest: true });
    needs.sort(function (a, b) { return a.priority - b.priority; });
    for (var i = 0; i < needs.length; i++) {
      var need = needs[i];
      if (need.rest) { clampStat('energy', 30); logAutoAction('小憩回血'); showBubble(pick(['眯一会儿~😴','补个觉~💤','充电中~⚡']), 2000); floatEmoji('💤'); save(); renderAll(); return; }
      need.items.sort(function (a, b) { return a.cost - b.cost; });
      for (var j = 0; j < need.items.length; j++) {
        var item = need.items[j];
        if (state.coins >= item.cost + AUTO_RESERVE) {
          state.coins -= item.cost;
          for (var k in item.effect) clampStat(k, item.effect[k]);
          state.today.autoSpend = (state.today.autoSpend || 0) + item.cost;
          logAutoAction(item.name);
          var bubbles = { full: ['我去吃个饭~🍚','饿了饿了…垫一口','咕噜噜…开饭！'], water: ['喝口水~💧','渴死我了…','补水补水~'], clean: ['洗个澡吧~🧼','身上脏脏的…','洗澡时间到！'], mood: ['玩一会儿~🎾','心情不好要哄哄','陪我玩嘛～'] };
          var pool = bubbles[need.stat] || ['嗯~'];
          showBubble(pool[Math.floor(Math.random() * pool.length)], 2000); floatEmoji(item.icon); save(); renderAll(); return;
        }
      }
    }
  }
  function logAutoAction(itemName) {
    var now = new Date(); var timeStr = pad0(now.getHours()) + ':' + pad0(now.getMinutes());
    if (!state.eventLog) state.eventLog = [];
    state.eventLog.push({ time: timeStr, msg: '🤖 自己买了 ' + itemName, isAuto: true });
    if (state.eventLog.length > 50) state.eventLog = state.eventLog.slice(-50);
  }

  /* ========== 学习交互系统 ========== */
  function triggerEvent(type, data, fromExternal) {
    if (!state.owned) return;
    var r = REACTIONS[type]; if (!r) return;
    var msgs = r.msgs; var msg;
    if (typeof msgs === 'function') { msg = pick(msgs(data)); } else { msg = pick(msgs); }
    var now = new Date(); var timeStr = pad0(now.getHours()) + ':' + pad0(now.getMinutes());
    var logMsg = (r.emoji || '') + ' ' + msg;
    if (!state.eventLog) state.eventLog = [];
    state.eventLog.push({ time: timeStr, msg: logMsg, type: type });
    if (state.eventLog.length > 50) state.eventLog = state.eventLog.slice(-50);
    showBubble(msg, 3500);
    if (r.emoji) floatEmoji(r.emoji);
    if (r.anim) setPetGif(r.anim);
    setTimeout(function () { if (!walking && !dragging) setPetGif('idle'); }, 3000);
    if (r.moodChange) clampStat('mood', r.moodChange);
    addExp(type === 'milestone' ? 15 : (type === 'focusDone' ? 10 : 3));
    if (type === 'focusDone' && data && data.min) earn('focus', data.min);
    save(); renderAll();
  }

  /* ============ 宠物选择弹窗 ============ */
  function openPickModal() {
    if (state.owned) return;
    selectedSpecies = null;
    var cards = document.querySelectorAll('.pick-card');
    cards.forEach(function (c) { c.classList.remove('selected'); });
    document.getElementById('pickConfirmBtn').disabled = true;
    document.getElementById('pickModal').classList.add('open');
  }
  function selectPet(cardEl) {
    var cards = document.querySelectorAll('.pick-card');
    cards.forEach(function (c) { c.classList.remove('selected'); });
    cardEl.classList.add('selected');
    selectedSpecies = cardEl.dataset.species;
    document.getElementById('pickConfirmBtn').disabled = false;
  }
  function confirmPick() {
    if (!selectedSpecies) return;
    document.getElementById('pickModal').classList.remove('open');
    state.species = selectedSpecies;
    state.name = SPECIES[selectedSpecies].defaultName;
    showPet();
    toast('欢迎 ' + state.name + ' 加入旅程！送了你 200 🪙 启动资金 🌸');
  }

  /* ============ 领取 / 显示切换 ============ */
  function showPet() {
    state.owned = true; save();
    document.getElementById('petEntry').style.display = 'flex';
    document.getElementById('petEntry').textContent = '🐾 我的宠物';
    pet.style.display = 'block';
    syncSpeciesClass();
    x = 20; y = window.innerHeight - 170; pet.style.left = x + 'px'; pet.style.top = y + 'px';
    walking = false; pet.classList.remove('walking');
    MOVE_INTERVAL = (state.moveInterval || 5) * 60 * 1000;
    nextMoveAt = Date.now() + MOVE_INTERVAL;
    nextAutoCareAt = Date.now() + AUTO_CARE_INTERVAL;
    setPetGif('idle'); renderAll();
  }
  function hidePet() {
    pet.style.display = 'none'; walking = false; pet.classList.remove('walking');
    var e = document.getElementById('petEntry');
    e.style.display = 'flex'; e.textContent = '✨ 领取宠物';
  }

  /* ============ 全屏漫游逻辑 ============ */
  function pickTarget() {
    var minX = M, maxX = window.innerWidth - PW - M;
    var minY = M + 8, maxY = window.innerHeight - PH - M;
    var ang = Math.random() * Math.PI * 2;
    var maxD = Math.min(window.innerWidth, window.innerHeight) * 0.6;
    var dist = rand(60, Math.max(120, maxD));
    var tx = x + Math.cos(ang) * dist, ty = y + Math.sin(ang) * dist;
    tx = Math.max(minX, Math.min(maxX, tx)); ty = Math.max(minY, Math.min(maxY, ty));
    target = { x: tx, y: ty };
    dir = target.x >= x ? 1 : -1;
    pet.querySelector('img').style.setProperty('--dir', dir);
  }
  function walkLoop() {
    var now = Date.now();
    if (!dragging && state && state.owned) {
      if (now >= nextAutoCareAt) { runAutoCare(); nextAutoCareAt = now + AUTO_CARE_INTERVAL; }
      // 空闲时自动切换 idle GIF（让宠物看起来"活着"）
      if (!walking && now >= nextIdleCycleAt && currentAnim === 'idle') {
        setPetGif('idle');
        nextIdleCycleAt = now + IDLE_CYCLE;
      }
      if (walking && target) {
        var dx = target.x - x, dy = target.y - y, dist = Math.hypot(dx, dy);
        if (dist < 4) {
          walking = false; pet.classList.remove('walking'); setPetGif('idle'); nextMoveAt = now + MOVE_INTERVAL; nextIdleCycleAt = now + IDLE_CYCLE;
          if (Math.random() < 0.7) { setPetGif('screen'); showBubble(['💭','♪','✨','🌸','⭐','🚀'][Math.floor(Math.random() * 6)], 1400); setTimeout(function () { if (!walking && !dragging) setPetGif('idle'); }, 2500); }
        } else {
          var ux = dx / dist, uy = dy / dist;
          x += ux * speed; y += uy * speed;
          dir = ux >= 0 ? 1 : -1;
          pet.style.left = x + 'px'; pet.style.top = y + 'px';
          pet.querySelector('img').style.setProperty('--dir', dir);
        }
      } else if (now >= nextMoveAt) { walking = true; pet.classList.add('walking'); pickTarget(); setPetGif('move'); nextIdleCycleAt = now + IDLE_CYCLE; }
    }
    requestAnimationFrame(walkLoop);
  }
  function showBubble(txt, ms) {
    var b = document.getElementById('bubble'); b.textContent = txt; b.classList.add('show');
    clearTimeout(showBubble._t); showBubble._t = setTimeout(function () { b.classList.remove('show'); }, ms || 1500);
  }
  function updateBubble() {
    if (!state.owned) return;
    var s = state.stats; var need = [];
    if (s.full < 25) need.push('饿'); if (s.water < 25) need.push('渴'); if (s.clean < 25) need.push('脏'); if (s.energy < 25) need.push('累');
    if (need.length) showBubble('我' + need.join('又') + '了…', 2500);
    else if (moodCategory() === 'sad') showBubble('陪陪我嘛~', 2500);
  }

  /* ============ 面板 ============ */
  function togglePanel() { document.getElementById('panel').classList.toggle('open'); }

  /* ============ 事件绑定 ============ */
  function bindDom() {
    var entry = document.getElementById('petEntry');
    entry.addEventListener('click', function () {
      if (!state.owned) openPickModal(); else togglePanel();
    });

    pet.addEventListener('pointerdown', function (e) {
      if (!state.owned) return;
      dragging = true; var moved = 0; var downX = e.clientX; var downY = e.clientY;
      pet.classList.remove('walking'); setPetGif('drag'); pet.setPointerCapture(e.pointerId);
      pet._dragMove = function (ev) {
        moved += Math.abs(ev.clientX - downX) + Math.abs(ev.clientY - downY);
        x = ev.clientX - PW / 2; y = ev.clientY - PH / 2;
        x = Math.max(M, Math.min(window.innerWidth - PW - M, x));
        y = Math.max(M, Math.min(window.innerHeight - PH - M, y));
        pet.style.left = x + 'px'; pet.style.top = y + 'px';
      };
      pet._dragUp = function () {
        dragging = false;
        if (moved < 6) {
          // 轻点：拥抱 + 切换动画 + 冒泡
          hug();
          setPetGif('idle'); // 拥抱结束后切回随机 idle
          var taps = ['嘿～', '嗯？', '🌸', '✨', '找我呀？', '～'];
          showBubble(taps[Math.floor(Math.random() * taps.length)], 1200);
        }
        else { walking = false; pet.classList.remove('walking'); setPetGif('idle'); }
      };
    });
    pet.addEventListener('pointermove', function (e) { if (dragging && pet._dragMove) pet._dragMove(e); });
    pet.addEventListener('pointerup', function (e) { if (dragging && pet._dragUp) pet._dragUp(); });

    // 图片加载失败兜底
    petImg.onerror = function () {
      this._errCount = (this._errCount || 0) + 1;
      if (this._errCount > 5) { this.style.opacity = '0.3'; this.alt = '🐾 加载中...'; }
      var self = this;
      setTimeout(function () { if (typeof setPetGif === 'function') setPetGif(currentAnim || 'idle'); }, 300 * (self._errCount || 1));
    };

    document.getElementById('panelClose').addEventListener('click', togglePanel);
    document.getElementById('petName').addEventListener('change', rename);
    document.getElementById('setName').addEventListener('input', function (e) {
      state.name = e.target.value; document.getElementById('petName').value = e.target.value; save();
    });

    // 照顾按钮（事件委托）
    document.getElementById('p-care').addEventListener('click', function (e) {
      var b = e.target.closest('.care-btn'); if (b) care(b.dataset.act);
    });
    // 商店（事件委托）
    function shopHandler(e) {
      var buyBtn = e.target.closest('[data-buy]'); if (buyBtn) { buy(buyBtn.dataset.buy); return; }
      var eqBtn = e.target.closest('[data-equip]'); if (eqBtn) { toggleEquip(eqBtn.dataset.equip); }
    }
    document.getElementById('shop-food').addEventListener('click', shopHandler);
    document.getElementById('shop-decor').addEventListener('click', shopHandler);

    // tab 切换
    var tabs = document.querySelectorAll('.tab');
    tabs.forEach(function (t) {
      t.addEventListener('click', function () {
        document.querySelectorAll('.tab').forEach(function (x) { x.classList.remove('active'); });
        document.querySelectorAll('.panel').forEach(function (x) { x.classList.remove('active'); });
        t.classList.add('active'); document.getElementById('p-' + t.dataset.t).classList.add('active');
      });
    });

    document.getElementById('autoCareToggle').addEventListener('change', toggleAutoCare);
    document.getElementById('moveIntervalSel').addEventListener('change', changeMoveInterval);
    document.getElementById('releaseBtn').addEventListener('click', release);

    // 选择弹窗
    document.querySelectorAll('.pick-card').forEach(function (c) {
      c.addEventListener('click', function () { selectPet(c); });
    });
    document.getElementById('pickConfirmBtn').addEventListener('click', confirmPick);

    window.addEventListener('resize', function () {
      x = Math.max(M, Math.min(window.innerWidth - PW - M, x));
      y = Math.max(M, Math.min(window.innerHeight - PH - M, y));
      pet.style.left = x + 'px'; pet.style.top = y + 'px';
    });
  }
  function bindExternal() {
    window.addEventListener('message', function (e) { if (!e.data || e.data.type !== 'pet-event') return; triggerEvent(e.data.eventType, e.data.data, true); if (e.data.earn) earn(e.data.earn.type, e.data.earn.amt); });
    window.addEventListener('pet-event', function (e) { triggerEvent(e.detail.type, e.detail.data, true); if (e.detail.earn) earn(e.detail.earn.type, e.detail.earn.amt); });
  }

  function showPetInit() {
    document.getElementById('petEntry').style.display = 'flex';
    document.getElementById('petEntry').textContent = '🐾 我的宠物';
    pet.style.display = 'block';
    syncSpeciesClass();
    x = Math.max(M, Math.min(window.innerWidth - PW - M, x));
    y = Math.max(M, Math.min(window.innerHeight - PH - M, y));
    pet.style.left = x + 'px'; pet.style.top = y + 'px';
    walking = false; pet.classList.remove('walking');
    MOVE_INTERVAL = (state.moveInterval || 5) * 60 * 1000;
    nextMoveAt = Date.now() + MOVE_INTERVAL;
    nextAutoCareAt = Date.now() + AUTO_CARE_INTERVAL;
    setPetGif('idle');
  }

  /* ============ 启动 ============ */
  function initPet(options) {
    options = options || {};
    KEY = options.key || 'pet-state-v1';
    GIF_LOCAL = options.gifLocal || '学习宠物/gifs/';
    GIF_BASE = options.gifRemote || 'https://gitee.com/lzy-buaa-jdi/ameath/raw/master/gifs/';
    storage = normStorage(options.storage);

    pet = document.getElementById('pet');
    petImg = document.getElementById('petImg');
    if (!pet || !petImg) { console.error('[StudyPet] 未找到 #pet / #petImg 节点'); return; }

    bindDom();
    bindExternal();

    var saved = load();
    state = saved || freshState();
    applyDecay();
    if (!saved) save();
    if (state.owned) { showPetInit(); } else { hidePet(); }
    pet.querySelector('img').style.setProperty('--dir', dir);

    MOVE_INTERVAL = (state.moveInterval || 5) * 60 * 1000;
    var sel = document.getElementById('moveIntervalSel');
    if (sel) sel.value = String(state.moveInterval || 5);
    var chk = document.getElementById('autoCareToggle');
    if (chk) chk.checked = !!state.autoCare;

    var aimesGifs = SPECIES.aimes.gifs;
    [aimesGifs.move, aimesGifs.drag, aimesGifs.main].concat(aimesGifs.idle).concat(aimesGifs.screen).forEach(function (src) {
      var i = new Image(); i.src = GIF_LOCAL + src;
      var j = new Image(); j.src = GIF_BASE + src;
    });

    renderAll();
    walkLoop();
  }

  /* 暴露 API（供主页面推送学习事件） */
  window.StudyPet = { init: initPet, event: function (t, d) { triggerEvent(t, d, false); } };

  /* 自动启动（账号隔离存储） */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { initPet({ storage: window.uStorage }); });
  } else {
    initPet({ storage: window.uStorage });
  }
})();
