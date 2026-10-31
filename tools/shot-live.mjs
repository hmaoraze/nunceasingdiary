#!/usr/bin/env node
/**
 * 线上页面截图（用于发布后验收）
 *
 * 用法：
 *   node tools/shot-live.mjs <url> <输出文件> [mobile]
 *
 * 例：node tools/shot-live.mjs https://blog.imce.cn/ C:/tmp/home.png mobile
 */
import { chromium } from 'playwright-core';

const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];

const url = process.argv[2];
const out = process.argv[3];
const mobile = process.argv[4] === 'mobile';

if (!url || !out) {
  console.error('用法：node tools/shot-live.mjs <url> <输出文件> [mobile]');
  process.exit(1);
}

const browser = await chromium.launch({
  executablePath: CHROME_CANDIDATES[0],
  headless: true,
  args: ['--no-sandbox'],
});

const context = await browser.newContext(
  mobile
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true }
    : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
);

const page = await context.newPage();
await page.goto(url, { waitUntil: 'load', timeout: 60000 });
// 留时间给入场动画与图片解码
await page.waitForTimeout(3500);
await page.screenshot({ path: out });
await browser.close();
console.log('✓', out);
