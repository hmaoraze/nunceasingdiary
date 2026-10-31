# 首屏加载性能改造记录

站点：https://blog.imce.cn（Hexo 7.3.0，主题 `themes/defaultone`，部署在腾讯云 EdgeOne Makers）

改造日期：2026-10-31

---

## 一、结果一览

测量条件：移动端 390×844 / 下行 1.6 Mbps / RTT 150 ms / CPU 4× 降速 / 冷缓存（禁用缓存），
每项跑 3–4 次取中位数。基线为改造前 `f7662c2`，在独立 worktree 中重新构建后测量，
与改造后使用同一套 `tools/probe.mjs`。

| 指标 | 改造前 | 改造后 | 目标 | 结论 |
|---|---|---|---|---|
| 首屏传输 | 3514 KB | **641 KB** | ≤ 1024 KB | ✅ −82% |
| 请求数 | 86 | **42** | ≤ 50 | ✅ −51% |
| LCP | 1716 ms | **1700 ms** | ≤ 1800 ms | ✅ |
| DCL | 16962 ms | **2607 ms** | ≤ 4000 ms | ✅ −85% |
| 长任务累计 | 2468 ms | **84 ms** | ≤ 600 ms | ✅ −97% |
| CLS | 0.017 | **0.005** | ≤ 0.05 | ✅ |
| 内容可见（遮罩消失） | 3185 ms | **2017 ms** | ≤ 1800 ms | ⚠️ 差 217 ms |
| 控制台错误 | 2 | 2 | 0 | ⚠️ 见下文说明 |
| 解析阻塞脚本 | 18 | **0** | 0 | ✅ |
| 首屏样式表 | 11 | **8** | — | ✅ |

结构性数字（`tools/perf-audit.mjs`，首页 HTML 直接引用的本地资源）：

| 项目 | 改造前 | 改造后 |
|---|---|---|
| `<script src>` 总数 / 其中解析阻塞 | 18 / 18 | 16 / **0** |
| JS 应用代码请求数 | 29（ESM 两层瀑布） | **1**（bundle） |
| mermaid.min.js | 733 KB（gzip），每页都加载 | 0（按需） |
| 首屏主图 | 2 张共 915 KB | **1 张 18.3–70.1 KB**（按视口选档） |
| FontAwesome CSS + 字体 | 162 KB + 805 KB | **15.7 KB + 6 KB** |
| 三套正文字体 | 170 KB | **92 KB**（拉丁子集） |
| 空 href | 1 | **0** |

视觉快照见 `docs/perf/`（改造前后各一组，含亮/暗色与移动端）。

---

## 二、逐项改动

### T1 开屏动画：保留动画，重写加载与兜底

- **改了什么**
  - 新增 `layout/components/header/preloader-boot.ejs`，只放"兜底计时 + 跳过判定 + `hide()`"，
    挂在 `<head>` 里第一个 `<link rel="stylesheet">` 之前。
  - `preloader.ejs` 只留样式、遮罩结构、字母拆分与动画本体。
  - 兜底定时器 1100 ms（≈ 900 ms 动画 + 200 ms 余量），脚本一执行就开始计时，
    不依赖 `anime`，也不依赖 `window.load`。
  - 动画压缩到约 900 ms（500 ms + 400 ms，偏移 `-300`，字母延迟 `120 + 12i`），
    运动曲线、模糊、位移、错落感不变。
  - 触发时机改为 `DOMContentLoaded`，删除原 5 s 兜底。
  - `anime.min.js` 改 preload + defer。
  - 跳过规则：本会话已播（sessionStorage）/ `prefers-reduced-motion: reduce` / 页面隐藏；
    命中时给 `<html>` 打标记，遮罩不参与首帧渲染。支持 click / keydown / touchstart 手动跳过。
  - 顺带把两处同样阻塞解析的内联脚本移出 `<head>`：`export_config()`（注入全局
    `theme`/`config`）与纪念日灰度脚本，都挪到 `</body>` 前。
