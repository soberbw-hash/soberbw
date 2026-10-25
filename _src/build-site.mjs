// 生成 soberbw.cn 静态站：index / works / about / work/*.html
// 纯静态输出，无运行时依赖。改内容只需改本文件的 DATA 区块后重跑。
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';

/* 输出目录。
   这个脚本有两种跑法，路径得自己认：
   · 在完整工作区里跑（tools/ 与 site/ 平级）→ 输出到 site/
   · 在 clone 下来的仓库里跑（index.html 就在根上）→ 输出到当前目录
   认错的后果很直接：在仓库里跑会新建一个空 site/，页面一个都不更新，
   而 git status 干干净净，看着像「构建成功但没生效」。 */
const ROOT = existsSync('site') ? 'site' : '.';
const SITE = 'https://soberbw.cn';

/* ---------- 站点图标 ----------
   深墨底 + 四角取景框。

   为什么不再用「尤」：16px 的标签栏里，一个汉字只剩十来个像素，横竖撇捺糊成
   一团墨点；而且把姓摆在图标上没有任何信息量——图标该说的是「这是个影像作品集」，
   不是「这人姓什么」。取景框的四角是「画幅」这个动作本身，缩到 16px 仍是个框。

   缺口宽度是试出来的：缺口 10/64 会连成一根完整的圆角方框（像「图片加载中」），
   20/64 在 16px 下散成四个点。16/64 在 16 和 64 两个尺寸上都成立。

   favicon-32.png 和 apple-touch-icon.png 是从这份 SVG 光栅化出来的静态文件：
   Chrome / Firefox 读 SVG，Safari 读 PNG。改这里之后要同步重新导出那两个
   （Chrome 无头截图，32px 与 180px 各一张；iOS 那张不带圆角，系统自己会加）。 */
const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<rect width="64" height="64" rx="14" fill="#141210"/>
<g fill="none" stroke="#FAFAF7" stroke-width="6.5" stroke-linecap="round">
<path d="M12 26V19a7 7 0 0 1 7-7h7"/><path d="M38 12h7a7 7 0 0 1 7 7v7"/>
<path d="M52 38v7a7 7 0 0 1-7 7h-7"/><path d="M26 52h-7a7 7 0 0 1-7-7v-7"/></g>
</svg>`;

/* 样式和脚本的指纹。GitHub Pages 的 HTML 只缓存十分钟，但 CSS 会一直用旧的，
   结果就是「内容更新了、版式还是上一版」——已经让用户踩过一次缓存。
   把 css/js 的内容哈希挂在链接后面，每次改动都会换 URL，浏览器只能重新取。 */
const ASSET_V = (() => {
  const h = createHash('sha1');
  /* 图标也算进来：favicon 的 URL 不变时浏览器会一直用缓存里那张旧图，
     换个图标半年不生效是常事。带上指纹，改一次就换一次地址。
     SVG 直接哈希字符串，不读文件——文件是本脚本自己写的，
     放在这里读会读到上一轮的内容，哈希就永远慢一拍。 */
  h.update(FAVICON_SVG);
  for (const f of ['assets/site.css', 'assets/app.js', 'assets/scroll.js', 'assets/copy.js',
                   'assets/favicon-16.png', 'assets/favicon-32.png', 'assets/apple-touch-icon.png']) {
    try { h.update(readFileSync(join(ROOT, f))); } catch {}
  }
  return h.digest('hex').slice(0, 8);
})();

/* ============ 占位图形（正式版替换为原片剧照） ============ */
const DEFS = `<svg class="defs" aria-hidden="true"><defs>
  <filter id="bw" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="13"/></filter>
  <filter id="bc" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="15"/></filter>
  <filter id="bg" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="11"/></filter>
  <filter id="hb" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="18"/></filter>
  <filter id="hb2" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="52"/></filter>
  <filter id="gr"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3"/><feColorMatrix type="saturate" values="0"/></filter>
  <radialGradient id="vw" cx="42%" cy="40%" r="72%"><stop offset=".38" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".72"/></radialGradient>
  <radialGradient id="vc" cx="56%" cy="46%" r="72%"><stop offset=".38" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".76"/></radialGradient>
  <radialGradient id="vg" cx="50%" cy="50%" r="74%"><stop offset=".38" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".7"/></radialGradient>
  <linearGradient id="hsky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#1A1710"/><stop offset=".26" stop-color="#4A3E28"/>
    <stop offset=".43" stop-color="#A88A54"/><stop offset=".52" stop-color="#E2C185"/>
    <stop offset=".61" stop-color="#8A6E42"/><stop offset=".74" stop-color="#2A2318"/>
    <stop offset="1" stop-color="#0C0B08"/>
  </linearGradient>
  <radialGradient id="hsun" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#FFF0C8" stop-opacity=".95"/><stop offset=".45" stop-color="#F0C078" stop-opacity=".5"/><stop offset="1" stop-color="#F0C078" stop-opacity="0"/></radialGradient>
  <radialGradient id="hvg" cx="50%" cy="44%" r="76%"><stop offset=".4" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".86"/></radialGradient>
