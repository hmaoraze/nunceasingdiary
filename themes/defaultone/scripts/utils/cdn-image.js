"use strict";

/**
 * 又拍云图床 URL 按需处理（纯函数，不依赖 hexo —— 可被 helper / filter / 工具脚本共用）
 *
 * image.hsmao.cn / cdn.timens.cn 都是又拍云 CDN，支持在 URL 后追加
 * 处理参数（如 https://host/path.jpg!/fw/800/format/webp）。
 * 之前这些图片大多裸引用原图，实测开销很大：
 *   - 友链头像显示 64×64 却下 512×512 原图（232 KB）
 *   - 页脚 icp 图标显示 20×20 却下 819×772 PNG（106 KB）
 *   - 首页缩略图卡片 150px 高却下 2125px 原图（104 KB）
 *
 * preset 档位（尺寸依据显示场景 + DPR3 选购）：
 *   icon    !/format/webp            页脚小图标。只转格式不缩放——
 *                                    fw 对小于目标宽度的图只是重编码，
 *                                    小图重编码反而变大（实测 106→117 KB）
 *   avatar  !/fw/192/fh/192/format/webp    头像/书签图（显示 64×64，DPR3=192）
 *   thumb   !/fw/800/format/webp     列表卡片缩略图（全宽 ~390~740px，DPR2~3）
 *   content !/fw/1024/quality/70/format/webp  文章正文大图
 *
 * content 档为什么定在 1024/70：正文容器桌面约 800 CSS px，1024 覆盖到
 * DPR 1.28，Retina 下不发虚；而它比 1280 档小 28%（照片类实测三张合计
 * 363 KB → 261 KB）。质量参数的影响远小于宽度——同为 1280 时
 * quality 75→60 只降 16%，却是肉眼最容易分辨的那部分，所以让宽度退一点、
 * 质量保在 70 这个稳妥值。
 *
 * 实测过的又拍云行为（2026-10，详见 PERF-CHANGELOG.md）：
 *   - fw 只缩不放；format/webp 对 jpg/png 生效
 *   - 不支持 AVIF（400）
 *   - GIF 加 fw 会变成 PNG 丢动画 → 一律跳过
 *   - URL 已有 !xxx 样式段（如 !compress 或 !/format/webp）时，
 *     整段替换是安全的；双 ! 叠加会得到 404 占位图，禁止
 */

/**
 * 确认开通了又拍云"图像处理"的图床域名。
 *
 * 刻意用白名单精确枚举而不是匹配 *.hsmao.cn：blog.hsmao.cn 是老博客源站
 * （Typecho/WordPress 直出），并不能确认它支持处理参数；实测那里的
 * 2021 年老图源文件已 404，给它追加参数没有意义，也没有收益。
 */
const CDN_HOSTS = new Set(["image.hsmao.cn", "cdn.timens.cn"]);

/** 不做任何处理的扩展名 */
const SKIP_EXT = /\.(?:gif|svg|mp4|webm|m4a|mp3|lrc|json|xml)$/i;

const PRESETS = {
  icon: "!/format/webp",
  avatar: "!/fw/192/fh/192/format/webp",
  thumb: "!/fw/800/format/webp",
  content: "!/fw/1024/quality/70/format/webp",
};

/**
 * @param {string} url  原始图片 URL（本地图/外站图原样返回）
 * @param {keyof typeof PRESETS} preset  icon | avatar | thumb | content
 * @returns {string} 追加（或替换）了又拍云处理参数的 URL
 */
function cdnImg(url, preset = "content") {
  if (typeof url !== "string" || !url) return url;

  const params = PRESETS[preset];
  if (!params) return url;

  // 只处理又拍云图床的 http(s) 链接
  const m = url.match(/^https?:\/\/([^/?#]+)([/?#]?.*)$/i);
  if (!m) return url;
  if (!CDN_HOSTS.has(m[1].toLowerCase())) return url;

  const path = m[2];
  if (SKIP_EXT.test(path.split(/[?#]/)[0])) return url;

  // 已有 ! 开头的样式段（!compress / !/format/webp/...）→ 整段替换。
  // 不能叠加（!!/ 会得到 404 占位图），所以必须先剥掉旧段。
  const bangIdx = path.indexOf("!");
  const base = bangIdx === -1 ? path : path.slice(0, bangIdx);

  return `https://${m[1]}${base}${params}`;
}

module.exports = { cdnImg, PRESETS, CDN_HOSTS };
