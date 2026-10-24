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
      lit: draw('255,248,236', 0.72, 0.44, 2.2, 0.76),
      shade: draw('96,108,120', 0.3, 0.64, 2.4, 0.9)
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
            { y: 0.48, n: 3, s: 0.78, sp: 3, a: 0.4, depth: 0.6 },
            { y: 0.62, n: 3, s: 1.1, sp: 6.5, a: 0.46, depth: 1.1 },
            { y: 0.76, n: 2, s: 1.55, sp: 11, a: 0.38, depth: 1.7 }
          ]
        : [
            { y: 0.44, n: 7, s: 0.9, sp: 2.4, a: 0.36, depth: 0.4 },
            { y: 0.56, n: 7, s: 1.28, sp: 5, a: 0.44, depth: 0.9 },
            { y: 0.68, n: 6, s: 1.8, sp: 8.5, a: 0.42, depth: 1.5 },
            { y: 0.8, n: 5, s: 2.4, sp: 13, a: 0.32, depth: 2.1 }
          ];

      layers = spec.map(function (L) {
        var items = [];
        for (var j = 0; j < L.n; j++) {
          items.push({
            puff: puffs[j % puffs.length],
            x: rand(-0.15, 1.15) * W,
            y: (L.y + rand(-0.085, 0.085)) * H,
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

  /* ---------------- 卡片带 ---------------- */
  function mountRail() {
    var track = document.getElementById('rail');
    if (!track) return;

    var originals = [].slice.call(track.children);
    var n = originals.length;
    originals.forEach(function (c) {
      var clone = c.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      clone.setAttribute('tabindex', '-1');
      track.appendChild(clone);
    });

    var cards = [].slice.call(track.children);
    var gap = parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap) || 0;
    var setW = 0, baseX = [];

    function measure() {
      setW = 0;
      for (var i = 0; i < n; i++) setW += originals[i].offsetWidth + gap;
      baseX = cards.map(function (c) { return c.offsetLeft + c.offsetWidth / 2; });
    }

    var offset = 0;
    var speed = reduce ? 0 : (mobile ? 16 : 24);
    var paused = false, dragging = false, startX = 0, startOffset = 0, moved = 0;

    track.addEventListener('pointerenter', function () { paused = true; });
    track.addEventListener('pointerleave', function () { paused = false; });

    track.addEventListener('pointerdown', function (e) {
      dragging = true;
      moved = 0;
      startX = e.clientX;
      startOffset = offset;
      track.classList.add('dragging');
      track.setPointerCapture(e.pointerId);
    });
    track.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      moved = e.clientX - startX;
      offset = startOffset + moved;
    });
    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      track.classList.remove('dragging');
      // 拖完如果几乎没动，就当点击处理，别把链接拦掉
      if (Math.abs(moved) > 6) {
        track.addEventListener('click', function (ev) { ev.preventDefault(); }, { once: true });
      }
    }
    track.addEventListener('pointerup', endDrag);
    track.addEventListener('pointercancel', endDrag);

    measure();
    addEventListener('resize', measure);

    var last = performance.now();
    (function loop(t) {
      var dt = Math.min((t - last) / 1000, 0.05);
      last = t;

      if (!paused && !dragging && !reduce) offset -= speed * dt;
      if (setW > 0) {
        while (offset <= -setW) offset += setW;
        while (offset > 0) offset -= setW;
      }
      track.style.transform = 'translate3d(' + offset.toFixed(2) + 'px,0,0)';

      // 离视口中心越远越小，做出中间大两边小的弧度
      var mid = innerWidth / 2;
      for (var i = 0; i < cards.length; i++) {
        var d = Math.abs(baseX[i] + offset - mid);
        var k = Math.max(0, 1 - d / (innerWidth * 0.62));
        cards[i].style.transform = 'scale(' + (0.9 + k * 0.14).toFixed(3) + ')';
      }
      requestAnimationFrame(loop);
    })(performance.now());
  }

  /* ---------------- 启动 ---------------- */
  var sky = document.getElementById('sky');
  if (sky) mountClouds(sky);
  mountTilt();
  mountRail();
})();