</defs></svg>`;

// 每部作品一套抽象占位：横屏 320×180 / 竖屏 180×320
const ART = {
  wushe: `<rect width="320" height="180" fill="#C9D3D8"/><g filter="url(#bc)"><rect x="0" y="0" width="320" height="96" fill="#DCE6EA" opacity=".9"/><rect x="0" y="96" width="320" height="84" fill="#5F7A46" opacity=".9"/><ellipse cx="96" cy="120" rx="14" ry="26" fill="#F2F4F0" opacity=".85"/><ellipse cx="150" cy="126" rx="12" ry="23" fill="#EDEFEA" opacity=".8"/><ellipse cx="222" cy="118" rx="15" ry="27" fill="#F4F6F2" opacity=".85"/></g><rect width="320" height="180" fill="url(#vg)" opacity=".5"/><rect width="320" height="180" filter="url(#gr)" opacity=".07"/>`,
  nushu: `<rect width="320" height="180" fill="#15130D"/><g filter="url(#bw)"><rect x="24" y="14" width="76" height="86" fill="#D8BC84" opacity=".55"/><rect x="38" y="26" width="48" height="62" fill="#F0DCAE" opacity=".35"/><ellipse cx="188" cy="96" rx="42" ry="62" fill="#3A3020" opacity=".9"/><ellipse cx="188" cy="48" rx="21" ry="24" fill="#6B5836" opacity=".85"/><rect x="0" y="128" width="320" height="52" fill="#201A12"/></g><rect width="320" height="180" fill="url(#vw)"/><rect width="320" height="180" filter="url(#gr)" opacity=".12"/>`,
  zaocan: `<rect width="320" height="180" fill="#17110B"/><g filter="url(#bw)"><rect x="0" y="86" width="320" height="46" fill="#8A5A2E" opacity=".75"/><rect x="40" y="20" width="80" height="70" fill="#C08A4A" opacity=".4"/><ellipse cx="150" cy="30" rx="60" ry="30" fill="#E8C48A" opacity=".3"/><ellipse cx="252" cy="104" rx="40" ry="18" fill="#D8A860" opacity=".45"/><rect x="0" y="132" width="320" height="48" fill="#1E1610"/></g><rect width="320" height="180" fill="url(#vw)"/><rect width="320" height="180" filter="url(#gr)" opacity=".13"/>`,
  fool: `<rect width="320" height="180" fill="#08090D"/><g filter="url(#bc)"><circle cx="250" cy="46" r="26" fill="#C86A7A" opacity=".4"/><circle cx="286" cy="76" r="18" fill="#6A8AC8" opacity=".35"/><rect x="0" y="112" width="320" height="68" fill="#11141A"/><rect x="60" y="96" width="180" height="14" fill="#8A94A0" opacity=".5"/><ellipse cx="120" cy="150" rx="60" ry="20" fill="#D8DCE2" opacity=".18"/></g><rect width="320" height="180" fill="url(#vc)"/><rect width="320" height="180" filter="url(#gr)" opacity=".14"/>`,
  travel1: `<rect width="320" height="180" fill="#E8B87A"/><g filter="url(#bw)"><rect x="0" y="0" width="320" height="110" fill="#F0C98A" opacity=".8"/><circle cx="150" cy="106" r="34" fill="#FFF0C8" opacity=".9"/><g fill="#6E5238" opacity=".85"><rect x="20" y="96" width="26" height="60"/><rect x="60" y="82" width="18" height="74"/><rect x="92" y="104" width="30" height="52"/><rect x="140" y="90" width="22" height="66"/><rect x="186" y="100" width="34" height="56"/><rect x="236" y="86" width="20" height="70"/><rect x="272" y="102" width="30" height="54"/></g><rect x="0" y="150" width="320" height="30" fill="#3A2C1E" opacity=".9"/></g><rect width="320" height="180" fill="url(#vw)" opacity=".6"/><rect width="320" height="180" filter="url(#gr)" opacity=".08"/>`,
  travel2: `<rect width="320" height="180" fill="#2A3320"/><g filter="url(#bg)"><rect x="0" y="0" width="320" height="180" fill="#4E6338" opacity=".9"/><circle cx="150" cy="86" r="40" fill="#D8C070" opacity=".55"/><rect x="120" y="62" width="60" height="48" fill="#8A7A4A" opacity=".9"/><rect x="132" y="74" width="36" height="26" fill="#3E4A2E" opacity=".9"/><rect x="0" y="150" width="320" height="30" fill="#8A9AA8" opacity=".35"/></g><rect width="320" height="180" fill="url(#vg)"/><rect width="320" height="180" filter="url(#gr)" opacity=".12"/>`,
  zhiyun: `<rect width="180" height="320" fill="#9FB0B8"/><g filter="url(#bc)"><rect x="0" y="0" width="180" height="176" fill="#D2DDE2" opacity=".92"/><rect x="0" y="176" width="180" height="144" fill="#4E5A46" opacity=".9"/><ellipse cx="86" cy="196" rx="30" ry="62" fill="#2E3A2C" opacity=".85"/><ellipse cx="86" cy="128" rx="16" ry="18" fill="#3A4636" opacity=".9"/><rect x="0" y="286" width="180" height="34" fill="#2A3226" opacity=".8"/></g><rect width="180" height="320" fill="url(#vg)" opacity=".55"/><rect width="180" height="320" filter="url(#gr)" opacity=".08"/>`,
  device: `<rect width="180" height="320" fill="#100F0C"/><g filter="url(#bw)"><circle cx="92" cy="104" r="46" fill="#E8C070" opacity=".5"/><circle cx="92" cy="104" r="24" fill="#FFF0C0" opacity=".55"/><rect x="40" y="168" width="100" height="86" fill="#2A2620" opacity=".95"/><rect x="58" y="182" width="64" height="40" fill="#4A4238" opacity=".8"/><rect x="0" y="270" width="180" height="50" fill="#1A1712"/></g><rect width="180" height="320" fill="url(#vw)"/><rect width="180" height="320" filter="url(#gr)" opacity=".14"/>`,
  stadium: `<rect width="180" height="320" fill="#080C0A"/><g filter="url(#bg)"><rect x="0" y="0" width="180" height="150" fill="#141A18" opacity=".95"/><circle cx="52" cy="66" r="16" fill="#D8C070" opacity=".35"/><circle cx="124" cy="52" r="12" fill="#C8D8E0" opacity=".3"/><rect x="0" y="150" width="180" height="170" fill="#1E4A2C" opacity=".95"/><rect x="24" y="196" width="132" height="8" fill="#8AB0A0" opacity=".3"/><ellipse cx="90" cy="252" rx="46" ry="14" fill="#2E6A44" opacity=".7"/></g><rect width="180" height="320" fill="url(#vg)"/><rect width="180" height="320" filter="url(#gr)" opacity=".12"/>`,
};

const HERO_ART = `<rect width="1440" height="900" fill="url(#hsky)"/>
  <g filter="url(#hb2)"><circle cx="1010" cy="452" r="340" fill="url(#hsun)"/><rect x="0" y="492" width="1440" height="24" fill="#241C12" opacity=".85"/><rect x="0" y="556" width="1440" height="344" fill="#100E09"/></g>
  <g filter="url(#hb)"><ellipse cx="620" cy="510" rx="16" ry="44" fill="#14110B"/><ellipse cx="684" cy="524" rx="18" ry="50" fill="#14110B"/><ellipse cx="806" cy="504" rx="15" ry="40" fill="#17130C"/><ellipse cx="1040" cy="518" rx="17" ry="48" fill="#14110B"/><ellipse cx="1122" cy="508" rx="14" ry="42" fill="#17130C"/><ellipse cx="1268" cy="528" rx="19" ry="52" fill="#14110B"/><rect x="566" y="466" width="116" height="16" fill="#2A2116" opacity=".85"/><rect x="1002" y="462" width="152" height="15" fill="#2A2116" opacity=".8"/></g>
  <rect width="1440" height="900" fill="url(#hvg)"/><rect width="1440" height="900" filter="url(#gr)" opacity=".12"/>`;

const coverOf = (w) => w.cover || w.imgs[0];

/* 读 JPEG 的真实宽高。
   分享卡的 og:image:width / height 写错不会报错，但微信和 Slack 拿到对不上的
   比例会自己再裁一刀，卡片上的人脸就被切掉了。与其手写常量，不如扫一遍文件头：
   JPEG 的 SOF 段（0xC0–0xCF，去掉 0xC4/0xC8/0xCC 这三个非 SOF）里
   紧跟着精度字节就是 height 和 width，各两字节大端。 */
function jpegSize(file) {
  let b;
  try { b = readFileSync(file); } catch { return null; }
  if (b[0] !== 0xFF || b[1] !== 0xD8) return null;
  let i = 2;
  while (i < b.length - 9) {
    if (b[i] !== 0xFF) { i++; continue; }
    const m = b[i + 1];
    if (m === 0xD8 || m === 0x01 || (m >= 0xD0 && m <= 0xD7)) { i += 2; continue; }
    const len = (b[i + 2] << 8) | b[i + 3];
    if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) {
      return { h: (b[i + 5] << 8) | b[i + 6], w: (b[i + 7] << 8) | b[i + 8] };
    }
    i += 2 + len;
  }
  return null;
}

const svgH = (key, cls = '') => `<svg aria-hidden="true" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice"${cls ? ` class="${cls}"` : ''}>${ART[key]}</svg>`;
const svgV = (key) => `<svg aria-hidden="true" viewBox="0 0 180 320" preserveAspectRatio="xMidYMid slice">${ART[key]}</svg>`;
const svgHero = () => `<svg aria-hidden="true" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">${HERO_ART}</svg>`;
const svgStage = (key) => `<svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice">${ART[key]}</svg>`;