- **为什么**：原实现的兜底写在 `anime.timeline()` 之后且依赖 `window.load`，
  anime 一旦加载失败就会永久白屏；同时内联脚本要等样式表下载完才执行，
  兜底计时的起点被推到弱网下的 1.8 s 之后。
- **怎么验证**
  - 正常网络：遮罩约 1.3–1.5 s 内消失，动画完整。
  - DevTools 阻断 `anime.min.js`：内容仍可见、无未捕获错误。
  - 同标签页刷新第二次：不出现遮罩。系统开启"减少动态效果"：不出现遮罩。
- **遗留**：弱网下（DCL > 1.1 s）动画不会播，只做淡出。这是有意的取舍——
  优先保证内容可见时间，而不是让遮罩多停留以播完动画。

### T2 mermaid 按需加载

- **改了什么**：`scripts.ejs` 的引入条件从"配置开关打开就加载"改为"当前页确实需要"
  （front-matter `mermaid: true`，或正文出现 `class="mermaid"`）。`_config.yml` 补注释。
- **为什么**：`mermaid.min.js` gzip 733 KB，是首屏最大的单个资源；全站 129 篇文章
  `grep -ril mermaid source/_posts` 结果为 **0**。
- **怎么验证**：首页/文章页 Network 无 `mermaid.min.js`；新建 `mermaid: true`
  的测试文章可正常引入（测试文章已删）。

### T3 消除解析阻塞脚本

- **改了什么**
  - `renderJS` 增加 `defer` 选项，默认 `true`；`module` 天然 defer 不重复输出。
  - `particles.js` 从 `<head>` 最前面（排在所有样式表之前）挪到 `</body>` 前。
  - Swup 的 6 个脚本 defer，初始化包进 `DOMContentLoaded`。
  - `aplayer.js` 初始化包进 `DOMContentLoaded` 并做存在性判断。
  - `scripts.ejs` 重排：odometer / Typed / minimasonry / moment 等 vendor 全部排到
    `main.js`（module）之前，避免模块求值时全局变量还没就绪。
  - footer 的 vercount 统计脚本 defer；odometer 内联初始化改为等库就绪，
    并兼容 Swup 导航后重跑（那时 `DOMContentLoaded` 已过）。
- **为什么**：原 `renderJS` 取了 `async` 参数但注释掉了，且没有 defer 分支，
  输出的每个 `<script>` 都阻塞解析。
- **怎么验证**：产物中 `<head>` 内无同步 `<script src>`；16 个脚本 0 个解析阻塞。

### T4 首屏主图改响应式派生图

- **改了什么**
  - 新增 `tools/build-images.mjs`（sharp）：从主题配置读亮/暗两张源图，
    各生成 640 / 1280 / 1536 三档 AVIF + WebP + JPEG，输出到 `source/images/hero/`。
  - 构建期做 80% 中心裁切，等价于原来的 CSS `scale-125`，运行时不再缩放位图。
  - 模板改 `<picture>` + `srcset`/`sizes`，浏览器按视口与 DPR 只取一档。
  - 两张图都加 `loading="lazy"`：lazy 图在 `display:none`、没有布局盒时不发请求，
    切到另一套主题时才加载 —— 亮/暗两种模式都只下载一张。
  - 去掉 `scale-125` / `sm:scale-110` / `will-change-transform`。
- **为什么**：`display:none` 不阻止 `<img>` 下载，原实现每个访客都要下两张
  1920×1280 的 JPEG（490 KB + 425 KB）。
- **怎么验证**：无论亮/暗都只发 1 个 hero 请求。桌面 1440 DPR1 取 `hero-1536.avif`（57.8 KB）；
  移动 390×844 在 DPR≥2 时取 `hero-1280.avif`（50.8 KB），DPR1 才落到 640 档（18.3 KB）。
  —— `sizes="100vw"` 会让浏览器按设备像素宽选档，真机 DPR 普遍 ≥2，所以移动端实际是 1280 档。
  冒烟测试对"亮/暗各只 1 个请求""取 AVIF""暗色取暗色图"都有断言。
