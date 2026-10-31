"use strict";

/**
 * 文章图片懒加载
 *
 * 原实现只做了一件事：把 src 换成 loading.svg、真图塞进 data-src。
 * 问题是没写宽高 —— 图片到达时把正文撑开，这是文章页 CLS 的主要来源；
 * 也没有 noscript 兜底，关掉 JS 就什么都看不到。
 *
 * 这里在保留原机制（IntersectionObserver + data-src）的前提下补齐：
 *   1. loading="lazy" / decoding="async"
 *   2. 本地图片在构建期用 sharp 读真实宽高写进 width/height，
 *      浏览器据此自动推导 aspect-ratio，图片到达时不再跳动（外链图片跳过）
 *   3. <noscript> 里输出真图，关掉 JS 也能看
 *   4. 正文第一张图不懒加载，并给 fetchpriority="high"
 */

const path = require("path");
const fs = require("fs");

let sharp = null;
try {
  // 只在构建期用；缺失时静默降级（不写宽高，其余逻辑照旧）
  sharp = require("sharp");
} catch (e) {
  sharp = null;
}

const sizeCache = new Map();

/** 依次在站点 source、主题 source、public 下找这张图 */
function resolveLocalImage(src) {
  if (!src || /^https?:\/\//.test(src) || src.startsWith("data:")) return null;

  const clean = src.split("?")[0].split("#")[0];
  const rel = clean.replace(/^\//, "");

  const roots = [
    path.join(hexo.base_dir, "source"),
    path.join(hexo.theme_dir, "source"),
    path.join(hexo.public_dir),
  ];

  for (const root of roots) {
    const abs = path.join(root, rel);
    if (fs.existsSync(abs)) return abs;
  }
  return null;
}

async function readSize(src) {
  if (!sharp) return null;
  if (sizeCache.has(src)) return sizeCache.get(src);

  const abs = resolveLocalImage(src);
  if (!abs) {
    sizeCache.set(src, null);
    return null;
  }

  try {
    const meta = await sharp(abs).metadata();
    const size = meta.width && meta.height ? { width: meta.width, height: meta.height } : null;
    sizeCache.set(src, size);
    return size;
  } catch (e) {
    sizeCache.set(src, null);
    return null;
  }
}

hexo.extend.filter.register(
  "after_post_render",
  async function (data) {
    const theme = hexo.theme.config;
    if (!theme.articles.lazyload) return data;

    const imgRe = /<img\b([^>]*?)\/?\s*>/gim;
    const matches = [...data.content.matchAll(imgRe)];
    if (!matches.length) return data;

    let firstContentImageHandled = false;
    const replacements = [];

    for (const match of matches) {
      const [whole, rawAttrs] = match;
      const srcMatch = rawAttrs.match(/\bsrc="([^"]*)"/i);
      if (!srcMatch || !srcMatch[1]) continue;

      const src = srcMatch[1];
      const hasSize = /\bwidth=/i.test(rawAttrs) && /\bheight=/i.test(rawAttrs);

      // 已经处理过（Swup 重复渲染等场景）就跳过
      if (/\blazyload\b/.test(rawAttrs) || /\bdata-src=/i.test(rawAttrs)) continue;

      const size = hasSize ? null : await readSize(src);
      const sizeAttrs = hasSize
        ? ""
        : size
          ? ` width="${size.width}" height="${size.height}"`
          : "";

      // 去掉原来的 src，避免重复属性
      const attrsWithoutSrc = rawAttrs.replace(/\s*\bsrc="[^"]*"/i, "");

      if (!firstContentImageHandled) {
        // 正文第一张图通常就是首屏可见的那张，别懒加载
        firstContentImageHandled = true;
        replacements.push({
          from: whole,
          to: `<img${attrsWithoutSrc} src="${src}"${sizeAttrs} loading="eager" fetchpriority="high" decoding="async">`,
        });
        continue;
      }

      replacements.push({
        from: whole,
        to:
          `<img${attrsWithoutSrc}${sizeAttrs} loading="lazy" decoding="async" ` +
          `lazyload src="/images/loading.svg" data-src="${src}">` +
          `<noscript><img${attrsWithoutSrc} src="${src}"${sizeAttrs}></noscript>`,
      });
    }

    for (const r of replacements) {
      data.content = data.content.replace(r.from, r.to);
    }

    return data;
  },
  1
);