/* ============ 内容 ============ */
const WORKS = [
  {
    slug: 'wushe-qingnian', no: '01', art: 'wushe', title: 'YOUNG 武设青年', short: '武设青年',
    kind: 'MV 短片', year: '2022', platform: '中国青年报', stat: '600 万+ 浏览', cat: 'MV',
    cap: 'MV · 2022',
    role: '策划 / 摄制 / 后期',
    lead: '武汉设计工程学院青年群像 MV。',
    body: [
      '负责原创 MV 的策划、《YOUNG 武设青年》的摄制与后期制作。',
      '作品先后被人民网、新华网、中国青年报、学习强国等顶级央媒平台主动转载报道。',
      '全网跨平台累计总浏览量突破 600 万+。',
    ],
    imgs: ['wushe-qingnian-1','wushe-qingnian-2','wushe-qingnian-3','wushe-qingnian-4','wushe-qingnian-5','wushe-qingnian-6'],
    cover: 'wushe-qingnian-5',
    href: 'https://m.cyol.com/gb/articles/2022-06/29/content_BPXjIlYQ.html',
    hrefLabel: '中国青年报',
  },
  {
    slug: 'nushu-huixiang', no: '02', art: 'nushu', title: '女书回响', short: '女书回响',
    kind: '人物短片', year: '2023', platform: '新片场', stat: '中英双语字幕', cat: '人物',
    cap: '人物短片 · 新片场',
    role: '导演 / 剪辑',
    lead: '以女书为线索的人物短片。',
    body: [
      '以女书为线索的人物短片。镜头在老人、课堂、书写与孩子之间切换。',
      '全片配中英双语字幕，可在线观看。',
    ],
    imgs: ['nushu-huixiang-1','nushu-huixiang-2','nushu-huixiang-3','nushu-huixiang-4','nushu-huixiang-5','nushu-huixiang-6'],
    href: 'https://www.xinpianchang.com/a13476909?from=UserProfile',
    hrefLabel: '新片场',
  },
  {
    slug: 'wuhan-zaocan', no: '03', art: 'zaocan', title: '武汉声音：过早了冇', short: '过早了冇',
    kind: '人物短片', year: '2023', platform: '新片场', stat: '中英双语字幕', cat: '人物',
    cap: '人物短片 · 新片场',
    role: '导演 / 剪辑',
    lead: '武汉早餐摊的群像。',
    body: [
      '「过早了冇」是武汉话里问人吃过早饭没有。片名本身就是这部片子的方法：先有声音，再有画面。',
      '拍的是早餐摊——蒸汽、铁板、翻面的手，镜头几乎贴着灶台。全片配中英双语字幕。',
    ],
    imgs: ['wuhan-zaocan-1','wuhan-zaocan-2','wuhan-zaocan-3','wuhan-zaocan-4','wuhan-zaocan-5','wuhan-zaocan-6'],
    href: 'https://www.xinpianchang.com/a13109633?from=UserProfile',
    hrefLabel: '新片场',
  },
  {
    slug: 'fool-for-you', no: '04', art: 'fool', title: 'FOOL FOR YOU', short: 'FOOL FOR YOU',
    kind: 'MV 短片', year: '2023', platform: '百度网盘', stat: '原片下载', cat: 'MV',
    cap: 'MV 短片 · 网盘原片',
    role: '导演 / 摄影 / 剪辑',
    lead: '钢琴、雨夜、一通没说完的电话。',
    body: ['钢琴、雨夜、一通没说完的电话。一支关于告别的 MV 短片。', '原片可在网盘下载观看。'],
    imgs: ['fool-for-you-1','fool-for-you-2','fool-for-you-3','fool-for-you-4','fool-for-you-5','fool-for-you-6'],
    href: 'https://pan.baidu.com/s/1f9f9kyH_GVX7pLa2CpTnXmg?pwd=0000',
    hrefLabel: '网盘原片',
  },
  {
    slug: 'travel-01', no: '05', art: 'travel1', title: '旅拍短片 ①', short: '旅拍 ①',
    kind: '旅拍', year: '2023', platform: '百度网盘', stat: '原片下载', cat: '旅拍',
    cap: '旅拍 · 网盘原片',
    role: '摄影 / 剪辑',
    lead: '从正午走到日落。',
    body: ['从正午走到日落：城市天际线、街角、草地上的逆光。', '原片可在网盘下载观看。'],
    imgs: ['travel-01-1','travel-01-2','travel-01-3','travel-01-4','travel-01-5','travel-01-6'],
    href: 'https://pan.baidu.com/s/1tujrcoURWsm0U2VGUTDQq?pwd=0000',
    hrefLabel: '网盘原片',
  },
  {
    slug: 'travel-02', no: '06', art: 'travel2', title: '旅拍短片 ②', short: '旅拍 ②',
    kind: '旅拍 · 含航拍', year: '2023', platform: '百度网盘', stat: '原片下载', cat: '旅拍',
    cap: '旅拍 · 航拍 · 网盘原片',
    role: '摄影 / 航拍 / 剪辑',
    lead: '航拍寺庙与殿宇，收在纽约曼哈顿的天际线上。',
    body: ['航拍寺庙与殿宇，收在纽约曼哈顿的天际线上。一组跨地域的旅拍。', '原片可在网盘下载观看。'],
    imgs: ['travel-02-1','travel-02-2','travel-02-3','travel-02-4','travel-02-5','travel-02-6'],
    href: 'https://pan.baidu.com/s/1N6GM_TNKiVxu0KNZaP5_Zg?pwd=0000',
    hrefLabel: '网盘原片',
  },
];

const VERTICAL = [
  {
    slug: 'zhiyun', art: 'zhiyun', no: '07', v: true,
    title: '@智云官号 视频产出', short: '@智云官号', meta: '2024–2025',
    kind: '品牌短视频', year: '2024–2025', platform: '抖音', stat: '5 条 100 万+ 曝光', cat: '商业',
    cap: '品牌短视频 · 抖音',
    role: '内容策划 / 拍摄 / 剪辑',
    lead: '智云官方抖音账号的内容制作。',
    body: [
      '负责品牌官号 @智云（抖音 / 视频号）及其渠道号的内容策划与制作，围绕摄影配件产品的功能卖点与使用场景创作高质量短片。',
      '内容类型覆盖产品教程、创意短片、行业干货，其中 5 条视频实现 100 万+ 曝光。',
      '建立并维护内容选题库与脚本模板，将有效内容结构沉淀为可复用方法论，使团队日均稳定产出 2 条高质量内容，推动团队整体内容生产效率提升约 30%。',
    ],
    imgs: ['zhiyun-5','zhiyun-2','zhiyun-4','zhiyun-1','zhiyun-6','douyin-3'],
    cover: 'zhiyun-cover',
    // 首页那条竖着滚的带子用 2:1，竖版封面进去会被切掉三分之二，这里另指一张横的
    rail: 'zhiyun-5',
    href: 'https://www.douyin.com/video/7495610857691319563',
    hrefLabel: '抖音',
  },
  {
    slug: 'x100-rgb', art: 'device', no: '08', v: true,
    title: 'X100 RGB 新品', short: 'X100 RGB', meta: '+130% 曝光',
    kind: '新品发布短视频', year: '2025', platform: '抖音', stat: '曝光 +130%', cat: '商业',
    cap: '新品发布 · 抖音',
    role: '内容策划 / 拍摄 / 剪辑',
    lead: '智云 X100 RGB 补光灯的新品发布内容。',
    body: [
      '深度参与核心新品 X100 RGB 的内容营销，围绕灯光核心卖点制定内容方向。',
      '输出创意短片与种草内容十条，新品发布期关注度较上一代全网曝光提升 130%。',
    ],
    imgs: ['zhiyun-3','zhiyun-1','zhiyun-2','douyin-4','zhiyun-6','zhiyun-4'],
    cover: 'x100-cover', hero: 'x100-hero',
    rail: 'zhiyun-3',
    href: 'https://www.douyin.com/video/7458104745123695884',
    hrefLabel: '抖音',
  },
  {
    slug: 'stadium-2023', art: 'stadium', no: '09', v: true,
    title: '世界超级球星足球赛预热', short: '球星赛预热', meta: '2023 · 5 支',
    kind: '赛事预热短片', year: '2023', platform: '抖音', stat: '全网千万级曝光', cat: '商业',
    cap: '赛事预热 · 抖音',
    role: '官方视频编导 / 直播主摄像',
    lead: '2023 世界超级球星足球赛官方预热短片。',
    body: [
      '主导赛前 5 支创意预热短视频制作，多平台矩阵宣发累计 10 万+ 播放，助力赛事门票预售。',
      '负责关键节点直播主摄像（抖音直播售票、球星同游黄鹤楼等），保障直播画面稳定输出。',
      '直播内容被湖北卫视、长江云新闻等平台采纳同步转播，最终全网曝光超千万级。',
    ],
    imgs: ['stadium-2023-1','stadium-2023-2','stadium-2023-3','stadium-2023-4','stadium-2023-5','stadium-2023-6'],
    href: 'https://v.douyin.com/0VG5ZgFznak/',
    hrefLabel: '抖音',
  },
];

// 首页卡片带与作品页共用一份序列，顺序就是展示顺序
/* 陈列顺序 ≠ 数据顺序。

   作品页的网格是「一大两小」的编辑式节奏（见 workBody），占通栏的三个位置
   得给最扛得住大图的作品。按数据原顺序排，通栏会落在「旅拍②」这种片子上；
   按这里的顺序，通栏是三部最能打的：

     01 武设青年  600 万+ 浏览，中国青年报
     04 智云      5 条百万曝光
     09 球星赛    全网千万级曝光，湖北卫视转播

   中间那部（智云）挪到第四位，顺手让智云 + X100 这两部商业作品连成一排。

   为什么改 ALL 而不是只在作品页单独排一遍：ALL 同时是详情页「上一部 / 下一部」
   的依据。两处用不同的顺序，翻着翻着就跳了。 */
const ALL_ORDER = [
  'wushe-qingnian', 'nushu-huixiang', 'wuhan-zaocan',
  'zhiyun', 'x100-rgb', 'fool-for-you',
  'travel-01', 'travel-02', 'stadium-2023',
];
const ALL = ALL_ORDER.map((slug) => {
  const w = [...WORKS, ...VERTICAL].find((x) => x.slug === slug);
  if (!w) throw new Error(`ALL_ORDER 里的 ${slug} 找不到对应作品`);
  return w;
});

/* 联系方式：全部来自简历原文 */
const CONTACT = {
  phone: '19891520050',
  email: 'soberybw@Outlook.com',
  wechat: 'soberbw',
  github: 'soberbw-hash',
  githubUrl: 'https://github.com/soberbw-hash',
};

/* 六个自己写、自己每天在用的工具。
   文案只写仓库里真实存在的功能，不写没做出来的规划；截图里是演示数据，
   页脚会说明一次，不逐张重复。 */
