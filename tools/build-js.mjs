#!/usr/bin/env node
/**
 * 前端 JS 构建（跑在 hexo generate 之前）
 *
 * 背景：source/js/main.js 静态 import 了 25 个一级模块、其中 3 个还各带二级模块，
 * 一共 29 个文件、两层请求瀑布，浏览器只能逐层发现。
 * 这里用 esbuild 打成一个 ESM bundle，请求数 29 → 1。
 *
 * 注意：theme / config / Swup / particlesJS / Odometer / Typed / mermaid /
 * MiniMasonry / APlayer 都是运行时的全局变量，**不要**打包它们，也不要加 define。
 * esbuild 遇到未声明的标识符会原样保留，正好保持与改造前一致的全局依赖。
 *
 * 用法：node tools/build-js.mjs
 */
import path from 'node:path';
import fsp from 'node:fs/promises';
import esbuild from 'esbuild';

const JS_SRC = path.resolve('themes/defaultone/source/js');
const JS_BUILD = path.join(JS_SRC, 'build');

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

async function main() {
  await fsp.mkdir(JS_BUILD, { recursive: true });

  // 1. 应用入口：整图打包
  const bundle = await esbuild.build({
    entryPoints: [path.join(JS_SRC, 'main.js')],
    bundle: true,
    format: 'esm',
    target: ['es2020'],
    minify: true,
    sourcemap: true,
    outfile: path.join(JS_BUILD, 'main.bundle.js'),
    legalComments: 'none',
    logLevel: 'warning',
  });

  const bundleStat = await fsp.stat(path.join(JS_BUILD, 'main.bundle.js'));
  console.log(`  main.bundle.js                ${kb(bundleStat.size)}  (${bundle.warnings.length} 条告警)`);

  // 2. 独立脚本：只压缩，不打包（它依赖全局 APlayer）
  for (const rel of ['plugins/aplayer.js']) {
    const out = path.join(JS_BUILD, rel);
    await fsp.mkdir(path.dirname(out), { recursive: true });
    await esbuild.build({
      entryPoints: [path.join(JS_SRC, rel)],
      bundle: false,
      target: ['es2018'],
      minify: true,
      sourcemap: true,
      outfile: out,
      legalComments: 'none',
      logLevel: 'warning',
    });
    const st = await fsp.stat(out);
    console.log(`  ${rel.padEnd(28)}  ${kb(st.size)}`);
  }

  console.log('\n✓ 产物已写入 themes/defaultone/source/js/build/');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
