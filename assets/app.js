/* 首页交互
   1. 云海：canvas 程序化绘制，缓慢漂移，跟随鼠标产生分层视差
   2. 标题组：随鼠标反向微移，做出景深
   3. 卡片带：竖着一列 2:1 画面匀速上移，可拖拽，鼠标悬停暂停；
      常态缩成一条安静的带子，中间最小、两端带斜度（像被弯起来的一列），
      光标压住的那张才弹回满幅

   写成普通脚本（不是 module），这样 file:// 直接打开也能跑。 */
(function () {
  'use strict';

  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var mobile = matchMedia('(max-width: 760px)').matches;
  var rand = function (a, b) { return a + Math.random() * (b - a); };

  /* ---------------- 云海 ---------------- */
  function makePuff(w, h) {
    // 云不是圆的，也不是一团雾。做法：画一堆实心椭圆，再整体模糊一次。
    // 这样既有明确的体块，边缘又是柔的——纯径向渐变只会得到烟雾。
    function draw(rgb, peak, yBias, rx, ry) {
      var c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      var x = c.getContext('2d');
      x.filter = 'blur(' + Math.round(h * 0.045) + 'px)';
      var n = 16 + Math.floor(Math.random() * 8);
      for (var i = 0; i < n; i++) {
        // 椭圆必须待在画布安全区里，碰到边缘会被裁成直线，露出方块
        var px = w * 0.5 + (Math.random() - 0.5) * w * 0.44;
        var py = h * yBias + (Math.random() - 0.5) * h * 0.24;
        var r = h * (0.08 + Math.random() * 0.11);
        x.fillStyle = 'rgba(' + rgb + ',' + (peak * (0.55 + Math.random() * 0.45)).toFixed(3) + ')';
        x.beginPath();
        x.ellipse(px, py, r * rx, r * ry, 0, 0, Math.PI * 2);
        x.fill();
      }
      x.filter = 'none';
      return c;
    }
    return {
      lit: draw('246,238,226', 0.5, 0.44, 2.2, 0.76),
      shade: draw('74,86,100', 0.26, 0.64, 2.4, 0.9)
    };
  }

  function mountClouds(canvas) {
    var ctx = canvas.getContext('2d');
    var W = 0, H = 0, dpr = 1, puffs = [], layers = [];
    var target = { mx: 0, my: 0 }, now = { mx: 0, my: 0 };

    function build() {
      // 云本身就是一团糊的东西，dpr 给到 2 是纯浪费：整块画布要按 2880×1800 填，
      // 每帧二十多张大图的 alpha 混合，全在和滚动/片带抢同一块 GPU。1.5 看不出来。
      dpr = Math.min(devicePixelRatio || 1, mobile ? 1.25 : 1.5);
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      var count = mobile ? 6 : 9;
      puffs = [];
      for (var i = 0; i < count; i++) puffs.push(makePuff(660, 330));

      var spec = mobile
        ? [
            { y: 0.66, n: 3, s: 0.8, sp: 3, a: 0.3, depth: 0.6 },
            { y: 0.78, n: 3, s: 1.15, sp: 6.5, a: 0.34, depth: 1.1 },
            { y: 0.9, n: 2, s: 1.6, sp: 11, a: 0.28, depth: 1.7 }
          ]
        : [
            { y: 0.6, n: 6, s: 0.92, sp: 2.4, a: 0.26, depth: 0.4 },
            { y: 0.7, n: 6, s: 1.32, sp: 5, a: 0.32, depth: 0.9 },
            { y: 0.8, n: 5, s: 1.85, sp: 8.5, a: 0.3, depth: 1.5 },
            { y: 0.9, n: 4, s: 2.5, sp: 13, a: 0.24, depth: 2.1 }
          ];

      layers = spec.map(function (L) {
        var items = [];
        for (var j = 0; j < L.n; j++) {
          items.push({
            puff: puffs[j % puffs.length],
            x: rand(-0.15, 1.15) * W,
            y: (L.y + rand(-0.07, 0.07)) * H,
            s: L.s * rand(0.78, 1.24),
            a: L.a * rand(0.82, 1.12),
            v: L.sp * rand(0.85, 1.18)
          });
        }
        return { depth: L.depth, items: items };
      });
    }

    var last = performance.now();
    function frame(t, once) {
      /* 云层出图节奏：跟着屏幕刷新率走，封顶 60fps（16ms）。

         原来这里写的是 30ms（30fps），理由是「云漂移 2–13px/s，每帧只挪
         0.07–0.43px，30fps 和 60fps 观感一样，成本差一倍」。前半句没错，
         但后半句当时没量——实测下来把这一层从 30fps 提到 60fps，
         主线程占用 0.133 → 0.127 s/s，在噪声范围内（canvas2d 的画图命令
         走的是光栅线程，不占主线程）。既然不要钱，就没有理由只给 30。

         封顶 60 而不是不封顶：120Hz / 144Hz 屏上再往上加，云一帧只挪
         0.1–0.2px，纯属白烧，而且和片带抢光栅带宽。 */
      if (!once && t - last < 16) { requestAnimationFrame(frame); return; }
      var dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      // 视差跟随按秒收敛，不按帧数——写成「每帧 0.06」的话，帧率一变跟随速度就变
      var k = Math.min(1, dt * 3.6);
      now.mx += (target.mx - now.mx) * k;
      now.my += (target.my - now.my) * k;
      ctx.clearRect(0, 0, W, H);

      for (var i = 0; i < layers.length; i++) {
        var L = layers[i];
        for (var j = 0; j < L.items.length; j++) {
          var it = L.items[j];
          if (!reduce) {
            it.x += it.v * dt;
            var half = (it.puff.width * it.s) / 2;
            if (it.x - half > W) it.x = -half;
          }
          var dx = now.mx * 26 * L.depth;
          var dy = now.my * 14 * L.depth;
          var w = it.puff.lit.width * it.s;
          var h = it.puff.lit.height * it.s;
          var px = it.x + dx - w / 2;
          var py = it.y + dy - h / 2;
          // 先铺暗底，云才有体积，不然只是一团雾
          ctx.globalAlpha = Math.max(0, Math.min(1, it.a * 1.05));
          ctx.drawImage(it.puff.shade, px, py + h * 0.1, w, h);
          ctx.globalAlpha = Math.max(0, Math.min(1, it.a));
          ctx.drawImage(it.puff.lit, px, py, w, h);
        }
      }
      ctx.globalAlpha = 1;
      if (!once) requestAnimationFrame(frame);
    }

    build();
    if (reduce) {
      // 减少动态：云不漂也不跟鼠标，画一帧定住就够，别再排队占帧
      frame(performance.now(), true);
    } else {
      requestAnimationFrame(frame);
    }

    addEventListener('resize', build);
    addEventListener('pointermove', function (e) {
      if (reduce) return;
      var r = canvas.getBoundingClientRect();
      target.mx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      target.my = ((e.clientY - r.top) / r.height - 0.5) * 2;
    }, { passive: true });
    addEventListener('pointerleave', function () {
      target.mx = 0; target.my = 0;
    });
  }

  /* ---------------- 标题视差 ---------------- */
  function mountTilt() {
    var els = [].slice.call(document.querySelectorAll('[data-tilt]'));
    if (!els.length) return;

    // 入场动画结束后交还 transform 控制权，否则 animation 会一直压着内联样式
    els.forEach(function (el) {
      el.addEventListener('animationend', function () {
        el.style.animation = 'none';
      }, { once: true });
    });
    if (reduce) return;

    var mx = 0, my = 0, tx = 0, ty = 0, raf = 0;
    addEventListener('pointermove', function (e) {
      mx = (e.clientX / innerWidth - 0.5) * 2;
      my = (e.clientY / innerHeight - 0.5) * 2;
      if (!raf) raf = requestAnimationFrame(loop);
    }, { passive: true });
    addEventListener('pointerleave', function () {
      mx = 0; my = 0;
      if (!raf) raf = requestAnimationFrame(loop);
    });

    /* 收敛之后就停。
       原来这个循环是常开的：鼠标不动的时候，它每秒 60 次算出完全一样的
       transform 再写回去，每次都触发一次样式重算——纯空转。
       现在一是只在值真变了才写，二是追上了就不再排队，等下一次 pointermove 再醒。 */
    function loop() {
      tx += (mx - tx) * 0.07;
      ty += (my - ty) * 0.07;
      for (var i = 0; i < els.length; i++) {
        var k = parseFloat(els[i].getAttribute('data-tilt')) || 0;
        var tf = 'translate3d(' + (tx * k).toFixed(2) + 'px,' + (ty * k).toFixed(2) + 'px,0)';
        if (els[i].__tf !== tf) { els[i].style.transform = tf; els[i].__tf = tf; }
      }
      raf = (Math.abs(mx - tx) > 0.0006 || Math.abs(my - ty) > 0.0006)
        ? requestAnimationFrame(loop) : 0;
    }
  }

  /* ---------------- 右侧片带：一列 2:1 画面匀速上移 ----------------
     卡高 = 卡宽 / 2，跟原片比例一致，不裁。卡宽在下面 measure() 里按带子宽高
     各算一个上限，再乘 QUIET 缩一档——常态要小，小到不跟左边那行巨型名字抢眼。
     一组 9 张的总高已经超过任何屏幕高度，不需要复制克隆；
     万一是超长屏，下面会按需再补一组。 */
  function mountRail() {
    var rail = document.querySelector('.sc-rail');
    var track = document.getElementById('rail');
    if (!rail || !track) return;

    var originals = [].slice.call(track.children);
    if (!originals.length) return;

    var W = 0, H = 0, cardW = 0, cardH = 0, pitch = 0, setH = 0, padL = 0, leftBase = 0;
    var cards = [];
    /* 轴向：桌面是「右侧一列竖着走的胶片」，手机是「底部一条横着走的胶片」。
       手机为什么要换轴：底部横带里竖着拖，既不像翻片带（手指该往左右划），
       又会把页面滚动抢走——短屏（360×640）上首页本来会多出几十像素的滚动，
       手指按在带子上就再也滚不动了。换轴之后 touch-action 可以放成 pan-y，
       竖划滚页面、横划翻片带，两个手势不打架。 */
    var horiz = false;

    /* ---------- 四个可调的量 ----------

       QUIET：常态把整条带子缩到多小。
       这是「安静」的那个数——卡片平时只是背景里的一条胶片，不该跟左边那行
       巨型名字抢注意力。0.80 是试出来的：再小（0.74）片名就糊成一条灰线，
       认不出是哪部；再大（0.88）跟改之前没区别，用户要的「尽可能小」没做到。

       单栏（≤900，片带铺满整屏宽）时只缩到 0.92：那一档片带是页面上唯一的
       图像，没有「抢名字」的问题；而且手机上根本没有悬停，缩了就再也长不回来。

       TAPER：中间那张比两端小多少（占卡高的比例）。
       用户要的是「越靠近中间越小」，所以中间是那个最远的点，往两端长回来。
       0.20 是看得见但不夸张的量：两端比中间大 25%，配合倾角才读得出是一条弧，
       而不是一条直带子。再大就成了「两头巨大、中间一颗豆」。

       TILT：两端最大倾角（度）。上限卡在 8°——2:1 的卡转 8° 之后，四个角
       探出约 11px，再大就会被 .sc-rail 的 overflow:hidden 切掉一块。

       HOVER：悬停那张放大到多少。取 1/QUIET 是有意的：卡片被「抽出来」之后
       正好回到满幅（再乘 SHRINK）。原来满幅 = rail 内宽，严丝合缝；收了
       10% 之后留出一条余量，放大时更不容易碰到左右边缘。 */
    var QUIET = 0.80, HOVER = 1 / QUIET;
    var PITCH = 0.94;    // 相邻两张卡的位移 / 卡高
    var TAPER = 0.20;
    var TILT = 6.5;
    /* 整体尺寸系数。2026-10-26：用户觉得卡片偏大，整条带子等比收 10%。
       乘在 cardW 上，cardH / pitch / setH 全都跟着变——相邻两张的间距、
       悬停放大的幅度，这些相对关系一点不改，只是整条小一号。
       只缩卡片不缩间距会让「一列胶片」散成「一排互不相干的卡」，
       那改的是另一件事。 */
    var SHRINK = 0.9;

    function measure() {
      // .sc-track 是 inset:0 铺满整个 padding box 的，左右内边距不会自己生效，
      // 得在这里减掉再算可用宽度——否则窄屏上是「左贴边、右留 20」的偏一边。
      var cs = getComputedStyle(rail);
      padL = parseFloat(cs.paddingLeft) || 0;
      var padR = parseFloat(cs.paddingRight) || 0;
      W = rail.clientWidth - padL - padR;
      H = rail.clientHeight;
      // 单栏档位（片带铺满整屏、压在正文下面）少缩一点、少弯一点：
      // 那里片带是页面上唯一的图像，没有「抢名字」的问题；而且手机上根本没有
      // 悬停，缩了就再也长不回来。0.94 只当是「比原来收一口气」。
      // 放在 measure 里而不是模块顶上：窗口从 1024 拖到 834 要跟着变。
      var oneCol = matchMedia('(max-width: 900px)').matches;
      horiz = oneCol;
      QUIET = oneCol ? 0.92 : 0.80;
      TAPER = oneCol ? 0.12 : 0.20;
      HOVER = 1 / QUIET;
      if (horiz) {
        /* 横向：卡宽先按「一屏露出一张半」定（0.74 屏宽），
           再用带子高度兜一个上限（2:1 的卡，高不超过带子的 86%）——
           两条约束谁更紧听谁的。窄高屏（360×640）是高度先撞线，
           宽屏手机是宽度先撞线，两种都不会把卡撑出带子。 */
        cardW = Math.min(W * 0.74, H * 1.72) * QUIET * SHRINK;
        cardH = cardW / 2;
        // 位移按卡宽算，不按卡高：横向的间距是左右留的
        pitch = cardW * PITCH;
      } else {
        // 卡宽上限还要受带子高度约束：手机端片带横跨整屏，卡宽等于带宽时 2:1 的卡
        // 会比带子还高，只能露出中间一条。按「一屏看得见两张多一点」定，
        // 片带才像一条还在走的胶片，而不是一张巨大的图。
        // 再乘 QUIET：缩的是「格子」本身，不是缩放——格子小了，间距跟着小，
        // 一屏能看见的卡就多，整条带子自然变轻；字号也还是 12.5px，不会被拉糊。
        cardW = Math.min(W, H * 0.95) * QUIET * SHRINK;
        cardH = cardW / 2;
        // 位移不是卡高 ×（1+间距），而是卡高 × 0.94：卡片缩了，间距要是还按卡高
        // 算，中间那张（最小的）底下就会空出一大块，看上去像断了。0.94 让中间
        // 留 14% 的空、两端刚好挨上——一头松一头紧，才是一条被弯起来的带子。
        pitch = cardH * PITCH;
      }
      leftBase = padL + (W - cardW) / 2;
      // 一整组的长度也要跟着重算：拖窄窗口之后 pitch 变了，setH 还留着旧值的话，
      // 折回的那一圈和卡的实际间距对不上，滚动时会突然空出一段。
      setH = pitch * cards.length;
      sizeCards();
    }

    /* 宽高只在尺寸真的变了的时候写一次。
       这几张卡的 width/height 在整个生命周期里是常量，但上一版把它们放在逐帧循环里写，
       等于每帧让浏览器给每张卡重排一次。位置改由 transform 的 translate 承担之后，
       逐帧就只剩一个合成器属性了。 */
    function sizeCards() {
      var w = cardW.toFixed(1) + 'px', h = cardH.toFixed(1) + 'px';
      for (var i = 0; i < cards.length; i++) {
        var s = cards[i].style;
        s.width = w; s.height = h;
        s.left = '0px'; s.top = '0px';
        // 尺寸一变，pitch / setH 也跟着变，量化缓存必须作废，否则下一帧
        // 会拿着旧格子判断「没动」，卡片停在原地不重排
        cards[i].__tq = undefined;
      }
    }

    measure();

    // 一组铺不满一屏时补一组（正常屏幕用不到，超长屏兜底）
    // 比的是「这一组够不够长」：竖着看带子高度，横着看带子宽度。
    if (pitch * originals.length < (horiz ? W + cardW * 2 : H + cardH * 2)) {
      [].slice.call(track.children).forEach(function (c) {
        var cp = c.cloneNode(true);
        cp.setAttribute('aria-hidden', 'true');
        cp.setAttribute('tabindex', '-1');
        track.appendChild(cp);
      });
    }
    var cards = [].slice.call(track.children);
    // 再量一次：第一次量的时候 cards 还是空的，setH 算不出来
    measure();

    // 光标压住的那张放大一点。倍率写在脚本里，因为 transform 每帧都要重写，
    // 写在 CSS 的 :hover 里会被行内样式盖掉。
    var hoverEl = null;
    cards.forEach(function (c) {
      c.addEventListener('mouseenter', function () { hoverEl = c; });
      c.addEventListener('mouseleave', function () { if (hoverEl === c) hoverEl = null; });
    });

    /* 拦住浏览器原生拖放。
       每张卡都是 <a><img>，按住一拖，浏览器会把它当成「拖拽这个链接 / 图片」，
       拖放一开始就发一个 pointercancel，把我们的拖拽序列当场掐断——
       表现是：按住卡片只跟手第一下，之后变成惯性乱飞，而且卡片会被拖出个影子。
       桌面和手机都中招（手机上是长按触发）。dragstart 上 preventDefault
       是唯一能彻底拦住原生拖放的地方，CSS 的 -webkit-user-drag 只覆盖一部分。 */
    track.addEventListener('dragstart', function (e) { e.preventDefault(); });

    var offset = 0, vel = 0;
    /* 惯性用「冲量 + 摩擦」算，不用「朝目标缓动」。

       朝目标缓动（每帧 offset += (target-offset)*k）也能丝滑，但它永远不会滑过头：
       手一停，它就照着剩下的距离收敛，尾巴很短，看着像「很快地停住」。
       用户要的是「刹不住车」——手停了，带子还得再走一段。那就只能积速度，不能只存位置。

       摩擦写成「每秒衰减到 X」而不是「每帧乘 0.9」：每帧乘系数的话，144Hz 屏上的
       衰减速度是 60Hz 的两倍多，同一次滚轮在高刷屏上一闪就没了，手感跟设备有关。
       按秒算，谁跑都一个样。

       为什么滚轮和拖拽用两套摩擦：拖拽是「扔出去」，一次用力甩本来就该滑很远，
       衰减到 5%/秒（总滑行 ≈ 初速/3）；滚轮是「推一下」，一格一格地推，
       衰减到 0.4%/秒（总滑行 ≈ 初速/5.5），滑得干脆、收得干净。 */
    var FRIC_DRAG = 0.05, FRIC_WHEEL = 0.004;
    var fric = FRIC_DRAG;
    /* 冲量系数：一格滚轮（Chrome 下 deltaY=100）给 1100px/s 的初速，
       滑行约 200px——一张卡多一点。手感是「一格一格翻」，但每一格都是滑过去的。
       因为冲量和摩擦都跟 deltaY 成正比，滚轮和触控板的总滑行都是
       「滚动总量 × 2」，两种设备不会一个快一个慢。 */
    var IMPULSE = 11;
    /* 上限：连续快滚时冲量会一路累加，不封顶能飙到几万 px/s，
       整条带子糊成一片、卡片来不及看清就飞过去了。5200 大约 5 张卡的滑行量。 */
    var VMAX = 5200;
    var dragging = false, lastP = 0, lastT = 0, moved = 0, paused = false;
    var speed = reduce ? 0 : (mobile ? 11 : 18);
    // 拖拽跟着哪个轴走：横向带子看 X，竖向看 Y。每次按下时取一次，
    // 拖到一半窗口跨过断点也不会突然换轴。
    var axisX = false;

    track.addEventListener('pointerenter', function () { paused = true; });
    track.addEventListener('pointerleave', function () { paused = false; });

    track.addEventListener('pointerdown', function (e) {
      dragging = true; moved = 0; vel = 0;
      axisX = horiz;
      lastP = axisX ? e.clientX : e.clientY;
      lastT = performance.now();
      track.classList.add('dragging');
      track.setPointerCapture(e.pointerId);
    });
    track.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var now = performance.now();
      var dt = Math.max(8, now - lastT) / 1000;
      var p = axisX ? e.clientX : e.clientY;
      var dy = p - lastP;
      lastP = p; lastT = now;
      moved += dy;
      offset += dy;                 // 跟手 1:1
      vel = dy / dt;
      fric = FRIC_DRAG;             // 松手之后按「扔出去」那套衰减
    });
    function endDrag() {
      if (!dragging) return;
      dragging = false;
      track.classList.remove('dragging');
      // 拖完几乎没动，就当点击处理，别把链接拦掉
      if (Math.abs(moved) > 6) {
        track.addEventListener('click', function (ev) { ev.preventDefault(); }, { once: true });
      }
    }
    track.addEventListener('pointerup', endDrag);
    track.addEventListener('pointercancel', endDrag);

    /* 滚轮：光标停在带子上时，滚轮直接滚这条带子。
       首页正好一屏、页面本身没有滚动条，所以这里吃掉默认行为不会有副作用。
       deltaMode 必须分开算：0 是像素、1 是「行」、2 是「页」。不换算的话，
       鼠标滚轮（Chrome 下 deltaY=100）和触控板（deltaY 只有 3 上下）差几十倍，
       同一个动作在两种设备上快慢完全不同。

       这里给的是冲量不是位移——见上面 IMPULSE 那段。原来写的是 `offset -= dy`：
       一格滚轮带子瞬移 100px，中间一帧过渡都没有，观感就是「直上直下」。
       现在滚轮只负责「推一把」，位置全交给循环里的积分和摩擦，
       于是每一下都是加速—滑行—收住。 */
    track.addEventListener('wheel', function (e) {
      // 横向带子上，触控板的横向滚动优先；只有纵向滚轮（鼠标）时退而用 deltaY，
      // 否则窄窗口下用鼠标的人会发现滚轮对这条带子完全没反应。
      var dy = horiz ? (e.deltaX || e.deltaY) : e.deltaY;
      if (e.deltaMode === 1) dy *= 16;        // 行 → 约一行的高度
      else if (e.deltaMode === 2) dy *= horiz ? W : H;    // 页 → 整屏
      if (reduce) {
        // 开了「减少动态」就老老实实一步到位，别给惯性——晕动症的人受不了。
        offset -= dy;
      } else {
        vel -= dy * IMPULSE;                  // 往下滚 = 内容往上走
        if (vel > VMAX) vel = VMAX;
        else if (vel < -VMAX) vel = -VMAX;
        fric = FRIC_WHEEL;
      }
      paused = true;
      e.preventDefault();
    }, { passive: false });

    addEventListener('resize', measure);

    /* ---------- 帧预算：这一屏的「卡」几乎全在这几个 transform 上 ----------

       实测（无头 Chrome，1440×900，首页静止，Performance.getMetrics 取 3s 增量）：

         · 带子在走              主线程占用 0.56 s/s，其中样式重算 0.48 s/s
         · 指针停在带子上（paused，一帧都不写）   0.05 s/s，样式重算 0.00

       也就是说：**只要不写 transform，这一屏就几乎没有开销**；写了，就吃掉
       一半以上的主线程。所以省的不是「算得够不够快」，是「到底写不写」。

       两条省钱的办法，都不改观感：

       1. 高刷屏封顶 60fps。rAF 跟着屏幕刷新率跑，144Hz 屏上这一段的开销是
          60Hz 的 2.4 倍——而带子一帧只挪 0.3px，多出来的帧纯属白烧。
          隔不到 14ms 就不干活，60Hz 屏完全不受影响。

       2. 位置按 0.5px 量化，没跨过半像素就不写。
          常态漂移 18px/s、一帧 0.3px，量化之后大约每两帧才真写一次。
          0.5px 在这个尺寸上是亚像素，看不出来；快滚（>240px/s）自动回到
          0.1px 精度，免得快速移动时出现台阶。

       注意跳过帧的时候不能更新 last——dt 要跨过被跳掉的时间，
       否则 60Hz 屏上积分会少掉一半。 */
    var last = performance.now(), lastDraw = 0;
    (function loop(t) {
      if (t - lastDraw < 14) { requestAnimationFrame(loop); return; }
      lastDraw = t;
      var dt = Math.min((t - last) / 1000, 0.05);
      last = t;

      if (!dragging && Math.abs(vel) > 2) {
        offset += vel * dt;
        vel *= Math.pow(fric, dt);       // 按秒衰减：拖拽到 5%，滚轮到 0.4%
      } else if (!dragging && !paused && !reduce) {
        vel = 0;
        offset -= speed * dt;            // 常态缓慢上移
      }

      if (setH > 0) {
        while (offset <= -setH) offset += setH;
        while (offset > 0) offset -= setH;
      }

      /* 带子的中线和「卡正好居中时的位置」。
         竖着走：中线在 H/2，卡只沿 Y 移动；
         横着走：中线在 W/2，卡只沿 X 移动。
         两个轴共用同一套 taper / 倾角 / 折回逻辑，只是把 tt 加到哪个坐标上。 */
      var half = horiz ? W / 2 : H / 2;
      var reach = half + (horiz ? cardW : cardH) / 2;
      var baseX = leftBase;
      var baseY = (H - cardH) / 2;

      /* 位置量化精度：慢的时候 0.5px，快的时候 0.1px。
         为什么按速度切换：常态漂移 18px/s，一帧 0.3px，0.5px 一格意味着大约
         每两帧才写一次；而滚轮甩到 2000px/s 时一帧就是 33px，0.5px 的量化
         会让卡片出现台阶，这时候必须回到 0.1px。 */
      var step = (dragging || Math.abs(vel) > 240) ? 10 : 2;

      for (var i = 0; i < cards.length; i++) {
        var el = cards[i];
        var tt = (i * pitch + offset) - half + (horiz ? cardW : cardH) / 2;   // 卡片中心相对带子中线
        // 折回 [-setH/2, setH/2)，保证首尾接得上
        if (setH > 0) tt = ((tt + setH / 2) % setH + setH) % setH - setH / 2;

        /* 抽牌：光标压住的那张抬起来、微微转一点。
           这里用一个小弹簧自己算进度（hp 位置 / hv 速度），而不是交给 CSS 的
           transition——transform 是逐帧写的，挂 transition 等于每帧重新起一次
           动画，卡片永远追不上目标值，整条带子会显得发软。
           ζ≈0.65，收尾时回弹一下，跟原来 .58s 那条曲线的观感一致。 */
        var target = el === hoverEl ? 1 : 0;
        var hp = el.__hp || 0, hv = el.__hv || 0;
        if (hp || hv || target) {
          hv += (target - hp) * 190 * dt - hv * 18 * dt;
          hp += hv * dt;
          if (!target && hp < 0.001 && Math.abs(hv) < 0.01) { hp = 0; hv = 0; }
          el.__hp = hp; el.__hv = hv;
        }

        var ad = Math.abs(tt) / reach;
        // 视口外就整张停写
        if (ad > 1.2) {
          if (el.__vis !== false) { el.style.visibility = 'hidden'; el.__vis = false; }
          continue;
        }
        if (el.__vis !== true) { el.style.visibility = 'visible'; el.__vis = true; }

        /* 位置没跨过量化格就整张跳过——连 dv / scale / rotate 都不算。
           弹簧还在动的时候（hp 或 hv 非 0）必须每帧写，否则抽牌会一顿一顿。 */
        var tq = Math.round(tt * step) / step;
        if (!hp && !hv && tq === el.__tq) continue;
        el.__tq = tq;
        // 后面算 dv / s / rot 都用量化后的值，写出来的字符串才稳定、才能被比对掉
        tt = tq;

        /* ---------- 曲线 ----------
           dv = 这张卡离带子中线多远，以半屏为 1。

           为什么不用上面那个 ad（除以 reach）当分母：reach 是半屏再加一张卡，
           屏幕上真正看得见的那一段只用到它的 0.8，缩放差会被削掉五分之一。
           拿半屏做分母，顶端那张正好是 1，TAPER 就是屏幕上真实看到的差距。

           为什么是线性而不是 d²：幂函数会让中间一大段几乎一样大，看上去是
           「一列同样大小的卡，只有最上面那张突然变大」；线性才是从中间往两头
           均匀地长，像一条被弯起来的带子。 */
        var dv = Math.abs(tt) / half;
        if (dv > 1) dv = 1;

        // 中间最小、两端长回来。
        // 注意是 (1 - dv) 不是 dv：用户要的是「越靠近中间越小」，中间是那个
        // 最远的点，两端朝观看者弯过来。写成 dv 就成了普通的 coverflow
        // （中间最大），方向正好反了。
        var s = 1 - TAPER * (1 - dv);
        // 抽出来的那张弹回满幅
        s = s * (1 - hp) + HOVER * hp;

        // 倾角：中线以上逆时针、以下顺时针，像从中间那一点散开的一把牌。
        // 抽出来的时候摆正——而且是彻底摆正，不留那点「抽牌自己的斜」：
        // 光标压住的那张要的是「看清」，一点点歪都会让字幕跟着斜，
        // 放大反而看不出内容。
        var rot = (tt < 0 ? -1 : 1) * TILT * dv * (1 - hp);

        /* 每帧只写 transform 一个属性。
           原来这里还写 left / top / width / height —— 那四个都是布局属性，
           一张卡一次就够浏览器重排一遍，一屏七八张就是七八次。
           现在位置改由 translate3d 承担，宽高在 measure() 里一次写好，
           逐帧只剩一个合成器属性，不触发布局也不触发绘制。

           另外比一下字符串：鼠标停在带子上、或者开了「减少动态」时，offset 不动，
           每帧算出来的 transform 是一模一样的。写同样的值浏览器照样要重算样式，
           所以只在真的变了的时候写。 */
        var tf = horiz
          ? 'translate3d(' + (baseX + tt).toFixed(1) + 'px,' +
            (baseY - 22 * hp).toFixed(1) + 'px,0)' +
            ' rotate(' + rot.toFixed(3) + 'deg)' +
            ' scale(' + s.toFixed(4) + ')'
          : 'translate3d(' + baseX.toFixed(1) + 'px,' +
            (baseY + tt - 30 * hp).toFixed(1) + 'px,0)' +
            ' rotate(' + rot.toFixed(3) + 'deg)' +
            ' scale(' + s.toFixed(4) + ')';
        if (el.__tf !== tf) { el.style.transform = tf; el.__tf = tf; }

        /* 字幕不再单独淡出，交给 .sc-rail 的 mask。
           原来这里按「离中线多远」给每张卡的 .cap 写一个 0–1 的透明度，
           本意是「只有中间那张算当前这张」。现在卡片是一张一张分开的，
           没有「当前」这回事；而且字幕贴在卡片底部，卡片中心到了 0.87 屏高时
           字幕其实还在遮罩全黑的那一段里，按中心算透明度会把它一起抹掉——
           上面那张片的片名就这么没了。mask 是按像素位置淡的，本来就跟字幕对齐。 */
      }

      /* 首帧画完才摘掉 CSS 那条「无脚本降级」。
         顺序不能反：卡片的宽高和第一帧 transform 都在这一帧里写好，同一任务内
         浏览器不会画中间态，所以切过去看不到任何跳动；反过来先摘降级、再等下一帧
         写 transform，卡片会先齐刷刷堆到左上角闪一下。
         2026-10-26：用户打开线上站，右侧片带整个没了——app.js 没跑起来，
         9 张卡的行内宽高全是空，CSS 里又没有兜底尺寸，于是只剩一片背景。 */
      if (!rail.__ready) { rail.__ready = 1; rail.setAttribute('data-rail', 'on'); }

      requestAnimationFrame(loop);
    })(performance.now());
  }

  /* ---------------- 背景短片 ---------------- */
  function mountFilm() {
    var film = document.getElementById('film');
    if (!film) return;
    // 有些浏览器不认 HTML 上的 muted，得在 JS 里再压一次，否则自动播放会被拦
    film.muted = true;
    film.defaultMuted = true;
    if (reduce) {
      // 关掉动效偏好就别让它转。直接把片源摘掉，只留 poster 那张静态帧，
      // 比 pause + seek 可靠（某些浏览器在暂停态下不让改 currentTime）
      film.removeAttribute('autoplay');
      film.pause();
      [].slice.call(film.querySelectorAll('source')).forEach(function (s) { s.remove(); });
      film.removeAttribute('src');
      film.load();
      return;
    }
    // 标签页切到后台就停，别白烧电
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) film.pause();
      else film.play().catch(function () {});
    });
    var p = film.play();
    if (p && p.catch) p.catch(function () {});
  }

  /* ---------------- 标题悬停柔光 ----------------
     上层渐变字用径向遮罩只在光标周围露出来。遮罩位置在 rAF 里做指数平滑，
     所以光斑是「拖」着光标走，不是死贴着——这点延迟让它像玻璃上的反光。 */
  function mountTitleGlow() {
    var h1 = document.querySelector('.sc-title');
    var lit = h1 && h1.querySelector('.sc-t-lit');
    if (!lit) return;

    var tx = 0, ty = 0, cx = 0, cy = 0, raf = 0, active = false;
    var lastX = '', lastY = '';

    function frame() {
      cx += (tx - cx) * 0.2;
      cy += (ty - cy) * 0.2;
      // 光标停住之后这两个值会收敛到同一串字符，就别再写了——
      // 写 --sc-mx 会让这个元素的遮罩重算一次，鼠标悬着不动也在烧
      var sx = cx.toFixed(1) + 'px', sy = cy.toFixed(1) + 'px';
      if (sx !== lastX) { lit.style.setProperty('--sc-mx', sx); lastX = sx; }
      if (sy !== lastY) { lit.style.setProperty('--sc-my', sy); lastY = sy; }
      if (active || Math.abs(tx - cx) > 0.4 || Math.abs(ty - cy) > 0.4) {
        raf = requestAnimationFrame(frame);
      } else {
        raf = 0;
      }
    }

    function setR() {
      var w = h1.getBoundingClientRect().width;
      lit.style.setProperty('--sc-r', Math.round(Math.max(w * 0.40, 120)) + 'px');
    }

    function toLocal(e) {
      var r = h1.getBoundingClientRect();
      tx = e.clientX - r.left;
      ty = e.clientY - r.top;
    }

    h1.addEventListener('pointerenter', function (e) {
      if (e.pointerType === 'touch') return;
      toLocal(e);
      cx = tx; cy = ty;              // 第一次进场别从左上角飞过来
      active = true;
      setR();
      h1.classList.add('is-lit');
      if (!raf) raf = requestAnimationFrame(frame);
    });
    h1.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      toLocal(e);
    });
    h1.addEventListener('pointerleave', function () {
      active = false;
      h1.classList.remove('is-lit');
      lit.style.setProperty('--sc-r', '0px');
    });
    addEventListener('resize', setR);
  }

  /* ---------------- 启动 ---------------- */
  var sky = document.getElementById('sky');
  if (sky) mountClouds(sky);
  mountFilm();
  if (!reduce) mountTitleGlow();
  mountTilt();
  mountRail();
})();

/* 联系页：点一下复制微信号 */
/* 复制微信号的逻辑已经搬到 assets/copy.js —— 只有联系页用得上，
   放在这里等于每个加载 app.js 的页面都背一段用不到的代码。
   另外原来那句 .then(done, done) 会把复制失败也报成成功，那边一并修了。 */