const TOOLS = [
  {
    n: 'shanghao', zh: '上号', en: 'ShangHao', kind: 'Windows 桌面端',
    lead: '给固定朋友长期挂语音、开黑和聊天的桌面语音房。',
    desc: '现成的语音软件不是给公会做的，就是给会议做的，没人管「一群朋友整晚挂在一起」这件小事。上号把房间当成场景来做：谁在打游戏、谁走开了、昨晚聊了什么，都在同一个画面里。',
    points: [
      ['状态从机器读，不靠人改签名', '支持的游戏和正在播放的歌会自己显示在工位上；连续 30 分钟无操作进入离开态并静音，回来按离开前的状态恢复。'],
      ['AI 接在录音之后，不塞进聊天', '转录走 SenseVoiceSmall，整理与问答走 GLM-4-Flash，也能换成本地模型。密钥用 Windows 加密只留本机，摘要默认不出这台电脑。'],
      ['降噪不把麦克风交给云', 'DeepFilterNet3 的模型与 WASM 在本机加载，AudioWorklet 里处理。检测到双讲时主动降低抑制强度，避免字头被吞、人声发闷。'],
      ['五个人的连接是要算的', '五人全互联是 10 条成员连接、20 条定向媒体路径，所以做了按成员回退到 Relay 的恢复策略：坏哪一路，先救那一位。'],
    ],
    stack: 'Electron · WebRTC / Opus · React', date: '2026.10',
    href: 'https://github.com/soberbw-hash/shanghao', link: 'GitHub 与下载',
    shots: [
      { s: 'img/tools/sh/room.jpg', c: '房间全景：人物、天气、日历、聊天与语音控制' },
      { s: 'img/tools/sh/memory.jpg', c: '语音记忆：逐句转录、精彩片段与当晚摘要', fit: 1 },
      { s: 'img/tools/sh/ai.jpg', c: 'AI 配置：云端模型、本地模型与自定义接口' },
      { s: 'img/tools/sh/audio.jpg', c: '麦克风链：降噪、回声消除、人声增强、自动增益' },
    ],
  },
  {
    n: 'weave', zh: 'Weave', en: 'Local asset workspace', kind: '桌面端 / 浏览器',
    lead: '把散在十几个文件夹里的素材，收成一个找得到的项目。',
    desc: '剪辑之前最耗时的不是剪，是找。Weave 把素材库、自由画布和剪辑对照放进同一个项目：素材按角色、场景、道具、视频、音频归类，画布上按思路摆放，文稿和素材逐段对齐。',
    points: [
      ['素材先有身份，才有位置', '导入时按类型归类，网格和画布两种看法——同一批素材既能按时间扫一遍，也能按思路摆开。'],
      ['剪辑对照，把文稿和画面对上', '文稿放进去，素材拖到段落旁边；不用在时间线和十几个文件夹之间来回切。'],
      ['项目是一个能带走的文件夹', '数据留在本地项目目录，更新程序不碰项目本身；备份打包成 ZIP，换机器直接带走。'],
      ['便携优先', 'Windows 免安装包解压即用，另有浏览器版；自动更新下载完先校验 SHA-256 再替换。'],
    ],
    stack: 'Electron · TypeScript · 本地优先', date: '2026.10',
    href: 'https://github.com/soberbw-hash/Weave', link: 'GitHub 与下载',
    shots: [
      { s: 'img/tools/weave-lib.jpg', c: '素材库：按角色、场景、道具、视频、音频归类' },
      { s: 'img/tools/weave-canvas.jpg', c: '自由画布：未摆放的素材在右侧待命' },
      { s: 'img/tools/weave-pack.jpg', c: '项目里的一组 AI 素材：同一角色的多套画面', fit: 1 },
    ],
  },
  {
    n: 'shengzuo', zh: '声作', en: 'ShengZuo', kind: 'Windows 桌面端',
    lead: '用自己的声音，把长稿念完。',
    desc: '配音的门槛不在模型，在流程：一段一段试、一句一句改、失败了从头再来。声作把长稿配音做成可以续的任务——句子级进度、后台排队生成、只重做改动过的那几句。',
    points: [
      ['声音留在本机', '克隆、合成、导出全在本地跑；没有账号、没有会员、没有遥测，录音和文稿默认不出这台电脑。'],
      ['长稿是任务，不是一次请求', '导入 SRT / TXT / Word / Excel 按句编辑，已完成的句子保留，中途失败只重做失败的那几句。'],
      ['AI 只标停顿和情绪，不改原文', '智能处理先在本机固定原稿与分段，只让接口按编号返回参数；响应里混进改写文字也覆盖不了正文。'],
      ['三款模型按需换', 'VoxCPM2 综合最稳，Fun-CosyVoice3 覆盖 19 种方言，IndexTTS-2.5 做情绪演绎；默认只加载一个，切换时释放上一个。'],
    ],
    stack: 'Electron · TypeScript · 本地推理', date: '2026.08',
    href: 'https://github.com/soberbw-hash/shengzuo', link: 'GitHub 与下载',
    shots: [
      { s: 'img/tools/shengzuo.jpg', c: '单段配音：先试听 30 字，满意再生成整段' },
    ],
  },
  {
    n: 'bili', zh: 'B 站封面预览', en: 'Cover preview', kind: '网页工具',
    lead: '封面好不好，放进推荐流里才知道。',
    desc: '封面躺在文件夹里和在推荐流里是两个东西——尺寸被压、旁边全是别人的脸。这个工具把封面放进近似 B 站首页和手机端的版式里，直接看它抢不抢眼。',
    points: [
      ['桌面和手机一起看', '两种推荐流版式分开预览，一次判断两个场景，不用做完再上传试错。'],
      ['52 张真实封面做参照', '参照不是空白格子，是已经跑出来的封面；比较的是同一屏里的注意力，不是一张图的构图。'],
      ['纯静态，打开就能用', '不经过服务器，导入封面即预览，一键截图存证。'],
    ],
    stack: 'HTML / CSS / JS · 纯静态', date: '2026.08',
    href: 'https://soberbw-hash.github.io/bilibili-cover-preview/', link: '在线试用',
    shots: [
      { s: 'img/tools/bili-desktop.jpg', c: '桌面端推荐流：大图位与信息流同屏对比' },
      { s: 'img/tools/bili-phone.jpg', c: '手机端推荐流：双列卡片下的可读性', p: 'top center' },
      { s: 'img/tools/bili-demo.jpg', c: '导入自己的封面后，直接看它在同一屏里的位置', p: 'top center' },
    ],
  },
];

/* 两个 Windows 小工具：功能不复杂，不值得占一整屏，并排放 */
const MINI_TOOLS = [
  {
    n: 'winglow', zh: 'WinGlow', icon: 'img/tools/icon-winglow.png',
    desc: '让 Windows 更好看，也更好用。字体、右键菜单、任务栏、窗口材质和开始菜单收在一个界面里；改之前先备份，能撤销、能一键还原，点叉号缩到托盘继续生效。',
    tags: ['鸿蒙 / 思源黑体一键换', '右键菜单精简与还原', '动态壁纸可选组件'],
    stack: 'Rust / Tauri 2 · React', date: '2026.10',
    href: 'https://github.com/soberbw-hash/WinGlow', link: 'GitHub',
  },
  {
    n: 'winease', zh: 'WinEase', icon: 'img/tools/icon-winease.png',
    desc: '极简 Windows 工具箱。首页把清理、空间、体检、网络、开机等九类检查一次跑完，看完结果再决定执行哪些；清理只扫白名单，个人文件走回收站。',
    tags: ['九类一键检查', '按证据修网络', '空间占用图下钻'],
    stack: 'Rust / Tauri 2 · React 19', date: '2026.10',
    href: 'https://github.com/soberbw-hash/WinEase', link: 'GitHub',
  },
];

/* ============ 简历（内容照简历原文，未做增删） ============ */
const RESUME_HEAD = {
  name: '尤博文',
  meta: [
    ['电话', '19891520050'],
    ['邮箱', 'soberybw@Outlook.com'],
    ['性别', '男'],
    ['年龄', '25'],
  ],
  summary: [
    '4 年+视频内容制作经验，覆盖 3C 类品牌官方账号与社媒内容、影视节、政务融媒、赛事宣发及电商等多元场景。',
    '以创作者共创（KOC）形式与多家 3C 品牌合作，代表作品全网累计 1000 万+ 曝光，具备百万级视频曝光输出能力。',
    '擅长以产品视角进行内容策划，通过镜头语言与剪辑节奏呈现产品功能、使用场景与品牌理念；对画面质感与内容调性有稳定审美，注重影像表达的专业性与一致性。',
    '熟练使用 Sony / Canon / Panasonic 等主流相机及无人机 / 穿越机拍摄，具备商业级项目经验；精通达芬奇 / Premiere Pro / Final Cut Pro / 剪映，持有 DaVinci 调色师认证。',
  ],
};

