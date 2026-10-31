// EdgeOne Makers 边缘中间件 —— 不改 Hexo 产物，只在边缘注入优化
// 文档：https://github.com/TencentEdgeOne/edgeone-makers-tools
//
// 职责边界（T8 之后）：
//   ✅ 注入安全响应头
//   ✅ 通过 Link 头给外部图床补 preconnect
//   ❌ 不再写 Cache-Control
//
// 为什么把缓存交出去：
//   边缘中间件里 response.headers.set('Cache-Control', ...) 会覆盖 edgeone.json，
//   两边打架的结果很难排查。现在统一由 edgeone.json 声明：
//     HTML            → max-age=0, must-revalidate
//     /static/<id>/*  → max-age=31536000, immutable（文件名带构建指纹）
//     /images/*       → 7 天 + stale-while-revalidate

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

  // ---- 2. 外部图床 preconnect（通过 Link 头，不修改 HTML）----
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
