#!/usr/bin/env node
/**
 * 站点图片派生（跑在 hexo generate 之前）
 *
 * 目前只做头像：侧边栏 CSS 显示 80×80，源图却有 135 KB。
 * 生成 80/160/240 三档（对应 DPR 1/2/3）的 AVIF 与 WebP，
 * 模板用 <picture> + srcset 取用，最多省 90% 字节。
 *
 * 换成 Stellar 后不再需要首页横幅派生图（主题没有整屏 banner），
 * 因此原来的 hero 三档生成逻辑已移除。
 *
 * 用法：node tools/build-images.mjs
 */
import path from 'node:path';
import fsp from 'node:fs/promises';
import sharp from 'sharp';
import { load as loadYaml } from 'js-yaml';

/** 站点级图片目录（换主题后图片已从主题目录迁到这里） */
const SITE_IMAGES = path.resolve('source/images');
const THEME_CONFIG = path.resolve('_config.stellar.yml');

const AVATAR_WIDTHS = [80, 160, 240];

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

const exists = async (p) => {
  try {
    await fsp.stat(p);
    return true;
  } catch {
    return false;
  }
};

/** 从头像配置里取文件名：支持 leftbar.brand.image.src 与本主题旧字段 */
async function resolveAvatar() {
  const raw = await fsp.readFile(THEME_CONFIG, 'utf8');
  const cfg = loadYaml(raw) || {};
  const configured = (cfg.leftbar?.brand?.image?.src || '').trim();
  if (!configured) return null;

  // 外链头像不动，交给 CDN
  if (!configured.startsWith('/images/')) {
    console.log(`跳过头像派生：${configured} 不是本地图`);
    return null;
  }

  // 配置已指向派生图（如 avatar-1-240.webp）时无需再派生，Stellar 的 brand 只吃单个 src
  if (/-\d+\.(avif|webp)$/i.test(configured)) {
    const size = (await fsp.stat(path.join(SITE_IMAGES, path.basename(configured))).catch(() => null))?.size;
    console.log(
      `跳过头像派生：配置已指向优化后的派生图 ${path.basename(configured)}` +
        (size ? `（${kb(size)}）` : ''),
    );
    return null;
  }

  const file = path.basename(configured.split('?')[0]);
  const input = path.join(SITE_IMAGES, file);
  if (!(await exists(input))) {
    console.log(`跳过头像派生：找不到 ${file}`);
    return null;
  }
  return { file, input };
}

async function buildAvatar() {
  const found = await resolveAvatar();
  if (!found) return;

  const { file, input } = found;
  const base = file.replace(/\.[^.]+$/, '');
  const meta = await sharp(input).metadata();
  console.log(`${file}  ${meta.width}×${meta.height} → 头像派生`);

  const written = [];
  for (const width of AVATAR_WIDTHS) {
    const pipeline = () =>
      sharp(input).resize(width, width, { fit: 'cover', position: 'centre' });

    const outputs = [
      [`${base}-${width}.avif`, pipeline().avif({ quality: 55, effort: 6 })],
      [`${base}-${width}.webp`, pipeline().webp({ quality: 82, effort: 5 })],
    ];

    for (const [name, instance] of outputs) {
      const outfile = path.join(SITE_IMAGES, name);
      await instance.toFile(outfile);
      const size = (await fsp.stat(outfile)).size;
      written.push({ name, size, width });
      console.log(`  ${name.padEnd(24)} ${width}×${width}  ${kb(size)}`);
    }
  }

  const sourceSize = (await fsp.stat(input)).size;
  const largest = written
    .filter((w) => w.width === AVATAR_WIDTHS[AVATAR_WIDTHS.length - 1] && w.name.endsWith('.avif'))
    .pop();
  if (largest) {
    console.log(
      `  → 原图 ${kb(sourceSize)}，最大档 AVIF ${kb(largest.size)}，` +
        `节省 ${Math.round((1 - largest.size / sourceSize) * 100)}%`,
    );
  }
}

async function main() {
  await fsp.mkdir(SITE_IMAGES, { recursive: true });
  await buildAvatar();
  console.log('\n✓ 派生图输出到 source/images/');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