- **视觉差异**：移动端与原 `scale-125` 完全一致；桌面端原来走 `sm:scale-110`（放大 10%），
  这里统一按 80% 裁切，取景比原来紧约 11%。对比图见 `docs/perf/01/02`。
  没有采用"压暗亮色图"的方案，因为两张图是完全不同的画（一张日出荒漠、一张动漫少女），
  换图会明显改变暗色模式的观感。

### T5 图标子集化

- **改了什么**：新增 `tools/subset-icons.mjs`，扫模板 / 文章 / 产物三处收集实际用到的图标名，
  从现有 CSS 解析"图标名 → 码点"，用 `subset-font` 按码点子集化三个 woff2，
  再生成只保留「基础工具类 + @font-face + 用到的字形」的 `fontawesome-subset.css`。
- **为什么**：全站只用到 43 个图标，却引了 4 份 CSS（162 KB）和三份完整字体（805 KB）。
- **踩到的坑**
  - FontAwesome 会把同码点的别名合并成一条选择器
    （`.fa-circle-info:before,.fa-info-circle:before{...}`），只匹配单个选择器会漏。
  - 模板里大量使用 `fas` / `far` / `fab` 简写，只认 `fa-solid`/`fa-regular` 会丢字形
    （`fa-arrow-up` 就这样中过一次）。
  - 工具类必须保留：`fa-spin` / `fa-beat` / `fa-fade` / `fa-bounce` / `fa-shake` /
    `fa-fw` / `fa-lg` / `fa-2x…5x` / `fa-flip`。
- **怎么验证**：冒烟测试断言"页面上每个图标元素都能取到 `::before` 内容"
  （首页 58 个图标全部命中）；另取首页 / 文章页 / 归档页截图目视复核。

### T6 字体子集化

- **改了什么**：`tools/subset-fonts.mjs` 按 Google Fonts 的 latin 区间子集化三套自托管字体，
  生成 `*-subset.woff2` 与配套 CSS；preload Chillax 与 Geist（带 `crossorigin`）；
  删掉两个无效的 `preconnect`（fonts.googleapis.com / fonts.gstatic.com）。
- **结果**：Chillax 54.3 → 36.8 KB、Geist 55.5 → 26.3 KB、Geist Mono 56.7 → 29.5 KB。
  中文继续走系统字体，不引入任何 CJK 字体文件。
- **说明**：Chillax 没压到 30 KB 以内（变量字体本身字形与字距表多），但从 54 KB 降到 37 KB
  已经覆盖主要收益，继续硬压需要丢弃特性表，风险大于收益。

### T7 JS 打包

- **改了什么**：新增 `tools/build-js.mjs`（esbuild），`main.js` 整图打成
  `js/build/main.bundle.js`，49.3 KB（gzip 15.7 KB）。`theme.developer.enable` 时仍走未打包源码。
- **为什么**：`main.js` 静态 import 25 个一级模块、其中 3 个还带二级模块，
  共 29 个文件、两层请求瀑布。
- **怎么验证**：首页 JS 应用代码请求 29 → 1；冒烟测试覆盖 TOC、搜索、图片查看器、
  主题切换、粒子、导航收缩等依赖 `main.js` 的功能。

### T8 缓存与版本目录

- **改了什么**
  - 新建 `edgeone.json` 声明缓存策略：HTML `max-age=0, must-revalidate`、
    `/static/*` 一年 `immutable`、`/images/*` 7 天、`/live2dw/*` 30 天、
    `search.xml`/`atom.xml` 5 分钟 + `stale-while-revalidate`。
  - `middleware.js` 删掉 Cache-Control 那一段（边缘中间件的 `set` 会覆盖 `edgeone.json`）。
  - 新增 `tools/version-assets.mjs`：按 js/css/fonts/fontawesome/webfonts/assets 的
    内容哈希生成 `buildId`，整体复制到 `public/static/<buildId>/`，再改写 HTML 里的绝对路径。
    目录结构保持一致，所以 CSS 里的 `../webfonts/xxx.woff2` 不用动。保留最近 3 个版本。
