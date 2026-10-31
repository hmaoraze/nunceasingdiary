#!/usr/bin/env node
/**
 * FontAwesome 图标子集化（跑在 hexo generate 之后）
 *
 * 背景：全站只用到 30 来个图标，却要付
 *   fontawesome.min.css 162KB + brands/solid/regular 三份 CSS
 *   + fa-solid-900.woff2 313KB + fa-regular-400.woff2 386KB + fa-brands 106KB
 * 合计约 970KB。这里按"构建产物里真正出现的图标"裁出子集字体与子集 CSS。
 *
 * 做法：
 *   1. 扫 public 目录下所有 HTML，收集 fa-solid / fa-regular / fa-brands 用到的图标名
 *   2. 从现有 CSS 里解析 图标名 → 码点
 *   3. 用 subset-font 按码点子集化三个 woff2
 *   4. 生成 fontawesome-subset.css：基础工具类 + @font-face + 用到的字形规则
 *
 * 关键：不能只保留字形规则。fa-spin / fa-beat / fa-fade / fa-bounce / fa-shake /
 * fa-fw / fa-lg / fa-2x…fa-5x / fa-flip 这些工具类必须留下，否则动画和尺寸会失效。
 *
 * 用法：node tools/subset-icons.mjs
 */
import path from 'node:path';
import fsp from 'node:fs/promises';
import subsetFont from 'subset-font';

const PUBLIC_DIR = path.resolve('public');
const THEME_SOURCE = path.resolve('themes/defaultone/source');
const FA_DIR = path.join(THEME_SOURCE, 'fontawesome');
const WEBFONTS = path.join(THEME_SOURCE, 'webfonts');

/** 三种样式各自的字体文件、CSS 源、font-family 与 font-weight */
const STYLES = [
  { key: 'solid', selectors: '.fa-solid,.fas', cssFile: 'fontawesome.min.css', font: 'fa-solid-900.woff2', family: 'Font Awesome 6 Pro', weight: 900 },
  { key: 'regular', selectors: '.fa-regular,.far', cssFile: 'fontawesome.min.css', font: 'fa-regular-400.woff2', family: 'Font Awesome 6 Pro', weight: 400 },
  { key: 'brands', selectors: '.fa-brands,.fab', cssFile: 'brands.min.css', font: 'fa-brands-400.woff2', family: 'Font Awesome 6 Brands', weight: 400 },
];

