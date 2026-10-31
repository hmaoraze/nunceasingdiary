#!/usr/bin/env node
/**
 * 首屏性能实测脚本（本地起静态服务 + Chrome CDP 限速）
 *
 * 用系统里已安装的 Chrome，不需要额外下载 Chromium。
 * 默认模拟：移动端 390×844、1.6 Mbps 下行、RTT 150 ms、CPU 4× 降速。
 *
 * 用法：
 *   node tools/probe.mjs                      # 首页，mobile
 *   node tools/probe.mjs / mobile             # 指定路径
 *   node tools/probe.mjs / desktop 3          # 桌面端，跑 3 次
 */
import http from 'node:http';
import zlib from 'node:zlib';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

const PUBLIC_DIR = path.resolve('public');
const PORT = 4310;

const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
};

const GZIP_TYPES = new Set(['.html', '.js', '.mjs', '.css', '.json', '.xml', '.svg', '.txt']);

const server = http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.join(PUBLIC_DIR, p);
    try {
      const st = await fsp.stat(file);
      if (st.isDirectory()) file = path.join(file, 'index.html');
    } catch {
      if (!path.extname(file)) file = path.join(file, 'index.html');
    }
    let buf = await fsp.readFile(file);
    const ext = path.extname(file).toLowerCase();

    // 线上静态站会开 gzip，本地也压一遍，否则传输量会被高估一倍以上
    const acceptsGzip = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
    const headers = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    };
    if (GZIP_TYPES.has(ext) && acceptsGzip && buf.length > 1024) {
      buf = zlib.gzipSync(buf, { level: 6 });
      headers['Content-Encoding'] = 'gzip';
    }
    headers['Content-Length'] = buf.length;
    res.writeHead(200, headers);
    res.end(buf);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('not found');
  }
});

const findChrome = () => CHROME_CANDIDATES.find((p) => fs.existsSync(p));

const PROFILES = {
  mobile: { width: 390, height: 844, dpr: 3, mobile: true },
  desktop: { width: 1440, height: 900, dpr: 1, mobile: false },
};

/** 在页面导航前注入采集器 */
const INIT_SCRIPT = `
(() => {
  window.__perf = { lcp: 0, cls: 0, longTasks: 0, longTaskCount: 0, preloaderGone: null };

  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__perf.lcp = e.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch (e) {}

  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (!e.hadRecentInput) window.__perf.cls += e.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  } catch (e) {}

  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        window.__perf.longTasks += e.duration;
        window.__perf.longTaskCount += 1;
      }
    }).observe({ type: 'longtask', buffered: true });
  } catch (e) {}

  // 轮询开屏遮罩何时消失（内容真正可见的时刻）
  // 注意：init 脚本在 body 解析前就跑，必须先等到遮罩出现，再判定消失
  const t0 = performance.now();
  let seen = false;
  const timer = setInterval(() => {
    const el = document.querySelector('.preloader');
    if (el) seen = true;
    const gone = !el || el.style.display === 'none' || getComputedStyle(el).display === 'none';
    if (seen && gone) {
      if (window.__perf.preloaderGone === null) window.__perf.preloaderGone = performance.now();
      clearInterval(timer);
    } else if (performance.now() - t0 > 20000) {
      clearInterval(timer);
    }
  }, 16);
})();
`;

async function runOnce({ pathname, profile, chromePath }) {
  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  const ctx = await browser.newContext({
    viewport: { width: profile.width, height: profile.height },
    deviceScaleFactor: profile.dpr,
    isMobile: profile.mobile,
    hasTouch: profile.mobile,
    userAgent: profile.mobile
      ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      : undefined,
  });

  const page = await ctx.newPage();
  const client = await ctx.newCDPSession(page);

  // CPU 4× 降速 + 1.6 Mbps / 150 ms 网络
  await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await client.send('Network.enable');
  await client.send('Network.setCacheDisabled', { cacheDisabled: true });
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (0.75 * 1024 * 1024) / 8,
    connectionType: 'cellular4g',
  });

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));

  const requests = new Map();
  const failed = [];

  // 用 CDP 的 encodedDataLength 统计真实上/下行字节（含压缩后体积）
  const reqIdToUrl = new Map();
  client.on('Network.requestWillBeSent', (e) => {
    reqIdToUrl.set(e.requestId, e.request.url);
  });
  client.on('Network.loadingFinished', (e) => {
    const url = reqIdToUrl.get(e.requestId);
    if (!url) return;
    const prev = requests.get(url);
    requests.set(url, Math.max(prev || 0, e.encodedDataLength || 0));
  });
  page.on('requestfailed', (req) => failed.push(`${req.url()} — ${req.failure()?.errorText}`));

  await page.addInitScript(INIT_SCRIPT);
  const navStart = Date.now();
  await page.goto(`http://127.0.0.1:${PORT}${pathname}`, {
    waitUntil: 'load',
    timeout: 60000,
  });
  // 给遮罩淡出与 LCP 结算留时间
  await page.waitForTimeout(6000);

  const metrics = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] || {};
    const paint = performance.getEntriesByType('paint');
    const fcp = paint.find((p) => p.name === 'first-contentful-paint');
    return {
      fcp: fcp ? fcp.startTime : null,
      lcp: window.__perf.lcp,
      dcl: nav.domContentLoadedEventEnd,
      load: nav.loadEventEnd,
      ttfb: nav.responseStart,
      cls: window.__perf.cls,
      longTasks: window.__perf.longTasks,
      longTaskCount: window.__perf.longTaskCount,
      preloaderGone: window.__perf.preloaderGone,
      resources: performance.getEntriesByType('resource').length,
    };
  });

  await browser.close();

  const entries = [...requests.entries()].map(([url, bytes]) => ({ url, bytes }));
  const transferred = entries.reduce((s, r) => s + r.bytes, 0);

  return {
    ...metrics,
    transferred,
    requestCount: entries.length,
    wallClock: Date.now() - navStart,
    consoleErrors,
    failed,
    topAssets: entries
      .filter((r) => r.bytes > 0)
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 8)
      .map((r) => ({ url: r.url.replace(/^http:\/\/127\.0\.0\.1:\d+/, ''), kb: +(r.bytes / 1024).toFixed(1) })),
  };
}