- **为什么**：原实现对静态资源统一 `max-age=300`，超过 5 分钟的复访要重新验证 80 多个请求；
  而文件名不带指纹又不敢长缓存。
- **怎么验证**：构建产物 541/542 个 HTML 完成改写，0 处残留旧路径，`/images/` 未被误改；
  部署后需实测：
  ```bash
  curl -sI https://blog.imce.cn/static/<id>/js/build/main.bundle.js | grep -i cache-control
  curl -sI https://blog.imce.cn/ | grep -i cache-control
  curl -sI https://blog.imce.cn/images/hero/hero-1536.avif | grep -i cache-control
  ```

### T9 运行时卡顿治理

- **粒子**：数量 100 → 36；关闭 `retina_detect`；视口 < 1024 px 或
  `prefers-reduced-motion` 不初始化；切到后台 `cancelAnimationFrame`；
  首页横幅滚出视口时暂停。
- **Live2D**：新增 `scripts/filters/live2d-lazy.js`，把 `hexo-helper-live2d` 注入的同步脚本
  改写成"load 之后 `requestIdleCallback` 再注入"；< 1024 px 与减少动效下不加载；
  `_config.yml` 的 `mobile.show` 改 `false`。
- **APlayer**：`preload: 'none'`；去掉自动点击 `.aplayer-icon-lrc`
  （会连带拉跨域 LRC，控制台一直报错）；封面图 `loading=lazy`。
- **大图层**：`home-background.ejs` 的全屏模糊 15 px → 12 px。
- **顺带**：`moment-with-locales`（366 KB / gzip 75 KB）只有 `/moments/` 用，
  从"每页加载"改为按需加载。
- **结果**：长任务累计 2468 ms → 83 ms；解析阻塞脚本 1 → 0。
- **视觉差异**：移动端不再显示粒子与看板娘（原先手机上既卡又挡内容）。

### T10 懒加载与 CLS

- 本地图片在构建期用 sharp 读真实宽高写进 `width`/`height`，浏览器据此推导
  `aspect-ratio`，图片到达时不再撑开正文；外链图片读不到尺寸，跳过。
- 补 `loading="lazy"` / `decoding="async"`；每个懒加载图配 `<noscript>` 输出真图。
- 正文第一张图不懒加载，给 `loading="eager" fetchpriority="high"`。
- 过滤器做了幂等判断，Swup 重复渲染不会二次包裹。
- **验证**：首页 CLS 0.004（改造前测得 0.017）；文章页 CLS 0.000
  （诊断报告里改造前为 0.165）。

### T11 配置层清理

- `home_banner.custom_font.enable` 改 `false`（`url`/`family` 都是空值，
  会输出 `<link href="">` 和非法 `font-family: '', sans-serif; !important;`）；
  模板里那条 style 也加了非空判断并修正语法。
- `<title>` 压成单行。
- `effects.cursoreffects` 标注不支持（`libs/cursor-effects.js` 从未随主题提供，开启只会 404）。
- `footer.runtime` 依赖的 odometer 走 defer 已生效，冒烟测试加了「运行时间已填充」回归项。

### T12 复测与交付

- 基线在与改造无关的独立 worktree 中重建后测量，与改造后同口径。
- `docs/perf/` 下 7 张对比图：首页桌面（亮/暗）、首页移动端各一组前后对比，
  另附文章页移动端。
- 冒烟测试 `tools/smoke.mjs` 覆盖 21 项：Swup 实例化与无刷新导航、遮罩收尾、
  粒子、播放器、首屏主图（含"只请求一张"和"取 AVIF"断言）、图标字形完整性、
  深浅色切换、搜索弹窗、运行时间填充、移动端无横向溢出、暗色模式、
  减少动态效果，以及无页面级 JS 错误。

