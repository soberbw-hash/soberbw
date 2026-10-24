/* 首页交互
   1. 云海：canvas 程序化绘制，缓慢漂移，跟随鼠标产生分层视差
   2. 标题组：随鼠标反向微移，做出景深
   3. 卡片带：无限横向滚动，可拖拽，鼠标悬停暂停，离中心越远越小

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
      dpr = Math.min(devicePixelRatio || 1, mobile ? 1.5 : 2);
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
    function frame(t) {
      var dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      now.mx += (target.mx - now.mx) * 0.06;
      now.my += (target.my - now.my) * 0.06;
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
      requestAnimationFrame(frame);
    }

    build();
    requestAnimationFrame(frame);

    addEventListener('resize', build);
    addEventListener('pointermove', function (e) {
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

    var mx = 0, my = 0, tx = 0, ty = 0;
    addEventListener('pointermove', function (e) {
      mx = (e.clientX / innerWidth - 0.5) * 2;
      my = (e.clientY / innerHeight - 0.5) * 2;
    }, { passive: true });
    addEventListener('pointerleave', function () { mx = 0; my = 0; });

    (function loop() {
      tx += (mx - tx) * 0.07;
      ty += (my - ty) * 0.07;
      for (var i = 0; i < els.length; i++) {
        var k = parseFloat(els[i].getAttribute('data-tilt')) || 0;
        els[i].style.transform = 'translate3d(' + (tx * k).toFixed(2) + 'px,' + (ty * k).toFixed(2) + 'px,0)';
      }
      requestAnimationFrame(loop);
    })();
  }

  /* ---------------- 右侧片带：一列 2:1 画面匀速上移 ----------------
     卡宽 = 片带宽，卡高 = 宽 / 2，跟原片比例一致，不裁。
     一组 9 张的总高（约 2300px）已经超过任何屏幕高度，不需要复制克隆；
     万一是超长屏，下面会按需再补一组。 */
  function mountRail() {
    var rail = document.querySelector('.sc-rail');
    var track = document.getElementById('rail');
    if (!rail || !track) return;

    var originals = [].slice.call(track.children);
    if (!originals.length) return;

    var W = 0, H = 0, cardW = 0, cardH = 0, pitch = 0, setH = 0, padL = 0;
    var GAP = 0.085;     // 间距 / 卡高
    var SHRINK = 0.055;  // 最边上缩多少：越靠边越小，像往远处退

    function measure() {
      // .sc-track 是 inset:0 铺满整个 padding box 的，左右内边距不会自己生效，
      // 得在这里减掉再算可用宽度——否则窄屏上是「左贴边、右留 20」的偏一边。
      var cs = getComputedStyle(rail);
      padL = parseFloat(cs.paddingLeft) || 0;
      var padR = parseFloat(cs.paddingRight) || 0;
      W = rail.clientWidth - padL - padR;
      H = rail.clientHeight;
      // 卡宽上限还要受带子高度约束：手机端片带横跨整屏，卡宽等于带宽时 2:1 的卡
      // 会比带子还高，只能露出中间一条。按「一屏看得见两张多一点」定，
      // 片带才像一条还在走的胶片，而不是一张巨大的图。
      cardW = Math.min(W, H * 0.95);
      cardH = cardW / 2;
      pitch = cardH * (1 + GAP);
    }

    measure();

    // 一组铺不满一屏时补一组（正常屏幕用不到，超长屏兜底）
    if (pitch * originals.length < H + cardH * 2) {
      [].slice.call(track.children).forEach(function (c) {
        var cp = c.cloneNode(true);
        cp.setAttribute('aria-hidden', 'true');
        cp.setAttribute('tabindex', '-1');
        track.appendChild(cp);
      });
    }
    var cards = [].slice.call(track.children);
    setH = pitch * cards.length;

    // 光标压住的那张放大一点。倍率写在脚本里，因为 transform 每帧都要重写，
    // 写在 CSS 的 :hover 里会被行内样式盖掉。
    var hoverEl = null;
    cards.forEach(function (c) {
      c.addEventListener('mouseenter', function () { hoverEl = c; });
      c.addEventListener('mouseleave', function () { if (hoverEl === c) hoverEl = null; });
    });

    var offset = 0, vel = 0;
    var dragging = false, lastY = 0, lastT = 0, moved = 0, paused = false;
    var speed = reduce ? 0 : (mobile ? 11 : 18);

    track.addEventListener('pointerenter', function () { paused = true; });
    track.addEventListener('pointerleave', function () { paused = false; });

    track.addEventListener('pointerdown', function (e) {
      dragging = true; moved = 0; vel = 0;
      lastY = e.clientY; lastT = performance.now();
      track.classList.add('dragging');
      track.setPointerCapture(e.pointerId);
    });
    track.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var now = performance.now();
      var dt = Math.max(8, now - lastT) / 1000;
      var dy = e.clientY - lastY;
      lastY = e.clientY; lastT = now;
      moved += dy;
      offset += dy;                 // 跟手 1:1
      vel = dy / dt;
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

    addEventListener('resize', measure);

    var last = performance.now();
    (function loop(t) {
      var dt = Math.min((t - last) / 1000, 0.05);
      last = t;

      if (!dragging && Math.abs(vel) > 2) {
        offset += vel * dt;
        vel *= Math.pow(0.05, dt);       // 速度每秒衰减到 5%
      } else if (!dragging && !paused && !reduce) {
        vel = 0;
        offset -= speed * dt;            // 常态缓慢上移
      }

      if (setH > 0) {
        while (offset <= -setH) offset += setH;
        while (offset > 0) offset -= setH;
      }

      var cy = H / 2, reach = H / 2 + cardH / 2;
      var leftX = padL + (W - cardW) / 2;

      for (var i = 0; i < cards.length; i++) {
        var el = cards[i];
        var tt = (i * pitch + offset) - cy + cardH / 2;   // 卡片中心相对视口中心
        // 折回 [-setH/2, setH/2)，保证首尾接得上
        if (setH > 0) tt = ((tt + setH / 2) % setH + setH) % setH - setH / 2;

        var ad = Math.abs(tt) / reach;
        // 视口外就整张停写
        if (ad > 1.2) { el.style.visibility = 'hidden'; continue; }
        el.style.visibility = 'visible';

        var d = ad > 1 ? 1 : ad;
        var s = 1 - SHRINK * d * d;
        if (el === hoverEl) s *= 1.035;

        el.style.left = leftX.toFixed(1) + 'px';
        el.style.top = (cy + tt - cardH / 2).toFixed(1) + 'px';
        el.style.width = cardW.toFixed(1) + 'px';
        el.style.height = cardH.toFixed(1) + 'px';
        el.style.transform = s === 1 ? 'none' : 'scale(' + s.toFixed(4) + ')';

        // 靠上下两端的卡字幕淡出，中间那张才是「当前这张」
        var cap = el.querySelector('.cap');
        if (cap) cap.style.opacity = d < 0.5 ? '1' : (d > 0.9 ? '0' : ((0.9 - d) / 0.4).toFixed(2));
      }
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

    function frame() {
      cx += (tx - cx) * 0.2;
      cy += (ty - cy) * 0.2;
      lit.style.setProperty('--sc-mx', cx.toFixed(1) + 'px');
      lit.style.setProperty('--sc-my', cy.toFixed(1) + 'px');
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
document.querySelectorAll('[data-copy]').forEach(function (el) {
  el.addEventListener('click', function () {
    var text = el.getAttribute('data-copy');
    var hint = el.querySelector('.ct-hint');
    var done = function () {
      el.classList.add('copied');
      if (hint) hint.textContent = '已复制 ' + text;
      setTimeout(function () {
        el.classList.remove('copied');
        if (hint) hint.textContent = '点击复制';
      }, 1800);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, done);
    } else {
      var t = document.createElement('textarea');
      t.value = text; document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(t); done();
    }
  });
});
