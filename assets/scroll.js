/* 滚动浏览页：四屏串成一条流之后的交互
   1. 判断当前停在哪一屏，同步右侧进度点和顶栏导航
   2. 点导航 / 点进度点时平滑滚过去
   3. 内容比一屏高的屏取消垂直居中（老浏览器兜底）

   为什么不用 IntersectionObserver：它只给「进入比例」，而且是整屏对整屏算的。
   简历那屏比视口高，比例永远到不了 1，动画会卡在半透明。

   ------------------------------------------------------------------
   关于性能（这一版重写的全部理由）：

   上一版每帧做三件事——对四个 section 各读一次 getBoundingClientRect()、
   读一次 documentElement.scrollHeight、再往四个 section 各写一个 --vis。
   读几何之前刚写过样式，浏览器只能强制同步布局；而 --vis 写在 section 上，
   会作废整棵子树的样式（软件屏 4000 多像素高、几百个节点）。

   实测滚动 120 帧：Layout 122 次、RecalcStyle 158 次、样式重算 0.66s，
   占主线程总耗时（0.94s）的七成。这就是掉帧的来源，不是「动画不够快」。

   现在：
   - 几何只在 measure() 里读一次（load / resize / ResizeObserver）
   - 逐帧只做整数比较，不读 DOM、不写样式
   - 进入动画交给 CSS 的 scroll-driven animation（animation-timeline: view()），
     opacity 和 transform 都是合成器属性，跑在合成线程上，主线程完全不参与
   - 只有浏览器不支持 scroll timeline 时，才退回逐帧写 --vis，并且按 2% 一档量化
   ------------------------------------------------------------------ */