---

## 三、未完成 / 未达标项

| 项 | 现状 | 原因 | 建议 |
|---|---|---|---|
| 内容可见 ≤ 1.8 s | 2017 ms | 遮罩淡出开始于约 1.8 s；4× 降速下首屏布局本身有一个约 536 ms 的长任务，把 1100 ms 的兜底计时器回调压后到约 1.75 s 才执行（这是布局开销，不是遮罩逻辑）。真正 4G 网络（5–10 Mbps）下计时起点更早，实测落在 1.4–1.7 s。 | 想再收紧只能让遮罩跳过动画直接淡出（`MAX_MS` 已到规范下限 1100 ms），或削减首屏 DOM 规模。不建议动。 |
| 控制台错误 = 0 | 2 条 | 都是**本地测量伪影**：APlayer 拉 LRC 时 CDN 返回的 `Access-Control-Allow-Origin` 是 `https://blog.imce.cn`，在 `127.0.0.1` 下必然跨域失败；线上同源不会触发。另一条是第三方签章图被 ORB 拦。改造前同样是这 2 条。 | 如需彻底消除，可给 LRC 关掉（`lrcType: 0`），但会丢掉歌词功能，未采纳。 |
| FontAwesome 子集首屏加载 | 6 KB 字体 + 15.7 KB CSS | 已达标（目标 ≤ 40 KB）。 | — |
| `cursoreffects` | 仍不可用 | 主题从未提供 `libs/cursor-effects.js`。 | 若要启用，需补一份 UMD 版 `cursor-effects`。 |

## 四、遗留风险

1. **构建顺序有约束**：`npm run build` = `build:js → build:images → build:fonts → hexo generate
   → build:icons → build:static`。图标子集必须**在 generate 之后**跑（要扫产物里的动态图标），
   否则社交链接这类由模板动态生成的图标会漏掉。单独跑 `hexo generate` 不会更新子集。
2. **`public/static/` 会累积**：脚本保留最近 3 个版本，长期部署仍需定期清理。
3. **`edgeone.json` 只在部署后生效**：本地只能用 `curl -I` 对照配置检查，
   上线后请按 T8 的三条命令实测，必要时调整规则声明顺序。
4. **`playwright-core` 是开发依赖**：`tools/probe.mjs` / `tools/smoke.mjs` 需要它，
   使用系统已安装的 Chrome，不额外下载 Chromium。CI 里若无 Chrome 需跳过这两步。
5. **图片派生图需重新生成**：换首页横幅图后要重跑 `npm run build:images`，
   脚本从主题配置读源图，改名或换路径都能自动跟随。
6. **子集字体与图标依赖实际用量**：新增图标或新增 `fa-*` 用法后需重跑 `build:icons`，
   否则新图标没有字形（`npm run build` 已包含这一步）。

## 五、复跑方式

```bash
npm install
npm run build          # 完整构建（含图片派生、JS 打包、图标/字体子集、资源版本化）

# 质量与性能验证
npm run perf:smoke     # 功能回归冒烟（21 项）
npm run perf:probe -- / mobile 3    # 首屏指标实测（本地起服务 + Chrome 限速）
npm run perf:audit -- index.html    # 静态资源体积审计
```

> `perf:probe` / `perf:smoke` 使用本机已安装的 Chrome/Edge，不需要下载 Chromium。
> 在 Git Bash 下传路径参数时要加 `MSYS_NO_PATHCONV=1`，否则 `/` 会被转成 Windows 路径。

---

# 二期：又拍云图床按需 WebP（2026-10-31 下午）

## 背景

图床 image.hsmao.cn / cdn.timens.cn 是又拍云 CDN，支持 URL 后追加处理参数
（`!/fw/800/format/webp` 等），但站内引用大多是裸原图。实测全站外链图 55 张
合计 9.5 MB，其中友链头像 64×64 却下 512×512 原图（232 KB）、页脚 icp 图标
20×20 却下 819×772 PNG（106 KB，且每页都加载）。

