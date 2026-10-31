#!/usr/bin/env node
/**
 * 静态资源版本化（跑在 hexo generate 之后）
 *
 * 目标：让 /static/<buildId>/... 可以放心设一年 immutable 缓存。
 *
 * 做法（版本目录方案，不改 JS 内部 import、风险最低）：
 *   1. buildId = js/css/fonts 等目录的内容哈希前 8 位
 *   2. 把这些目录整体复制到 public/static/<buildId>/ 下，保持内部相对路径
 *      （CSS 里的 ../webfonts/xxx.woff2 因此仍然成立）
 *   3. 遍历所有 HTML，把 ="<目录>/... 改写成 ="/static/<buildId>/<目录>/...
 *
 * 保留上一版 static 目录，避免正在浏览的会话切页 404。
 *
 * 用法：node tools/version-assets.mjs
 */
import path from 'node:path';
import fsp from 'node:fs/promises';
import crypto from 'node:crypto';

const PUBLIC_DIR = path.resolve('public');
const STATIC_ROOT = path.join(PUBLIC_DIR, 'static');

/** 需要版本化的目录（相对 public/） */
const VERSIONED_DIRS = ['js', 'css', 'fonts', 'fontawesome', 'webfonts', 'assets'];

const MAX_KEEP_VERSIONS = 3;

async function exists(p) {
  try {
    await fsp.stat(p);
    return true;
  } catch {
    return false;
  }
}

async function walkFiles(dir, base = dir, out = []) {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await walkFiles(p, base, out);
    else out.push(path.relative(base, p).split(path.sep).join('/'));
  }
  return out;
}

/** 用目录内容算 buildId：内容不变则 id 不变，避免无谓的缓存失效 */
async function computeBuildId() {
  const hash = crypto.createHash('sha256');
  for (const dir of VERSIONED_DIRS) {
    const abs = path.join(PUBLIC_DIR, dir);
    if (!(await exists(abs))) continue;
    const files = (await walkFiles(abs)).sort();
    for (const rel of files) {
      const buf = await fsp.readFile(path.join(abs, rel));
      hash.update(dir + '/' + rel);
      hash.update(buf);
    }
  }
  return hash.digest('hex').slice(0, 8);
}

async function copyDir(src, dest) {
  await fsp.mkdir(dest, { recursive: true });
  await fsp.cp(src, dest, { recursive: true, force: true });
}

async function rewriteHtml(buildId) {
  const htmlFiles = [];
  async function walk(dir) {
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === 'static') continue; // 别改到自己身上
        await walk(p);
      } else if (e.name.endsWith('.html')) {
        htmlFiles.push(p);
      }
    }
  }
  await walk(PUBLIC_DIR);

  const prefixes = VERSIONED_DIRS.map((d) => `="${d}/`);
  let touched = 0;

  for (const file of htmlFiles) {
    let html = await fsp.readFile(file, 'utf8');
    const before = html;
    for (const d of VERSIONED_DIRS) {
      // 只替换"以引号开头的绝对路径"，避免误伤 /static/ 或正文里的相对链接
      html = html.split(`="/${d}/`).join(`="/static/${buildId}/${d}/`);
    }
    if (html !== before) {
      await fsp.writeFile(file, html);
      touched += 1;
    }
  }
  return { total: htmlFiles.length, touched };
}

/** 只保留最近几个版本，避免 public 无限膨胀 */
async function pruneVersions(currentId) {
  if (!(await exists(STATIC_ROOT))) return [];
  const dirs = (await fsp.readdir(STATIC_ROOT, { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  const keep = dirs.slice(-MAX_KEEP_VERSIONS);
  if (!keep.includes(currentId)) keep.push(currentId);

  const removed = [];
  for (const d of dirs) {
    if (keep.includes(d)) continue;
    await fsp.rm(path.join(STATIC_ROOT, d), { recursive: true, force: true });
    removed.push(d);
  }
  return removed;
}

async function main() {
  if (!(await exists(PUBLIC_DIR))) {
    console.error('public/ 不存在，请先执行 hexo generate');
    process.exit(1);
  }

  const buildId = await computeBuildId();
  const target = path.join(STATIC_ROOT, buildId);

  if (await exists(target)) {
    await fsp.rm(target, { recursive: true, force: true });
  }

  for (const dir of VERSIONED_DIRS) {
    const src = path.join(PUBLIC_DIR, dir);
    if (!(await exists(src))) continue;
    await copyDir(src, path.join(target, dir));
  }

  const { total, touched } = await rewriteHtml(buildId);
  const removed = await pruneVersions(buildId);

  console.log(`  buildId            ${buildId}`);
  console.log(`  版本化目录         ${VERSIONED_DIRS.join(', ')}`);
  console.log(`  HTML 改写          ${touched}/${total} 个文件`);
  if (removed.length) console.log(`  清理旧版本         ${removed.join(', ')}`);
  console.log('\n✓ 静态资源已落到 /static/' + buildId + '/');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
