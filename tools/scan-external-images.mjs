/**
 * 扫描 public/ 里真实引用的外部图床图片，统计：
 *  - 去重 URL 数、是否已带又拍云处理参数
 *  - 每\tan  quanzhang 的实际 Content-Length（原始 vs 加参数后）
 *
 * 用法： node tools/scan-external-images.mjs [--probe]
 */
import fs from 'node:fs';
import path from 'node:path';
import fsp from 'node:fs/promises';

const PUBLIC_DIR = path.resolve('public');
const OUT = '.perf/ext-imgs-real.txt';

const RE = new RegExp(
  'https:\\/\\/[a-z0-9.-]*(?:hsmao|timens)\\.cn\\/[^"\')\\s<>]+\\.(?:jpg|jpeg|png|webp|gif|bmp)[^"\')\\s<>]*',
  'gi',
);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

/** 去掉已有又拍云参数，得到源图 URL */
function stripParams(u) {
  const i = u.indexOf('!/');
  const base = i === -1 ? u : u.slice(0, i);
  return base.replace(/\?.*$/, '');
}

async function head(url) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    await r.arrayBuffer();
    return { status: r.status, len: +(r.headers.get('content-length') || 0), type: r.headers.get('content-type') || '' };
  } catch (e) {
    return { status: 0, len: 0, type: '', err: e.message };
  }
}

async function size(url) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30000);
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    const b = await r.arrayBuffer();
    return b.byteLength;
  } catch {
    return 0;
  }
}

const files = fs.existsSync(PUBLIC_DIR) ? walk(PUBLIC_DIR) : [];
const seen = new Map();
const raw = new Map();
for (const f of files) {
  const h = fs.readFileSync(f, 'utf8');
  for (const m of h.matchAll(RE)) {
    const k = stripParams(m[0]);
    seen.set(k, (seen.get(k) || 0) + 1);
    raw.set(m[0], true);
  }
}
const urls = [...seen.keys()];
await fsp.writeFile(OUT, urls.join('\n'));
const withParams = [...raw.keys()].filter((u) => u.includes('!/')).length;
console.log(`构建产物引用的外链图片：${urls.length} 个去重 URL`);
console.log(`其中已带又拍云 !/ 参数：${withParams} 个，未带参数：${urls.length - withParams} 个`);

if (process.argv.includes('--probe')) {
  console.log('\n逐个 HEAD 探测原始体积（Content-Length）…\n');
  let total = 0;
  const rows = [];
  for (const u of urls) {
    const stub = /^https?:/.test(u) ? u : `https:${u}`;
    const r = await head(stub);
    if (r.len) total += r.len;
    rows.push({ url: u, ...r });
    process.stdout.write('.');
  }
  console.log('\n');
  rows.sort((a, b) => b.len - a.len);
  const kb = (n) => (n / 1024).toFixed(1) + ' KB';
  for (const r of rows.slice(0, 25)) {
    console.log(
      `${kb(r.len).padStart(10)}  ${String(r.status).padStart(3)}  ${(r.type || '-').padEnd(24)} ${r.url.slice(0, 78)}`,
    );
  }
  console.log(`\n合计 ${kb(total)}，共 ${rows.length} 张`);
}