## 实测结论（又拍云图像处理）

- `fw` 只缩不放；`format/webp` 对 jpg/png 生效；**不支持 AVIF（400）**
- 质量参数影响远小于宽度：同样 1280 宽下 quality 75→60 只降 16%，宽度
  1280→1024 直接降 28%，所以宁降宽度、保质量
- **GIF 加 fw 会变 PNG 丢动画** → 一律跳过；SVG 本身是矢量 → 跳过
- URL 已有 `!样式` 段（`!compress` 或 `!/format/webp`）时整段替换安全；
  双 `!` 叠加会得到 404 占位图，禁止
- 又拍云处理失败/源失效时返回 200 + 800×600 的"404 插画"，状态码正常，
  极易漏检 → 新增 tools/verify-cdn-images.mjs 逐个校验（42 个改写 URL 全部通过）
- 短时间大量不同参数变体的请求会触发 CDN 临时 302 风控，等待即恢复

## 实现

- `themes/defaultone/scripts/utils/cdn-image.js`：纯函数 `cdnImg(url, preset)`，
  四个档位 icon（仅转 WebP）/ avatar（192×192）/ thumb（fw 800）/ content（fw 1024 + quality 70）；
  白名单精确限定 image.hsmao.cn、cdn.timens.cn（blog.hsmao.cn 源站不处理）
- `scripts/helpers/cdn-image.js` 注册 `cdn_img` 模板 helper（hexo 是注入式加载，
  被 require 的模块拿不到，故注册层与实现层分开）
- `scripts/filters/cdn-image-handle.js`：正文 `<img src/data-src>` 在懒加载
  之前改写为 content 档
- 模板接入：首页缩略图（thumb）、文章封面（content）、友链头像与缩略卡
  （avatar/thumb）、说说图（单图 content、九宫格 thumb、LivePhoto 封面 thumb）、
  书签图标（avatar）、页脚 icp（avatar）
- og:image / twitter:image / JSON-LD **故意不改**：社交平台对 WebP 缩略图
  兼容性参差，抓取仍用原图
- APlayer 封面在 _config.yml 直接改为 `!/fw/256/fh/256/format/webp`

## 结果（390×844 / 1.6Mbps / RTT150 / CPU 4×，外链图合计，等待全部加载完成）

| 页面 | 改造前 | 改造后 | 降幅 |
|---|---|---|---|
| 首页 `/` | 302.4 KB | 119.7 KB | −60% |
| 友链 `/links/` | 618.5 KB | 71.0 KB | −89% |
| 文章 `/Turning-19-Today/`（13 图） | 958.4 KB | 635.1 KB | −34% |
| 文章 `/zaijian-wode-18sui-shengri/` | 231.6 KB | 86.5 KB | −63% |

回归：tools/smoke.mjs 22/22 通过；友链页 13 张外链图全部正常解码渲染，
头像解码尺寸恰为 192×192（DPR3 下的 64px 显示）。

## 遗留

- blog.hsmao.cn 域下的 2021 年老图源文件已 404（非本次引入），页面显示裂图，
  需修复源或替换图片
- 正文 [LivePhoto photo="..."] 自定义标签渲染不正常（URL 被当成 Markdown
  链接输出），属既有问题，其图片参数未改写

---

# 三期：EdgeOne 图片处理 —— 评估后不采用（2026-10-31 晚更正）

> **结论先行：本项目对该功能零依赖，无需回滚任何代码。**
>
> - 代码从未拼接 `?eo-img.*` 参数。`scripts/utils/cdn-image.js` 的域白名单只有
>   又拍云 `image.hsmao.cn` / `cdn.timens.cn`，preset 用的全是又拍云 `!/fw/…` 语法。
> - `edgeone.json` 只声明缓存与安全响应头，没有 `transform` / 图片处理配置。
> - 因此「EO 图片处理是付费能力、免费额度站点开不了」这件事**不影响线上任何行为**：
>   图片不会裂、不会 404、不会有额外计费。
>
> 唯一需要改的，是把下面这份"待启用"指引更正为"已评估、不采用"，避免日后误操作。

