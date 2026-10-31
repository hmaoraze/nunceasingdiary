#!/usr/bin/env node
/**
 * 首页横幅图派生（跑在 hexo generate 之前，或单独执行）
 *
 * 背景：原实现每个访客都要下两张 1920×1280 的 JPEG（490KB + 425KB），
 * display:none 并不会阻止 <img> 下载。这里把两张原图各裁成三档尺寸，
 * 输出 AVIF / WebP / JPEG，模板用 <picture> + srcset 让浏览器只取需要的那一档。
 *
 * 关于裁切：原模板用 CSS `scale-125` 把图放大 25%，等于只露出画面中心 80%。
 * 这里在构建期直接做 80% 中心裁切，运行时就不必再缩放位图（省掉一次 2.5 倍面积的
 * 重采样），观感与原实现一致。
 *
 * 用法：node tools/build-images.mjs
 */
import path from 'node:path';
import fsp from 'node:fs/promises';
import sharp from 'sharp';
import yaml from 'js-yaml';

const THEME_ROOT = path.resolve('themes/defaultone');
const THEME_IMAGES = path.join(THEME_ROOT, 'source/images');
const OUT_DIR = path.join(THEME_IMAGES, 'hero');

/** 与 CSS scale-125 等价：只保留画面中心 80% */
const CROP_RATIO = 0.8;

// 源图 1920×1280，裁掉 20% 后只剩 1536 宽。最大档就取 1536：
// 再生成 1920 只是把位图放大，与改造前"1920 位图被 scale-125 拉到 2400 渲染"
// 的实际清晰度完全一致，却白白多传字节。
const WIDTHS = [640, 1280, 1536];

/** 亮/暗两张源图从主题配置读，换图后重跑本脚本即可 */
async function readSources() {
  const raw = await fsp.readFile(path.join(THEME_ROOT, '_config.yml'), 'utf8');
  const theme = yaml.load(raw) || {};
  const image = theme.home_banner?.image || {};
  const toRel = (p, fallback) => {
    const v = (p || fallback || '').trim();
    // 去掉 /images/ 前缀与查询串，只留文件名
    return path.basename(v.split('?')[0]);
  };
  return [
    { src: toRel(image.light, '/images/main_bg_ligth.jpg'), prefix: 'hero' },
    { src: toRel(image.dark, '/images/main_bg.jpg'), prefix: 'hero-dark' },
  ];
}

const QUALITY = {
  avif: { 640: 45, 1280: 45, 1536: 42 },
  webp: { 640: 72, 1280: 72, 1536: 70 },
  jpeg: { 640: 78, 1280: 78, 1536: 76 },
};

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

async function buildOne({ src, prefix }) {
  const input = path.join(THEME_IMAGES, src);
  const meta = await sharp(input).metadata();

  const cropW = Math.round(meta.width * CROP_RATIO);
  const cropH = Math.round(meta.height * CROP_RATIO);
  const left = Math.round((meta.width - cropW) / 2);
  const top = Math.round((meta.height - cropH) / 2);

  // 先做一次中心裁切，后续每档都从这张裁好的图上缩，避免重复解码
  const cropped = await sharp(input)
    .extract({ left, top, width: cropW, height: cropH })
    .toBuffer();

  console.log(`\n${src}  ${meta.width}×${meta.height} → 中心裁切 ${cropW}×${cropH}`);

  for (const width of WIDTHS) {
    const height = Math.round((cropH / cropW) * width);
    const base = sharp(cropped).resize(width, height, { fit: 'cover' });

    for (const format of ['avif', 'webp', 'jpeg']) {
      const outfile = path.join(OUT_DIR, `${prefix}-${width}.${format === 'jpeg' ? 'jpg' : format}`);
      const pipeline =
        format === 'avif'
          ? base.clone().avif({ quality: QUALITY.avif[width], effort: 6 })
          : format === 'webp'
            ? base.clone().webp({ quality: QUALITY.webp[width], effort: 5 })
            : base.clone().jpeg({ quality: QUALITY.jpeg[width], mozjpeg: true, progressive: true });

      await pipeline.toFile(outfile);
      const size = (await fsp.stat(outfile)).size;
      console.log(`  ${path.basename(outfile).padEnd(24)} ${width}×${height}  ${kb(size)}`);
    }
  }
}

async function main() {
  await fsp.mkdir(OUT_DIR, { recursive: true });
  const sources = await readSources();
  for (const s of sources) await buildOne(s);
  console.log('\n✓ 派生图输出到 themes/defaultone/source/images/hero/');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
