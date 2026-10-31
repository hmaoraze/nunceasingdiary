"use strict";

/**
 * Live2D 延迟加载
 *
 * hexo-helper-live2d 会往每个页面 </body> 前塞一段同步脚本：
 *   <script src="/live2dw/lib/L2Dwidget.min.js?..."></script>
 *   写 <script>L2Dwidget.init({...})</script>
 * 同步脚本会阻塞解析，而看板娘对首屏毫无帮助。
 *
 * 这里把这段注入改写成"页面 load 之后、浏览器空闲时再加载"：
 *   · 视口宽度 < 1024px 不加载（移动端既卡又挡内容）
 *   · 系统开启"减少动态效果"时不加载
 *   · 桌面端仍按原配置渲染，模型与位置不变
 *
 * 顺带把 mobile.show 的处理交给这里，避免依赖插件自身的时间点。
 */

const ORIGINAL = /<script src="([^"]*L2Dwidget[^"]*)"\s*><\/script>\s*<script>([\s\S]*?)<\/script>\s*(?=<\/body>)/i;

hexo.extend.filter.register("after_render:html", function (html) {
  if (!html || html.indexOf("L2Dwidget") === -1) return html;

  const matched = html.match(ORIGINAL);
  if (!matched) return html;

  const [whole, scriptUrl, initCode] = matched;

  // initCode 形如 `L2Dwidget.init({"pluginRootPath":...});`
  const boot = `<script>
(function () {
  var SRC = ${JSON.stringify(scriptUrl)};
  function run() {
    ${initCode}
  }
  function load() {
    if (document.querySelector('script[data-live2d-loader]')) return;
    var s = document.createElement('script');
    s.src = SRC;
    s.async = true;
    s.setAttribute('data-live2d-loader', '');
    s.onload = run;
    document.body.appendChild(s);
  }
  // 移动端与"减少动态效果"下不加载看板娘
  if (window.innerWidth < 1024) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var start = function () {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(load, { timeout: 3000 });
    } else {
      setTimeout(load, 2000);
    }
  };
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
})();
</script>`;

  return html.replace(whole, boot);
});
