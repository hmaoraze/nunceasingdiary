#!/usr/bin/env node
/**
 * 一次性迁移：把 defaultone（Redefine）时代的 Front Matter 转成 Stellar v2 规范
 *
 * 背景：换主题后 doctor 报了 1400+ 条「未知字段」警告，都是旧主题的默认字段。
 * 处理策略（保守，只动 front-matter 区块，不碰正文）：
 *   - 删除 thumbnail / top_img：128 篇全是同一张占位图，迁成 cover 只会让列表
 *     每张卡片都一样，不如留纯文字卡片，以后按文章单独补 cover
 *   - 删除 aside / toc / toc_number / copyright / aplayer / highlight_shrink：旧主题专属
 *   - 删除 mathjax / katex: false：Stellar 用 render.math，且这些值全是 false
 *   - comments: true → comments.enabled: true（Stellar 要求对象结构）
 *
 * 用法：node tools/migrate-frontmatter.mjs [--dry]
 */
import fsp from 'node:fs/promises';
import path from 'node:path';

const DRY = process.argv.includes('--dry');
const POSTS_DIR = path.resolve('source/_posts');

/** 直接整行删除的字段 */
const DROP = [
  'thumbnail',
  'top_img',
  'aside',
  'toc',
  'toc_number',
  'copyright',
  'aplayer',
  'highlight_shrink',
  'mathjax',
  'katex',
];

/** 判断一行是否属于要删除的字段 */
const shouldDrop = (line) => {
  const m = line.match(/^([A-Za-z_][\w-]*)\s*:/);
  if (!m) return false;
  return DROP.includes(m[1]);
};

/** 处理单个文件的 front-matter */
function migrate(raw) {
  const lines = raw.split(/\r?\n/);
  if (lines[0].trim() !== '---') return { changed: false, text: raw };

  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      end = i;
      break;
    }
  }
  if (end < 0) return { changed: false, text: raw };

  const head = lines.slice(1, end);
  const body = lines.slice(end);
  const out = [];
  let changed = false;

  for (const line of head) {
    if (shouldDrop(line)) {
      changed = true;
      continue;
    }
    const cm = line.match(/^comments\s*:\s*(true|false)\s*(#.*)?$/);
    if (cm) {
      changed = true;
      out.push('comments:');
      out.push(`  enabled: ${cm[1]}`);
      continue;
    }
    // 旧写法 comments: false 也用对象表达
    out.push(line);
  }

  if (!changed) return { changed: false, text: raw };
  return { changed: true, text: ['---', ...out, ...body].join('\n') };
}

async function main() {
  const entries = await fsp.readdir(POSTS_DIR);
  const files = entries.filter((f) => f.endsWith('.md'));

  let touched = 0;
  const dropped = new Map();

  for (const file of files) {
    const full = path.join(POSTS_DIR, file);
    const raw = await fsp.readFile(full, 'utf8');
    const before = raw.match(/^([A-Za-z_][\w-]*)\s*:/gm) || [];
    const { changed, text } = migrate(raw);
    if (!changed) continue;

    touched++;
    const after = text.match(/^([A-Za-z_][\w-]*)\s*:/gm) || [];
    for (const key of before) {
      const k = key.replace(/\s*:$/, '');
      if (!after.includes(key)) dropped.set(k, (dropped.get(k) || 0) + 1);
    }

    if (!DRY) await fsp.writeFile(full, text, 'utf8');
  }

  console.log(`${DRY ? '[预演] ' : ''}处理 ${touched} / ${files.length} 个文件`);
  for (const [k, n] of [...dropped].sort((a, b) => b[1] - a[1])) {
    console.log(`  移除 ${k.padEnd(18)} ${n} 处`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
