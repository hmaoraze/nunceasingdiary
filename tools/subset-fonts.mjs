#!/usr/bin/env node
/**
 * 拉丁子集字体（跑在 hexo generate 之前，或单独执行）
 *
 * 主题自带三套自托管字体：Chillax（标题）、Geist（正文拉丁）、Geist Mono（代码）。
 * 中文一直走系统字体，这三套只需要拉丁字形，但原始文件带全字符集，体积偏大。
 *
 * 这里按 Google Fonts 的 latin 区间做子集，生成 *-subset.woff2 与配套 CSS，
 * 不改上游 CSS 文件，head.ejs 换成 *-subset.css 即可。
 *
 * 用法：node tools/subset-fonts.mjs
 */
import path from 'node:path';
import fsp from 'node:fs/promises';
import subsetFont from 'subset-font';

const FONTS_DIR = path.resolve('themes/defaultone/source/fonts');

/** Google Fonts 的 latin 子集区间 */
const LATIN_RANGES = [
  [0x0000, 0x00ff],
  [0x0131, 0x0131],
  [0x0152, 0x0153],
  [0x02c6, 0x02c6],
  [0x02da, 0x02da],
  [0x02dc, 0x02dc],
  [0x2000, 0x206f],
  [0x2074, 0x2074],
  [0x20ac, 0x20ac],
  [0x2122, 0x2122],
  [0x2191, 0x2191],
  [0x2193, 0x2193],
  [0x2212, 0x2212],
  [0x2215, 0x2215],
  [0xfeff, 0xfeff],
  [0xfffd, 0xfffd],
];

const unicodeRange = LATIN_RANGES.map(([a, b]) =>
  a === b ? `U+${a.toString(16).toUpperCase()}` : `U+${a.toString(16).toUpperCase()}-${b.toString(16).toUpperCase()}`,
).join(',');

const latinChars = LATIN_RANGES.map(([a, b]) => {
  let s = '';
  for (let cp = a; cp <= b; cp += 1) s += String.fromCodePoint(cp);
  return s;
}).join('');

const TARGETS = [
  {
    dir: 'Chillax',
    src: 'Chillax-Variable.woff2',
    out: 'Chillax-Variable-subset.woff2',
    css: 'chillax-subset.css',
    family: 'Chillax-Variable',
    weight: '200 700',
  },
  {
    dir: 'Geist',
    src: 'GeistVF.woff2',
    out: 'GeistVF-subset.woff2',
    css: 'geist-subset.css',
    family: 'Geist Variable',
    weight: '200 700',
  },
  {
    dir: 'GeistMono',
    src: 'GeistMonoVF.woff2',
    out: 'GeistMonoVF-subset.woff2',
    css: 'geist-mono-subset.css',
    family: 'Geist Mono',
    weight: '200 700',
  },
];

async function main() {
  for (const t of TARGETS) {
    const dir = path.join(FONTS_DIR, t.dir);
    const srcPath = path.join(dir, t.src);
    const srcBuf = await fsp.readFile(srcPath);

    let outBuf;
    try {
      outBuf = await subsetFont(srcBuf, latinChars, { targetFormat: 'woff2' });
    } catch (e) {
      // 变量字体在个别 harfbuzz 版本上会拒绝保留轴，退化为不子集化
      console.warn(`  ⚠ ${t.dir} 子集化失败（${e.message}），沿用原文件`);
      outBuf = srcBuf;
    }

    await fsp.writeFile(path.join(dir, t.out), outBuf);

    const css = `/*
 * ${t.family} —— 拉丁子集版本
 * 由 tools/subset-fonts.mjs 生成，请勿手改。
 * 中文由系统字体承担，这里只保留拉丁字形。
 */
@font-face {
    font-family: '${t.family}';
    src: url('${t.out}') format('woff2');
    font-weight: ${t.weight};
    font-display: swap;
    font-style: normal;
    unicode-range: ${unicodeRange};
}
`;
    await fsp.writeFile(path.join(dir, t.css), css);

    const saved = ((1 - outBuf.length / srcBuf.length) * 100).toFixed(0);
    console.log(
      `  ${t.family.padEnd(18)} ${(srcBuf.length / 1024).toFixed(1).padStart(6)} KB → ` +
        `${(outBuf.length / 1024).toFixed(1).padStart(6)} KB  (-${saved}%)`,
    );
  }
  console.log('\n✓ 子集 CSS 与字体已写入 themes/defaultone/source/fonts/');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
