/* 联系页的「点击复制」。

   为什么单独一个文件、不塞回 app.js：
   app.js 是首页那一整套（云层 canvas、片带、页面转场），五百多行。
   联系页只需要这三十行，没必要为一个按钮把整包搬过去。

   为什么必须独立加载：原来联系页一个 <script> 都没有，
   这个按钮点了完全没反应——不是「慢」，是真的坏了。

   失败反馈也修了：原来写的是 navigator.clipboard.writeText(text).then(done, done)，
   成功和失败走同一个回调，复制没成功也照样弹「已复制」，等于骗人。
   现在失败会说「复制失败」并把文字选中，让人能手动 Ctrl+C。 */
(function () {
  var btns = document.querySelectorAll('[data-copy]');
  if (!btns.length) return;

  /* 老浏览器 / 非安全上下文（http 打开的页面）没有 navigator.clipboard，
     退回到 execCommand 那条老路。它返回布尔值，能如实知道成没成。 */
  function legacyCopy(text) {
    var t = document.createElement('textarea');
    t.value = text;
    t.setAttribute('readonly', '');
    // 定位到屏幕外，别让页面在复制的一瞬间滚一下
    t.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0';
    document.body.appendChild(t);
    t.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(t);
    return ok;
  }

  btns.forEach(function (el) {
    var text = el.getAttribute('data-copy');
    var hint = el.querySelector('.ct-hint');
    var idle = hint ? hint.textContent : '';
    var timer = 0;

    function say(msg, cls) {
      clearTimeout(timer);
      el.classList.remove('copied', 'failed');
      if (cls) el.classList.add(cls);
      if (hint) hint.textContent = msg;
      timer = setTimeout(function () {
        el.classList.remove('copied', 'failed');
        if (hint) hint.textContent = idle;
      }, 2000);
    }

    function failed() {
      // 两种复制方式都失败时，把实际微信号选中，支持手动 Ctrl+C。
      var value = el.querySelector('b');
      var selection = window.getSelection && window.getSelection();
      if (value && selection) {
        var range = document.createRange();
        range.selectNodeContents(value);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      say('复制失败，请手动选中', 'failed');
    }

    el.addEventListener('click', function () {
      // 没有 clipboard API：直接走老路，成不成看返回值
      if (!navigator.clipboard || !navigator.clipboard.writeText) {
        if (legacyCopy(text)) say('已复制 ' + text, 'copied');
        else failed();
        return;
      }

      navigator.clipboard.writeText(text).then(
        function () { say('已复制 ' + text, 'copied'); },
        function () {
          /* 用户拒绝授权、页面失焦、或者不是 https——都走这里。
             先试一次老办法，还不行才认输。 */
          if (legacyCopy(text)) say('已复制 ' + text, 'copied');
          else failed();
        }
      );
    });
  });
})();
