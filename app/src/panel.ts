import { AppConfig, publicConfig } from './config.js';

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

export function panelHtml(cfg: AppConfig): string {
  const pub = publicConfig(cfg);
  const bootJson = JSON.stringify(pub).replace(/</g, '\\u003c');
  const baseUrl = escapeHtml(pub.baseUrl);
  const poolBaseUrl = escapeHtml(pub.pool.baseUrl);
  const poolDashboardUrl = escapeHtml(pub.pool.dashboardUrl);
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>WindsurfProxyAPI</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f8fafc;
      --surface: #ffffff;
      --surface-soft: #f1f5f9;
      --surface-strong: #e2e8f0;
      --ink: #0f172a;
      --muted: #64748b;
      --line: #e2e8f0;
      --accent: #0f766e;
      --accent-soft: #ccfbf1;
      --indigo: #4f46e5;
      --good: #15803d;
      --good-soft: #dcfce7;
      --warn: #b45309;
      --warn-soft: #fef3c7;
      --bad: #b91c1c;
      --bad-soft: #fee2e2;
      --info: #475569;
      --info-soft: #f1f5f9;
      --shadow: 0 1px 2px 0 rgba(15, 23, 42, .06);
      --mono: "JetBrains Mono", "Fira Code", Consolas, "Courier New", monospace;
      --font: "Segoe UI", "Microsoft YaHei", system-ui, sans-serif;
    }
    * { box-sizing: border-box; }
    html, body { min-height: 100%; }
    body {
      margin: 0;
      font-family: var(--font);
      background: var(--bg);
      color: var(--ink);
      overflow: hidden;
    }
    button, input { font: inherit; }
    a { color: inherit; text-decoration: none; }
    .font-mono, code, pre { font-family: var(--mono); }
    .hidden { display: none !important; }
    .app-shell { display: grid; grid-template-columns: 240px minmax(0, 1fr); min-height: 100vh; }
    .sidebar {
      background: #0f172a;
      color: #e2e8f0;
      border-right: 1px solid #1e293b;
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .brand { padding: 20px 18px; border-bottom: 1px solid #1e293b; display: flex; gap: 12px; align-items: center; }
    .brand-mark { width: 34px; height: 34px; border-radius: 8px; background: linear-gradient(135deg, #0f766e, #4f46e5); display: grid; place-items: center; font-weight: 800; color: #fff; }
    .brand-name { font-size: 15px; font-weight: 700; }
    .brand-sub { margin-top: 2px; color: #94a3b8; font-size: 12px; }
    .nav { padding: 12px; display: grid; gap: 4px; }
    .nav button {
      width: 100%;
      border: 0;
      background: transparent;
      color: #cbd5e1;
      border-radius: 6px;
      padding: 10px 11px;
      display: flex;
      gap: 10px;
      align-items: center;
      cursor: pointer;
      text-align: left;
    }
    .nav button:hover { background: #1e293b; color: #fff; }
    .nav button.active { background: #334155; color: #fff; box-shadow: inset 3px 0 0 #14b8a6; }
    .nav-icon { width: 24px; height: 24px; border-radius: 6px; display: grid; place-items: center; background: rgba(148, 163, 184, .16); font-size: 12px; font-weight: 700; }
    .sidebar-footer { margin-top: auto; padding: 14px 18px; border-top: 1px solid #1e293b; color: #94a3b8; font-size: 12px; line-height: 1.6; }
    .content-shell { min-width: 0; height: 100vh; display: flex; flex-direction: column; }
    .topbar {
      height: 64px;
      background: rgba(255, 255, 255, .9);
      border-bottom: 1px solid var(--line);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 0 24px;
      backdrop-filter: blur(10px);
    }
    .top-title { min-width: 0; }
    .top-title h1 { margin: 0; font-size: 18px; line-height: 1.2; }
    .top-title p { margin: 3px 0 0; color: var(--muted); font-size: 13px; }
    .top-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
    .main {
      overflow-y: auto;
      min-width: 0;
      flex: 1;
      padding: 24px;
      background: var(--bg);
    }
    .main-inner { width: min(1320px, 100%); margin: 0 auto; }
    .view { display: none; }
    .view.active { display: block; }
    .view-head { display: flex; justify-content: space-between; gap: 14px; align-items: flex-start; margin-bottom: 14px; }
    .view-head h2 { margin: 0; font-size: 20px; }
    .view-head p { margin: 4px 0 0; color: var(--muted); font-size: 13px; }
    .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
    .two-col { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(320px, .9fr); gap: 12px; }
    .card, .panel {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 8px;
      box-shadow: var(--shadow);
      min-width: 0;
    }
    .card { padding: 16px; }
    .card-label { color: var(--muted); font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; }
    .card-value { margin-top: 9px; font-size: 26px; line-height: 1.15; font-weight: 800; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
    .card-sub { margin-top: 6px; color: var(--muted); font-size: 12px; line-height: 1.45; }
    .panel { margin-top: 12px; overflow: hidden; }
    .panel-head { padding: 14px 16px; border-bottom: 1px solid var(--line); display: flex; justify-content: space-between; align-items: center; gap: 10px; }
    .panel-head h3 { margin: 0; font-size: 15px; }
    .panel-body { padding: 16px; min-width: 0; }
    .btn {
      border: 1px solid var(--line);
      background: #fff;
      color: var(--ink);
      padding: 9px 12px;
      border-radius: 6px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      min-height: 38px;
    }
    .btn:hover:not(:disabled) { background: var(--surface-soft); }
    .btn:disabled { opacity: .55; cursor: not-allowed; }
    .btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
    .btn.primary:hover:not(:disabled) { background: #115e59; }
    .btn.icon { width: 34px; height: 34px; padding: 0; min-height: 34px; }
    .btn.small { padding: 6px 9px; min-height: 32px; font-size: 12px; }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border-radius: 999px;
      padding: 3px 9px;
      font-size: 12px;
      font-weight: 700;
      border: 1px solid transparent;
      white-space: nowrap;
    }
    .badge::before { content: ""; width: 6px; height: 6px; border-radius: 999px; background: currentColor; }
    .badge.success { color: var(--good); background: var(--good-soft); border-color: #bbf7d0; }
    .badge.warning { color: var(--warn); background: var(--warn-soft); border-color: #fde68a; }
    .badge.danger { color: var(--bad); background: var(--bad-soft); border-color: #fecaca; }
    .badge.info { color: var(--info); background: var(--info-soft); border-color: var(--line); }
    .table-wrap { overflow-x: auto; max-width: 100%; border: 1px solid var(--line); border-radius: 8px; }
    table { width: 100%; border-collapse: collapse; min-width: 720px; }
    th, td { padding: 12px 16px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; font-size: 13px; }
    th { color: var(--muted); font-weight: 700; background: #f8fafc; }
    tr:last-child td { border-bottom: 0; }
    code {
      background: var(--surface-soft);
      border: 1px solid var(--line);
      border-radius: 5px;
      padding: 2px 5px;
      overflow-wrap: anywhere;
      font-size: 12px;
    }
    .kv { display: grid; grid-template-columns: 150px minmax(0, 1fr); gap: 8px 14px; align-items: start; }
    .kv .k { color: var(--muted); font-size: 13px; }
    .kv .v { min-width: 0; font-size: 13px; overflow-wrap: anywhere; }
    .login {
      width: min(520px, calc(100vw - 32px));
      margin: 10vh auto 0;
      background: #fff;
      border: 1px solid var(--line);
      border-radius: 8px;
      box-shadow: var(--shadow);
      padding: 24px;
    }
    .login h1 { margin: 0 0 8px; font-size: 22px; }
    .login p { margin: 0 0 18px; color: var(--muted); line-height: 1.6; }
    .login-row { display: flex; gap: 8px; }
    input[type="password"], input[type="text"], .search {
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 10px 12px;
      min-width: 0;
      width: 100%;
      background: #fff;
      color: var(--ink);
    }
    input:focus { outline: 2px solid rgba(20, 184, 166, .22); border-color: #14b8a6; }
    .error-text { color: var(--bad); font-size: 13px; margin-top: 10px; min-height: 18px; }
    .secret { display: inline-flex; align-items: center; gap: 6px; min-width: 0; }
    .secret-text { display: inline-flex; align-items: center; gap: 6px; min-width: 0; }
    .secret-value { max-width: 360px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .btn.icon svg { width: 16px; height: 16px; stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .empty {
      min-height: 180px;
      display: grid;
      place-items: center;
      text-align: center;
      color: var(--muted);
      border: 1px dashed var(--line);
      border-radius: 8px;
      background: #f8fafc;
      padding: 28px;
    }
    .empty-state { display: grid; place-items: center; text-align: center; color: var(--muted); }
    .empty-mark {
      width: 58px;
      height: 42px;
      margin: 0 auto 12px;
      border-radius: 8px;
      background: linear-gradient(135deg, #e2e8f0, #f8fafc);
      border: 1px solid var(--line);
    }
    .empty strong { display: block; color: var(--ink); margin-bottom: 4px; }
    .toolbar { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    .log-toolbar { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-bottom: 10px; }
    .seg { display: inline-flex; border: 1px solid var(--line); border-radius: 999px; overflow: hidden; background: #fff; }
    .seg button { border: 0; background: transparent; padding: 7px 11px; font-family: var(--mono); font-size: 12px; cursor: pointer; color: var(--muted); }
    .seg button.active { background: var(--accent-soft); color: var(--accent); font-weight: 800; }
    .check { display: inline-flex; gap: 7px; align-items: center; color: var(--muted); font-size: 13px; }
    .logs {
      background: #101827;
      color: #dbeafe;
      border-radius: 8px;
      min-height: 380px;
      max-height: 62vh;
      overflow: auto;
      padding: 12px;
      font-family: var(--mono);
      font-size: 13px;
      line-height: 1.55;
      white-space: pre-wrap;
      border: 1px solid #1e293b;
    }
    .log-viewer { background: #101827; color: #dbeafe; font-family: var(--mono); }
    .log-line { display: block; border-bottom: 1px solid rgba(148, 163, 184, .12); padding: 2px 0; }
    .log-line.error { color: #fecaca; }
    .log-line.warn { color: #fde68a; }
    .log-line.info { color: #bfdbfe; }
    .skeleton {
      min-height: 18px;
      border-radius: 6px;
      background: linear-gradient(90deg, #e2e8f0 0%, #f8fafc 45%, #e2e8f0 90%);
      background-size: 240px 100%;
      animation: shimmer 1.1s linear infinite;
    }
    @keyframes shimmer { to { background-position: 240px 0; } }
    .toast-stack { position: fixed; top: 16px; right: 16px; z-index: 50; display: grid; gap: 8px; width: min(380px, calc(100vw - 32px)); }
    .toast { background: #fff; border: 1px solid var(--line); border-left: 4px solid var(--accent); border-radius: 8px; box-shadow: 0 12px 28px rgba(15, 23, 42, .14); padding: 12px 14px; font-size: 13px; color: var(--ink); }
    .toast.error { border-left-color: var(--bad); }
    .toast.warn { border-left-color: var(--warn); }
    .toast.success { border-left-color: var(--good); }
    @media (max-width: 980px) {
      body { overflow: auto; }
      .app-shell { grid-template-columns: 1fr; min-height: 100vh; }
      .sidebar { position: sticky; top: 0; z-index: 10; }
      .brand { padding: 12px 14px; }
      .nav { grid-template-columns: repeat(4, minmax(0, 1fr)); padding: 8px; }
      .nav button { justify-content: center; padding: 9px 6px; }
      .nav-text, .sidebar-footer { display: none; }
      .content-shell { height: auto; min-height: calc(100vh - 108px); }
      .topbar { height: auto; padding: 14px; align-items: flex-start; flex-direction: column; }
      .main { padding: 14px; overflow: visible; }
      .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .two-col { grid-template-columns: 1fr; }
    }
    @media (max-width: 620px) {
      .grid { grid-template-columns: 1fr; }
      .login-row, .view-head { flex-direction: column; }
      .top-actions { justify-content: flex-start; }
      .kv { grid-template-columns: 1fr; }
      table { min-width: 640px; }
    }
  </style>
</head>
<body>
  <div id="toastStack" class="toast-stack" aria-live="polite"></div>
  <section id="login" class="login">
    <h1>WindsurfProxyAPI</h1>
    <p>输入 <code>data/admin-credentials.txt</code> 里的管理密码，进入本地网关控制台。</p>
    <div class="login-row">
      <input id="password" type="password" placeholder="管理密码" autocomplete="current-password">
      <button class="btn primary" id="unlock">进入</button>
    </div>
    <div id="loginMsg" class="error-text"></div>
  </section>
  <section id="app" class="app-shell hidden">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark">W</div>
        <div>
          <div class="brand-name">WindsurfProxyAPI</div>
          <div class="brand-sub">Local Gateway Console</div>
        </div>
      </div>
      <nav class="nav" aria-label="控制台导航">
        <button class="active" data-view="dashboard"><span class="nav-icon">D</span><span class="nav-text">网关大盘</span></button>
        <button data-view="pool"><span class="nav-icon">P</span><span class="nav-text">账号池管理</span></button>
        <button data-view="rules"><span class="nav-icon">R</span><span class="nav-text">路由规则</span></button>
        <button data-view="logs"><span class="nav-icon">L</span><span class="nav-text">系统日志</span></button>
      </nav>
      <div class="sidebar-footer">
        <div>Gateway <span class="font-mono">${baseUrl}</span></div>
        <div>Pool <span class="font-mono">${poolBaseUrl}</span></div>
      </div>
    </aside>
    <div class="content-shell">
      <header class="topbar">
        <div class="top-title">
          <h1 id="pageTitle">网关大盘</h1>
          <p id="pageSub">本地网关、账号池和请求状态的快速视图。</p>
        </div>
        <div class="top-actions">
          <span id="gatewayTopBadge" class="badge info">Gateway</span>
          <span id="poolTopBadge" class="badge info">Pool</span>
          <a class="btn" id="poolLink" href="${poolDashboardUrl}" target="_blank" rel="noreferrer">打开 Pool Dashboard</a>
          <button class="btn primary" id="refresh">刷新</button>
        </div>
      </header>
      <main class="main">
        <div class="main-inner">
          <section id="view-dashboard" class="view active">
            <div class="view-head">
              <div><h2>网关大盘</h2><p>运行状态、请求统计和最近错误。</p></div>
            </div>
            <div class="grid" id="metricsGrid"></div>
            <div class="two-col">
              <section class="panel">
                <div class="panel-head"><h3>API 配置</h3></div>
                <div class="panel-body"><div class="kv" id="configSummary"></div></div>
              </section>
              <section class="panel">
                <div class="panel-head"><h3>最近错误</h3></div>
                <div class="panel-body" id="recentErrors"></div>
              </section>
            </div>
          </section>
          <section id="view-pool" class="view">
            <div class="view-head">
              <div><h2>账号池管理</h2><p>从内层 Pool Dashboard 拉取脱敏账号摘要。</p></div>
              <button class="btn small" id="refreshPool">局部刷新</button>
            </div>
            <section class="panel">
              <div class="panel-head"><h3>账号列表</h3><span id="poolCount" class="badge info">0 accounts</span></div>
              <div class="panel-body" id="poolAccounts"></div>
            </section>
          </section>
          <section id="view-rules" class="view">
            <div class="view-head">
              <div><h2>路由规则</h2><p>本地 API Key、OpenAI-compatible base URL 和 Pool 转发关系。</p></div>
            </div>
            <section class="panel">
              <div class="panel-head"><h3>本地 API Key</h3><button class="btn small" id="toggleSecrets">显示/隐藏</button></div>
              <div class="panel-body" id="apiKeys"></div>
            </section>
            <section class="panel">
              <div class="panel-head"><h3>转发路径</h3></div>
              <div class="panel-body"><div class="kv" id="routeRules"></div></div>
            </section>
          </section>
          <section id="view-logs" class="view">
            <div class="view-head">
              <div><h2>系统日志</h2><p>最近 500 行网关日志，支持级别过滤和搜索。</p></div>
            </div>
            <section class="panel">
              <div class="panel-body">
                <div class="log-toolbar">
                  <div class="seg" id="logLevelSeg">
                    <button class="active" data-level="">ALL</button>
                    <button data-level="info">INFO</button>
                    <button data-level="warn">WARN</button>
                    <button data-level="error">ERROR</button>
                  </div>
                  <input id="logSearch" class="search font-mono" placeholder="搜索日志">
                  <label class="check"><input id="logAutoScroll" type="checkbox" checked> 自动滚动到底部</label>
                </div>
                <div id="logs" class="logs log-viewer"></div>
              </div>
            </section>
          </section>
        </div>
      </main>
    </div>
  </section>
  <script>
    const boot = ${bootJson};
    const state = {
      key: sessionStorage.getItem('wpa_mgmt') || '',
      view: 'dashboard',
      status: null,
      stats: null,
      config: boot,
      secrets: [],
      accounts: [],
      poolError: '',
      logLines: [],
      logFilter: '',
      logSearch: '',
      secretValues: {},
      visibleSecrets: {},
      loading: false
    };
    const qs = id => document.getElementById(id);
    const iconEye = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
    const iconEyeOff = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 3 18 18"></path><path d="M10.6 10.6a3 3 0 0 0 2.8 2.8"></path><path d="M9.9 4.2A10.7 10.7 0 0 1 12 4c6.5 0 10 8 10 8a17.6 17.6 0 0 1-3.2 4.3"></path><path d="M6.6 6.6C3.6 8.7 2 12 2 12s3.5 8 10 8a10.8 10.8 0 0 0 4.1-.8"></path></svg>';
    const iconCopy = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
    const esc = value => String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    const fmt = value => new Intl.NumberFormat('zh-CN').format(Number(value || 0));
    const toneForStatus = value => {
      const s = String(value || '').toLowerCase();
      if (['ok', 'active', 'running', 'success', 'usable'].includes(s)) return 'success';
      if (['cooldown', 'rate_limited', 'ratelimited', 'limited', 'degraded', 'warning'].includes(s)) return 'warning';
      if (['error', 'failed', 'offline', 'exhausted', 'disabled_expired'].includes(s)) return 'danger';
      if (['disabled', 'inactive', 'unknown'].includes(s)) return 'info';
      return 'info';
    };
    const badge = (tone, text) => '<span class="badge ' + esc(tone) + '">' + esc(text) + '</span>';
    function toast(message, type = 'success') {
      const el = document.createElement('div');
      el.className = 'toast ' + type;
      el.textContent = message;
      qs('toastStack').appendChild(el);
      setTimeout(() => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(-4px)';
        el.style.transition = 'all .18s';
        setTimeout(() => el.remove(), 200);
      }, 3600);
    }
    async function api(path) {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 10000);
      try {
        const res = await fetch(path, { headers: { 'X-Management-Key': state.key }, signal: ac.signal });
        const text = await res.text();
        let data = {};
        try { data = text ? JSON.parse(text) : {}; } catch { data = { error: { message: text || '响应不是 JSON', type: 'bad_json' } }; }
        if (res.status === 401) {
          sessionStorage.removeItem('wpa_mgmt');
          throw new Error('管理密码不正确');
        }
        if (!res.ok) {
          const err = data.error || {};
          throw new Error(err.message || ('HTTP ' + res.status));
        }
        return data;
      } catch (err) {
        if (err && err.name === 'AbortError') throw new Error('请求超时，请检查本地服务');
        throw err;
      } finally {
        clearTimeout(timer);
      }
    }
    function metricCard(label, value, sub, tone = 'info') {
      return '<div class="card">' +
        '<div class="card-label">' + esc(label) + '</div>' +
        '<div class="card-value">' + esc(value) + '</div>' +
        '<div class="card-sub">' + esc(sub || '') + '</div>' +
        '</div>';
    }
    function loadingCards() {
      qs('metricsGrid').innerHTML = [1,2,3,4].map(() => '<div class="card"><div class="skeleton" style="width:52%"></div><div class="skeleton" style="width:76%;height:32px;margin-top:15px"></div><div class="skeleton" style="width:44%;margin-top:12px"></div></div>').join('');
    }
    function routeRow(k, v) {
      return '<div class="k">' + esc(k) + '</div><div class="v font-mono">' + esc(v || '-') + '</div>';
    }
    function renderConfig() {
      const c = state.config || boot;
      qs('configSummary').innerHTML =
        routeRow('OpenAI Base URL', (c.baseUrl || '') + '/v1') +
        routeRow('Gateway', c.baseUrl || '-') +
        routeRow('Pool API', c.pool ? c.pool.baseUrl : '-') +
        routeRow('Pool Dashboard', c.pool ? c.pool.dashboardUrl : '-') +
        routeRow('出站代理', c.proxyUrl || '未配置') +
        routeRow('日志文件', c.loggingToFile ? '启用' : '未启用');
      qs('routeRules').innerHTML =
        routeRow('GET /v1/models', 'Gateway -> Pool /v1/models') +
        routeRow('POST /v1/chat/completions', 'Gateway -> Pool /v1/chat/completions') +
        routeRow('POST /v1/responses', 'Gateway -> Pool /v1/responses') +
        routeRow('POST /v1/messages', 'Gateway -> Pool /v1/messages') +
        routeRow('Management', 'X-Management-Key protected local APIs');
    }
    function mask(value) {
      const s = String(value || '');
      return s ? '********' : '未配置';
    }
    function secretValue(item) {
      if (typeof item === 'string') return item;
      return item && (item.value || item.preview || item.label || item.id || '');
    }
    function secretName(item, idx) {
      if (typeof item === 'string') return 'Key ' + (idx + 1);
      return item && (item.name || item.key || item.id || item.label) || 'Key ' + (idx + 1);
    }
    function normalizeRows(payload, keys) {
      if (Array.isArray(payload)) return payload;
      if (!payload || typeof payload !== 'object') return [];
      for (const key of keys) {
        if (Array.isArray(payload[key])) return payload[key];
      }
      return [];
    }
    function secretCell(key, value) {
      const raw = String(value == null ? '' : value);
      state.secretValues[key] = raw;
      const shown = state.visibleSecrets[key] ? raw : mask(raw);
      return '<span class="secret secret-text"><code class="secret-value">' + esc(shown) + '</code>' +
        '<button class="btn icon" title="显示或隐藏" data-secret-toggle="' + esc(key) + '">' + (state.visibleSecrets[key] ? iconEyeOff : iconEye) + '</button>' +
        '<button class="btn icon" title="复制" data-secret-copy="' + esc(key) + '">' + iconCopy + '</button></span>';
    }
    function secretRow(item, idx) {
      return '<tr><td class="font-mono">' + esc(secretName(item, idx)) + '</td><td>' + secretCell('secret-' + idx, secretValue(item)) + '</td></tr>';
    }
    function renderSecrets() {
      const items = state.secrets || [];
      if (!items.length) {
        const count = (state.config && state.config.apiKeyCount) || boot.apiKeyCount || 0;
        qs('apiKeys').innerHTML = emptyState('敏感项未返回', count ? ('当前只知道本地 API Key 数量：' + count) : '后端没有返回 secret 列表。');
        return;
      }
      qs('apiKeys').innerHTML = '<div class="table-wrap"><table><thead><tr><th>名称</th><th>值</th></tr></thead><tbody>' + items.map(secretRow).join('') + '</tbody></table></div>';
    }
    function emptyState(title, desc, action) {
      return '<div class="empty empty-state"><div><div class="empty-mark"></div><strong>' + esc(title) + '</strong><div>' + esc(desc || '') + '</div>' + (action || '') + '</div></div>';
    }
    async function copyText(value) {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
        return;
      }
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    function bindSecretButtons() {
      document.querySelectorAll('[data-secret-toggle]').forEach(btn => btn.onclick = () => {
        const key = btn.getAttribute('data-secret-toggle') || '';
        state.visibleSecrets[key] = !state.visibleSecrets[key];
        renderAll();
      });
      document.querySelectorAll('[data-secret-copy]').forEach(btn => btn.onclick = async () => {
        const key = btn.getAttribute('data-secret-copy') || '';
        try {
          await copyText(state.secretValues[key] || '');
          toast('已复制', 'success');
        } catch {
          toast('复制失败，请手动选择', 'error');
        }
      });
    }
    function renderMetrics() {
      const status = state.status || {};
      const stats = state.stats || {};
      const pool = status.pool || {};
      const uptime = status.gateway && status.gateway.uptimeSeconds ? Math.round(status.gateway.uptimeSeconds / 60) + ' 分钟' : '-';
      qs('metricsGrid').innerHTML =
        metricCard('网关状态', status.gateway ? status.gateway.status : '-', 'PID ' + ((status.gateway && status.gateway.pid) || '-'), 'success') +
        metricCard('Pool 状态', pool.ok ? 'ok' : 'offline', pool.latencyMs != null ? pool.latencyMs + ' ms' : (pool.dashboardUrl || ''), pool.ok ? 'success' : 'danger') +
        metricCard('本地请求统计', fmt(stats.totalRequests), '自 ' + ((stats.startedAt || '').slice(0, 19).replace('T', ' ') || '-'), 'info') +
        metricCard('错误数', fmt(stats.totalErrors), '运行 ' + uptime, stats.totalErrors ? 'danger' : 'success');
      qs('gatewayTopBadge').className = 'badge success';
      qs('gatewayTopBadge').textContent = 'Gateway ok';
      qs('poolTopBadge').className = 'badge ' + (pool.ok ? 'success' : 'danger');
      qs('poolTopBadge').textContent = pool.ok ? 'Pool ok' : 'Pool offline';
    }
    function renderErrors() {
      const list = (state.stats && state.stats.recentErrors) || [];
      if (!list.length) {
        qs('recentErrors').innerHTML = emptyState('最近没有错误', '网关错误列表为空。');
        return;
      }
      qs('recentErrors').innerHTML = '<div class="table-wrap"><table><thead><tr><th>时间</th><th>路由</th><th>状态</th><th>Trace</th></tr></thead><tbody>' +
        list.slice(0, 8).map(e => '<tr><td class="font-mono">' + esc(e.ts) + '</td><td>' + esc(e.method + ' ' + e.route) + '</td><td>' + badge('danger', e.status) + '</td><td><code>' + esc(e.traceId || '-') + '</code></td></tr>').join('') +
        '</tbody></table></div>';
    }
    function renderAccounts() {
      const list = state.accounts || [];
      qs('poolCount').className = 'badge info';
      qs('poolCount').textContent = list.length + ' accounts';
      if (state.poolError) {
        qs('poolAccounts').innerHTML = emptyState('Pool Dashboard 暂不可用', state.poolError, '<a class="btn small" href="' + esc(boot.pool.dashboardUrl) + '" target="_blank" rel="noreferrer">打开内层 Dashboard</a>');
        return;
      }
      if (!list.length) {
        qs('poolAccounts').innerHTML = emptyState('暂无 Token 账号，请先导入', '去内层 Pool Dashboard 登录取号或导入账号。', '<a class="btn primary small" href="' + esc(boot.pool.dashboardUrl) + '" target="_blank" rel="noreferrer">去添加账号</a>');
        return;
      }
      qs('poolAccounts').innerHTML = '<div class="table-wrap"><table><thead><tr><th>账号</th><th>状态</th><th>套餐/额度</th><th>代理</th><th>速率</th></tr></thead><tbody>' +
        list.map((a, idx) => {
          const status = a.rateLimited ? 'rateLimited' : (a.status || 'unknown');
          const proxy = a.proxySummary || (a.proxy ? (a.proxy.type + '://' + a.proxy.host + ':' + a.proxy.port + (a.proxy.hasAuth || a.proxy.username ? ' auth' : '')) : (a.proxyEnabled ? '已配置' : '使用全局或未配置'));
          const tier = a.tier || a.planName || (a.credits && (a.credits.planName || a.credits.tier)) || 'unknown';
          const rate = (a.rpmUsed != null || a.rpmLimit != null) ? String(a.rpmUsed || 0) + '/' + String(a.rpmLimit || '-') : '-';
          return '<tr><td><div>' + esc(a.email || a.label || '-') + '</div><code>' + esc(a.id || ('account-' + (idx + 1))) + '</code></td><td>' + badge(toneForStatus(status), status) + '</td><td><span class="font-mono">' + esc(tier) + '</span></td><td class="font-mono">' + esc(proxy) + '</td><td class="font-mono">' + esc(rate) + '</td></tr>';
        }).join('') +
        '</tbody></table></div>';
    }
    function logLevelOf(line) {
      try {
        const parsed = JSON.parse(String(line || ''));
        if (parsed && parsed.level) return String(parsed.level).toLowerCase() === 'error' ? 'error' : String(parsed.level).toLowerCase() === 'warn' ? 'warn' : 'info';
      } catch {}
      const s = String(line || '').toLowerCase();
      if (s.includes('"level":"error"') || s.includes(' error ') || s.includes('[error]')) return 'error';
      if (s.includes('"level":"warn"') || s.includes(' warn ') || s.includes('[warn]')) return 'warn';
      if (s.includes('"level":"info"') || s.includes(' info ') || s.includes('[info]')) return 'info';
      return 'info';
    }
    function scrubLogValue(key, value) {
      if (/token|password|secret|api[-_]?key|authorization/i.test(key)) return '[redacted]';
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const out = {};
        Object.keys(value).forEach(child => out[child] = scrubLogValue(child, value[child]));
        return out;
      }
      return value;
    }
    function redactLogLine(line) {
      const raw = String(line || '');
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const out = {};
          Object.keys(parsed).forEach(key => out[key] = scrubLogValue(key, parsed[key]));
          return JSON.stringify(out);
        }
      } catch {}
      return raw.replace(/((authorization|api[-_]?key|token|secret|password)["']?\\s*[:=]\\s*["']?)([^"',}\\s]+)/ig, '$1[redacted]');
    }
    function renderLogs() {
      const q = state.logSearch.toLowerCase();
      const lines = state.logLines.slice(-500).map(line => ({
        level: logLevelOf(line),
        text: redactLogLine(line)
      })).filter(line => {
        return (!state.logFilter || line.level === state.logFilter) && (!q || line.text.toLowerCase().includes(q));
      });
      if (!lines.length) {
        qs('logs').innerHTML = '<span class="log-line info">日志为空或没有符合筛选条件的日志。</span>';
        return;
      }
      qs('logs').innerHTML = lines.map(line => '<span class="log-line ' + line.level + '">' + esc(line.text) + '</span>').join('');
      if (qs('logAutoScroll').checked) qs('logs').scrollTop = qs('logs').scrollHeight;
    }
    function setView(view) {
      state.view = view;
      const titles = {
        dashboard: ['网关大盘', '本地网关、账号池和请求状态的快速视图。'],
        pool: ['账号池管理', '脱敏查看 Pool 账号状态和代理摘要。'],
        rules: ['路由规则', '本地 API Key 和网关转发路径。'],
        logs: ['系统日志', '最近 500 行网关日志。']
      };
      document.querySelectorAll('.nav button').forEach(btn => btn.classList.toggle('active', btn.dataset.view === view));
      document.querySelectorAll('.view').forEach(el => el.classList.toggle('active', el.id === 'view-' + view));
      qs('pageTitle').textContent = titles[view][0];
      qs('pageSub').textContent = titles[view][1];
    }
    async function refreshAll(silent = false) {
      if (!state.key) return;
      state.loading = true;
      qs('refresh').disabled = true;
      loadingCards();
      try {
        const [status, stats, config, logs, secrets, accounts] = await Promise.allSettled([
          api('/api/status'),
          api('/api/stats'),
          api('/api/config'),
          api('/api/logs'),
          api('/api/secrets'),
          api('/api/pool/accounts')
        ]);
        if (status.status === 'rejected') throw status.reason;
        if (stats.status === 'rejected') throw stats.reason;
        if (config.status === 'rejected') throw config.reason;
        state.status = status.value;
        state.stats = stats.value;
        state.config = config.value;
        state.logLines = logs.status === 'fulfilled' ? (logs.value.lines || []).slice(-500) : [];
        state.secrets = secrets.status === 'fulfilled' ? normalizeRows(secrets.value, ['apiKeys', 'secrets', 'items', 'data', 'rows']) : [];
        if (accounts.status === 'fulfilled') {
          state.poolError = '';
          state.accounts = normalizeRows(accounts.value, ['accounts', 'items', 'data', 'rows']);
        } else {
          state.poolError = accounts.reason.message || 'Pool Dashboard 请求失败';
          state.accounts = [];
          if (!silent) toast(state.poolError, 'warn');
        }
        renderAll();
        qs('login').classList.add('hidden');
        qs('app').classList.remove('hidden');
        if (!silent) toast('控制台已刷新', 'success');
      } catch (err) {
        qs('login').classList.remove('hidden');
        qs('app').classList.add('hidden');
        qs('loginMsg').textContent = err.message || String(err);
        toast(err.message || String(err), 'error');
      } finally {
        qs('refresh').disabled = false;
        state.loading = false;
      }
    }
    async function refreshPool() {
      const btn = qs('refreshPool');
      btn.disabled = true;
      try {
        const data = await api('/api/pool/accounts');
        state.poolError = '';
        state.accounts = normalizeRows(data, ['accounts', 'items', 'data', 'rows']);
        renderAccounts();
        bindSecretButtons();
        toast('账号池已刷新', 'success');
      } catch (err) {
        state.poolError = err.message || String(err);
        state.accounts = [];
        renderAccounts();
        toast(state.poolError, 'warn');
      } finally {
        btn.disabled = false;
      }
    }
    function renderAll() {
      renderMetrics();
      renderConfig();
      renderSecrets();
      renderErrors();
      renderAccounts();
      renderLogs();
      qs('poolLink').href = (state.config && state.config.pool && state.config.pool.dashboardUrl) || boot.pool.dashboardUrl;
      bindSecretButtons();
    }
    qs('unlock').onclick = async () => {
      state.key = qs('password').value;
      sessionStorage.setItem('wpa_mgmt', state.key);
      await refreshAll(true);
    };
    qs('password').addEventListener('keydown', e => { if (e.key === 'Enter') qs('unlock').click(); });
    qs('refresh').onclick = () => refreshAll(false);
    qs('refreshPool').onclick = refreshPool;
    qs('toggleSecrets').onclick = () => {
      const next = !Object.values(state.visibleSecrets).some(Boolean);
      Object.keys(state.secretValues).forEach(key => state.visibleSecrets[key] = next);
      renderAll();
    };
    document.querySelectorAll('.nav button').forEach(btn => btn.onclick = () => setView(btn.dataset.view));
    qs('logSearch').oninput = () => { state.logSearch = qs('logSearch').value; renderLogs(); };
    qs('logAutoScroll').onchange = renderLogs;
    document.querySelectorAll('#logLevelSeg button').forEach(btn => {
      btn.onclick = () => {
        state.logFilter = btn.dataset.level || '';
        document.querySelectorAll('#logLevelSeg button').forEach(x => x.classList.toggle('active', x === btn));
        renderLogs();
      };
    });
    renderConfig();
    loadingCards();
    if (state.key) refreshAll(true).catch(() => {});
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
      latencyMs: typeof poolRecord.latencyMs === 'number' ? poolRecord.latencyMs : null,
      statusCode: typeof poolRecord.statusCode === 'number' ? poolRecord.statusCode : null,
    },
  };
}
