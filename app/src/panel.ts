import { AppConfig, publicConfig } from './config.js';
import { Stats } from './stats.js';

export function panelHtml(cfg: AppConfig): string {
  const pub = publicConfig(cfg);
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>WindsurfProxyAPI</title>
  <style>
    :root{color-scheme:light;--ink:#1f2724;--muted:#65716c;--line:#dce3dd;--panel:#f8faf7;--accent:#0f8b8d;--warn:#a15c17;--bad:#b83c3c;--good:#26734d}
    *{box-sizing:border-box}body{margin:0;font-family:"Segoe UI",Microsoft YaHei,sans-serif;color:var(--ink);background:#f2f5f1}
    main{max-width:1180px;margin:0 auto;padding:28px}
    header{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;margin-bottom:18px}
    h1{font-size:28px;margin:0 0 6px}p{margin:0;color:var(--muted);line-height:1.6}
    .actions{display:flex;gap:10px;flex-wrap:wrap}.btn{border:1px solid var(--line);background:white;color:var(--ink);padding:9px 12px;border-radius:6px;text-decoration:none;cursor:pointer}.btn.primary{background:var(--accent);color:white;border-color:var(--accent)}
    .grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:18px 0}.card{background:white;border:1px solid var(--line);border-radius:8px;padding:16px;min-width:0}.card h2{font-size:14px;margin:0 0 10px;color:var(--muted);font-weight:600}.metric{font-size:26px;font-weight:700;white-space:nowrap}.ok{color:var(--good)}.bad{color:var(--bad)}.warn{color:var(--warn)}
    .panel{background:white;border:1px solid var(--line);border-radius:8px;margin-top:12px;overflow:hidden}.panel h2{font-size:16px;margin:0;padding:14px 16px;border-bottom:1px solid var(--line)}.panel .body{padding:14px 16px}
    table{width:100%;border-collapse:collapse}td,th{padding:10px;border-bottom:1px solid var(--line);text-align:left;font-size:14px;vertical-align:top}th{color:var(--muted);font-weight:600}code{background:var(--panel);padding:2px 5px;border-radius:4px;word-break:break-all}.logs{font-family:Consolas,monospace;white-space:pre-wrap;font-size:12px;background:#16201c;color:#dcefe6;padding:12px;border-radius:6px;max-height:280px;overflow:auto}.hidden{display:none}
    input{border:1px solid var(--line);border-radius:6px;padding:10px;min-width:260px}
    @media(max-width:820px){main{padding:16px}.grid{grid-template-columns:repeat(2,minmax(0,1fr))}header{display:block}.actions{margin-top:12px}}
    @media(max-width:520px){.grid{grid-template-columns:1fr}.metric{font-size:22px}input{width:100%;min-width:0}}
  </style>
</head>
<body>
  <main>
    <header>
      <div><h1>WindsurfProxyAPI</h1><p>本地网关 <code>${pub.baseUrl}</code> · 内层 Pool <code>${pub.pool.baseUrl}</code></p></div>
      <div class="actions"><a class="btn" href="${pub.pool.dashboardUrl}" target="_blank">打开 Pool Dashboard</a><button class="btn primary" id="refresh">刷新</button></div>
    </header>
    <section id="login" class="panel"><h2>管理访问</h2><div class="body"><input id="password" type="password" placeholder="输入 data/admin-credentials.txt 里的管理密码"><button class="btn primary" id="unlock">进入</button><p id="loginMsg"></p></div></section>
    <section id="content" class="hidden">
      <div class="grid">
        <div class="card"><h2>网关状态</h2><div id="gatewayStatus" class="metric">...</div></div>
        <div class="card"><h2>Pool 状态</h2><div id="poolStatus" class="metric">...</div></div>
        <div class="card"><h2>本地请求统计</h2><div id="totalRequests" class="metric">0</div></div>
        <div class="card"><h2>错误数</h2><div id="totalErrors" class="metric">0</div></div>
      </div>
      <section class="panel"><h2>API 配置</h2><div class="body" id="config"></div></section>
      <section class="panel"><h2>本地 API Key 统计</h2><div class="body"><table id="keyStats"></table></div></section>
      <section class="panel"><h2>最近错误</h2><div class="body"><table id="errors"></table></div></section>
      <section class="panel"><h2>网关日志</h2><div class="body"><div id="logs" class="logs"></div></div></section>
    </section>
  </main>
  <script>
    let key = sessionStorage.getItem('wpa_mgmt') || '';
    const qs = id => document.getElementById(id);
    async function api(path){const r=await fetch(path,{headers:{'X-Management-Key':key}});if(r.status===401)throw new Error('管理密码不正确');return r.json();}
    function table(el, rows){el.innerHTML=rows.join('');}
    async function load(){
      const [status, stats, config, logs] = await Promise.all([api('/api/status'), api('/api/stats'), api('/api/config'), api('/api/logs')]);
      qs('login').classList.add('hidden'); qs('content').classList.remove('hidden');
      qs('gatewayStatus').textContent = status.gateway.status; qs('gatewayStatus').className = 'metric ok';
      qs('poolStatus').textContent = status.pool.ok ? 'ok' : 'offline'; qs('poolStatus').className = 'metric ' + (status.pool.ok ? 'ok' : 'bad');
      qs('totalRequests').textContent = stats.totalRequests || 0; qs('totalErrors').textContent = stats.totalErrors || 0;
      qs('config').innerHTML = '<p>API Base URL: <code>'+config.baseUrl+'/v1</code></p><p>Pool Dashboard: <code>'+config.pool.dashboardUrl+'</code></p><p>API Key 数量: <code>'+config.apiKeyCount+'</code></p><p>出站代理: <code>'+(config.proxyUrl || '未配置')+'</code></p>';
      const keys = Object.values(stats.byApiKey || {});
      table(qs('keyStats'), ['<tr><th>Key</th><th>请求</th><th>错误</th><th>最近状态</th><th>最近使用</th></tr>'].concat(keys.map(k=>'<tr><td><code>'+k.label+'</code></td><td>'+k.total+'</td><td>'+k.errors+'</td><td>'+k.lastStatus+'</td><td>'+k.lastUsedAt+'</td></tr>')));
      table(qs('errors'), ['<tr><th>时间</th><th>路由</th><th>状态</th><th>Trace</th><th>信息</th></tr>'].concat((stats.recentErrors||[]).slice(0,12).map(e=>'<tr><td>'+e.ts+'</td><td>'+e.method+' '+e.route+'</td><td>'+e.status+'</td><td><code>'+e.traceId+'</code></td><td>'+e.message+'</td></tr>')));
      qs('logs').textContent = (logs.lines || []).join('\\n');
    }
    qs('unlock').onclick=async()=>{key=qs('password').value;sessionStorage.setItem('wpa_mgmt',key);try{await load()}catch(e){qs('loginMsg').textContent=e.message}};
    qs('refresh').onclick=()=>load().catch(e=>alert(e.message));
    if(key) load().catch(()=>{});
  </script>
</body>
</html>`;
}

export function statusPayload(cfg: AppConfig, poolHealth: unknown) {
  const poolRecord = typeof poolHealth === 'object' && poolHealth !== null && !Array.isArray(poolHealth)
    ? poolHealth as Record<string, unknown>
    : {};
  const poolOk = poolRecord.ok === true;
  return {
    gateway: {
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      pid: process.pid,
    },
    pool: {
      ok: poolOk,
      health: poolHealth,
      dashboardUrl: cfg.pool.dashboardUrl,
    },
  };
}
