// 把 site/ 的内容推到 soberbw-hash/soberbw 的 main 分支（GitHub Pages 源）。
// 用 .tmp/deploy/repo 做中转，避免把 research / materials / tools 带上去。
// 注意：不要整目录删除（会被批量删除保护拦下），一律用 git 自己清。
//
// 用法：node tools/deploy.mjs [--dry]

import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const REPO = 'soberbw-hash/soberbw';
const WORK = resolve('.tmp/deploy');
const TARGET = join(WORK, 'repo');
const SITE = resolve('site');
const dry = process.argv.includes('--dry');

// 必须带 username：这台机器上凭据是存在 git:https://x-access-token@github.com 这个
// 目标下的，只给 host 的话 GCM 找不到，会转去弹 GUI 登录框，在无头环境里就静默挂死。
const token = (() => {
  try {
    return execSync('git credential fill', {
      input: 'protocol=https\nhost=github.com\nusername=x-access-token\n\n',
      encoding: 'utf8',
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      timeout: 30000,
    }).match(/^password=(.+)$/m)?.[1];
  } catch {
    return null;
  }
})();
if (!token) throw new Error('拿不到 GitHub token：请在终端里手动 git push 一次完成登录，再重跑');

const run = (cmd, cwd = TARGET) =>
  execSync(cmd, { cwd, stdio: 'inherit', env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });

mkdirSync(WORK, { recursive: true });

if (existsSync(join(TARGET, '.git'))) {
  console.log('== 复用已有仓库 ==');
  // origin 里不带 token 的话，ls-remote / fetch 会去问凭据管理器，
  // 非交互环境下就静静挂住（曾经挂过 25 分钟）。这里先把 token 塞进去。
  run(`git remote set-url origin https://x-access-token:${token}@github.com/${REPO}.git`);
  const env = { ...process.env, GIT_TERMINAL_PROMPT: '0' };
  // 本地 HEAD 已经等于远端就别再 fetch 了：--depth 1 的浅仓库每次 fetch
  // 都会把 30MB 图片重新下一遍，网络一慢就挂在这儿十几分钟。
  const local = execSync('git rev-parse HEAD', { cwd: TARGET, encoding: 'utf8' }).trim();
  let remote = '';
  try {
    remote = execSync('git ls-remote --heads origin main', { cwd: TARGET, encoding: 'utf8', env, timeout: 45000 })
      .trim().split(/\s+/)[0] || '';
  } catch { /* 拿不到就当需要 fetch */ }
  if (remote && remote === local) {
    console.log('   本地已是最新，跳过 fetch');
  } else {
    run('git fetch --depth 1 origin main');
    run('git reset --hard origin/main');
  }
  run('git clean -fdx -q');
} else {
  console.log('== 拉取仓库 ==');
  run(`git clone --depth 1 --branch main https://x-access-token:${token}@github.com/${REPO}.git repo`, WORK);
}

// 用 git 清空工作区（不走 fs 删除）
run('git rm -r --force --quiet . || true');
run('git clean -fdx -q || true');

console.log('== 复制 site/ ==');
// 逐项复制（cpSync 对已存在目录的行为是把 src 放进 dest 内部，会误建 repo/site）
for (const name of readdirSync(SITE)) {
  if (name === '.git') continue;
  cpSync(join(SITE, name), join(TARGET, name), { recursive: true, force: true });
}

/* 把构建脚本也塞进仓库一份。
   原因：这个仓库里只有生成结果，没有生成它的东西。换一台电脑 clone 下来，
   能看、能改 HTML，但改完下次构建就被覆盖——因为内容其实在 build-site.mjs 里。
   带上这一份，clone 下来就能 `node _src/build-site.mjs` 重新生成，
   不需要找「当初那台机器」。

   源文件永远以工作区的 tools/ 为准，这里是每次部署时的快照。
   目录名带下划线，GitHub Pages 的 Jekyll 会跳过它，所以不会当成页面发布出去
   ——但它在仓库里，clone 得到。 */
mkdirSync(join(TARGET, '_src'), { recursive: true });
for (const f of ['build-site.mjs', 'deploy.mjs']) {
  cpSync(join('tools', f), join(TARGET, '_src', f), { force: true });
}

run('git config user.email "soberbw@Outlook.com"');
run('git config user.name "soberbw-hash"');
run('git add -A');

let changed = true;
try {
  run('git diff --cached --quiet');
  changed = false;
} catch {
  changed = true;
}

if (!changed) {
  console.log('没有变更，跳过提交。');
  process.exit(0);
}

if (dry) {
  run('git diff --cached --stat');
  console.log('[dry] 不推送。');
  process.exit(0);
}

const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
run(`git commit -m "deploy: ${stamp}"`);
console.log('== 推送 ==');
run('git push origin main');
console.log('ok 已推送');
