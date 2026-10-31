import fs from 'node:fs';
import path from 'node:path';

const RE =
  /https:\/\/[a-z0-9.-]*(?:hsmao|timens)\.cn\/[^"'\s<>]+\.(?:jpg|jpeg|png|webp|gif)/gi;

function walk(d, o = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, o);
    else if (e.name.endsWith('.html')) o.push(p);
  }
  return o;
}

const rows = walk('public')
  .map((f) => {
    const h = fs.readFileSync(f, 'utf8');
    return [(h.match(RE) || []).length, f.replace('public', '')];
  })
  .filter((r) => r[0] > 0)
  .sort((a, b) => b[0] - a[0]);

console.log('引用外链图片最多的页面 TOP10:');
rows.slice(0, 10).forEach(([n, f]) => console.log(String(n).padStart(4) + '  ' + f));
console.log('含外链图片的页面数:', rows.length);
