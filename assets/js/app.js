/* =========================================================================
 *  加载农历库：优先使用同目录下的 lunar.js（打包进 assets 即可离线），
 *  没有则回退到 CDN；两者都失败时仍可正常使用公历功能。
 * ========================================================================= */
(function () {
  function boot() {
    if (window.__APP_STARTED__) return;
    window.__APP_STARTED__ = true;
    startApp();
  }
  function load(src, onFail) {
    var s = document.createElement('script');
    s.src = src;
    s.onload = boot;
    s.onerror = function () { if (onFail) onFail(); else boot(); };
    document.head.appendChild(s);
  }
  load('assets/js/lunar.js', function () {
    load('https://cdn.jsdelivr.net/npm/lunar-javascript/lunar.js');
  });
})();

/* =========================================================================
 *  主程序（全部使用 ES5 语法，兼容低版本 Android WebView）
 * ========================================================================= */
function startApp() {
  var $ = function (id) { return document.getElementById(id); };
  var WEEK = ['日', '一', '二', '三', '四', '五', '六'];
  var pad2 = function (n) { return n < 10 ? '0' + n : '' + n; };

  var today = new Date();
  var viewYear = today.getFullYear();
  var viewMonth = today.getMonth();
  var selected = new Date(viewYear, viewMonth, today.getDate());
  var selectedKey = '';

  var daysBox = $('days');
  var panel = $('panel');

  /* ---------------- 工具 ---------------- */

  function todayDate() {
    var d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function keyOf(y, m, d) { return y + '-' + pad2(m + 1) + '-' + pad2(d); }

  function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear() &&
           a.getMonth() === b.getMonth() &&
           a.getDate() === b.getDate();
  }

  function closest(el, cls, stop) {
    while (el && el !== stop && el !== document) {
      if (el.className && typeof el.className === 'string' &&
          (' ' + el.className + ' ').indexOf(' ' + cls + ' ') >= 0) return el;
      el = el.parentNode;
    }
    return null;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* 待办功能已移除。 */

  /* ---------------- 法定节假日（本地内置，离线可用；失败不影响使用） ---------------- */

  var holidays = {};

  function cleanName(name) {
    if (typeof name !== 'string' || name.indexOf(',') < 0) return name;
    var parts = name.split(',');
    for (var i = 0; i < parts.length; i++) {
      if (/[\u4e00-\u9fa5]/.test(parts[i]) && !/^[0-9]+$/.test(parts[i])) return parts[i];
    }
    return parts[0];
  }

  function applyHolidayData(data) {
    if (!data) return false;
    var d, n = 0;
    if (data.holidays) {
      for (d in data.holidays) {
        if (data.holidays.hasOwnProperty(d)) { holidays[d] = { name: cleanName(data.holidays[d]), work: false }; n++; }
      }
    }
    if (data.workdays) {
      for (d in data.workdays) {
        if (data.workdays.hasOwnProperty(d)) { holidays[d] = { name: cleanName(data.workdays[d]), work: true }; n++; }
      }
    }
    if (n) render();
    return n > 0;
  }

  function loadHolidays() {
    /* 1. 打包进 assets/js/chinese-days.js 的本地数据：断网也能显示放假与调休 */
    if (applyHolidayData(window.__CHINESE_DAYS__)) return;

    /* 2. 同目录 JSON（用于把数据单独部署的场景） */
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', 'assets/data/chinese-days.json', true);
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) return;
        if (xhr.status !== 200 && xhr.status !== 0) return;
        var ok = false;
        try { ok = applyHolidayData(JSON.parse(xhr.responseText)); } catch (e) {}
        if (!ok) fetchHolidaysFromCDN();
      };
      xhr.send();
    } catch (e) {
      fetchHolidaysFromCDN();
    }
  }

  /* 3. 最后兜底：CDN */
  function fetchHolidaysFromCDN() {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', 'https://cdn.jsdelivr.net/npm/chinese-days/dist/chinese-days.json', true);
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) return;
        if (xhr.status !== 200 && xhr.status !== 0) return;
        try { applyHolidayData(JSON.parse(xhr.responseText)); } catch (e) {}
      };
      xhr.send();
    } catch (e) {}
  }

  /* ---------------- 农历信息 ---------------- */

  function lunarOf(date) {
    if (typeof Solar === 'undefined' || !Solar || !Solar.fromDate) return null;
    try { return Solar.fromDate(date).getLunar(); } catch (e) { return null; }
  }

  function getInfo(date) {
    var k = keyOf(date.getFullYear(), date.getMonth(), date.getDate());
    var info = { lunar: null, lunarText: '', jq: '', fests: [], holiday: holidays[k] || null };
    var lunar = lunarOf(date);
    if (!lunar) return info;
    try {
      var solar = Solar.fromDate(date);
      info.lunar = lunar;
      var dn = lunar.getDayInChinese();
      info.lunarText = (dn === '初一') ? (lunar.getMonthInChinese() + '月') : dn;
      info.jq = lunar.getJieQi() || '';
      var sf = solar.getFestivals() || [];
      var lf = lunar.getFestivals() || [];
      var all = [], i;
      for (i = 0; i < sf.length; i++) all.push(sf[i]);
      for (i = 0; i < lf.length; i++) all.push(lf[i]);
      var uniq = [];
      for (i = 0; i < all.length; i++) {
        if (uniq.indexOf(all[i]) < 0) uniq.push(all[i]);
      }
      info.fests = uniq;
    } catch (e) {}
    return info;
  }

  function shortest(arr) {
    var s = arr[0];
    for (var i = 1; i < arr.length; i++) { if (arr[i].length < s.length) s = arr[i]; }
    return s;
  }

  /* ---------------- 渲染 ---------------- */

  function render() {
    today = todayDate();

    $('monthTitle').innerHTML = viewYear + '年' + (viewMonth + 1) + '月';

    var ml = lunarOf(new Date(viewYear, viewMonth, 1));
    $('lunarYearText').innerHTML = ml
      ? (ml.getYearInGanZhi() + '年 · 属' + ml.getYearShengXiao())
      : '';

    var startWeek = new Date(viewYear, viewMonth, 1).getDay();
    var daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    var daysInPrev = new Date(viewYear, viewMonth, 0).getDate();
    var html = '', i, date, other;

    for (i = 0; i < 42; i++) {
      other = false;
      if (i < startWeek) {
        date = new Date(viewYear, viewMonth - 1, daysInPrev - startWeek + 1 + i);
        other = true;
      } else if (i >= startWeek + daysInMonth) {
        date = new Date(viewYear, viewMonth + 1, i - startWeek - daysInMonth + 1);
        other = true;
      } else {
        date = new Date(viewYear, viewMonth, i - startWeek + 1);
      }
      html += dayHtml(date, other);
    }

    daysBox.className = 'days';
    daysBox.innerHTML = html;
    void daysBox.offsetWidth;
    daysBox.className = 'days motion-in';
    renderPanel(selected);
  }

  function dayHtml(date, other) {
    var info = getInfo(date);
    var k = keyOf(date.getFullYear(), date.getMonth(), date.getDate());
    var cls = 'day';
    if (other) cls += ' other';
    if (sameDay(date, today)) cls += ' today';
    if (sameDay(date, selected)) cls += ' sel';
    if (info.fests.length) cls += ' fest';

    var label = info.fests.length ? shortest(info.fests) : info.lunarText;
    if (!label) label = '&nbsp;';

    var inner = '<div class="di">' +
        '<span class="num">' + date.getDate() + '</span>' +
        '<span class="lunar">' + label + '</span>';

    if (info.holiday) {
      inner += '<span class="holiday-dot ' + (info.holiday.work ? 'work' : 'rest') + '" aria-label="' +
               (info.holiday.work ? '调休上班' : '节假日') + '"></span>';
    }



    inner += '</div>';

    return '<div class="' + cls + '" data-k="' + k + '"' +
           ' data-y="' + date.getFullYear() + '"' +
           ' data-m="' + date.getMonth() + '"' +
           ' data-d="' + date.getDate() + '">' + inner + '</div>';
  }

  function renderPanel(date) {
    var info = getInfo(date);
    var k = keyOf(date.getFullYear(), date.getMonth(), date.getDate());
    selectedKey = k;

    var html = '<div class="date-line">' +
      date.getFullYear() + '年' + pad2(date.getMonth() + 1) + '月' + pad2(date.getDate()) +
      '日 星期' + WEEK[date.getDay()] + '</div>';

    if (info.lunar) {
      html += '<div class="lunar-line">农历' + info.lunar.getYearInChinese() + '年' +
              info.lunar.getMonthInChinese() + '月' + info.lunar.getDayInChinese() + '</div>';
    } else {
      html += '<div class="lunar-line">农历数据需联网加载，当前显示公历</div>';
    }

    var tags = '', i;
    if (info.holiday) {
      tags += '<span class="tag ' + (info.holiday.work ? 'normal' : 'holiday') + '">' +
              esc(info.holiday.name) + (info.holiday.work ? ' · 上班' : ' · 放假') + '</span>';
    }
    for (i = 0; i < info.fests.length; i++) {
      var f = info.fests[i];
      if (info.holiday && f === info.holiday.name) continue;
      tags += '<span class="tag ' + (f === info.jq ? 'jq' : 'fest') + '">' + esc(f) + '</span>';
    }
    if (!tags) tags = '<span class="tag normal">普通日子</span>';
    html += '<div class="tags">' + tags + '</div>';

    if (info.lunar) {
      html += '<div class="gz"><span>' + info.lunar.getYearInGanZhi() + '年 ' +
              info.lunar.getMonthInGanZhi() + '月 ' + info.lunar.getDayInGanZhi() + '日</span>' +
              '<span>属' + info.lunar.getYearShengXiao() + '</span></div>';
    }

    panel.innerHTML = html;
  }

  /* ---------------- 交互 ---------------- */

  function shiftMonth(delta) {
    var d = new Date(viewYear, viewMonth + delta, 1);
    viewYear = d.getFullYear();
    viewMonth = d.getMonth();
    render();
  }

  $('prevBtn').onclick = function () { shiftMonth(-1); };
  $('nextBtn').onclick = function () { shiftMonth(1); };
  $('todayBtn').onclick = function () {
    var t = new Date();
    viewYear = t.getFullYear();
    viewMonth = t.getMonth();
    selected = new Date(t.getFullYear(), t.getMonth(), t.getDate());
    render();
  };

  daysBox.onclick = function (e) {
    var el = closest(e.target, 'day', daysBox);
    if (!el) return;
    var y = parseInt(el.getAttribute('data-y'), 10);
    var m = parseInt(el.getAttribute('data-m'), 10);
    var d = parseInt(el.getAttribute('data-d'), 10);
    selected = new Date(y, m, d);
    if (m !== viewMonth || y !== viewYear) { viewYear = y; viewMonth = m; }
    render();
    if (y === 2026 && m === 9 && d === 3) openMemoryModal();
  };

  /* ---------------- 背景音乐：许嵩《玫瑰花的葬礼》 ---------------- */
  var music = $('memoryAudio');
  var modal = $('memoryModal');

  function startMusic() {
    if (!music) return;
    music.play().catch(function () {});
  }

  function openMemoryModal() {
    if (!modal) return;
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
    startMusic();
  }

  function closeMemoryModal() {
    if (!modal) return;
    modal.classList.remove('show');
    document.body.style.overflow = '';
  }

  $('memoryClose').onclick = closeMemoryModal;
  modal.addEventListener('click', function(e) { if (e.target === modal) closeMemoryModal(); });
  document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeMemoryModal(); });


  /* ---------------- 启动 ---------------- */

  render();
  loadHolidays();
}