const EXPERIENCE = [
  {
    org: '深圳市绿联进出口贸易有限公司（绿联）',
    sub: '',
    yr: '2026.03 – 至今',
    mark: '绿',
    logo: 'ugreen',
    /* 工作内容还没给我，先把位置占着。
       空着不写会让人以为是渲染坏了，所以给一行极淡的占位字。 */
    todo: '工作内容整理中。',
    items: [],
  },
  {
    org: '拍客科技有限公司（OPPO）',
    sub: '内容制作 · 电商 / TikTok',
    yr: '2025.09 – 2026.02',
    mark: '拍',
    logo: 'paike',
    items: [
      { h: '社媒内容制作', p: '依托 @青年派 自有账号矩阵，参与精品视频内容的策划与制作，内容以年轻人兴趣与圈层文化为核心导向。负责内容的视频拍摄与剪辑工作，强化整体内容质感与调性统一，相关内容获得稳定播放表现。', k: '平均播放量 10 万+' },
      { h: '内容洞察与选题判断', p: '基于巴西市场用户偏好，对 TikTok BR 热点内容、热门音乐、标签趋势及竞品账号结构进行持续拆解，判断有效内容形式与视觉表达方向。将洞察结果转化为可执行的选题方向、优化内容结构。', k: '冷启动阶段平均播放量稳定在 2000' },
      { h: 'TikTok 视频制作', p: '面向 TikTok 巴西市场，负责短视频内容制作，围绕不同产品类型与使用场景，优化镜头语言、画面节奏与卖点呈现方式，提升视频完成度与整体质感。', k: '单日 20 单转化，粉丝 0 → 2000+' },
      { h: 'AI 辅助内容生产', p: '熟练使用 ChatGPT / Runway / TopView / Sora 等生成式工具，辅助创意发散、画面素材与脚本构思。将 AI 应用于卖点提炼、脚本 / 分镜生成、素材补充与粗剪结构输出等关键环节。', k: '' },
      { h: 'AI 工作流搭建', p: '基于扣子搭建多节点 AI 工作流，实现内容生产关键环节的标准化与半自动化协作。', k: '单视频制作时长 1 小时 → 10 分钟' },
    ],
  },
  {
    org: '智神信息深圳有限公司（智云）',
    sub: '内容制作 · 摄影配件',
    yr: '2024.12 – 2025.06',
    mark: '智',
    logo: 'zhiyun',
    items: [
      { h: '社媒内容制作', p: '负责品牌官号 @智云（抖音 / 视频号）及其渠道号的内容策划与制作，围绕摄影配件产品的功能卖点与使用场景创作高质量短片。内容类型覆盖产品教程 / 创意短片 / 行业干货。', k: '5 条视频 100 万+ 曝光' },
      { h: '内容方法论沉淀', p: '建立并维护内容选题库与脚本模板，将有效内容结构沉淀为可复用方法论，使团队日均稳定产出 2 条高质量内容。', k: '团队效率提升约 30%' },
      { h: 'X100 RGB 新品营销', p: '深度参与核心新品 X100 RGB 的内容营销，围绕灯光核心卖点制定内容方向，输出创意短片与种草内容十条。', k: '发布期曝光较上一代 +130%' },
      { h: '达人共创与内容协同', p: '协同 50+ 位影像 / 摄影领域达人进行内容共创，负责 brief 沟通、分镜指导与成片审核，确保内容质量与品牌表达一致。', k: '协同 50+ 达人' },
      { h: '「36 小时影像创作」', p: '深度参与品牌营销活动，制定内容标准，协助 Top 级创作者完成视频内容创作。', k: '全网曝光超 1000 万+' },
    ],
  },
  {
    org: '武汉森鑫科技有限公司',
    sub: '摄影师 · 电商 / 亚马逊',
    yr: '2024.05 – 2024.12',
    mark: '森',
    logo: 'senxin',
    items: [
      { h: '产品拍摄与后期交付', p: '围绕产品功能与使用场景，针对高反光金属、全透明玻璃、强吸光面料等复杂材质，制定差异化布光与拍摄方案，强化产品质感与核心卖点呈现。', k: '' },
      { h: '跨部门协作', p: '对接运营与设计团队，将产品卖点与业务需求转化为可落地的视觉内容方案。', k: 'Listing 主图 / A+ 页面 / 广告素材' },
    ],
  },
];

const PROJECTS = [
  {
    org: '国际赛事 · 2023 世界超级球星足球赛',
    sub: '官方视频编导 & 直播主摄像',
    yr: '2023.11 – 2023.12',
    items: [
      '主导赛前 5 支创意预热短视频制作，多平台矩阵宣发累计 10 万+ 播放，助力赛事门票预售。',
      '负责关键节点直播主摄像（抖音直播售票、球星同游黄鹤楼等），保障直播画面稳定输出。',
      '直播内容被湖北卫视、长江云新闻等平台采纳同步转播，最终全网曝光超千万级。',
    ],
  },
  {
    org: '2022 横店影视节「文荣奖」',
    sub: '官方融媒体宣传',
    yr: '2022.10 – 2022.12',
    items: [
      '官方抖音账号 @横店影视节 的内容制作。完成包括创意短视频策划、电视剧花絮剪辑在内的多项视频制作任务。',
      '负责抖音 / 微博 / 小红书 / 公众号矩阵的内容策划与剪辑包装，并执行粉丝互动。',
      '独立策划剪辑覆盖黄明昊、王鹤棣 104 位知名明星艺人的宣传短视频，相关内容累计超百万曝光。',
    ],
  },
  {
    org: '《YOUNG 武设青年》MV 宣传片',
    sub: '主创团队',
    yr: '2022.03 – 2022.06',
    items: [
      '负责原创 MV 的策划、《YOUNG 武设青年》的摄制与后期制作。',
      '作品先后被人民网、新华网、中国青年报、学习强国等顶级央媒平台主动转载报道。',
      '全网跨平台累计总浏览量突破 600 万+。',
    ],
  },
];

const EDU = {
  school: '武汉设计工程学院',
  major: '播音与主持艺术（编创方向）',
  degree: '本科',
  yr: '2020.09 – 2024.06',
};

const AWARDS = [
  ['技能类', '获省级广电媒体颁发的「最佳视效奖」「优秀内容创作者」等奖项。'],
  ['竞赛类', '中国大学生广告艺术节学院奖中，累计 7 次入围并斩获「企业奖·优秀类」等奖项。'],
  ['综合荣誉', '校期间多次获评「优秀学生干部」「突出贡献奖」「先进个人」等荣誉。'],
];

const SKILLS = [
  ['相机', 'Sony / Canon / Panasonic 主流机型'],
  ['特种拍摄', '无人机 / 穿越机'],
  ['剪辑', 'Premiere Pro / Final Cut Pro / 剪映'],
  ['调色', 'DaVinci Resolve（认证调色师）'],
  ['AI 工具', 'ChatGPT / Runway / TopView / Sora / 扣子'],
  ['开发', 'TypeScript / Rust（工具开发）'],
];

/* ============ 模板 ============ */
// 四个内容页合成一条滚动流（browse.html），导航一律指到对应的那一屏。
// 原来的 work.html / resume.html / tools.html / contact.html 仍然生成，
// 直接访问和外部链接都还能用，只是不再是导航的主路径。
const NAV = [
  ['作品', 'browse.html#work'],
  ['简历', 'browse.html#resume'],
  ['软件', 'browse.html#tools'],
  ['联系', 'browse.html#contact'],
];

// 一级页不挂导航——四个入口就在页面里，顶栏再列一遍等于把同一件事说两遍。
// 署名只用「尤博文」：soberbw.cn 是域名，不是名字，不往页面上写。
function topbar(depth, current, bare = false) {
  const p = depth ? '../' : '';
  const items = NAV.map(([label, href]) =>
    `<a href="${p}${href}"${label === current ? ' aria-current="page"' : ''}>${label}</a>`
  ).join('\n        ');
  return `<header class="topbar${bare ? ' bare' : ''}">
    <div class="in">
      <a class="mark" href="${p}index.html">尤博文</a>
      ${bare ? '' : `<nav>
        ${items}
      </nav>`}
    </div>
  </header>`;
}

function footer(depth) {
  const p = depth ? '../' : '';
  return `<footer class="wrap">
    <span>© 2026 尤博文</span>
    <span><a href="${p}index.html">返回首页</a></span>
  </footer>`;
}

