#!/usr/bin/env node
/**
 * 首屏截图（改造前后视觉对比用）
 *
 * 用法：
 *   node tools/shot.mjs <输出目录> [页面路径]
 *
 * 会依次输出：桌面亮色、桌面暗色、移动端亮色 三张 PNG。
 */
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

const PUBLIC_DIR = path.resolve('public');
const PORT = 4312;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml',
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

async function main() {
  const outDir = process.argv[2] || '.perf/shots';
  const pagePath = process.argv[3] && !/^[A-Za-z]:/.test(process.argv[3]) ? process.argv[3] : '/';
  await fsp.mkdir(outDir, { recursive: true });
  await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

  const browser = await chromium.launch({ executablePath: CHROME, headless: true });

  const shots = [
    { name: 'desktop-light', viewport: { width: 1440, height: 900 }, colorScheme: 'light' },
    { name: 'desktop-dark', viewport: { width: 1440, height: 900 }, colorScheme: 'dark' },
    { name: 'mobile-light', viewport: { width: 390, height: 844 }, colorScheme: 'light', isMobile: true, dpr: 3 },
  ];

  for (const s of shots) {
    const ctx = await browser.newContext({
      viewport: s.viewport,
      colorScheme: s.colorScheme,
      isMobile: !!s.isMobile,
      hasTouch: !!s.isMobile,
      deviceScaleFactor: s.dpr || 1,
      // 关掉遮罩，避免拍到开屏画面
      reducedMotion: 'no-preference',
    });
    const page = await ctx.newPage();
    await page.goto(`http://127.0.0.1:${PORT}${pagePath}`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(3000);
    // 确保遮罩已退场
    await page.evaluate(() => document.querySelectorAll('.preloader').forEach((el) => el.remove()));
    await page.waitForTimeout(300);
    const file = path.join(outDir, `${s.name}.png`);
    await page.screenshot({ path: file });
    console.log(`✓ ${file}`);
    await ctx.close();
  }

  await browser.close();
  server.close();
}

main().catch((e) => {
  console.error(e);
  server.close();
  process.exit(1);
});
