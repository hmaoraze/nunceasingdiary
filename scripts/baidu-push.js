// scripts/baidu-push.js
// 构建后自动推送 URL 到百度搜索资源平台（普通收录 API）
// 文档：https://ziyuan.baidu.com/linksubmit/index
// 配置见 _config.yml 的 baidu_push 段

'use strict';

const http = require('http');
const https = require('https');
const { URL } = require('url');

hexo.on('generateAfter', async function () {
  const cfg = hexo.config.baidu_push || {};
  if (cfg.enable === false) return;

  const site = (cfg.site || hexo.config.url || '').replace(/\/$/, '');
  const token = cfg.token;
  if (!site || !token) {
    console.log('[百度推送] 未配置 site/token，跳过');
    return;
  }

  // 只推文章页和独立页面，不推分页/标签/分类等聚合页
  const urls = [];

  // 文章页
  hexo.locals.get('posts').forEach((post) => {
    if (post.published !== false) {
      urls.push(site + '/' + post.path.replace(/index\.html$/, ''));
    }
  });

  // 独立页面（about、links、masonry、moments 等）
  hexo.locals.get('pages').forEach((page) => {
    if (page.published !== false && page.path.endsWith('.html')) {
      urls.push(site + '/' + page.path.replace(/index\.html$/, ''));
    }
  });

  // 首页
  urls.push(site + '/');

  if (urls.length === 0) {
    console.log('[百度推送] 没有可推送的 URL');
    return;
  }

  const api = `http://data.zz.baidu.com/urls?site=${encodeURIComponent(site)}&token=${token}`;

  try {
    const result = await postUrls(api, urls);
    console.log(`[百度推送] 推送 ${urls.length} 个 URL → ${result}`);
  } catch (e) {
    console.error(`[百度推送] 失败：${e.message}（不影响构建）`);
  }
});

function postUrls(apiUrl, urls) {
  return new Promise((resolve, reject) => {
    const u = new URL(apiUrl);
    const body = urls.join('\n');
    const client = u.protocol === 'https:' ? https : http;

    const req = client.request(
      {
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + u.search,
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: 10000,
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve(data.trim()));
      }
    );

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error('请求超时'));
    });
    req.write(body);
    req.end();
  });
}
