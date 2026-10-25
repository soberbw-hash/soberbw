// 扫全站 html 的 href/src，确认都指向存在的本地文件
import { readFileSync, existsSync } from 'node:fs';
import { readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

const ROOT = existsSync('site') ? 'site' : '.';
const files = [];
(function walk(d) {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) walk(p);
    else if (n.endsWith('.html')) files.push(p);
  }
})(ROOT);

let bad = 0, total = 0;
for (const f of files) {
  const html = readFileSync(f, 'utf8');
  for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const href = m[1];
    if (/^(https?:|mailto:|tel:|#|data:)/.test(href)) continue;
    total++;
    // 先剥掉 ?v=532bec43 这类查询串，再剥 #hash。
    // 只剥 # 的话，所有带资源指纹的 css/js/图标都会被报成 MISS——
    // 第一版就是这样，81 条「缺失」里全是假警报，真缺的一个没抓出来。
    const target = resolve(dirname(f), href.split('#')[0].split('?')[0]);
    if (!existsSync(target)) {
      console.log('MISS', f, '->', href);
      bad++;
    }
  }
}
console.log(`checked ${files.length} pages, ${total} links, missing ${bad}`);
process.exit(bad ? 1 : 0);