function layout({ title, desc, depth = 0, current = '', body, bodyClass = '', bare = false, minimal = false, script = '', path = '', htmlClass = '', ogImage = '', theme = 'light' }) {
  const p = depth ? '../' : '';
  const url = `${SITE}/${path}`;
  /* 分享图（og:image）默认给站点主视觉，但作品页要给自己那张。
     原来这里写死成 wushe-qingnian-5.jpg，九个详情页分享出去全是同一张
     《武设青年》的剧照——发一部新片到微信里，卡片上还是两年前的旧片。
     传进来的只是文件名，路径和尺寸在这里统一补。 */
  const ogFile = ogImage || 'wushe-qingnian-5.jpg';
  const ogDim = jpegSize(join(ROOT, 'img/work', ogFile)) || { w: 1396, h: 698 };
  const ogW = ogDim.w;
  const ogH = ogDim.h;
  return `<!DOCTYPE html>
<html lang="zh-CN"${htmlClass ? ` class="${htmlClass}"` : ''}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="${url}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:url" content="${url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="尤博文的个人主页">
<meta property="og:image" content="${SITE}/img/work/${ogFile}">
<meta property="og:image:width" content="${ogW}">
<meta property="og:image:height" content="${ogH}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="${theme === 'dark' ? '#0A0A09' : '#F5F4F0'}">
<link rel="icon" href="${p}assets/favicon.svg?v=${ASSET_V}" type="image/svg+xml">
<link rel="icon" href="${p}assets/favicon-16.png?v=${ASSET_V}" sizes="16x16" type="image/png">
<link rel="icon" href="${p}assets/favicon-32.png?v=${ASSET_V}" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="${p}assets/apple-touch-icon.png?v=${ASSET_V}">
${path === '' ? `<link rel="preload" href="${p}fonts/display/sans-name-700.woff2" as="font" type="font/woff2" crossorigin>` : ''}
<link rel="stylesheet" href="${p}fonts/harmonyos/Regular.css">
<link rel="stylesheet" href="${p}fonts/harmonyos/Medium.css">
<link rel="stylesheet" href="${p}fonts/harmonyos/Semibold.css">
<link rel="stylesheet" href="${p}fonts/script/caveat.css">
<link rel="stylesheet" href="${p}assets/site.css?v=${ASSET_V}">
</head>
<body${bodyClass ? ` class="${bodyClass}"` : ''}>
${DEFS}
${minimal ? '' : topbar(depth, current, bare)}
${body}
${minimal ? '' : footer(depth)}
${script ? [].concat(script).map((s) => `<script src="${p}assets/${s}?v=${ASSET_V}" defer></script>`).join('\n') : ''}
</body>
</html>
`;
}

/* ---- 一级页面：场景首页 ----
   全屏云海（app.js 画的 canvas）+ 巨型姓名 + 手写签名 + 胶囊导航 + 底部卡片带。
   简介照作品集第一页原文，一个字没改。 */
const RAIL = ALL;

const SUMMARY = [
  '4 年+视频制作经验，覆盖 3C 类 Top 品牌官方账号与社媒内容、影视节、政务融媒、赛事宣发及电商等多元场景。',
  '曾获省级广电媒体颁发的「最佳视效奖」「优秀内容创作者」等奖项，累计 7 次入围广告艺术节奖项。',
  '精通视频全中后期制作流程，对画面质感与内容调性有稳定审美。',
];

const indexBody = `<main class="sc-stage">
  <video class="sc-film" id="film" aria-hidden="true" tabindex="-1"
         autoplay muted loop playsinline preload="auto" disablepictureinpicture
         poster="media/island-poster.jpg">
    <source src="media/island-loop.mp4" type="video/mp4">
  </video>
  <canvas class="sc-sky" id="sky" aria-hidden="true"></canvas>

  <div class="sc-veil" aria-hidden="true"></div>
  <div class="sc-grain" aria-hidden="true"></div>

  <header class="sc-nav">
    <a class="sc-pill sc-brand" href="index.html">尤博文</a>
    <nav class="sc-links">
      <a href="browse.html#work">作品</a>
      <a href="browse.html#resume">简历</a>
      <a href="browse.html#tools">软件</a>
    </nav>
    <a class="sc-pill sc-cta" href="browse.html#contact">联系</a>
  </header>

  <div class="sc-hero">
    <div class="sc-hero-in">
      <p class="sc-kicker" data-tilt="6">短片导演 / 摄影师</p>
      <h1 class="sc-title" data-tilt="14">
        <span class="sc-t-b">尤博文</span>
        <span class="sc-t-lit" aria-hidden="true">尤博文</span>
      </h1>
      <div class="sc-en" data-tilt="8">
        <span class="en">Portfolio</span>
        <span class="sig">You Bowen</span>
      </div>
      <ul class="sc-sub" data-tilt="4">
        ${SUMMARY.map((t) => `<li>${t}</li>`).join('\n        ')}
      </ul>
    </div>
  </div>

  <aside class="sc-rail" aria-label="作品">
    <div class="sc-track" id="rail">
      ${RAIL.map((r) => `<a class="sc-card" href="work/${r.slug}.html">
        <div class="art"><img src="img/work/${r.rail || coverOf(r)}.jpg" alt="" loading="lazy"></div>
        <div class="cap"><b>${r.short || r.title}</b><i>${r.cap}</i></div>
      </a>`).join('\n      ')}
    </div>
  </aside>


</main>`;

/* ---- 三级：单部作品 ---- */
function detailBody(w, i) {
  const prev = ALL[(i - 1 + ALL.length) % ALL.length];
  const next = ALL[(i + 1) % ALL.length];
  const idx = String(i + 1).padStart(2, '0');
  // 详情页顶部可以另配一张：卡片要抢眼，详情页要能讲事
  const cover = `img/work/${w.hero || coverOf(w)}.jpg`;
  /* 画廊里每一张的「权限」按源图真实尺寸给，不按心情。
     原来这里有一条无条件的 `figure:last-child:nth-child(odd){grid-column:span 2}`：
     只要张数是奇数，最后一张就被拉到 1330px——可《女书回响》的剧照只有 714px 宽，
     等于放大 1.86 倍，糊是必然的。现在按测量结果分三类：

     · 横向且 ≥1200px → 通栏。1330px 下才放大 1.11 倍，看不出来。
     · 竖向（h > w）→ 通栏居中、压到 360px 宽，比例用原图的。
       两张抖音封面是竖版带大标题字的，硬裁成 2:1 会把标题和脸一起切掉。
     · 其余 → 半栏，660px。800px 的源图正好缩到 0.8 倍，只会更锐。 */
  const shots = w.imgs
    .filter((n) => n !== coverOf(w) && n !== w.hero)
    .map((n) => ({ n, dim: jpegSize(join(ROOT, 'img/work', `${n}.jpg`)) }));

  /* 一部作品只给一次通栏，而且给最大的那张。
     全给通栏的话，五张一样大的长条一路排下去，和「六张一样大的小卡」是同一种
     单调，只是换了个尺寸。一次通栏 + 后面两两并排，节奏才立得住。
     把最大的那张挪到最前面，是为了让通栏落在第一行：留在中间的话，跨两列的
     那张会在右半格挤不下去，被整体推到下一行，前面空出一个 660×330 的洞。
     挪一张图的顺序，换来整页不留洞，划算。 */
  let wideAt = -1;
  shots.forEach((s, k) => {
    if (!s.dim || s.dim.h > s.dim.w || s.dim.w < 1200) return;
    if (wideAt < 0 || s.dim.w > shots[wideAt].dim.w) wideAt = k;
  });
  if (wideAt > 0) shots.unshift(...shots.splice(wideAt, 1));

  const gallery = shots.map(({ n, dim }, k) => {
    let attr = '';
    if (k === 0 && wideAt >= 0) {
      attr = ' class="is-wide"';
    } else if (dim && dim.h > dim.w) {
      /* 比例写在行内，是为了让占位高度一次算对——不然懒加载时图一进来整页往下跳。 */
      attr = ` class="is-tall" style="aspect-ratio:${dim.w}/${dim.h}"`;
    }
    return `<figure${attr}><img src="../img/work/${n}.jpg" alt="${w.title} 剧照 ${k + 2}" loading="lazy"></figure>`;
  });

  return `<main class="dt">
  <section class="dt-hero${w.v ? ' is-v' : ''}">
    <div class="dt-top wrap">
      <a href="../browse.html#work">← 全部作品</a>
      <a class="dt-mark" href="../index.html">尤博文</a>
    </div>

    <div class="dt-main wrap">
      <div class="dt-info">
        <div class="dt-kind">${w.kind}${w.year === '未记录' ? '' : ` · ${w.year}`}</div>
        <h1>${w.title}</h1>
        <p class="dt-lead">${w.lead}</p>
      </div>
      <figure class="dt-shot">
        <div class="dt-shot-in"><img src="../${cover}" alt="${w.title} 剧照"></div>
      </figure>
    </div>

    ${/* 身份 / 发布 / 年份 / 观看入口原来挤在标题下面那一小坨 dl 里，
         跟标题抢同一块注意力。挪到首屏底部、拉成一条横贯的credits带：
         像片尾字幕那样一行一件事，标题就彻底空出来了。 */ ''}
    <div class="dt-credits wrap">
      <dl>
        <div><dt>身份</dt><dd>${w.role}</dd></div>
        <div><dt>发布</dt><dd>${w.platform}</dd></div>
        ${w.year && w.year !== '未记录' ? `<div><dt>年份</dt><dd>${w.year}</dd></div>` : ''}
      </dl>
      ${w.href ? `<a class="dt-cta" href="${w.href}" target="_blank" rel="noopener">在${w.hrefLabel}观看 <span>↗</span></a>` : ''}
    </div>
  </section>

  <section class="wrap dt-body">
    <div class="dt-text">
      <div class="label">关于</div>
      ${w.body.map((t) => `<p>${t}</p>`).join('\n      ')}
    </div>
    <div class="dt-gallery">
      ${gallery.join('\n      ')}
    </div>
  </section>

  ${/* 上一部 / 下一部。原来两边都是两行小字，读到页尾就没气了。
         现在「下一部」带一张封面——它是这一页最后看到的东西，
         应该是一张画面，而不是一行链接。 */ ''}
  <nav class="dt-nav wrap" aria-label="作品切换">
    <a class="dt-prev" href="${prev.slug}.html">
      <span>← 上一部</span>
      <b>${prev.short || prev.title}</b>
    </a>
    <a class="dt-next" href="${next.slug}.html">
      <figure><img src="../img/work/${next.rail || next.hero || coverOf(next)}.jpg" alt="" loading="lazy"></figure>
      <span>下一部 →</span>
      <b>${next.short || next.title}</b>
    </a>
  </nav>
</main>`;
}

