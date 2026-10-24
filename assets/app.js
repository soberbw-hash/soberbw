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

  /* ---------------- 卡片带：圆柱内壁弧形 ----------------
     每张卡片的位置、尺寸、形状，都从「它离视口中心多远」推出来：
       宽   = 基准宽 × (1 + 0.28·d²)               中间窄、两侧宽
       左右边缘各自的高度 = 基准高 × (1 + 0.33·q^2.6)  外边缘比内边缘高 → 卡片倾斜
       垂直中心下沉 H·0.028·d²                      像圆柱内壁的透视
     形状用 clip-path: path() 画圆角四边形，每帧重算。 */
  function mountRail() {
    var rail = document.querySelector('.sc-rail');
    var track = document.getElementById('rail');
    if (!rail || !track) return;

    var originals = [].slice.call(track.children);
    if (!originals.length) return;

    // 8 张图铺不满 1440，硬拉间距会变成「一排卡片」而不是「一圈墙」。
    // 所以把整组图重复 3 遍，让周期足够长，间距可以压紧。
    var REPEAT = 3;
    var n = originals.length * REPEAT;
    for (var r = 1; r < REPEAT; r++) {
      originals.forEach(function (c) {
        var cp = c.cloneNode(true);
        cp.setAttribute('aria-hidden', 'true');
        cp.setAttribute('tabindex', '-1');
        track.appendChild(cp);
      });
    }
    // 再整组复制一份，滚到尾部时无缝接回开头
    [].slice.call(track.children).forEach(function (c) {
      var clone = c.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      clone.setAttribute('tabindex', '-1');
      track.appendChild(clone);
    });
    var cards = [].slice.call(track.children);

    var W = 0, H = 0, baseW = 0, baseH = 0, pitch = 0, setW = 0;

    // 圆柱内壁：卡片在中间最矮最正，越靠两侧越高，且外缘比内缘更高 → 整张卡倾斜。
    // 参数是从参考图逐卡量出来的：高度增幅 ~1.37、指数 ~3.3、宽度几乎不变、间距恒定。
    var GROW_H = 0.46;   // 边缘卡片高度增幅
    var POW_H = 2.6;     // 高度曲线指数：越大越只在最外侧翘起
    var GROW_W = 0.12;   // 边缘卡片宽度增幅（参考图几乎不放大，只靠高度出弧）
    var BOW_X = 0.02;    // 水平外扩，几乎不用，靠间距本身撑开
    var GAP = 1.11;      // 卡片间距 / 卡宽，参考图约 1.11，压紧才像"墙"

    function measure() {
      W = rail.clientWidth;
      H = rail.clientHeight;
      // 最外侧高度 = baseH*(1+GROW_H) 必须留在 rail 内，留 3% 余量
      baseH = (H * 0.94) / (1 + GROW_H);
      baseW = baseH * 0.615;
      pitch = baseW * GAP;
      // 一圈至少要盖满一屏，否则首尾接缝会露空
      if (pitch * n < W * 1.06) pitch = (W * 1.06) / n;
      setW = pitch * n;
      // 字幕原本贴着卡片底边，这里取 CSS 里的基础内边距
      if (capPad < 0) {
        var c0 = track.querySelector('.cap');
        capPad = c0 ? (parseFloat(getComputedStyle(c0).bottom) || 12) : 12;
      }
    }
    var capPad = -1;

    var offset = 0, vel = 0;
    var dragging = false, lastX = 0, lastT = 0, moved = 0, paused = false;
    var speed = reduce ? 0 : (mobile ? 14 : 26);

    track.addEventListener('pointerenter', function () { paused = true; });
    track.addEventListener('pointerleave', function () { paused = false; });

    track.addEventListener('pointerdown', function (e) {
      dragging = true; moved = 0; vel = 0;
      lastX = e.clientX; lastT = performance.now();
      track.classList.add('dragging');
      track.setPointerCapture(e.pointerId);
    });
    track.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var now = performance.now();
      var dt = Math.max(8, now - lastT) / 1000;
      var dx = e.clientX - lastX;
      lastX = e.clientX; lastT = now;
      moved += dx;
      offset += dx;                 // 跟手 1:1
      vel = dx / dt;
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

    measure();
    addEventListener('resize', measure);

    // 圆角四边形：tl/tr/bl/br 是四条边相对元素顶部的 y
    function quad(w, tl, bl, tr, br, r) {
      var W1 = w.toFixed(1), R = r.toFixed(1);
      return 'path("M' + R + ',' + tl.toFixed(1) +
        ' L' + (w - r).toFixed(1) + ',' + tr.toFixed(1) +
        ' Q' + W1 + ',' + tr.toFixed(1) + ' ' + W1 + ',' + (tr + r).toFixed(1) +
        ' L' + W1 + ',' + (br - r).toFixed(1) +
        ' Q' + W1 + ',' + br.toFixed(1) + ' ' + (w - r).toFixed(1) + ',' + br.toFixed(1) +
        ' L' + R + ',' + bl.toFixed(1) +
        ' Q0,' + bl.toFixed(1) + ' 0,' + (bl - r).toFixed(1) +
        ' L0,' + (tl + r).toFixed(1) +
        ' Q0,' + tl.toFixed(1) + ' ' + R + ',' + tl.toFixed(1) + ' Z")';
    }

    var last = performance.now();
    (function loop(t) {
      var dt = Math.min((t - last) / 1000, 0.05);
      last = t;

      if (!dragging && Math.abs(vel) > 2) {
        offset += vel * dt;
        vel *= Math.pow(0.05, dt);       // 速度每秒衰减到 5%
      } else if (!dragging && !paused && !reduce) {
        vel = 0;
        offset -= speed * dt;            // 常态缓慢左移
      }

      if (setW > 0) {
        while (offset <= -setW) offset += setW;
        while (offset > 0) offset -= setW;
      }

      var cx = W / 2, half = W / 2, cyBase = H * 0.5;

      for (var i = 0; i < cards.length; i++) {
        var el = cards[i];
        var tt = (i * pitch + baseW / 2 + offset) - cx;
        // 折回 [-setW/2, setW/2)，保证克隆段和原段接上
        if (setW > 0) tt = ((tt + setW / 2) % setW + setW) % setW - setW / 2;

        var ad = Math.abs(tt) / half;
        // 视口外就整张停写，48 张卡不必每帧都算
        if (ad > 1.32) { el.style.visibility = 'hidden'; continue; }
        el.style.visibility = 'visible';

        var d = ad > 1 ? 1 : ad;
        var w = baseW * (1 + GROW_W * d * d);
        var x = cx + tt * (1 + BOW_X * (tt / half) * (tt / half));

        // 左右两条边各自按离圆心的距离求高度：外缘更远 → 更高 → 卡片自然倾斜
        var qL = Math.abs(tt - w / 2) / half; if (qL > 1) qL = 1;
        var qR = Math.abs(tt + w / 2) / half; if (qR > 1) qR = 1;
        var hL = baseH * (1 + GROW_H * Math.pow(qL, POW_H));
        var hR = baseH * (1 + GROW_H * Math.pow(qR, POW_H));

        var cy = cyBase;
        var y1L = cy - hL / 2, y2L = cy + hL / 2;
        var y1R = cy - hR / 2, y2R = cy + hR / 2;
        var top = Math.min(y1L, y1R), bot = Math.max(y2L, y2R);

        el.style.left = (x - w / 2).toFixed(1) + 'px';
        el.style.top = top.toFixed(1) + 'px';
        el.style.width = w.toFixed(1) + 'px';
        el.style.height = (bot - top).toFixed(1) + 'px';
        el.style.clipPath = quad(w, y1L - top, y2L - top, y1R - top, y2R - top, Math.max(7, w * 0.075));

        // 文字只在靠中间的卡片上出现，两侧斜切后不显示，避免被裁一半
        var cap = el.querySelector('.cap');
        if (cap) {
          // 弧面把矮的那条边往上切，字幕得跟着抬，否则第二行会被切掉
          var lift = bot - Math.min(y2L, y2R);
          cap.style.bottom = (lift + capPad).toFixed(1) + 'px';
          cap.style.opacity = d < 0.34 ? '1' : (d > 0.72 ? '0' : ((0.72 - d) / 0.38).toFixed(2));
        }
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