/** 递归收集 HTML 文件 */
async function walk(dir, out = []) {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await walk(p, out);
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

/**
 * 解析 CSS 里的字形规则。
 * 注意 FontAwesome 会把同码点的别名合并成一条：
 *   .fa-circle-info:before,.fa-info-circle:before{content:"\f05a"}
 * 所以必须按逗号拆选择器，不能只匹配单个 .fa-xxx:before。
 */
function parseGlyphs(css) {
  const map = new Map();
  const re = /([^{}]+)\{content:"\\([0-9a-f]{1,6})"\}/gi;
  let m;
  while ((m = re.exec(css))) {
    const cp = parseInt(m[2], 16);
    for (const sel of m[1].split(',')) {
      const single = sel.trim().match(/^\.fa-([a-z0-9-]+):before$/i);
      if (single) map.set(single[1], cp);
    }
  }
  return map;
}

/** 找 CSS 里第一处字形规则的起点，之前的部分是基础工具类 */
function basePrefix(css) {
  const i = css.search(/\.fa-[a-z0-9-]+:before,\.[a-z0-9-:]+:before\{content:"\\|\.fa-[a-z0-9-]+:before\{content:"\\/i);
  return i === -1 ? css : css.slice(0, i);
}

async function main() {
  const htmlFiles = await walk(PUBLIC_DIR);
  console.log(`扫描 ${htmlFiles.length} 个 HTML 文件…`);

  // 收集每个样式用到的图标名
  const used = { solid: new Set(), regular: new Set(), brands: new Set() };
  const classRe = /class="([^"]*)"/g;
  let btnCount = { solid: 0, regular: 0, brands: 0 };

  for (const file of htmlFiles) {
    const html = await fsp.readFile(file, 'utf8');
    let m;
    classRe.lastIndex = 0;
    while ((m = classRe.exec(html))) {
      const classes = m[1].split(/\s+/);
      // 一个标签可能同时是 fa-solid/fa-regular/fa-brands（例如 fa-brands fa-github）
      // 注意模板里大量使用 fas / far / fab 简写，漏了它们就会丢掉对应字形
      let style = null;
      if (classes.includes('fa-brands') || classes.includes('fab')) style = 'brands';
      else if (classes.includes('fa-solid') || classes.includes('fas')) style = 'solid';
      else if (classes.includes('fa-regular') || classes.includes('far')) style = 'regular';
      if (!style) continue;
      btnCount[style] += 1;

      // 取该标签上第一个 fa- 开头的图标名（排除样式前缀与工具类）
      const UTIL = /^(solid|regular|brands|classic|sharp|thin|light|duotone|sharp-solid|fw|spin|spin-pulse|spin-reverse|pulse|beat|beat-fade|fade|bounce|shake|flip|flip-horizontal|flip-vertical|flip-both|border|inverse|stack|stack-1x|stack-2x|layers|layers-text|pull-left|pull-right|ul|li|rotate-\d+|xs|sm|lg|xl|2xs|2xl|[1-9]x|[1-9]0x|sr-only)$/;
      const icon = classes.find((c) => c.startsWith('fa-') && !UTIL.test(c.slice(3)));
      if (icon) used[style].add(icon.slice(3));
    }
  }

  const faCss = await fsp.readFile(path.join(FA_DIR, 'fontawesome.min.css'), 'utf8');
  const brandsCss = await fsp.readFile(path.join(FA_DIR, 'brands.min.css'), 'utf8');
  const solidGlyphs = parseGlyphs(faCss);
  const brandGlyphs = parseGlyphs(brandsCss);

  console.log(`用法统计：solid ${btnCount.solid} 次 / regular ${btnCount.regular} 次 / brands ${btnCount.brands} 次`);

  const parts = [];
  parts.push(`/*! FontAwesome Pro 6.2.1 子集（由 tools/subset-icons.mjs 生成，请勿手改） */`);
  parts.push(basePrefix(faCss).trim());

  const emitFaces = [];
  const emitGlyphs = [];
  const glyphSeen = new Set();

  for (const style of STYLES) {
    const names = [...used[style.key]].filter(Boolean);
    const table = style.key === 'brands' ? brandGlyphs : solidGlyphs;
    const resolved = names.map((n) => ({ name: n, cp: table.get(n) })).filter((x) => x.cp);
    const missing = names.filter((n) => !table.get(n));

    if (missing.length) {
      console.warn(`  ⚠ ${style.key}: 以下图标在 CSS 里找不到码点，已跳过：${missing.join(', ')}`);
    }
    if (!resolved.length) continue;

    // 按码点子集化（subset-font 按字符集工作，图标字体里字符就是 PUA 码点）
    const chars = [...new Set(resolved.map((r) => r.cp))].map((cp) => String.fromCodePoint(cp)).join('');
    const srcBuf = await fsp.readFile(path.join(WEBFONTS, style.font));
    const outBuf = await subsetFont(srcBuf, chars, { targetFormat: 'woff2' });

    const outName = `fa-subset-${style.key}.woff2`;
    await fsp.writeFile(path.join(WEBFONTS, outName), outBuf);

    emitFaces.push(
      `@font-face{font-family:"${style.family}";font-style:normal;font-weight:${style.weight};font-display:block;` +
        `src:url(../webfonts/${outName}) format("woff2")}` +
        `${style.selectors}{font-family:"${style.family}";font-weight:${style.weight}}`,
    );

    for (const { name, cp } of resolved) {
      if (glyphSeen.has(`${style.key}:${name}`)) continue;
      glyphSeen.add(`${style.key}:${name}`);
      emitGlyphs.push(`.fa-${name}:before{content:"\\${cp.toString(16)}"}`);
    }

    console.log(
      `  ${style.key.padEnd(8)} ${resolved.length} 个图标  ` +
        `${(srcBuf.length / 1024).toFixed(0)} KB → ${(outBuf.length / 1024).toFixed(1)} KB`,
    );
  }

  parts.push(emitFaces.join(''));
  parts.push(emitGlyphs.join(''));

  const outCss = parts.join('\n');
  await fsp.writeFile(path.join(FA_DIR, 'fontawesome-subset.css'), outCss);

  console.log(`\n✓ 子集 CSS: fontawesome-subset.css  ${(outCss.length / 1024).toFixed(1)} KB`);
  console.log(`✓ 子集字体: ${STYLES.map((s) => `fa-subset-${s.key}.woff2`).join(', ')}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
