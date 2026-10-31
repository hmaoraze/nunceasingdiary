/**
 * 测量「某个页面上外链图片」的真实开销（改造前后同口径对比用）
 *
 * 用法： MSYS_NO_PATHCONV=1 node tools/probe-img.mjs /[,/links/[,/xxx/]] [mobile|desktop] [轮数]
 *
 * 为什么单独脚本：tools/probe.mjs 关注的是整页综合指标，这里只看图床那一类请求，
 * 能直接回答「加又拍云参数前后，某一页到底少下了多少字节」。
 */
import http from 'node:http';
import fsp from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { chromium } from 'playwright-core';

const PUBLIC_DIR = path.resolve('public');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const CDN_HOSTS = /(hsmao|timens)\.cn/;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.avif': 'image/avif',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
};
const GZIPPABLE = new Set(['.html', '.js', '.css', '.svg', '.json']);

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
    const headers = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    };
    if (GZIPPABLE.has(ext) && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
      buf = zlib.gzipSync(buf);
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

async function measure(browser, route, opts) {
  const ctx = await browser.newContext(opts.context);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (0.75 * 1024 * 1024) / 8,
  });

  const images = new Map();
  page.on('response', async (res) => {
    const url = res.url();
    if (!CDN_HOSTS.test(url)) return;
    let bytes = 0;
    try {
      const b = await res.body();
      bytes = b.length;
    } catch {
      bytes = 0;
    }
    if (images.has(url)) return;
    images.set(url, { bytes, status: res.status(), type: res.headers()['content-type'] || '' });
  });

  await page.goto(`http://127.0.0.1:${SERVER_PORT}${route}`, { waitUntil: 'load', timeout: 90000 });
  // 图片懒加载 + 滚动到底才全部触发
  await page.evaluate(async () => {
    await new Promise((r) => {
      let y = 0;
      const t = setInterval(() => {
        y += window.innerHeight;
        window.scrollTo(0, y);
        if (y > document.body.scrollHeight) {
          clearInterval(t);
          window.scrollTo(0, 0);
          r();
        }
      }, 180);
    });
  });
  // 关键：必须等所有 <img> 真正下载完（complete=true）才结算。
  // 1.6Mbps 下几张几百 KB 的原图要好几秒，只 waitForTimeout(3000) 会把
  // 没下完的图漏统计 —— 那样"改造前"反而显得更小，得出错误结论。
  await page
    .waitForFunction(
      () => {
        const imgs = [...document.querySelectorAll('img')];
        return imgs.length > 0 && imgs.every((i) => i.complete);
      },
      { timeout: 120000, polling: 500 },
    )
    .catch(() => console.log('    ⚠ 部分图片未在 120s 内加载完（记为已触发但未完成）'));
  await page.waitForTimeout(1500);

  await ctx.close();
  const list = [...images.entries()].map(([url, v]) => ({ url, ...v }));
  const total = list.reduce((s, r) => s + r.bytes, 0);
  return { count: list.length, total, list };
}

const SERVER_PORT = Number(process.env.PROBE_PORT || 4388);

async function main() {
  const argPaths = (process.argv[2] || '/').split(',');
  const paths = argPaths.map((p) => (p && p[0] === '/' ? p : '/' + (p || '')));
  const device = process.argv[3] || 'mobile';
  const rounds = Number(process.argv[4] || 1);

  const context =
    device === 'desktop'
      ? { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }
      : { viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 3 };

  await new Promise((r) => server.listen(SERVER_PORT, '127.0.0.1', r));
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });

  for (const p of paths) {
    const runs = [];
    for (let i = 0; i < rounds; i++) runs.push(await measure(browser, p, { context }));
    const med = (arr) =>
      arr.slice().sort((a, b) => a - b)[Math.floor(arr.length / 2)] ?? 0;
    const totalMed = med(runs.map((r) => r.total));
    const countMed = med(runs.map((r) => r.count));
    const last = runs[runs.length - 1];

    console.log(`\n=== ${p}  (${device}, CPU 4×, 1.6Mbps) ===`);
    console.log(
      `外链图片 ${countMed} 张   合计 ${(totalMed / 1024).toFixed(1)} KB   （${rounds} 轮中位数）`,
    );
    last.list
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 8)
      .forEach((r) => {
        const short = r.url.replace(/^https?:\/\//, '').replace(/\?.*$/, '');
        console.log(
          `  ${(r.bytes / 1024).toFixed(1).padStart(8)} KB  ${String(r.status).padStart(3)}  ${(r.type || '-').padEnd(12)} ${short.slice(0, 74)}`,
        );
      });
  }

  await browser.close();
  server.close();
}

main().catch((e) => {
  console.error(e);
  server.close();
  process.exit(1);
});