const median = (arr) => {
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const fmtMs = (v) => (v == null ? 'n/a' : `${Math.round(v)} ms`);
const fmtKb = (v) => `${(v / 1024).toFixed(0)} KB`;

/** Git Bash 会把 "/" 这类参数转成 Windows 路径，这里还原成 URL 路径 */
const normalizePath = (raw) => {
  if (!raw) return '/';
  if (/^[A-Za-z]:[\\/]/.test(raw) || raw.includes('\\')) return '/';
  return raw.startsWith('/') ? raw : `/${raw}`;
};

async function main() {
  const pathname = normalizePath(process.argv[2]);
  const mode = process.argv[3] || 'mobile';
  const rounds = Number(process.argv[4] || 3);
  const profile = PROFILES[mode] || PROFILES.mobile;
  const chromePath = findChrome();

  if (!chromePath) {
    console.error('未找到 Chrome/Edge，无法实测。');
    process.exit(1);
  }

  await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
  console.log(`静态服务: http://127.0.0.1:${PORT}  配置: ${mode}  轮次: ${rounds}\n`);

  const runs = [];
  for (let i = 1; i <= rounds; i++) {
    const r = await runOnce({ pathname, profile, chromePath });
    runs.push(r);
    console.log(
      `第 ${i} 次  FCP ${fmtMs(r.fcp)}  LCP ${fmtMs(r.lcp)}  DCL ${fmtMs(r.dcl)}  ` +
        `可见 ${fmtMs(r.preloaderGone)}  传输 ${fmtKb(r.transferred)}  请求 ${r.requestCount}  ` +
        `长任务 ${Math.round(r.longTasks)} ms/${r.longTaskCount}  CLS ${r.cls.toFixed(3)}`,
    );
  }

  const pick = (k) => median(runs.map((r) => r[k]).filter((v) => v != null));

  console.log(`\n${'='.repeat(72)}`);
  console.log('中位数汇总');
  console.log(`${'='.repeat(72)}`);
  const rows = [
    ['TTFB', fmtMs(pick('ttfb'))],
    ['FCP', fmtMs(pick('fcp'))],
    ['LCP', fmtMs(pick('lcp'))],
    ['DCL', fmtMs(pick('dcl'))],
    ['load', fmtMs(pick('load'))],
    ['内容可见（遮罩消失）', fmtMs(pick('preloaderGone'))],
    ['首屏传输', fmtKb(pick('transferred'))],
    ['请求数', String(Math.round(pick('requestCount')))],
    ['长任务累计', `${Math.round(pick('longTasks'))} ms`],
    ['CLS', pick('cls').toFixed(3)],
  ];
  for (const [k, v] of rows) console.log(`  ${k.padEnd(22)} ${v}`);

  const errs = [...new Set(runs.flatMap((r) => r.consoleErrors))];
  console.log(`\n控制台错误: ${errs.length === 0 ? '无' : errs.length + ' 条'}`);
  for (const e of errs.slice(0, 10)) console.log(`  ✗ ${e}`);

  const fails = [...new Set(runs.flatMap((r) => r.failed))];
  if (fails.length) {
    console.log(`\n请求失败: ${fails.length} 条`);
    for (const f of fails.slice(0, 10)) console.log(`  ✗ ${f}`);
  }

  const top = runs[0].topAssets;
  console.log(`\n最大资源（第 1 轮）:`);
  for (const a of top) console.log(`  ${String(a.kb).padStart(8)} KB  ${a.url}`);

  server.close();
}

main().catch((e) => {
  console.error(e);
  server.close();
  process.exit(1);
});
