#!/usr/bin/env node
/**
 * 首屏资源静态审计（不依赖浏览器，可在 CI / 本地复跑）
 *
 * 做法：解析 public/index.html 与 public/<任意页面>.html，收集所有 <script src>、
 * <link rel=stylesheet>、<img src/srcset>、preload 等引用，映射到 public/ 下的真实文件，
 * 统计「原始字节 / gzip 字节 / 请求数」，用于改造前后的客观对比。
 *
 * 用法：
 *   node scripts/perf-audit.mjs              # 默认审计首页
 *   node scripts/perf-audit.mjs index.html post/xxx/index.html
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';

const PUBLIC_DIR = path.resolve('public');
const DEFAULT_PAGES = ['index.html'];

const pages = process.argv.slice(2);
const targets = pages.length ? pages : DEFAULT_PAGES;

const gzipSize = (buf) => zlib.gzipSync(buf, { level: 9 }).length;

/** 从 HTML 里抠出所有需要下载的资源引用 */
function extractRefs(html) {
  const refs = new Set();

  // <script src="...">
  for (const m of html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)) refs.add(m[1]);
  // <link rel="stylesheet" href="...">
  for (const m of html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)) {
    refs.add(m[1]);
  }
  // <link rel="preload" ... href="...">
  for (const m of html.matchAll(/<link\b[^>]*rel="preload"[^>]*href="([^"]+)"/g)) {
    refs.add(m[1]);
  }
  // <img src="..."> 与 srcset
  for (const m of html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)) refs.add(m[1]);
  for (const m of html.matchAll(/\bsrcset="([^"]+)"/g)) {
    for (const part of m[1].split(',')) {
      const u = part.trim().split(/\s+/)[0];
      if (u) refs.add(u);
    }
  }
  // <source srcset="..."> 已被上面的 srcset 覆盖

  return [...refs].filter(
    (u) => u && !u.startsWith('data:') && !u.startsWith('http://') && !u.startsWith('https://'),
  );
}

const resolveLocal = (ref) => {
  const clean = ref.split('?')[0].split('#')[0];
  const abs = path.join(PUBLIC_DIR, clean.replace(/^\//, ''));
  return abs;
};

const fmt = (n) =>
  n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(2)} MB` : `${(n / 1024).toFixed(1)} KB`;

async function audit(page) {
  const file = path.join(PUBLIC_DIR, page);
  let html;
  try {
    html = await fs.readFile(file, 'utf8');
  } catch {
    console.log(`\n⚠ 跳过（不存在）: ${page}`);
    return null;
  }

  const refs = extractRefs(html);
  let raw = 0;
  let gz = 0;
  const missing = [];
  const rows = [];

  for (const ref of refs) {
    const abs = resolveLocal(ref);
    try {
      const buf = await fs.readFile(abs);
      const g = gzipSize(buf);
      raw += buf.length;
      gz += g;
      rows.push({ ref, raw: buf.length, gz: g });
    } catch {
      missing.push(ref);
    }
  }

  // 结构性计数：先把完整 <script ...> 开标签抓出来，才能判断 defer/async/module
  const scriptTags = [...html.matchAll(/<script\b[^>]*>/g)].map((m) => m[0]).filter((t) => /\bsrc=/.test(t));
  const blocking = scriptTags.filter((t) => !/\b(defer|async)\b/.test(t) && !/type="module"/.test(t)).length;
  const totalScripts = scriptTags.length;
  const stylesheets = [...html.matchAll(/rel="stylesheet"/g)].length;
  const emptyHref = [...html.matchAll(/href=""/g)].length;

  rows.sort((a, b) => b.gz - a.gz);

  console.log(`\n${'='.repeat(72)}`);
  console.log(`页面: ${page}`);
  console.log(`${'='.repeat(72)}`);
  console.log(`本地资源请求数         : ${refs.length}（成功解析 ${rows.length}，缺失 ${missing.length}）`);
  console.log(`本地资源传输量 (gzip)  : ${fmt(gz)}   （原始 ${fmt(raw)}）`);
  console.log(`<script src> 总数       : ${totalScripts}，其中解析阻塞: ${blocking}`);
  console.log(`<link rel=stylesheet>  : ${stylesheets}`);
  console.log(`空 href 数量            : ${emptyHref}`);

  if (missing.length) {
    console.log(`\n缺失文件（会 404）:`);
    for (const m of missing) console.log(`  ✗ ${m}`);
  }

  console.log(`\nTop 15 资源（按 gzip 体积）:`);
  for (const r of rows.slice(0, 15)) {
    console.log(`  ${fmt(r.gz).padStart(9)}  ${r.ref}`);
  }

  return { page, gz, raw, count: refs.length, blocking, stylesheets, emptyHref };
}

const results = [];
for (const p of targets) {
  const r = await audit(p);
  if (r) results.push(r);
}

console.log(`\n${'='.repeat(72)}`);
console.log('汇总');
console.log(`${'='.repeat(72)}`);
for (const r of results) {
  console.log(
    `${r.page.padEnd(36)} gzip ${fmt(r.gz).padStart(10)}  请求 ${String(r.count).padStart(3)}  阻塞脚本 ${r.blocking}`,
  );
}
