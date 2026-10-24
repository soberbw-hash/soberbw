/* 滚动浏览页：四屏串成一条流之后的交互
   ------------------------------------------------------------------
   做四件事：
   1. 每帧算一次每屏的「进入程度」，写进 --vis，让内容跟着滚动淡入抬起来
   2. 判断当前停在哪一屏，同步右侧进度点和顶栏导航
   3. 点导航 / 点进度点时平滑滚过去，而不是跳页面
   4. 内容比一屏高的屏取消垂直居中，否则顶部会被顶出视口、永远滚不到

   为什么不用 IntersectionObserver：它只给「进入比例」，而且是整屏对整屏算的。
   简历那屏比视口高，比例永远到不了 1，动画会卡在半透明。这里自己按
   getBoundingClientRect 算，逻辑简单、每屏都准。
   ------------------------------------------------------------------ */
(function () {
  var panes = [].slice.call(document.querySelectorAll('.bz-pane'));
  if (!panes.length) return;

  var dots = [].slice.call(document.querySelectorAll('.bz-dots a'));
  var navLinks = [].slice.call(document.querySelectorAll('.topbar nav a'));
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  var cur = -1;
  var ticking = false;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  // 顶栏是 fixed 的，滚到某屏时得让开它的高度
  function padTop() {
    var v = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop);
    return isNaN(v) ? 0 : v;
  }

  function topOf(el) {
    return el.getBoundingClientRect().top + scrollY;
  }

  // 视口中线偏上一点：顶栏压掉一截，用 50% 会让当前屏判断偏下一屏
  function activeIndex() {
    var mid = innerHeight * 0.42;
    for (var i = panes.length - 1; i >= 0; i--) {
      var r = panes[i].getBoundingClientRect();
      if (r.top <= mid && r.bottom > mid) return i;
    }
    return 0;
  }

  function measureTall() {
    // 垂直居中交给 CSS 的 justify-content:safe center 处理了，
    // 这里只兜底：老浏览器不认 safe，遇到内容超一屏的屏手动退化成顶对齐。
    if (CSS.supports('justify-content', 'safe center')) return;
    var vh = innerHeight;
    for (var i = 0; i < panes.length; i++) {
      var inner = panes[i].scrollHeight;
      panes[i].classList.toggle('is-tall', inner > vh * 0.92);
    }
  }

  function paint() {
    ticking = false;
    var vh = innerHeight;
    // 一屏从视口底部升到视口上方 55% 处，就算完全进场
    var span = vh * 0.55;

    for (var i = 0; i < panes.length; i++) {
      var r = panes[i].getBoundingClientRect();
      var vis = clamp((vh - r.top) / span, 0, 1);
      if (reduce) vis = 1;
      panes[i].style.setProperty('--vis', vis.toFixed(3));
    }

    var idx = activeIndex();
    if (idx !== cur) {
      cur = idx;
      for (var d = 0; d < dots.length; d++) {
        dots[d].classList.toggle('on', d === idx);
        if (d === idx) dots[d].setAttribute('aria-current', 'true');
        else dots[d].removeAttribute('aria-current');
      }
      for (var n = 0; n < navLinks.length; n++) {
        // 顶栏导航的顺序和屏的顺序一致：作品 / 简历 / 软件 / 联系
        if (n === idx) navLinks[n].setAttribute('aria-current', 'page');
        else navLinks[n].removeAttribute('aria-current');
      }
    }

    // 顶栏底下那条细线的长度
    var max = document.documentElement.scrollHeight - vh;
    document.documentElement.style.setProperty('--prog', max > 0 ? (scrollY / max).toFixed(4) : '0');
  }

  function onScroll() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(paint);
    }
  }

  function goTo(id, smooth) {
    var el = document.getElementById(id);
    if (!el) return false;
    var y = topOf(el) - padTop();
    // 最后一屏内容不满一屏时，滚到最底可能够不到目标位置，这里夹一下
    var max = document.documentElement.scrollHeight - innerHeight;
    y = clamp(y, 0, max);
    scrollTo({ top: y, behavior: smooth && !reduce ? 'smooth' : 'instant' });
    return true;
  }

  function samePage(href) {
    var a = document.createElement('a');
    a.href = href;
    return a.pathname === location.pathname;
  }

  // 顶栏导航：在本页内就平滑滚，不在本页就正常跳转
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a') : null;
    if (!a) return;
    var href = a.getAttribute('href');
    if (!href) return;

    var i = href.indexOf('#');
    if (i < 0) return;

    // 进度点用的是 #work 这种纯锚点；导航用的是 browse.html#work
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
  addEventListener('resize', function () {
    measureTall();
    onScroll();
  });

  // 打开时如果带着 #resume 之类的锚点，直接落到那一屏，不要先滚一遍
  function boot() {
    measureTall();
    var id = location.hash.replace('#', '');
    if (id && document.getElementById(id)) {
      // 等一帧让字体和图片撑开高度，否则算出来的位置会偏
      requestAnimationFrame(function () {
        goTo(id, false);
        onScroll();
      });
    } else {
      onScroll();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
  addEventListener('load', function () {
    measureTall();
    var id = location.hash.replace('#', '');
    if (id && document.getElementById(id)) goTo(id, false);
    onScroll();
  });
})();
