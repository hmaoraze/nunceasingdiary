// EdgeOne Makers 边缘中间件 —— 不改 Hexo 产物，只在边缘注入优化
// 文档：https://github.com/TencentEdgeOne/edgeone-makers-tools
//
// 优化项：
//   1. 注入安全响应头（X-Content-Type-Options / X-Frame-Options / Referrer-Policy / Permissions-Policy）
//   2. 修正静态资源缓存策略：浏览器 5 分钟 + 边缘 1 小时（现状边缘已缓存 43 小时，发版太慢）
//   3. HTML 保持 max-age=0，确保新发文章立刻可见
//   4. 通过 Link 头给外部图床补 preconnect

// 静态资源路径前缀（Hexo 产物里这些文件名不带 content hash，不能长缓存）
const STATIC_PREFIXES = [
  '/css/',
  '/js/',
  '/fonts/',
  '/fontawesome/',
  '/images/',
];

function isStaticAsset(pathname) {
  return STATIC_PREFIXES.some((p) => pathname.startsWith(p));
}

function isHtml(pathname) {
  // 带扩展名的通常不是 HTML（.css/.js/.jpg...）；其余视为 HTML 路由
  return !pathname.includes('.') || pathname.endsWith('/') || pathname.endsWith('.html');
}

export async function middleware(context) {
  const url = new URL(context.request.url);
  const pathname = url.pathname;

  // 让请求继续到源站（这里的"源站"就是 Makers 静态托管本身）
  const response = await context.next();

  // ---- 1. 安全响应头（对所有响应生效）----
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), browsing-topics=()'
  );

  // ---- 2. 缓存策略修正 ----
  if (isStaticAsset(pathname)) {
    // 静态资源：浏览器短缓存 5 分钟，CDN 边缘缓存 1 小时
    // 权衡：文件名不带 hash，不能用 immutable；但现状边缘 43h 太长，发版后用户半天看不到新版
    response.headers.set(
      'Cache-Control',
      'public, max-age=300, s-maxage=3600'
    );
  } else if (isHtml(pathname)) {
    // HTML：不缓存，保证新文章/新改动立刻可见
    response.headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
  }

  // ---- 3. 外部图床 preconnect（通过 Link 头，不修改 HTML）----
  // 仅对 HTML 响应注入，避免对静态资源响应重复加
  if (isHtml(pathname)) {
    const existing = response.headers.get('Link') || '';
    const preconnects = [
      '<https://image.hsmao.cn>; rel=preconnect; crossorigin',
      '<https://cdn.timens.cn>; rel=preconnect; crossorigin',
    ];
    const linkValue = preconnects.join(', ') + (existing ? ', ' + existing : '');
    response.headers.set('Link', linkValue);
  }

  return response;
}
//（注：内容由AI生成）
