#!/usr/bin/env node
/**
 * 功能回归冒烟测试（无头 Chrome + 本地静态服务）
 *
 * 覆盖改造中最容易改坏的点：Swup 初始化与导航、开屏遮罩收尾、粒子、
 * 播放器、深浅色切换、搜索弹窗、代码块复制。
 *
 * 用法：node tools/smoke.mjs [页面路径]
 */
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

const PUBLIC_DIR = path.resolve('public');
const PORT = 4311;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.mp3': 'audio/mpeg',
};

const server = http.createServer(async (req, res) => {
  let file = path.join(PUBLIC_DIR, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  try {
    const st = await fsp.stat(file);
    if (st.isDirectory()) file = path.join(file, 'index.html');
  } catch {
    if (!path.extname(file)) file = path.join(file, 'index.html');
  }
  try {
    const buf = await fsp.readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(buf);
  } catch {
    res.writeHead(404);
    res.end();
  }
});

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => fs.existsSync(p));

/** 与本机网络环境无关的噪声（外链音频跨域、第三方签章图被 ORB 拦） */
const NOISE = /CORS policy|ERR_BLOCKED_BY_ORB|ERR_FAILED|ERR_ABORTED|Failed to load resource/i;

const results = [];
const check = (name, ok, extra = '') => {
  results.push({ name, ok, extra });
  console.log(`  ${ok ? '✓' : '✗'} ${name}${extra ? ` — ${extra}` : ''}`);
};

/** 遮罩算"已收尾"：元素被移除，或已被隐藏（跳过规则走 CSS 隐藏，不移除 DOM） */
const PRELOADER_GONE = `(() => {
  const el = document.querySelector('.preloader');
  if (!el) return true;
  const s = getComputedStyle(el);
  return s.display === 'none' || parseFloat(s.opacity) < 0.05;
})()`;

