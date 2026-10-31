"use strict";

/**
 * 文章正文里的又拍云图片 → 按需 WebP
 *
 * 正文 <img> 的 src 在渲染期是图床原图 URL（约 10 张最大的合计 4MB+）。
 * 本 filter 在 lazyload（priority 1）之前把 src 改写成
 * !/fw/1280/quality/75/format/webp，lazyload 会接着把它挪进 data-src。
 *
 * 只动 data.content（正文），不动模板/配置层的图片——那些由
 * cdn_img helper 在模板里显式处理。
 */

const { cdnImg } = require("../utils/cdn-image");

hexo.extend.filter.register(
  "after_post_render",
  function (data) {
    if (!data || typeof data.content !== "string") return data;

    // 改写 <img src="https://图床/...jpg">（含已有 !样式段 的）
    // 也覆盖 lazyload 已跑过一轮的场景（src 变成了 data-src）
    data.content = data.content.replace(
      /(\b(?:src|data-src)=")(https?:\/\/[^"]*?)(")/gi,
      (whole, prefix, url, quote) => prefix + cdnImg(url, "content") + quote,
    );

    return data;
  },
  0 // 先于 lazyload-handle（priority 1）
);
