/* 易个日历 · 冒烟测试（无需浏览器）
 * 用最小 DOM 桩在 Node 里跑一遍 assets/js/app.js，
 * 检查：农历库能否加载、节假日能否读到、日历是否渲染出 42 格、详情面板是否有农历与放假信息。
 *
 * 用法：node tools/smoke-test.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let failures = 0;
function check(name, cond, extra) {
  if (cond) {
    console.log('  ✓ ' + name);
  } else {
    failures++;
    console.log('  ✗ ' + name + (extra ? '  →  ' + extra : ''));
  }
}

/* ---------- 最小 DOM 桩 ---------- */
function makeEl(id) {
  return {
    id,
    innerHTML: '',
    className: '',
    style: {},
    offsetWidth: 0,
    onclick: null,
    _handlers: {},
    classList: { add() {}, remove() {}, contains() { return false; } },
    addEventListener(t, fn) { (this._handlers[t] = this._handlers[t] || []).push(fn); },
    removeEventListener() {},
    getAttribute() { return null; },
    querySelector() { return null; },
  };
}

const nodes = {};
const head = makeEl('head');
const body = makeEl('body');
body.style = {};

const document = {
  body,
  head,
  addEventListener() {},
  getElementById(id) {
    if (!nodes[id]) nodes[id] = makeEl(id);
    return nodes[id];
  },
  createElement(tag) {
    const el = makeEl(tag);
    if (tag === 'script') {
      let src = '';
      Object.defineProperty(el, 'src', {
        set(v) {
          src = v;
          /* 模拟 script 加载：本地文件真的执行一次，远程地址视为失败 */
          setImmediate(() => {
            if (/^https?:/.test(src)) {
              el.onerror && el.onerror(new Error('offline'));
              return;
            }
            try {
              const code = fs.readFileSync(path.join(ROOT, src), 'utf8');
              vm.runInContext(code, sandbox, { filename: src });
              el.onload && el.onload();
            } catch (e) {
              el.onerror && el.onerror(e);
            }
          });
        },
        get() { return src; },
      });
    }
    return el;
  },
};

/* 章节：真实浏览器里 document.head.appendChild 会触发 script 的 src 赋值 */
head.appendChild = (el) => el.src;

const sandbox = {
  console,
  setTimeout,
  setImmediate,
  document,
  navigator: {},
  location: { protocol: 'http:', hostname: 'localhost' },
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;

/* ---------- 跑起来 ---------- */
const ctx = vm.createContext(sandbox);
vm.runInContext(read('assets/js/chinese-days.js'), ctx, { filename: 'chinese-days.js' });
vm.runInContext(read('assets/js/app.js'), ctx, { filename: 'app.js' });

setTimeout(() => {
  const days = nodes.days.innerHTML || '';
  const panel = nodes.panel.innerHTML || '';

  console.log('\n[1] 资源与数据');
  check('localStorage 无关，本地节假日数据已注入', !!sandbox.__CHINESE_DAYS__);
  check('法定节假日条数 > 600', Object.keys((sandbox.__CHINESE_DAYS__ || {}).holidays || {}).length > 600,
    String(Object.keys((sandbox.__CHINESE_DAYS__ || {}).holidays || {}).length));
  check('农历库已加载（Solar 可用）',
    /^object|^function$/.test(vm.runInContext('typeof Solar', ctx)) &&
    vm.runInContext('typeof Solar.fromDate', ctx) === 'function');

  console.log('\n[2] 月历渲染');
  const cells = (days.match(/class="day/g) || []).length;
  check('渲染出 42 个日期格', cells === 42, '实际 ' + cells);
  check('有农历/节日文字（.lunar）', /class="lunar"/.test(days));
  check('有“今天”高亮', /class="day[^"]*today/.test(days));

  console.log('\n[3] 详情面板');
  check('显示公历日期行', /class="date-line"/.test(panel));
  check('显示农历行且非“需联网”提示', /class="lunar-line"/.test(panel) && !/需联网/.test(panel),
    (panel.match(/lunar-line">([^<]*)/) || [])[1]);
  check('显示干支', /class="gz"/.test(panel));
  check('未出现 NaN/undefined', !/NaN|undefined/.test(days + panel));

  console.log('\n[4] 节假日渲染');
  /* 先回到今天，再切到 2026 年 10 月（国庆 + 中秋，且含调休）验收假期标签 */
  nodes.todayBtn.onclick && nodes.todayBtn.onclick();
  const idxOf = () => {
    const m = (nodes.monthTitle.innerHTML || '').match(/(\d+)年(\d+)月/);
    return m ? Number(m[1]) * 12 + (Number(m[2]) - 1) : NaN;
  };
  const target = 2026 * 12 + 9; // 2026 年 10 月
  let guard = 0;
  while (idxOf() !== target && guard++ < 240) {
    if (idxOf() > target) nodes.prevBtn.onclick(); else nodes.nextBtn.onclick();
  }
  const oct = nodes.days.innerHTML || '';
  const octPanel = nodes.panel.innerHTML || '';
  console.log('（切到：' + (nodes.monthTitle.innerHTML || '?') + '）');
  check('10 月里出现节假日/调休圆点', /class="holiday-dot/.test(oct));
  check('详情面板出现放假标签', /tag holiday|tag normal/.test(octPanel),
    (octPanel.match(/<span class="tag[^>]*">([^<]*)/) || [])[1]);

  console.log('\n结果：' + (failures === 0 ? '全部通过' : failures + ' 项失败'));
  process.exit(failures === 0 ? 0 : 1);
}, 300);