## 为什么曾考虑它，又为什么放弃

EO「多媒体服务 → 图片处理」与又拍云同类，且多两点优势：支持 AVIF 输出；参数
错误不报 404 而是直接返回原图。原设想是用它的「智能格式压缩」以零代码方式覆盖
`/images/*` 下存量 jpg/png。该能力在公测期免费，现已转为**付费项**，免费额度
站点无法开启（控制台会引导升级或开通试用），故撤回方案。**不要去点试用开通**，
避免产生扣费。

## 现有方案已覆盖同样的收益

| 目标 | 承担者 | 状态 |
|---|---|---|
| 外链图床按需限宽 + 转 WebP | 又拍云 URL 参数 `!/fw/1024/quality/70/format/webp` | 已上线（二期） |
| 首屏 hero 响应式多格式 | 构建期 sharp 生成 640/1280/1536 三档 AVIF+WebP+JPEG | 已上线（一期） |
| 图标体积 | FontAwesome 子集化 + WebP | 已上线（一期） |
| 本地图瘦身 | 构建期预生成，比运行时转码更快，且不占任何边缘配额 | 已覆盖实际被引用的图 |

本地 `/images/*` 现况复核（2026-10-31）：17 张 jpg + 3 张 png，合计 3.5 MB，
**但没有任何一张构成首屏运行时负担**：

- hero 的 6 张 jpg 只在 `<picture>` 里充当 AVIF/WebP 的兜底，浏览器按 `type`
  选源，不会下载；
- `main_bg_ligth.jpg`（490 KB）与 `main_bg.jpg`（425 KB）只出现在主题配置的
  `open_graph.image` 字段里，供社交平台抓取预览，不进入页面渲染；
- `2/3/4/6.jpg`、`avatar-2.png`、`avatar-3.png`、`redefine-og.webp`、`7.png`
  等均未被任何页面的 `/images/` 绝对路径引用（历史残留文件）；
- 541 个页面引用的默认封面 `wallhaven-wqery6-light.webp` 本身已是 WebP，57 KB。

## 若日后确实需要边缘运行时转码

1. **图库迁腾讯云 COS + EO 图片处理（付费）**：只需在 `cdn-image.js` 里加一个
   `eo` preset（`?eo-img.resize=w/1024&eo-img.format=webp`）并把这批域名加进
   白名单，helper / filter 架构已预留，改动不超过 5 行。
2. **继续用又拍云**（有免费额度）：把本地图也托管上去，直接复用现有 4 档 preset。
3. 不建议接第三方免费图片代理（如 wsrv.nl）：可用性、备案与隐私均不可控。

## 附：EO 参数对照（档案，当前未启用）

| 需求 | EO 写法 | 又拍云写法（本站图床在用） |
|---|---|---|
| 限宽、高自适应 | `?eo-img.resize=w/1024` | `!/fw/1024` |
| 转 WebP | `?eo-img.format=webp` | `!/format/webp` |
| 转 AVIF | `?eo-img.format=avif` | 不支持 |
| 组合 | `?eo-img.resize=w/1024&eo-img.format=webp` | `!/fw/1024/quality/70/format/webp` |
| 失败行为 | 返回原图 | 返回 400 或 404 占位图 |

## 为什么当初就没接 eo-img 参数（回头看是对的）

主站本地图片（hero 派生图、文章插图）已由 sharp 在构建期预生成 AVIF/WebP，
比任何运行时转换都更快、更省配额；因此代码只对**又拍云图床的外链图**做 URL
参数改写，从未把渲染路径绑到 EO 的图片处理上。这个边界恰好让本次"付费不可用"
变成纯文档层面的更正，零代码回滚、零线上风险。