/* ---- 二级：作品 ---- */
/* 作品页：九部全收，编辑式大小混排。

   上一版只列了六部横屏——三部竖屏作品（智云 / X100 / 球星赛）当时被单独放进
   一段 9:16 的三列网格，用户嫌「展示不全、破坏美感」整段删了，结果那三部
   只剩首页片带能点到，作品页反而漏掉了商业成绩最好的三条。

   现在把它们收回同一个网格，但用各自的**横版剧照**（都是 2:1），
   所以不会重现「竖屏卡高低不齐」——整个网格只有一个比例。

   节奏：通栏（1）→ 两张并排（2、3）→ 通栏（4）→ 两两并排（5–8）→ 通栏（9）。
   为什么不是简单的两列四行半：一样大的卡重复九次，就是一张 Excel。 */
const LIST_WIDE = [0, 3, 8];

/* wide=true 给作品页（认真看，有大小层级），false 给浏览页（快速扫，一律等大）。

   为什么浏览页要用另一套：它是「四章连起来滚一遍」的形态。之前两页共用同一个
   网格，作品那章从 1.6 屏涨到 4.2 屏，整页的重心全歪到作品上，简历和软件
   被挤到后面去了。作品页本来就该长，浏览页不该。 */
function workBody(wide = true) {
  return `<main class="wrap list-page">
  <div class="sec-head">
    <h1>作品</h1>
  </div>

  <div class="list-grid">
    ${ALL.map((w, i) => {
      /* 九部是奇数，两列网格最后一行会剩一张孤零零的半宽卡，右边空一块。
         最后一张补满整行把格子收口——只在紧凑形态需要，作品页那张本来就是通栏。 */
      const cls = wide && LIST_WIDE.includes(i) ? 'is-wide'
        : (!wide && i === ALL.length - 1 && ALL.length % 2 ? 'is-fill' : '');
      return `<a href="work/${w.slug}.html"${cls ? ` class="${cls}"` : ''}>
      <div class="frame"><img src="img/work/${w.rail || w.hero || coverOf(w)}.jpg" alt="${w.title}" loading="lazy"></div>
      <div class="cap"><b>${w.title}</b><i>${w.cap}</i></div>
    </a>`;
    }).join('\n    ')}
  </div>
</main>`;
}

/* 默认展开哪一条：第一条「有内容」的。
   绿联刚占位、内容还没给，默认摊开它的话，右边整栏只有一行「整理中」，
   一进简历页就是空的。等绿联的内容补上，这条规则会自动把默认位挪回第一条。 */
const EXP_DEFAULT = Math.max(0, EXPERIENCE.findIndex((e) => e.items.length));

/* ---- 二级：简历 ---- */
const resumeBody = `<main class="wrap resume-page">
  <header class="rs-head">
    <div class="rs-name">
      <h1>${RESUME_HEAD.name}</h1>
      <dl class="rs-meta">
        ${RESUME_HEAD.meta.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('\n        ')}
      </dl>
    </div>
    <ul class="rs-summary">
      ${RESUME_HEAD.summary.map((t) => `<li>${t}</li>`).join('\n      ')}
    </ul>
  </header>

  <section class="rs-block">
    <h2>工作经历</h2>
    <div class="exp">
      ${EXPERIENCE.map((e, i) => `<input type="radio" name="exp" id="exp-${i}"${i === EXP_DEFAULT ? ' checked' : ''}>`).join('\n      ')}
      <div class="exp-list">
        ${EXPERIENCE.map((e, i) => `<label for="exp-${i}">
          ${e.logo
            ? `<i class="mark is-logo"><img src="img/logo/${e.logo}.png" alt="" width="30" height="30" loading="lazy" decoding="async"></i>`
            : `<i class="mark">${e.mark}</i>`}
          <span><b>${e.org}</b>${e.sub ? `<em>${e.sub}</em>` : ''}</span>
          <u>${e.yr}</u>
        </label>`).join('\n        ')}
      </div>
      <div class="exp-panes">
        ${EXPERIENCE.map((e) => `<article class="exp-pane">
          <h3>${e.org}</h3>
          <div class="exp-pane-meta">${[e.sub, e.yr].filter(Boolean).join(' · ')}</div>
          ${e.items.length
            ? `<ul class="ticks">
            ${e.items.map((it) => `<li>
              <div><b>${it.h}</b><p>${it.p}</p></div>
              ${it.k ? `<span class="kpi">${it.k}</span>` : ''}
            </li>`).join('\n            ')}
          </ul>`
            : `<p class="exp-todo">${e.todo || ''}</p>`}
        </article>`).join('\n        ')}
      </div>
    </div>
  </section>

  <section class="rs-block">
    <h2>项目经历</h2>
    <div class="proj-list">
      ${PROJECTS.map((pr) => `<article class="proj">
        <div class="proj-head">
          <h3>${pr.org}</h3>
          <div class="proj-meta">${pr.sub} · ${pr.yr}</div>
        </div>
        <ul class="ticks">
          ${pr.items.map((t) => `<li><div><p>${t}</p></div></li>`).join('\n          ')}
        </ul>
      </article>`).join('\n      ')}
    </div>
  </section>

  <section class="rs-block">
    <h2>教育经历</h2>
    <div class="edu-row">
      <div>
        <b>${EDU.school}</b>
        <span>${EDU.major} · ${EDU.degree}</span>
      </div>
      <u>${EDU.yr}</u>
    </div>
  </section>

  <section class="rs-block">
    <h2>荣誉奖项</h2>
    <ul class="award-list">
      ${AWARDS.map(([k, v]) => `<li><b>${k}</b><p>${v}</p></li>`).join('\n      ')}
    </ul>
  </section>

  <section class="rs-block">
    <h2>技能</h2>
    <dl class="skill-list">
      ${SKILLS.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('\n      ')}
    </dl>
  </section>
</main>`;

/* ---- 二级：软件 ---- */
const toolsBody = `<main class="wrap tools-page">
  <div class="sec-head">
    <h1>软件</h1>
    <p>六个自己写、自己也在用的工具。起点都一样：先用，发现哪一步不顺手，再决定要不要动手。</p>
  </div>

  <div class="tool-list">
    ${TOOLS.map((t, i) => {
      const [main, ...rest] = t.shots;
      return `<article class="tool${i % 2 ? ' is-flip' : ''}" id="${t.n}">
      <div class="tool-visual">
        <a class="tool-main" href="${t.href}" target="_blank" rel="noopener" aria-label="${t.zh}">
          <img src="${main.s}" alt="${t.zh} 界面" loading="lazy">
        </a>
      </div>
      <div class="tool-info">
        <div class="tool-meta">
          <span class="tool-no">${String(i + 1).padStart(2, '0')}</span>
          <span class="tool-kind">${t.kind}</span>
        </div>
        <h2>${t.zh}<span class="tool-en">${t.en}</span></h2>
        <p class="tool-lead">${t.lead}</p>
        <p class="tool-desc">${t.desc}</p>
        <ul class="tool-points">
          ${t.points.map(([k, v]) => `<li><b>${k}</b><span>${v}</span></li>`).join('\n          ')}
        </ul>
        <div class="tool-foot">
          <span class="tool-stack">${t.stack} · ${t.date}</span>
          <a class="tool-link" href="${t.href}" target="_blank" rel="noopener">${t.link} <span>↗</span></a>
        </div>
      </div>
      ${rest.length ? `<div class="tool-shots">
        ${rest.map((s) => `<figure${s.fit ? ' class="is-fit"' : ''}>
          <img src="${s.s}" alt="${t.zh} 界面" loading="lazy"${s.p ? ` style="object-position:${s.p}"` : ''}>
          <figcaption>${s.c}</figcaption>
        </figure>`).join('\n        ')}
      </div>` : ''}
    </article>`;
    }).join('\n    ')}
  </div>

  <div class="tool-mini">
    ${MINI_TOOLS.map((t, i) => `<article class="mini" id="${t.n}">
      <div class="mini-top">
        <img class="mini-icon" src="${t.icon}" alt="${t.zh}" loading="lazy">
        <div class="mini-head">
          <h2>${t.zh}</h2>
          <span class="mini-no">${String(TOOLS.length + i + 1).padStart(2, '0')}</span>
        </div>
      </div>
      <p class="mini-desc">${t.desc}</p>
      <ul class="mini-tags">${t.tags.map((x) => `<li>${x}</li>`).join('')}</ul>
      <div class="tool-foot">
        <span class="tool-stack">${t.stack} · ${t.date}</span>
        <a class="tool-link" href="${t.href}" target="_blank" rel="noopener">${t.link} <span>↗</span></a>
      </div>
    </article>`).join('\n    ')}
  </div>

  <p class="tool-note">截图取自软件实际运行界面；其中的房间成员、录音与项目素材为演示数据。</p>
</main>`;