(function () {
  var panes = [].slice.call(document.querySelectorAll('.bz-pane'));
  if (!panes.length) return;

  var dots = [].slice.call(document.querySelectorAll('.bz-dots a'));
  var navLinks = [].slice.call(document.querySelectorAll('.topbar nav a'));
  var bar = document.querySelector('.topbar');
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 浏览器自己能按滚动进度播动画，就不用在 JS 里逐帧写样式
  var NATIVE = !!(window.CSS && CSS.supports && CSS.supports('animation-timeline', 'view()'));

  var tops = [], maxScroll = 0, vh = innerHeight;
  var cur = -1, ticking = false;
  var lastVis = [], lastProg = -1;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  /* 只在这里读几何。scrollY 只用来把「视口坐标」换算成「文档坐标」。 */
  function measure() {
    vh = innerHeight;
    var y = scrollY;
    tops = panes.map(function (p) {
      return Math.round(p.getBoundingClientRect().top + y);
    });
    maxScroll = Math.max(0, document.documentElement.scrollHeight - vh);
    lastVis = panes.map(function () { return -1; });
  }

  /* 视口中线偏上一点：顶栏压掉一截，用 50% 会让当前屏判断偏下一屏。
     纯算术，不碰 DOM。 */
  function activeIndex() {
    var probe = scrollY + vh * 0.42;
    for (var i = tops.length - 1; i >= 0; i--) {
      if (probe >= tops[i]) return i;
    }
    return 0;
  }

  /* 不支持 scroll timeline 时的退路：自己算 --vis。
     量化到 2% 一档——原来每帧都写，一屏要写上百次；现在最多 50 次，
     而 2% 的透明度差肉眼看不出来。 */
  function paintVis() {
    var span = vh * 0.55;
    for (var i = 0; i < panes.length; i++) {
      var vis = clamp((vh - (tops[i] - scrollY)) / span, 0, 1);
      var q = Math.round(vis * 50) / 50;
      if (q === lastVis[i]) continue;
      lastVis[i] = q;
      panes[i].style.setProperty('--vis', q);
    }
  }

  /* 顶栏底下那条金线的长度 = 整页滚动进度。
     写 --prog 而不是直接写 width：width 是布局属性，每帧改一次就要重排一次。
     CSS 里已经换成 transform:scaleX()，写自定义属性只影响这一个元素。 */
  function paintProg() {
    if (!bar) return;
    var p = maxScroll > 0 ? Math.round(scrollY / maxScroll * 500) / 500 : 0;
    if (p === lastProg) return;
    lastProg = p;
    bar.style.setProperty('--prog', p);
  }

  function paint() {
    ticking = false;
    if (!NATIVE) { paintVis(); paintProg(); }

    var idx = activeIndex();
    if (idx === cur) return;
    cur = idx;

    for (var d = 0; d < dots.length; d++) {
      dots[d].classList.toggle('on', d === idx);
      if (d === idx) dots[d].setAttribute('aria-current', 'true');
      else dots[d].removeAttribute('aria-current');
    }
    for (var n = 0; n < navLinks.length; n++) {
      if (n === idx) navLinks[n].setAttribute('aria-current', 'page');
      else navLinks[n].removeAttribute('aria-current');
    }
  }

  function onScroll() {
    if (!ticking) { ticking = true; requestAnimationFrame(paint); }
  }

  function goTo(id, smooth) {
    var el = document.getElementById(id);
    if (!el) return false;
    var i = panes.indexOf(el);
    var y = i >= 0 ? tops[i] : el.getBoundingClientRect().top + scrollY;
    y = clamp(y, 0, maxScroll);
    scrollTo({ top: y, behavior: smooth && !reduce ? 'smooth' : 'instant' });
    return true;
  }

  function samePage(href) {
    var a = document.createElement('a');
    a.href = href;
    return a.pathname === location.pathname;
  }

  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest ? e.target.closest('a') : null;
    if (!a) return;
    var href = a.getAttribute('href');
    if (!href) return;
    var i = href.indexOf('#');
    if (i < 0) return;
    if (href.charAt(0) === '#' || samePage(href)) {
      var id = href.slice(i + 1);
      if (goTo(id, true)) {
        e.preventDefault();
        // 用 replaceState 而不是改 location.hash：改 hash 会触发浏览器
        // 自己的跳转，跟这里的平滑滚动打架
        history.replaceState(null, '', '#' + id);
      }
    }
  });

  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', function () { measure(); onScroll(); });

  function boot() {
    measure();
    // 返回场景别先跳到锚点再被拉回来，那会在过渡里闪一下
    if (!isNaN(savedY())) { onScroll(); return; }
    var id = location.hash.replace('#', '');
    if (id && document.getElementById(id)) {
      requestAnimationFrame(function () { goTo(id, false); measure(); onScroll(); });
    } else { onScroll(); }
  }

  /* ---------- 返回时回到原来读到的位置 ----------
     作品卡在竖屏商业那一段，点进详情、再按返回，URL 上的 #work 会把人拽回
     第一屏——读了半天的位置没了。跨文档导航里浏览器自己不保证恢复，
     所以这里自己记一笔。

     只认 back_forward：从导航点进来的（type 是 navigate）不该被上一次的位置
     劫持，那种情况交给 #锚点。 */
  var KEY = 'bz:scroll';
  function savedY() {
    var nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
    if (!nav || nav.type !== 'back_forward') return NaN;
    try { return parseFloat(sessionStorage.getItem(KEY)); } catch (e) { return NaN; }
  }
  function restoreY() {
    var y = savedY();
    if (isNaN(y)) return false;
    var max = document.documentElement.scrollHeight - innerHeight;
    scrollTo({ top: clamp(y, 0, max), behavior: 'instant' });
    return true;
  }

  // pagehide 在离开页面时一定会触发，比 beforeunload 可靠（后者在移动端常被跳过）
  addEventListener('pagehide', function () {
    try { sessionStorage.setItem(KEY, String(Math.round(scrollY))); } catch (e) {}
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }

  // 图片解码完高度会变，锚点位置跟着变——重新量一次，别用旧的偏移量算
  addEventListener('load', function () {
    measure();
    // 返回场景优先于锚点：先按记录的位置放好，没有再走 #hash
    if (restoreY()) { measure(); onScroll(); return; }
    var id = location.hash.replace('#', '');
    if (id && document.getElementById(id)) goTo(id, false);
    onScroll();
  });

  /* 视图过渡在 pagereveal 时就已经把新页面拍成快照了，那一刻滚动位置还没恢复，
     快照就会是屏顶——淡入淡出看着像「跳了一下」。所以这里抢在它前面。 */
  addEventListener('pagereveal', function () {
    if (restoreY()) { measure(); onScroll(); }
  });

  /* 图片懒加载、字体替换都可能在中途改变某屏高度。
     与其监听一堆 load 事件，不如直接盯四屏的盒子尺寸——它变了就重量。
     （ResizeObserver 只在真正变化时回调，比每帧读一次便宜得多。） */
  if (window.ResizeObserver) {
    var ro = new ResizeObserver(function () {
      measure();
      onScroll();
    });
    panes.forEach(function (p) { ro.observe(p); });
  }
})();
