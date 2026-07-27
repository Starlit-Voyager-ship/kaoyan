// ============================================================
//  考研学习中心 · Cloudflare Worker 同步后端（复制此文件到 Worker）
//  步骤见《Cloudflare 同步教程.md》。需要先在 Cloudflare 绑定一个
//  KV 命名空间，绑定变量名必须叫：DATA
// ============================================================
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const key = url.searchParams.get('key');
    if (!key) return new Response('missing key', { status: 400 });

    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };

    if (request.method === 'OPTIONS') return new Response(null, { headers });

    // 读取
    if (request.method === 'GET') {
      const val = await env.DATA.get(key);
      return new Response(val || 'null', { headers });
      // 注意：null 表示云端还没有数据，前端会提示先上传
    }

    // 写入
    if (request.method === 'PUT' || request.method === 'POST') {
      const body = await request.text();
      await env.DATA.put(key, body, { expirationTtl: 86400 * 365 }); // 一年有效
      return new Response('{"ok":true}', { headers });
    }

    return new Response('method not allowed', { status: 405, headers });
  }
};
