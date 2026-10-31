/**
 * 批量验证构建产物里带又拍云处理参数的图片 URL
 *
 * 防的是这一类事故：某张图在又拍云处理失败（或源文件已失效），
 * CDN 返回 200 + 一张 800×600 的"404 插画"占位图——页面不会报错，
 * 但用户看到的是错误图。构建不会发现，只有逐个拉一遍才知道。
 *
 * 用法： node tools/verify-cdn-images.mjs
 * 退出码非 0 = 有坏图，应该先修再发布。
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { PRESETS } = require('../themes/defaultone/scripts/utils/cdn-image.js');

const PUBLIC_DIR = path.resolve('public');

// 又拍云图床 + 处理参数。参数段形如 `!/fw/1280/quality/75/format/webp`，
// 必须一路吃到最后一个参数（不能停在开头的 `!/`，否则拉到的是空参数 URL）
const RE =
  /https?:\/\/[a-z0-9.-]*(?:hsmao|timens)\.cn\/[^\s"'<>]*!\/(?:[a-z0-9-]+\/)*[a-z0-9-]*/gi;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

let sharp = null;
try {
  sharp = require("sharp");
} catch {
  sharp = null;
}

/**
 * 又拍云处理失败/源文件失效时，会返回一张固定的 800×600 "404" 插画，
 * 状态码却是 200 —— 页面看起来正常、控制台也不报错，很容易漏掉。
 * 光靠体积猜会误伤（不少真图就在 25~30KB），所以按尺寸 + 体积双重判定。
 */
async function isPlaceholder(buf, type) {
  if (!sharp || !/png/i.test(type)) return false;
  try {
    const m = await sharp(buf).metadata();
    return m.width === 800 && m.height === 600 && Math.abs(buf.length - 29700) < 8000;
  } catch {
    return false;
  }
}

async function checkUrl(url) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    const buf = Buffer.from(await r.arrayBuffer());
    const type = r.headers.get('content-type') || '';
    // isPlaceholder 是 async，漏了 await 会拿到 Promise（恒真值）而误判全部失败
    const placeholder = await isPlaceholder(buf, type);
    return {
      ok: r.status === 200 && /^image\//i.test(type) && !placeholder,
      status: r.status,
      type,
      size: buf.length,
    };
  } catch (e) {
    return { ok: false, status: 0, type: e.message, size: 0 };
  }
}

const files = walk(PUBLIC_DIR);
const urls = new Map();
for (const f of files) {
  const h = fs.readFileSync(f, 'utf8');
  for (const m of h.matchAll(RE)) {
    const u = m[0].replace(/&amp;/g, '&');
    if (!urls.has(u)) urls.set(u, []);
    urls.get(u).push(path.relative(PUBLIC_DIR, f));
  }
}

// 只校验「本次改造生成」的 URL：参数段等于 cdn_img 四个 preset 之一。
// 文章原文里作者手写的参数（如 /format/webp/scale/30）不属于我们产出，
// 不计入失败，避免出现"别人的图、我们背锅"的误报。
const OUR_PARAMS = new Set(Object.values(PRESETS));
const isOurs = (u) => {
  const i = u.indexOf('!');
  return i !== -1 && OUR_PARAMS.has(u.slice(i));
};

const ours = [...urls.keys()].filter(isOurs);
const others = [...urls.keys()].filter((u) => !isOurs(u));

console.log(`带又拍云参数的 URL：${urls.size} 个（去重）`);
console.log(`  本次改写产出 ${ours.length} 个 → 逐个校验`);
console.log(`  文章原文自带 ${others.length} 个 → 跳过（非本次产物）\n`);

const bad = [];
let checked = 0;
for (const u of ours) {
  const refs = urls.get(u);
  const r = await checkUrl(u);
  checked++;
  process.stdout.write(`\r${checked}/${ours.length}`);
  if (!r.ok) bad.push({ url: u, ...r, pages: refs.slice(0, 3) });
}
console.log('\n');

if (bad.length === 0) {
  console.log('✓ 全部可用（200 + image/* + 非占位图）');
} else {
  console.log(`✗ ${bad.length} 个坏 URL：\n`);
  for (const b of bad) {
    console.log(`  [${b.status}] ${(b.type || '').slice(0, 30)}  ${b.url}`);
    console.log(`       引用页: ${b.pages.join(', ')}`);
  }
  process.exit(1);
}