/* ---- 二级：联系 ---- */
const contactBody = `<main class="wrap contact-page">
  <div class="sec-head">
    <h1>联系</h1>
  </div>

  <div class="ct-grid">
    <a class="ct-main" href="tel:${CONTACT.phone}">
      <span class="ct-k">电话</span>
      <b>${CONTACT.phone}</b>
      <i>点击拨号</i>
    </a>
    <a class="ct-main" href="mailto:${CONTACT.email}">
      <span class="ct-k">邮箱</span>
      <b>${CONTACT.email}</b>
      <i>商务与合作</i>
    </a>
    <button class="ct-main ct-copy" type="button" data-copy="${CONTACT.wechat}">
      <span class="ct-k">微信</span>
      <b>${CONTACT.wechat}</b>
      <i class="ct-hint">点击复制</i>
    </button>
  </div>

  <div class="ct-links">
    <a href="${CONTACT.githubUrl}" target="_blank" rel="noopener">GitHub<span>${CONTACT.github}</span></a>
  </div>
</main>`;

/* ============ 输出 ============ */
mkdirSync(join(ROOT, 'assets'), { recursive: true });

/* 滚动页：四个内容页拼成一条竖着滚的流。
   为什么不在原来四个页面之间做跨页动画：跨文档没法无缝——滚到底再触发跳转，
   中间必然有一次白屏或加载。要「滚到哪看到哪」，只能装进同一个文档。
   内容全部复用下面四个 body，不另写一份，改内容只改一处。 */
const PANES = [
  ['work', '作品', workBody(false)],
  ['resume', '简历', resumeBody],
  ['tools', '软件', toolsBody],
  ['contact', '联系', contactBody],
];

const paneOf = (key, label, body) => {
  // 原来每个页面是 <main class="wrap xxx-page">，这里换成 section 并带上锚点
  const inner = body
    .replace(/^<main class="wrap ([^"]*)">/, '<div class="wrap $1">')
    .replace(/<\/main>\s*$/, '</div>');
  return `  <section class="bz-pane" id="${key}" aria-label="${label}">
${inner}
  </section>`;
};

const browseBody = `<div class="bz">
${PANES.map(([k, l, b]) => paneOf(k, l, b)).join('\n')}
</div>

<nav class="bz-dots" aria-label="跳到某一屏">
${PANES.map(([k, l], i) => `  <a href="#${k}" data-go="${k}"><i></i><span>${String(i + 1).padStart(2, '0')} ${l}</span></a>`).join('\n')}
</nav>`;

writeFileSync(join(ROOT, 'index.html'), layout({
  /* 标签页写站点身份，不写「名字 — 职位」。
     后者挂在标签栏上像一张没写完的名片，而且职位一换就得改一处，
     站点身份不会过期。 */
  title: '尤博文的个人主页',
  desc: '尤博文，短片导演、剪辑。作品、简历、软件与联系方式。',
  minimal: true,
  bodyClass: 'dark',
  script: 'app.js',
  path: '',
  theme: 'dark',
  body: indexBody,
}));

writeFileSync(join(ROOT, 'browse.html'), layout({
  title: '作品 · 简历 · 软件 · 联系 — 尤博文的个人主页',
  desc: '尤博文的作品、简历、软件与联系方式，一屏一屏往下看。',
  bodyClass: 'inner bz-page',
  htmlClass: 'snap',
  /* app.js 也得带上：联系屏的「点击复制」绑在它里面。
     只挂 scroll.js 的话，首页和单独的联系页都能复制，唯独从导航进去的
     主路径点不动——最难发现的那种坏法。 */
  script: ['app.js', 'scroll.js'],
  path: 'browse.html',
  body: browseBody,
}));

writeFileSync(join(ROOT, 'work.html'), layout({
  title: '作品 — 尤博文的个人主页',
  desc: '尤博文的影像作品：品牌短片、人物短片、MV 与旅拍。',
  current: '作品',
  bodyClass: 'inner',
  path: 'work.html',
  body: workBody(),
}));

/* 每部作品一个独立页面，路径固定 work/<slug>.html */
mkdirSync(join(ROOT, 'work'), { recursive: true });
ALL.forEach((w, i) => {
  writeFileSync(join(ROOT, 'work', `${w.slug}.html`), layout({
    title: `${w.title} — 尤博文的个人主页`,
    desc: w.lead,
    depth: 1,
    minimal: true,
    bodyClass: 'dt-page',
    theme: 'dark',
    path: `work/${w.slug}.html`,
    /* 竖版作品（X100、智云）的 hero / cover 都是 520×845 的竖图，
       分享卡是横的，竖图进去只剩中间一条。rail 那张本来就是给 2:1 片带
       挑的横图，正好拿来当分享图。 */
    ogImage: `${w.rail || w.hero || coverOf(w)}.jpg`,
    body: detailBody(w, i),
  }));
});

writeFileSync(join(ROOT, 'resume.html'), layout({
  title: '简历 — 尤博文的个人主页',
  desc: '尤博文的经历、教育与技能。播音与主持艺术编创方向出身，做视频四年多。',
  current: '简历',
  bodyClass: 'inner',
  path: 'resume.html',
  body: resumeBody,
}));

writeFileSync(join(ROOT, 'tools.html'), layout({
  title: '软件 — 尤博文的个人主页',
  desc: '尤博文开发的视频生产工具：封面点击欲测试、声音克隆与配音工作台、素材管理。',
  current: '软件',
  bodyClass: 'inner',
  path: 'tools.html',
  body: toolsBody,
}));

writeFileSync(join(ROOT, 'contact.html'), layout({
  title: '联系 — 尤博文的个人主页',
  desc: '联系尤博文：品牌短片、人物纪录、赛事拍摄、短视频代运营。',
  current: '联系',
  bodyClass: 'inner',
  path: 'contact.html',
  script: 'copy.js',
  body: contactBody,
}));

writeFileSync(join(ROOT, 'assets', 'favicon.svg'), FAVICON_SVG);

/* ---------- sitemap / robots ----------

   sitemap 跟着构建一起生成，不手写：作品增减时手写的那份必然忘记同步，
   而搜索爬虫拿到 404 的条目会降低整站的抓取频率。

   只列「有独立地址」的页面——browse.html 是四章连播的另一种浏览方式，
   内容与 work/resume/tools/contact 完全重复，列进去等于告诉爬虫
   「同一份内容有两个地址」，反而分散权重，所以排除。

   changefreq / priority 都不写。这两个字段 Google 早在 2023 年就公开说明
   不再参考，写了只是占地方。lastmod 给构建当天，是唯一还有意义的一个。 */
const today = new Date().toISOString().slice(0, 10);
const urls = ['', 'work.html', 'resume.html', 'tools.html', 'contact.html',
  ...ALL.map((w) => `work/${w.slug}.html`)];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url>
    <loc>${SITE}/${u}</loc>
    <lastmod>${today}</lastmod>
  </url>`).join('\n')}
</urlset>
`;
writeFileSync(join(ROOT, 'sitemap.xml'), sitemap);

writeFileSync(join(ROOT, 'robots.txt'), `User-agent: *
Allow: /

Sitemap: ${SITE}/sitemap.xml
`);

console.log('生成完成：index / browse / work / resume / tools / contact + ' +
  ALL.length + ' 个作品页 + sitemap/robots');