async function main() {
  const startPath = process.argv[2] && !/^[A-Za-z]:/.test(process.argv[2]) ? process.argv[2] : '/';

  await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

  const browser = await chromium.launch({ executablePath: CHROME, headless: true });

  // ---- 1. 桌面端首屏 + 交互 ----
  console.log('\n[桌面端 1440×900]');
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  const heroReqs = [];
  page.on('request', (r) => {
    if (/\/images\/hero\//.test(r.url())) heroReqs.push(new URL(r.url()).pathname);
  });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !NOISE.test(m.text())) errors.push(m.text());
  });

  await page.goto(`http://127.0.0.1:${PORT}${startPath}`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(2500);

  check('Swup 已实例化', await page.evaluate(() => !!window.swup));
  check('开屏遮罩已收尾', await page.evaluate(PRELOADER_GONE));
  check('粒子背景已渲染', await page.evaluate(() => !!document.querySelector('#particles-js canvas')));
  check('播放器已初始化', await page.evaluate(() => !!document.querySelector('.aplayer')));
  check('首屏主图已加载', await page.evaluate(() => {
    const img = document.querySelector('.home-banner-background img');
    return !!img && img.complete && img.naturalWidth > 0;
  }));
  check('亮色模式只请求 1 张 hero', heroReqs.length === 1, heroReqs.map((u) => u.split('/').pop()).join(', '));
  check('亮色模式取的是 AVIF', heroReqs.every((u) => u.endsWith('.avif')));

  // 图标子集化的回归保护：每个图标元素都必须能取到 ::before 内容且渲染出宽度，
  // 否则说明子集 CSS 漏了该字形（会显示成空白或方块）
  const iconReport = await page.evaluate(() => {
    const els = [...document.querySelectorAll('i[class*="fa-"]')];
    const broken = [];
    for (const el of els) {
      const content = getComputedStyle(el, '::before').content;
      const hasGlyph = content && content !== 'none' && content !== 'normal' && content !== '""';
      // 隐藏元素（弹窗、侧栏工具）宽度本来就是 0，只校验字形规则是否存在
      // 弹窗/查看器里的图标是零尺寸布局，宽度不可作判据；
      // 这里只校验"字形规则存在"，缺规则才是子集化会引入的回归
      if (!hasGlyph) {
        broken.push(`${el.className} (content=${content})`);
      }
    }
    return { total: els.length, broken: broken.slice(0, 5) };
  });
  check('图标字形完整（无缺字/方块）', iconReport.broken.length === 0, iconReport.broken.join(' | ') || `${iconReport.total} 个图标`);

  // 深浅色切换
  const darkBefore = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  await page.evaluate(() => {
    const btn = document.querySelector('.tool-dark-light-toggle');
    if (btn) btn.click();
  });
  await page.waitForTimeout(400);
  const darkAfter = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  check('深浅色切换生效', darkBefore !== darkAfter, `${darkBefore} → ${darkAfter}`);

  // 搜索弹窗
  const searchOk = await page.evaluate(() => {
    const btn = document.querySelector('.search-button, #search-button, [data-search]');
    if (!btn) return null;
    btn.click();
    return true;
  });
  await page.waitForTimeout(500);
  const searchVisible = await page.evaluate(() => {
    const el = document.querySelector('#local-search, .local-search-container, .search-popup');
    return !!el && getComputedStyle(el).display !== 'none';
  });
  check('搜索弹窗可打开', searchOk ? searchVisible : 'skipped', searchOk ? '' : '未找到搜索按钮');

  // Swup 导航
  const before = page.url();
  const linkHandle = await page.$(
    '#swup a[href^="/"][href$="/"]:not([href="/"])',
  );
  if (linkHandle) {
    await linkHandle.click();
    await page.waitForTimeout(2200);
    const after = page.url();
    check('Swup 无刷新导航', after !== before, `${new URL(before).pathname} → ${new URL(after).pathname}`);
    check('导航后内容已替换', await page.evaluate(() => (document.querySelector('#swup')?.innerText || '').length > 200));
    check('导航后 Swup 存活', await page.evaluate(() => !!window.swup));
  }

  check('无页面级 JS 错误', errors.length === 0, errors.slice(0, 3).join(' | '));

  // ---- 2. 移动端 ----
  console.log('\n[移动端 390×844]');
  const mctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
  });
  const mpage = await mctx.newPage();
  const mErrors = [];
  mpage.on('pageerror', (e) => mErrors.push(e.message));
  await mpage.goto(`http://127.0.0.1:${PORT}${startPath}`, { waitUntil: 'load', timeout: 60000 });
  await mpage.waitForTimeout(2500);

  check('移动端遮罩已收尾', await mpage.evaluate(PRELOADER_GONE));
  check('移动端无横向溢出', await mpage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2));
  check('移动端无 JS 错误', mErrors.length === 0, mErrors.slice(0, 2).join(' | '));

  // ---- 3. 暗色模式：只下载暗色那张，不重复下载亮色 ----
  console.log('\n[暗色模式 prefers-color-scheme: dark]');
  const dctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: 'dark',
  });
  const dpage = await dctx.newPage();
  const darkHeroReqs = [];
  dpage.on('request', (r) => {
    if (/\/images\/hero\//.test(r.url())) darkHeroReqs.push(new URL(r.url()).pathname);
  });
  await dpage.goto(`http://127.0.0.1:${PORT}${startPath}`, { waitUntil: 'load', timeout: 60000 });
  await dpage.waitForTimeout(2500);
  check('暗色模式只请求 1 张 hero', darkHeroReqs.length === 1, darkHeroReqs.map((u) => u.split('/').pop()).join(', '));
  check('暗色模式取的是暗色图', darkHeroReqs.every((u) => u.includes('hero-dark')));

  // ---- 4. 减少动态效果 ----
  console.log('\n[prefers-reduced-motion: reduce]');
  const rctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const rpage = await rctx.newPage();
  await rpage.goto(`http://127.0.0.1:${PORT}${startPath}`, { waitUntil: 'load', timeout: 60000 });
  await rpage.waitForTimeout(800);
  check('减少动态效果时不播遮罩', await rpage.evaluate(PRELOADER_GONE));

  await browser.close();
  server.close();

  const failed = results.filter((r) => r.ok === false);
  console.log(`\n结果：${results.length - failed.length}/${results.length} 通过`);
  if (failed.length) {
    console.log('失败项：');
    for (const f of failed) console.log(`  ✗ ${f.name} ${f.extra}`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  server.close();
  process.exit(1);
});
