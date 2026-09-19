import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Luật dời biến CSS nội tuyến sang class — xem khối "Biến CSS nội tuyến" ở lib/dom.js.
 *
 * Ba lớp canh, và cả ba đều chạy trong Node, không cần trình duyệt:
 *
 * 1. Phép biến đổi chuỗi: tách khai báo, giải thực thể, dời trọn thuộc tính style khai hay đọc
 *    biến, bỏ qua mọi thứ không chắc chắn. Chạy cả trên chuỗi THẬT mà các màn vẽ ra từ fixture.
 *    Cùng lớp này: mount() gỡ dấu bọc giá trị pha, bỏ qua lượt vẽ chỉ khác pha, và dùng lại thẻ
 *    table của lượt trước.
 * 2. Sổ class có trần: một giá trị đổi ở mọi lượt vẽ (--now) không được làm stylesheet mọc
 *    mãi, và tên class không bao giờ dùng lại.
 * 3. Lưới quét mã nguồn: mọi lần ghi HTML đi qua mount(), không ai đặt biến bằng
 *    style.setProperty, không ai chạm element.style ngoài những chỗ đã xét, và không khai báo
 *    nào mà `!important` đổi nghĩa bị dời: biến có hoạt hình, hay thuộc tính thường được dời
 *    mà CSS có @keyframes đổi hoặc khai `!important`.
 *
 * Chỗ rò chỉ đo được trong WebKit thật; file này chỉ khoá lại những điều kiện đã làm con số
 * ấy phẳng.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..', 'public');
const mod = (rel) => import(new URL(`file://${path.join(ROOT, rel)}`).href);

const { hoistVars, declsOf, splitStyle, VarClasses, mount, unchanged, setVars, phase, html, rawText, esc } = await mod('lib/dom.js');

/** Sổ thật với sàn tuỳ chọn, trả kèm hàm `classFor` để đưa thẳng vào `hoistVars`. */
function book(floor) {
  const vars = new VarClasses(floor);
  return { vars, classFor: (k, d) => vars.classFor(k, d) };
}

/* ── Tách khai báo ──────────────────────────────────────────────────────────── */

test('splitStyle: tách ở dấu ; ngoài cùng, soi ngoặc và nháy', () => {
  assert.deepEqual(splitStyle('a:1;b:2'), ['a:1', 'b:2']);
  assert.deepEqual(splitStyle('--s:steps(3,end);--u:url(data:x;base64,AA)'), ['--s:steps(3,end)', '--u:url(data:x;base64,AA)']);
  assert.deepEqual(splitStyle(`--q:"a;b";--r:'c;d'`), [`--q:"a;b"`, `--r:'c;d'`]);
  assert.deepEqual(splitStyle('--g:[a;b]'), ['--g:[a;b]']);
  assert.deepEqual(splitStyle('a:1;'), ['a:1', '']);
});

test('splitStyle: năm thực thể của esc() là MỘT ký tự, không phải chỗ cắt', () => {
  // `&quot;` chứa dấu ; — cắt ở đó là xé đôi một chuỗi trong nháy.
  assert.deepEqual(splitStyle('--q:&quot;a;b&quot;;w:1'), ['--q:&quot;a;b&quot;', 'w:1']);
  assert.deepEqual(splitStyle('--a:&amp;&lt;&gt;&#39;x&#39;'), ['--a:&amp;&lt;&gt;&#39;x&#39;']);
});

test('splitStyle: không chắc chắn thì trả null', () => {
  assert.equal(splitStyle('--x:&nbsp;'), null, 'thực thể lạ');
  assert.equal(splitStyle('--x:a\\;b'), null, 'dấu thoát');
  assert.equal(splitStyle('--x:1/*;*/'), null, 'chú thích');
  assert.equal(splitStyle('--x:"a'), null, 'nháy không đóng');
  assert.equal(splitStyle('--x:f(a'), null, 'ngoặc không đóng');
  assert.equal(splitStyle('--x:a)'), null, 'ngoặc đóng thừa');
});

test('splitStyle: những chỗ bộ đọc CSS cắt khác dấu ; thì trả null', () => {
  // Mỗi ca là một chỗ fuzz trên Chrome thấy innerHTML và mount() cho ra style khác nhau.
  assert.equal(splitStyle('left:f[1px);--c:red;top:(2px]'), null, 'ngoặc đóng sai loại: khối [ nuốt cả --c');
  assert.equal(splitStyle('width:{;--c:red;}'), null, 'dấu { mở một khối nuốt các khai báo phía sau');
  assert.equal(splitStyle('--c:red;width:}'), null, 'dấu } lẻ');
  assert.equal(splitStyle('--a:"x\ny";width:3px'), null, 'xuống dòng trong nháy làm hỏng chuỗi');
  assert.equal(splitStyle("--a:'x\ry'"), null, 'xuống dòng kiểu CR');
  // Trong nháy thì ngoặc và dấu { chỉ là chữ.
  assert.deepEqual(splitStyle('--q:"(]{";w:1'), ['--q:"(]{"', 'w:1']);
  assert.deepEqual(splitStyle('--n:f([a;b]);w:1'), ['--n:f([a;b])', 'w:1']);
});

/* ── Phân loại ──────────────────────────────────────────────────────────────── */

test('declsOf: mọi khai báo vào bộ khoá theo thứ tự viết, tên thuộc tính thường viết thường', () => {
  const set = declsOf(' --a: 1 ; WIDTH : 2px;--b:x(y);height:3px');
  assert.deepEqual(set.decls, [
    ['--a', '1'],
    ['width', '2px'],
    ['--b', 'x(y)'],
    ['height', '3px'],
  ]);
  assert.equal(set.key, '--a:1;width:2px;--b:x(y);height:3px');
  // Tên biến phân biệt hoa thường, nên giữ nguyên.
  assert.deepEqual(declsOf('--Ab:1').decls, [['--Ab', '1']]);
  assert.deepEqual(declsOf('--a:1;;width:2px;').decls, [
    ['--a', '1'],
    ['width', '2px'],
  ], 'mảnh rỗng giữa hai dấu ; bị bỏ qua như trình duyệt bỏ qua');
});

test('declsOf: thuộc tính ĐỌC biến cũng dời trọn, vì WebKit không gộp được giá trị có var()', () => {
  assert.deepEqual(declsOf('width:3px;color:var(--faint)').decls, [
    ['width', '3px'],
    ['color', 'var(--faint)'],
  ]);
  assert.deepEqual(declsOf('font:10px VAR(--mono)').decls, [['font', '10px VAR(--mono)']], 'tên hàm CSS không phân biệt hoa thường');
  assert.deepEqual(declsOf('padding-top:env(safe-area-inset-top)').decls, [['padding-top', 'env(safe-area-inset-top)']], 'env() cũng là tham chiếu chờ thay');
  assert.deepEqual(declsOf('width:calc(var(--w) - 2px)').decls, [['width', 'calc(var(--w) - 2px)']]);
});

test('declsOf: không khai biến, không đọc biến thì null, cả thuộc tính ở lại nội tuyến', () => {
  for (const src of ['width:3px', 'height:calc(100% - 2px)', 'background:url(navvar(1).png)', 'grid-template-columns:minmax(0,1fr)', '']) {
    assert.equal(declsOf(src), null, src);
  }
});

test('declsOf: giải thực thể trong giá trị', () => {
  assert.deepEqual(declsOf('--q:&quot;a&amp;b&quot;;content:&quot;x&quot;').decls, [
    ['--q', '"a&b"'],
    ['content', '"x"'],
  ]);
});

test('declsOf: MỘT khai báo không chép được, biến hay thường, thì cả thuộc tính ở lại', () => {
  const bad = [
    '--a:1;--b:{x}',
    '--a:1;--b:1 !important',
    '--a:1;--b:&lt;i&gt;',
    '--a:1;--b:',
    '--a:1;--b',
    '--a:1;--bé:2',
    '--a:1;--:2',
    '--a:1;width:{x}',
    '--a:1;width:1px !important',
    '--a:1;width:',
    '--a:1;width',
    '--a:1;wid th:1px',
    '--a:1;wídth:1px',
    '--a:1;1px:2',
    '--a:1;-:2',
    'color:var(--a);width:{x}',
    'color:var(--a);width:1px !important',
  ];
  for (const src of bad) assert.equal(declsOf(src), null, src);
});

test('declsOf: khoảng trắng hai đầu cắt theo CSS, không theo String.prototype.trim()', () => {
  // Với CSS, NBSP, U+FEFF và U+3000 là ký tự thường: bản nội tuyến giữ chúng trong giá trị, nên
  // bản đã dời cũng phải giữ.
  for (const ch of [' ', '﻿', '　']) {
    assert.deepEqual(
      declsOf(`--a:${ch}x${ch};font-family:${ch}y`).decls,
      [
        ['--a', `${ch}x${ch}`],
        ['font-family', `${ch}y`],
      ],
      JSON.stringify(ch),
    );
  }
  assert.deepEqual(declsOf(' \t--a : \n x \f;\r width: 1px ').decls, [
    ['--a', 'x'],
    ['width', '1px'],
  ]);
  assert.equal(declsOf(' --a:1'), null, 'tên dính NBSP không còn là tên: cả thuộc tính ở lại');
});

test('declsOf và setVars: revert-layer, revert-rule thì ở lại nội tuyến, vì trong !important chúng lùi về tầng khác', () => {
  for (const src of ['font-size:revert-layer;--b:1', '--a:revert-layer', '--a:1;color:REVERT-LAYER', '--a:revert-rule', 'color:var(--x, revert-layer)']) {
    assert.equal(declsOf(src), null, src);
  }
  // `revert` trơn thì cả hai dạng cùng lùi về gốc người dùng, nên vẫn dời được.
  assert.deepEqual(declsOf('--a:1;color:revert').decls, [
    ['--a', '1'],
    ['color', 'revert'],
  ]);
  const doc = fakeDocument();
  const el = doc.element();
  setVars(el, { '--k': 1, 'font-size': 'revert-layer' });
  assert.equal(el.classList.size, 0);
  assert.deepEqual(doc.log.map(([k]) => k), ['setProperty', 'setProperty']);
});

/* ── Viết lại chuỗi HTML ────────────────────────────────────────────────────── */

test('hoistVars: chuỗi không có gì để dời thì trả về chính nó', () => {
  const { classFor } = book();
  for (const s of ['<p>chữ</p>', '<i style="width:3px"></i>', '<i class="--x:1"></i>', '']) {
    const r = hoistVars(s, classFor);
    assert.equal(r.html, s);
    assert.equal(r.marks, 0);
  }
});

test('hoistVars: thuộc tính có biến dời TRỌN vào luật, kể cả khai báo thường, đúng thứ tự', () => {
  const { vars, classFor } = book();
  const r = hoistVars('<div class="q" style="--r-c:var(--ok);--hp:#f00">x</div><i style="width:3px;--c:red;height:4px"></i><b style="width:5px"></b>', classFor);
  assert.equal(r.html, '<div class="q" data-nv="nv-1">x</div><i data-nv="nv-2"></i><b style="width:5px"></b>', 'thuộc tính không khai biến thì ở lại nguyên văn');
  assert.equal(r.marks, 2);
  assert.deepEqual(vars.drain(), [
    ['nv-1', '.nv-1{--r-c:var(--ok) !important;--hp:#f00 !important}'],
    ['nv-2', '.nv-2{width:3px !important;--c:red !important;height:4px !important}'],
  ]);
});

test('hoistVars: thuộc tính chỉ ĐỌC biến cũng dời trọn; không khai, không đọc biến thì ở lại', () => {
  const { vars, classFor } = book();
  const r = hoistVars('<td style="color:var(--dim);white-space:nowrap">x</td><b style="height:calc(100% - 2px)"></b>', classFor);
  assert.equal(r.html, '<td data-nv="nv-1">x</td><b style="height:calc(100% - 2px)"></b>');
  assert.deepEqual(vars.drain(), [['nv-1', '.nv-1{color:var(--dim) !important;white-space:nowrap !important}']]);
  // Chuỗi không có dấu -- nào vẫn phải được đọc, vì env() không cần tên biến.
  assert.equal(hoistVars('<i style="top:env(safe-area-inset-top)"></i>', classFor).html, '<i data-nv="nv-2"></i>');
});

test('hoistVars: cùng bộ khai báo thì cùng class, và luật chỉ sinh một lần', () => {
  const { vars, classFor } = book();
  const r = hoistVars('<i style="--c:red"></i><b style="--c: red"></b><s style="--c:blue"></s><u style="--c:red;width:1px"></u>', classFor);
  assert.equal(r.html, '<i data-nv="nv-1"></i><b data-nv="nv-1"></b><s data-nv="nv-2"></s><u data-nv="nv-3"></u>', 'cùng biến mà khác khai báo thường là một bộ khác');
  assert.equal(vars.drain().length, 3);
  hoistVars('<i style="--c:red"></i><u style="--c:red;WIDTH:1px"></u>', classFor);
  assert.equal(vars.drain().length, 0, 'lượt vẽ lại y hệt không được chèn luật nào');
});

test('hoistVars: SVG, thẻ tự đóng, nháy đơn, nhiều thuộc tính', () => {
  const { classFor } = book();
  assert.equal(
    hoistVars('<svg><path d="M0 0" style="--p:30%"/></svg>', classFor).html,
    '<svg><path d="M0 0" data-nv="nv-1"/></svg>',
  );
  assert.equal(hoistVars(`<i title='a>b' style='left:1px;--q:&quot;x&quot;' data-k="z"></i>`, classFor).html, `<i title='a>b' data-nv="nv-2" data-k="z"></i>`);
  assert.equal(hoistVars('<br style="--p:30%" />', classFor).html, '<br data-nv="nv-1" />');
});

test('hoistVars: chỉ đọc THẺ — chú thích, chữ thô, giá trị thuộc tính đi qua nguyên vẹn', () => {
  const { classFor } = book();
  const cases = [
    '<!-- <i style="--x:1"></i> --><p>t</p>',
    '<style>.a { --x: 1 } i[style="--x:1"] {}</style>',
    '<script>const s = \'<i style="--x:1">\';</script>',
    '<textarea><i style="--x:1"></i></textarea>',
    '<input value="&lt;i style=&quot;--x:1&quot;&gt;">',
    '<p>a < b style="--x:1"</p>',
  ];
  for (const s of cases) assert.equal(hoistVars(s, classFor).html, s, s);
  // Sau khối chữ thô, thẻ bình thường vẫn được đọc tiếp.
  assert.equal(hoistVars('<style>i{}</style><i style="--x:1"></i>', classFor).html, '<style>i{}</style><i data-nv="nv-1"></i>');
});

test('hoistVars: chú thích và thẻ lạ được đọc như trình phân tích HTML đọc', () => {
  const { classFor } = book();
  const x = '<i style="--x:1"></i>';
  const hoisted = '<i data-nv="nv-1"></i>';
  const run = (s) => hoistVars(s, classFor).html;
  // `<!-->` và `<!--->` đóng ngay. Đọc chúng như chú thích mở thì bộ quét nhảy tới một `-->`
  // ở xa, có thể rơi vào giữa chữ của một thẻ style và chèn data-nv vào CSS.
  for (const open of ['<!-->', '<!--->']) {
    assert.equal(run(`${open}${x}`), `${open}${hoisted}`, open);
    const css = '<style>b{--y:1} /* --> */ i[style="--x:1"]{}</style>';
    assert.equal(run(`${open}${css}`), `${open}${css}`, `${open} rồi tới thẻ style`);
  }
  assert.equal(run(`<!---->${x}`), `<!---->${hoisted}`);
  assert.equal(run(`<!-- a --!>${x}`), `<!-- a --!>${hoisted}`, '--!> cũng đóng chú thích');
  // Chú thích hỏng kéo tới dấu > đầu tiên; thẻ đóng không có thuộc tính nào sống.
  for (const s of [`<!doctype html>${x}`, `<?php x ?>${x}`, `</ foo>${x}`, `</>${x}`]) {
    assert.equal(run(s), s.replace(x, hoisted), s);
  }
  assert.equal(run('</i style="--x:1">'), '</i style="--x:1">', 'thuộc tính trên thẻ đóng bị bỏ, không dời');
  assert.equal(run(`</b title="a>b">${x}`), `</b title="a>b">${hoisted}`, 'dấu > trong nháy của thẻ đóng');
  assert.equal(run(`<![CDATA[ a>b ${x} ]]>${x}`), `<![CDATA[ a>b ${x} ]]>${hoisted}`);
  // Thêm vài thẻ chữ thô, và plaintext thì chữ tới hết chuỗi.
  for (const tag of ['xmp', 'iframe', 'noembed', 'noframes', 'noscript']) {
    assert.equal(run(`<${tag}>${x}</${tag}>${x}`), `<${tag}>${x}</${tag}>${hoisted}`, tag);
  }
  assert.equal(run(`<plaintext>${x}`), `<plaintext>${x}`);
  // Nội dung template không nằm trong cây mà mount() quét, nên dấu tạm ở đó sẽ kẹt lại. Chữ
  // thô bên trong template vẫn phải được đọc là chữ thô: một chữ </template> nằm trong style
  // không đóng template nào.
  const tpl = `<template>${x}<template>${x}</template>${x}</template>`;
  assert.equal(run(`${tpl}${x}`), `${tpl}${hoisted}`);
  const inStyle = `<template><style></template>${x}</style></template>`;
  assert.equal(run(`${inStyle}${x}`), `${inStyle}${hoisted}`);
});

test('hoistVars: trong svg hay math, gặp thẻ chữ thô thì dừng hẳn', () => {
  const { classFor } = book();
  const x = '<i style="--x:1"></i>';
  const hoisted = '<i data-nv="nv-1"></i>';
  const run = (s) => hoistVars(s, classFor).html;
  // Fuzz trên Chrome: textarea trong svg là phần tử thường, svg đóng lại, rồi một style THẬT
  // mở ra. Coi textarea là chữ thô thì bộ quét nhảy qua đúng chỗ style ấy mở và viết vào CSS.
  const s = `<svg><textarea><svg/></svg><path><style></path></textarea>${x}</style>`;
  assert.equal(run(s), s);
  assert.equal(run(`${x}<math><style>`), `${hoisted}<math><style>`, 'phần trước vẫn được dời');
  // svg tự đóng không mở vùng nào.
  assert.equal(run(`<svg/><style>${x}</style>${x}`), `<svg/><style>${x}</style>${hoisted}`);
  // Fuzz: thẻ b kéo trình phân tích ra khỏi svg, nên title sau đó lại là chữ thô thật. Bộ quét
  // không theo được quy tắc ấy, nên title trong svg cũng làm nó dừng.
  const breakout = `<svg><b><title>${x}</title></b></svg>${x}`;
  assert.equal(run(breakout), breakout);
  const slashValue = `<svg data-a=/x/><style>${x}</style>${x}`;
  assert.equal(run(slashValue), slashValue, 'dấu / cuối giá trị không nháy không làm svg thành tự đóng');
});

test('hoistVars: những ca phải để nguyên thuộc tính', () => {
  const { classFor } = book();
  const cases = [
    '<i style="--x:{bad}"></i>',
    '<i style="--x:1 !important"></i>',
    '<i style="--x:1;width:1px !important"></i>',
    '<i style="--x:1;width:{1px}"></i>',
    '<i style=--x:1></i>',
    '<i data-nv="nv-9" style="--x:1"></i>',
    '<i style="width:1px" style="--x:1"></i>',
    // Style lặp: trình duyệt giữ cái đầu, nên gỡ cái đầu là làm cái thứ hai sống dậy.
    '<i style="--c:red" style="color:blue"></i>',
    '<i style="--c:red" STYLE="--d:1"></i>',
  ];
  for (const s of cases) assert.equal(hoistVars(s, classFor).html, s, s);
  // `classFor` trả null (luật bị từ chối) thì cũng để nguyên.
  assert.equal(hoistVars('<i style="--x:1"></i>', () => null).html, '<i style="--x:1"></i>');
  // Thẻ không đóng: phần trước vẫn được dời, phần còn lại để nguyên.
  assert.equal(hoistVars('<i style="--x:1"></i><b style="--y:2"', classFor).html, '<i data-nv="nv-1"></i><b style="--y:2"');
});

/* ── Trên chuỗi thật các màn vẽ ra ──────────────────────────────────────────── */

const STATE = JSON.parse(fs.readFileSync(path.join(HERE, 'fixtures', 'state.json'), 'utf8'));

async function paintedViews() {
  const out = [];
  for (const f of fs.readdirSync(path.join(ROOT, 'views')).filter((x) => x.endsWith('.js')).sort()) {
    const m = await mod(`views/${f}`);
    for (const [name, fn] of Object.entries(m)) {
      if (/^render[A-Z]/.test(name) && typeof fn === 'function') out.push([`views/${f} · ${name}`, rawText(fn(STATE, ''))]);
    }
  }
  const { overviewDrawer } = await mod('views/overview.js');
  const { popoverView } = await mod('lib/menubar-view.js');
  out.push(['overviewDrawer', rawText(overviewDrawer(STATE.projects[0], STATE.thresholds))]);
  out.push(['popoverView', rawText(popoverView(STATE, {}))]);
  return out;
}

const PAINTED = await paintedViews();
const styleAttrs = (s) => [...s.matchAll(/\sstyle="([^"]*)"/g)].map((m) => m[1]);
const declNames = (css) => (splitStyle(css) ?? []).map((p) => p.split(':')[0].trim()).filter(Boolean);
const isVar = (name) => name.startsWith('--');
/** Chuỗi có đọc biến không, viết độc lập với `VAR_REF` của lib/dom.js để test không tự khớp với chính nó. */
const readsVar = (css) => /(^|[^\w-])(var|env)\(/i.test(css);
/** Tên khai báo theo thứ tự trong văn bản một luật `.nv-1{a:1 !important;b:2 !important}`. */
const ruleNames = (rule) => (splitStyle(rule.slice(rule.indexOf('{') + 1, -1)) ?? []).map((p) => p.split(':')[0].trim());

test('mọi màn: thuộc tính style khai hay đọc biến dời trọn vào luật, thuộc tính còn lại ở lại nguyên văn', () => {
  let marks = 0;
  let mixed = 0;
  let reads = 0;
  for (const [label, s] of PAINTED) {
    const { vars, classFor } = book();
    const r = hoistVars(s, classFor);
    marks += r.marks;
    const rules = new Map(vars.drain());
    const withVars = styleAttrs(s).filter((css) => declNames(css).some(isVar) || readsVar(css));
    mixed += withVars.filter((css) => declNames(css).some(isVar) && !declNames(css).every(isVar)).length;
    reads += withVars.filter((css) => !declNames(css).some(isVar)).length;
    assert.deepEqual(styleAttrs(r.html), styleAttrs(s).filter((css) => !withVars.includes(css)), `${label}: thuộc tính không khai biến bị đổi`);
    const classes = [...r.html.matchAll(/\sdata-nv="([^"]*)"/g)].map((m) => m[1]);
    assert.equal(classes.length, withVars.length, `${label}: số chỗ dời lệch số thuộc tính có biến`);
    withVars.forEach((css, i) => {
      const want = declNames(css).map((n) => (isVar(n) ? n : n.toLowerCase()));
      assert.deepEqual(ruleNames(rules.get(classes[i])), want, `${label}: luật của style="${css}" mất hay đảo khai báo`);
    });
  }
  // Lưới phải canh một thứ có thật: màn Dự án một mình đã có hơn chục chỗ, và vạch biểu đồ ở
  // Thống kê và Token là loại có cả `width` lẫn biến.
  assert.ok(marks > 100, `chỉ dời được ${marks} chỗ trên mọi màn — phép quét có vẻ đã hụt`);
  assert.ok(mixed >= 10, `chỉ thấy ${mixed} thuộc tính có cả biến lẫn khai báo thường`);
  // Màn Quyết định và Sức khoẻ một mình đã có vài chục chỗ `color:var(--dim)` trong bảng.
  assert.ok(reads >= 30, `chỉ thấy ${reads} thuộc tính chỉ đọc biến`);
});

/**
 * Phần tử được dời mà mỗi lượt vẽ vẫn tạo bộ biến mới, xem khối đầu mục ở lib/dom.js.
 *
 * Phần tử còn giữ thuộc tính style thì không được có ở đây nữa: mount() dời trọn thuộc tính.
 * Thẻ bảng KHAI biến thì html.css của WebKit khai `border-color: inherit` cho chúng, nên chúng
 * tạo bộ biến mới dù không còn style. Con cháu của chúng mới là chỗ rò, nên chúng chỉ được là
 * thẻ lá. Thẻ bảng chỉ ĐỌC biến (`td style="color:var(--dim)"`) không có bộ biến riêng để tạo,
 * nên có con được.
 */
const TAG_RE = /<([a-zA-Z][^\s/>]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>/g;
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const TABLE_PART = new Set(['thead', 'tbody', 'tfoot', 'tr', 'td', 'th']);

function hoistedTags(markup, declares = () => true) {
  const out = [];
  for (const m of markup.matchAll(TAG_RE)) {
    const [whole, name, attrs, selfClose] = m;
    const cls = attrs.match(/\sdata-nv="([^"]*)"/)?.[1];
    if (cls == null) continue;
    const tag = name.toLowerCase();
    const after = m.index + whole.length;
    const close = markup.indexOf(`</${name}`, after);
    const leaf = selfClose === '/' || VOID.has(tag) || (close >= 0 && !/<[a-zA-Z]/.test(markup.slice(after, close)));
    out.push({ tag: whole.slice(0, 80), styled: /\sstyle=/.test(attrs), table: TABLE_PART.has(tag) && declares(cls), leaf });
  }
  return out;
}

test('mọi màn: phần tử đã dời không giữ style, và thẻ bảng khai biến chỉ là thẻ lá', () => {
  let checked = 0;
  for (const [label, s] of PAINTED) {
    const { vars, classFor } = book();
    const out = hoistVars(s, classFor).html;
    const rules = new Map(vars.drain());
    const found = hoistedTags(out, (cls) => ruleNames(rules.get(cls)).some(isVar));
    checked += found.length;
    assert.deepEqual(found.filter((f) => f.styled).map((f) => f.tag), [], `${label}: phần tử đã dời mà còn giữ style nội tuyến`);
    assert.deepEqual(found.filter((f) => f.table && !f.leaf).map((f) => f.tag), [], `${label}: thẻ bảng có con mà vẫn tạo bộ biến mới ở mọi lượt vẽ`);
  }
  assert.ok(checked > 100, `chỉ đọc được ${checked} phần tử đã dời, phép quét có vẻ đã hụt`);
});

test('lưới phần tử đã dời: bắt được style còn sót và thẻ bảng có con, bỏ qua thẻ lá', () => {
  const pick = (s) => hoistedTags(s).map(({ styled, table, leaf }) => ({ styled, table, leaf }));
  assert.deepEqual(pick('<i style="width:1px" data-nv="nv-1"></i>'), [{ styled: true, table: false, leaf: true }]);
  assert.deepEqual(pick('<td data-nv="nv-1"><b>x</b></td>'), [{ styled: false, table: true, leaf: false }]);
  assert.deepEqual(
    hoistedTags('<td data-nv="nv-1"><b>x</b></td>', () => false).map(({ table }) => table),
    [false],
    'thẻ bảng chỉ đọc biến thì không bị buộc làm thẻ lá',
  );
  assert.deepEqual(pick('<td data-nv="nv-1">chữ</td><div data-nv="nv-2"><b>x</b></div>'), [
    { styled: false, table: true, leaf: true },
    { styled: false, table: false, leaf: false },
  ]);
  assert.deepEqual(pick('<path data-nv="nv-1"/><img data-nv="nv-2"><i style="--c:red"></i>'), [
    { styled: false, table: false, leaf: true },
    { styled: false, table: false, leaf: true },
  ]);
});

test('màn Dự án: vẽ lại y hệt thì không sinh thêm luật nào', () => {
  const [, s] = PAINTED.find(([label]) => label.endsWith('renderOverview'));
  const { vars, classFor } = book();
  const first = hoistVars(s, classFor).html;
  const rules = vars.drain().length;
  assert.ok(rules > 0 && rules < 20, `màn Dự án sinh ${rules} luật`);
  assert.equal(hoistVars(s, classFor).html, first);
  assert.equal(vars.drain().length, 0);
});

/* ── Sổ class có trần ───────────────────────────────────────────────────────── */

test('sổ: vượt trần thì bỏ class chết, giữ class sống, trần giãn theo số sống', () => {
  const { vars, classFor } = book(4);
  const names = ['a', 'b', 'c', 'd', 'e'].map((x) => classFor(`--x:${x}`, [['--x', x]]));
  assert.equal(vars.size, 5);
  assert.ok(vars.over);
  const dead = vars.sweep(new Set([names[1], names[4]]));
  assert.deepEqual(dead, [names[0], names[2], names[3]]);
  assert.equal(vars.size, 2);
  assert.equal(vars.cap, 4, 'trần không xuống dưới sàn');
  // Bộ đã bị bỏ mà quay lại thì nhận TÊN MỚI, không dùng lại tên cũ.
  const again = classFor('--x:a', [['--x', 'a']]);
  assert.notEqual(again, names[0]);
  assert.equal(classFor('--x:b', [['--x', 'b']]), names[1], 'class còn sống giữ nguyên tên');

  const live = new Set();
  for (let i = 0; i < 10; i++) live.add(classFor(`--y:${i}`, [['--y', String(i)]]));
  vars.sweep(live);
  assert.equal(vars.cap, 20, 'trần = 2 × số class còn sống khi số ấy vượt sàn');
});

test('sổ: --now đổi ở mọi lượt vẽ mà stylesheet không mọc mãi', () => {
  // Mô phỏng màn thị trấn: vài trăm bộ biến ổn định cùng sống, cộng một bộ mới mỗi lượt
  // (lifeClock). Dọn đúng như mount() dọn: chỉ class của lượt vẽ HIỆN TẠI là còn sống.
  const floor = 64;
  const { vars, classFor } = book(floor);
  let peak = 0;
  for (let turn = 0; turn < 5000; turn++) {
    const live = new Set();
    for (let k = 0; k < 40; k++) live.add(classFor(`--x:${k}px`, [['--x', `${k}px`]]));
    live.add(classFor(`--now:${turn * 30_000}`, [['--now', String(turn * 30_000)]]));
    vars.drain();
    peak = Math.max(peak, vars.size);
    if (vars.over) vars.sweep(live);
  }
  assert.ok(peak <= Math.max(floor, 2 * 41) + 1, `sổ đạt ${peak} class`);
});

test('sổ: luật bị từ chối thì bộ ấy ở lại nội tuyến, và danh sách từ chối có trần', () => {
  const { vars, classFor } = book();
  const cls = classFor('--x:1', [['--x', '1']]);
  vars.refuse(cls);
  assert.equal(classFor('--x:1', [['--x', '1']]), null);
  assert.equal(vars.size, 0);
  for (let i = 0; i < 1000; i++) vars.refuse(classFor(`--z:${i}`, [['--z', String(i)]]));
  assert.ok(vars.refused.size <= 256);
});

/* ── mount() trên một DOM giả tối thiểu ─────────────────────────────────────── */

/**
 * Đủ để soát THỨ TỰ mount() làm việc: innerHTML, rồi dấu tạm thành class, rồi mới chèn luật
 * và dọn sổ. Chèn luật sau cùng thì WebKit chỉ dựng lại resolver một lần cho mỗi lượt vẽ, xem
 * khối đầu mục ở lib/dom.js. Không phải một bộ phân tích HTML: phần tử con chỉ được đọc bằng
 * một biểu thức chính quy.
 *
 * `refuse` là một hàm nhận văn bản luật, trả true để giả lập `insertRule` ném lỗi.
 */
function fakeDocument({ refuse = () => false } = {}) {
  const log = [];
  class Sheet {
    cssRules = [];
    insertRule(rule, at) {
      if (refuse(rule)) {
        log.push(['refused', rule]);
        throw new SyntaxError(rule);
      }
      log.push(['insert', rule]);
      this.cssRules.splice(at, 0, { selectorText: rule.slice(0, rule.indexOf('{')) });
    }
    deleteRule(at) {
      log.push(['delete', this.cssRules[at].selectorText]);
      this.cssRules.splice(at, 1);
    }
  }
  const classes = (list, onAdd = () => {}) => {
    const set = new Set(list);
    const add = set.add.bind(set);
    set.add = (c) => {
      onAdd(c);
      return add(c);
    };
    set.remove = set.delete;
    return set;
  };
  const roots = [];
  const doc = {
    log,
    defaultView: { CSSStyleSheet: Sheet },
    adoptedStyleSheets: [],
    querySelectorAll: () => roots.filter((r) => r.isConnected).flatMap((r) => [r, ...r.kids]).filter((n) => [...n.classList].some((c) => c.startsWith('nv-'))),
    element({ connected = true } = {}) {
      const style = {
        setProperty: (k, v) => log.push(['setProperty', k, v]),
        removeProperty: (k) => log.push(['removeProperty', k]),
      };
      const el = { ownerDocument: doc, isConnected: connected, kids: [], html: '', classList: classes([]), style };
      el.classList = classes([], (c) => log.push(['class', c]));
      Object.defineProperty(el, 'innerHTML', {
        get: () => el.html,
        set(v) {
          el.html = v;
          log.push(['innerHTML', v]);
          el.kids = [...v.matchAll(/<\w+([^>]*)>/g)].map((m) => {
            const attrs = new Map([...m[1].matchAll(/([\w-]+)="([^"]*)"/g)].map((a) => [a[1], a[2]]));
            return {
              attrs,
              classList: classes((attrs.get('class') ?? '').split(/\s+/).filter(Boolean), (c) => log.push(['class', c])),
              getAttribute: (k) => attrs.get(k),
              removeAttribute: (k) => attrs.delete(k),
            };
          });
        },
      });
      el.querySelectorAll = () => el.kids.filter((k) => k.attrs.has('data-nv'));
      roots.push(el);
      return el;
    },
  };
  return doc;
}

test('mount: innerHTML và class TRƯỚC, luật mới SAU', () => {
  const doc = fakeDocument();
  const el = doc.element();
  mount(el, html`<div class="q" style="--c:${'red'};width:3px"></div><i style="--c:red"></i><b style="width:2px"></b>`);
  assert.deepEqual(
    doc.log.map(([k]) => k),
    ['innerHTML', 'class', 'class', 'insert', 'insert'],
    'chèn luật trước innerHTML thì WebKit dựng resolver hai lần cho một lượt vẽ',
  );
  assert.deepEqual(doc.log.slice(-2), [
    ['insert', '.nv-1{--c:red !important;width:3px !important}'],
    ['insert', '.nv-2{--c:red !important}'],
  ]);
  assert.deepEqual([...el.kids[0].classList], ['q', 'nv-1']);
  assert.equal(el.kids[0].attrs.has('style'), false, 'phần tử có biến không được giữ khai báo nội tuyến nào');
  assert.equal(el.kids[2].attrs.get('style'), 'width:2px', 'thuộc tính không có biến ở lại nguyên văn');
  assert.ok(el.kids.every((k) => !k.attrs.has('data-nv')), 'không phần tử nào còn giữ dấu tạm');

  doc.log.length = 0;
  mount(el, html`<i style="--c:red"></i>`);
  assert.deepEqual(doc.log.map(([k]) => k), ['innerHTML', 'class'], 'vẽ lại bộ khai báo cũ thì không chèn gì');
});

test('mount: --now mới mỗi lượt thì sheet dọn khi vượt trần, luật đang dùng còn nguyên', () => {
  const doc = fakeDocument();
  const el = doc.element();
  for (let i = 0; i < 1200; i++) mount(el, html`<div class="shop" style="--now:${i}"><i style="--x:1px"></i></div>`);
  const sheet = doc.adoptedStyleSheets[0];
  assert.ok(sheet.cssRules.length <= 513, `sheet còn ${sheet.cssRules.length} luật`);
  const liveNow = [...el.kids[0].classList].find((c) => c.startsWith('nv-'));
  const liveX = [...el.kids[1].classList].find((c) => c.startsWith('nv-'));
  const selectors = sheet.cssRules.map((r) => r.selectorText);
  assert.ok(selectors.includes(`.${liveNow}`) && selectors.includes(`.${liveX}`), 'dọn sổ đã xoá luật của lượt vẽ hiện tại');
});

test('mount: luật bị từ chối thì viết lại, bộ biến ấy ở lại nội tuyến', () => {
  const doc = fakeDocument({ refuse: (rule) => rule.includes('--bad') });
  const el = doc.element();
  mount(el, html`<i style="--bad:1;width:2px"></i><b style="--ok:1"></b>`);
  assert.equal(el.innerHTML, '<i style="--bad:1;width:2px"></i><b data-nv="nv-2"></b>', 'bộ bị từ chối ở lại nội tuyến trọn vẹn');
  assert.equal(el.kids[0].attrs.get('style'), '--bad:1;width:2px');
  assert.deepEqual([...el.kids[1].classList], ['nv-2']);
  assert.deepEqual(doc.adoptedStyleSheets[0].cssRules.map((r) => r.selectorText), ['.nv-2']);
  doc.log.length = 0;
  mount(el, html`<i style="--bad:1;width:2px"></i><b style="--ok:1"></b>`);
  assert.deepEqual(doc.log.map(([k]) => k), ['innerHTML', 'class'], 'lượt sau không thử lại luật đã bị từ chối');
});

test('mount: phần tử chưa nằm trong document thì gán nguyên văn, không dời biến', () => {
  // Dọn sổ chỉ đếm class trong document: dời biến cho một cây tách rời là để luật của nó bị
  // xoá trước lúc cây được gắn vào.
  const doc = fakeDocument();
  const loose = doc.element({ connected: false });
  mount(loose, html`<i style="--c:red"></i>`);
  assert.equal(loose.innerHTML, '<i style="--c:red"></i>');
  assert.deepEqual(doc.log.map(([k]) => k), ['innerHTML']);
});

test('mount/unchanged: không có document thì gán nguyên văn, và nhớ chuỗi nguồn', () => {
  const el = { ownerDocument: null, isConnected: true, innerHTML: '' };
  const tpl = html`<i style="--x:1"></i>`;
  mount(el, tpl);
  assert.equal(el.innerHTML, '<i style="--x:1"></i>');
  assert.equal(unchanged(el, html`<i style="--x:1"></i>`), true);
  assert.equal(unchanged(el, html`<i style="--x:2"></i>`), false);
  assert.equal(unchanged({}, tpl), false, 'phần tử chưa từng mount thì không bao giờ "y hệt"');
});

/* ── Giá trị pha ────────────────────────────────────────────────────────────── */

test('mount/unchanged: giá trị pha không được so, và DOM không bao giờ thấy dấu bọc', () => {
  const el = { ownerDocument: null, isConnected: true, innerHTML: '' };
  mount(el, html`<div style="--now:${phase(12)};width:1px">x</div>`);
  assert.equal(el.innerHTML, '<div style="--now:12;width:1px">x</div>');
  assert.equal(unchanged(el, html`<div style="--now:${phase(987654)};width:1px">x</div>`), true, 'chỉ khác pha thì coi như y hệt');
  assert.equal(unchanged(el, html`<div style="--now:${phase(12)};width:2px">x</div>`), false, 'khác chỗ khác thì vẫn phải dựng lại');
  assert.equal(unchanged(el, html`<div style="--now:987654;width:1px">x</div>`), false, 'con số không bọc thì vẫn được so');

  // Qua sổ class: luật chèn vào sheet mang con số trần, không mang dấu bọc.
  const doc = fakeDocument();
  const live = doc.element();
  mount(live, html`<div class="shop" style="--now:${phase(34)}"></div>`);
  assert.deepEqual(doc.log.at(-1), ['insert', '.nv-1{--now:34 !important}']);
  assert.ok(!doc.log.some((e) => /[\uE000\uE001]/.test(e.join(' '))), 'dấu bọc lọt vào DOM hay sheet');
});

test('esc/mount/unchanged: U+E000, U+E001 trong nội dung là chữ, không phải dấu bọc pha', () => {
  // Nerd Fonts đặt biểu tượng Pomicons ở U+E000–E00A, nên tên dự án hay tiêu đề phiên mang được
  // đúng hai ký tự dùng làm dấu bọc.
  const g0 = '';
  const g1 = '';
  assert.equal(esc(`${g0}a${g1}`), '&#xE000;a&#xE001;');
  assert.equal(rawText(phase('<')), `${g0}&lt;${g1}`, 'phase() vẫn escape giá trị của nó');

  const el = { ownerDocument: null, isConnected: true, innerHTML: '' };
  const title = (s) => html`<h3>${s}</h3>`;
  mount(el, title(`${g0} Deploy plan v1 ${g1}`));
  assert.equal(el.innerHTML, '<h3>&#xE000; Deploy plan v1 &#xE001;</h3>', 'ký tự phải tới được DOM');
  assert.equal(unchanged(el, title(`${g0} Deploy plan v2 ${g1}`)), false, 'sửa chữ nằm giữa hai ký tự ấy vẫn phải dựng lại');

  // Hai ký tự ở hai phần tử xa nhau, và giữa chúng có một giá trị pha thật.
  const page = (name, now = 5) => html`<p>${g0}x</p><div style="--now:${phase(now)}">${name}</div><p>y${g1}</p>`;
  mount(el, page('a'));
  assert.equal(el.innerHTML, '<p>&#xE000;x</p><div style="--now:5">a</div><p>y&#xE001;</p>');
  assert.equal(unchanged(el, page('b')), false, 'nội dung đổi giữa hai ký tự thì không được coi là chỉ khác pha');
  assert.equal(unchanged(el, page('a', 99)), true, 'giá trị pha thật vẫn được bỏ qua');

  // Trong thuộc tính style, thực thể ấy là thực thể lạ với bộ tách: cả thuộc tính ở lại nội tuyến.
  assert.equal(declsOf(esc(`--a:${g0};--b:1`)), null);
});

test('màn thị trấn: hai lượt vẽ chỉ khác đồng hồ tường thì mount() bỏ qua lượt sau', async () => {
  const { lifeClock } = await mod('lib/pet.js');
  const { butlerArt } = await mod('lib/town.js');
  const at = (ms, fn) => {
    const real = Date.now;
    Date.now = () => ms;
    try {
      return fn();
    } finally {
      Date.now = real;
    }
  };
  const { whereOf } = await mod('lib/petmath.js');
  // Quản gia ở bàn (hai khung gõ máy), đi lại trong công viên và ra phố đều mang độ trễ âm theo
  // đồng hồ; `--now` của lifeClock thì mọi màn khoá pha đều mang.
  const walk = { kind: 'move', id: 'walk' };
  const draws = [
    (ms) => html`<div style="${lifeClock()}">${butlerArt(null, 'home', ms)}</div>`,
    (ms) => html`<i>${butlerArt(walk, whereOf(walk), ms)}</i>`,
    (ms) => html`<i>${butlerArt({ id: 'eyes' }, 'street', ms)}</i>`,
  ];
  for (const draw of draws) {
    const a = at(1_000, () => draw(1_000));
    const b = at(2_345_678, () => draw(2_345_678));
    const plain = (tpl) => rawText(tpl).replace(/[\uE000\uE001]/g, '');
    assert.ok(/animation-delay/.test(plain(a)) && plain(a) !== plain(b), `hai lượt phải khác nhau thật, không thì phép thử rỗng: ${plain(a).slice(0, 120)}`);
    const el = { ownerDocument: null, isConnected: true, innerHTML: '' };
    mount(el, a);
    assert.ok(unchanged(el, b), `lượt vẽ chỉ khác đồng hồ mà vẫn dựng lại: ${plain(b).slice(0, 160)}`);
  }
});

test('mọi Date.now() đổ vào một thuộc tính style đều được bọc bằng phase()', () => {
  const hits = [];
  let seen = 0;
  for (const { rel, code } of SOURCES) {
    if (rel === 'lib/dom.js') continue;
    for (const m of code.matchAll(/\sstyle="/g)) {
      for (let i = m.index + m[0].length; i < code.length && code[i] !== '"'; i++) {
        if (!(code[i] === '$' && code[i + 1] === '{')) continue;
        const end = exprEnd(code, i + 2);
        const expr = code.slice(i + 2, end).trim();
        if (/Date\.now\(\)/.test(expr)) {
          seen++;
          if (!/^phase\(/.test(expr)) hits.push(`${rel}:${code.slice(0, m.index).split('\n').length} \${${expr.slice(0, 60)}}`);
        }
        i = end;
      }
    }
  }
  assert.deepEqual(hits, [], 'giá trị theo đồng hồ tường trong style mà không bọc phase(): màn ấy dựng lại ở mọi lượt vẽ');
  assert.ok(seen >= 3, `chỉ thấy ${seen} chỗ Date.now() trong style — phép quét có vẻ đã hụt`);
  const clock = SOURCES.find((x) => x.rel === 'lib/pet.js').code.match(/export const lifeClock = [^\n]*/)?.[0] ?? '';
  assert.match(clock, /phase\(Date\.now\(\)/, 'lifeClock phải bọc con số bằng phase()');
});

/* ── Thẻ table dùng lại ─────────────────────────────────────────────────────── */

/**
 * Cây DOM giả đủ cho `keepTables`: thuộc tính, con, replaceWith, replaceChildren, và một bộ đọc
 * HTML chỉ hiểu thẻ mở, thẻ đóng và chữ (không thực thể, không thẻ rỗng).
 */
function fakeTree() {
  class El {
    constructor(tag, attrs = new Map()) {
      this.tag = tag;
      this.attrs = attrs;
      this.childNodes = [];
      this.parent = null;
    }
    get attributes() {
      return [...this.attrs].map(([name, value]) => ({ name, value }));
    }
    hasAttribute(n) {
      return this.attrs.has(n);
    }
    getAttribute(n) {
      return this.attrs.get(n) ?? null;
    }
    setAttribute(n, v) {
      this.attrs.set(n, String(v));
    }
    removeAttribute(n) {
      this.attrs.delete(n);
    }
    get isConnected() {
      let e = this;
      while (e.parent) e = e.parent;
      return e.root === true;
    }
    contains(o) {
      for (let e = o; e; e = e.parent) if (e === this) return true;
      return false;
    }
    remove() {
      if (!this.parent) return;
      this.parent.childNodes.splice(this.parent.childNodes.indexOf(this), 1);
      this.parent = null;
    }
    append(...kids) {
      for (const k of kids) {
        k.remove();
        k.parent = this;
        this.childNodes.push(k);
      }
    }
    replaceChildren(...kids) {
      for (const k of [...this.childNodes]) k.remove();
      this.append(...kids);
    }
    replaceWith(o) {
      const p = this.parent;
      const at = p.childNodes.indexOf(this);
      o.remove();
      this.remove();
      p.childNodes.splice(at, 0, o);
      o.parent = p;
    }
    getElementsByTagName(t) {
      const out = [];
      const walk = (e) => {
        for (const k of e.childNodes) {
          if (k.tag === t) out.push(k);
          walk(k);
        }
      };
      walk(this);
      return out;
    }
    querySelectorAll() {
      return [];
    }
    set innerHTML(markup) {
      this.replaceChildren();
      let at = this;
      for (const m of markup.matchAll(/<(\/?)([a-z]+)([^>]*)>|([^<]+)/g)) {
        if (m[4]) at.append(Object.assign(new El('#text'), { text: m[4] }));
        else if (m[1]) at = at.parent;
        else {
          const kid = new El(m[2], new Map([...m[3].matchAll(/([\w-]+)="([^"]*)"/g)].map((a) => [a[1], a[2]])));
          at.append(kid);
          at = kid;
        }
      }
    }
    get text() {
      return this._text ?? this.childNodes.map((k) => k.text).join('');
    }
    set text(v) {
      this._text = v;
    }
  }
  const root = new El('#document');
  root.root = true;
  const el = new El('div');
  root.append(el);
  el.ownerDocument = null;
  return { root, el, El };
}

test('mount: thẻ table của lượt trước được dùng lại, thuộc tính và con theo lượt mới', () => {
  const { root, el } = fakeTree();
  const tables = () => el.getElementsByTagName('table');
  mount(el, html`<table class="tbl"><tr><td>a</td></tr></table><p>x</p><table data-k="q"><tr><th>b</th></tr></table>`);
  const [t1, t2] = tables();

  mount(el, html`<div><table class="tbl ch-tbl" id="z"><tr><td>c</td></tr></table></div>`);
  assert.equal(tables().length, 1);
  assert.equal(tables()[0], t1, 'bảng đầu phải là đối tượng table của lượt trước');
  assert.deepEqual([...t1.attrs], [['class', 'tbl ch-tbl'], ['id', 'z']], 'thuộc tính theo đúng lượt mới');
  assert.equal(t1.text, 'c');
  assert.equal(t1.parent.tag, 'div', 'bảng đứng đúng chỗ của bảng mới');
  assert.equal(t2.isConnected, false);
  assert.equal(t2.childNodes.length, 0, 'bảng dư buông cây con cũ');

  mount(el, html`<table><tr><td>d</td></tr></table><table><tr><td>e</td></tr></table><table><tr><td>f</td></tr></table>`);
  const now = tables();
  assert.deepEqual([now[0] === t1, now[1] === t2], [true, true], 'bảng nằm chờ trong sổ được dùng lại khi màn có nhiều bảng hơn');
  assert.deepEqual([...t1.attrs], [], 'thuộc tính cũ không còn ở lượt mới thì bị gỡ');
  assert.deepEqual(now.map((t) => t.text), ['d', 'e', 'f']);
  const t3 = now[2];

  // Ai đó đã dời một bảng cũ ra chỗ khác trong document: không lấy nó về nữa.
  root.append(t3);
  mount(el, html`<table><tr><td>g</td></tr></table><table><tr><td>h</td></tr></table><table><tr><td>i</td></tr></table>`);
  assert.notEqual(tables()[2], t3);
  assert.equal(t3.parent, root);
  assert.deepEqual(tables().map((t) => t.text), ['g', 'h', 'i']);
});

test('setVars: đổi class thay vì setProperty, và lùi về setProperty khi giá trị không dời được', () => {
  const doc = fakeDocument();
  const el = doc.element();
  setVars(el, { '--town-k': 0.5 });
  const first = [...el.classList][0];
  assert.match(first, /^nv-\d+$/);
  assert.deepEqual(doc.log.map(([k]) => k), ['class', 'insert'], 'gắn class trước, chèn luật sau, cùng lý do như mount()');
  doc.log.length = 0;
  setVars(el, { '--town-k': 0.5 });
  assert.deepEqual(doc.log, [], 'cùng giá trị thì không đụng gì');
  setVars(el, { '--town-k': 0.75 });
  assert.equal(el.classList.size, 1);
  assert.notEqual([...el.classList][0], first, 'class cũ phải được tháo');
  setVars(el, { '--town-k': '{x}' });
  assert.equal(el.classList.size, 0, 'lùi về nội tuyến thì class !important cũ không được ở lại');
  assert.deepEqual(doc.log.at(-1), ['setProperty', '--town-k', '{x}']);
});

test('setVars: cùng luật với mount() — khai báo thường đi cùng biến vào class, bộ không có biến thì nội tuyến', () => {
  const doc = fakeDocument();
  const el = doc.element();
  setVars(el, { '--k': 1, width: '3px' });
  assert.deepEqual(doc.log.map(([k]) => k), ['class', 'insert']);
  assert.equal(doc.log.at(-1)[1], `.${[...el.classList][0]}{--k:1 !important;width:3px !important}`);

  doc.log.length = 0;
  setVars(el, { width: '3px' });
  assert.equal(el.classList.size, 0);
  assert.deepEqual(doc.log.at(-1), ['setProperty', 'width', '3px'], 'không có biến nào thì không có lý do dời');

  // Một khai báo không chép được là cả bộ nội tuyến, và một dấu ; trong giá trị không được tách
  // nó thành hai khai báo.
  for (const bad of [{ '--k': 2, width: '1px !important' }, { '--k': '1;width:9px' }, { '--k': 'a&amp;b' }]) {
    doc.log.length = 0;
    setVars(el, bad);
    assert.equal(el.classList.size, 0, JSON.stringify(bad));
    assert.ok(!doc.log.some(([k]) => k === 'insert'), JSON.stringify(bad));
  }
});

test('setVars: về lại class thì gỡ các thuộc tính nội tuyến mà lần lùi trước đã đặt', () => {
  const doc = fakeDocument();
  const el = doc.element();
  setVars(el, { '--k': '{x}', width: '1px' });
  assert.deepEqual(doc.log.map(([k]) => k), ['setProperty', 'setProperty']);
  doc.log.length = 0;
  setVars(el, { '--k': 2 });
  assert.deepEqual(doc.log.map(([k, v]) => `${k} ${v}`), ['class nv-1', 'insert .nv-1{--k:2 !important}', 'removeProperty --k', 'removeProperty width']);
  doc.log.length = 0;
  setVars(el, { '--j': '{y}' });
  assert.deepEqual(doc.log.map(([k]) => k), ['setProperty'], 'lùi lần nữa: class đã tháo, không còn gì nội tuyến cũ để gỡ');
  assert.equal(el.classList.size, 0);
});

test('setVars: luật bị từ chối hay phần tử tách rời thì lùi về setProperty, không để class treo', () => {
  const doc = fakeDocument({ refuse: (rule) => rule.includes('9') });
  const el = doc.element();
  setVars(el, { '--k': 1 });
  setVars(el, { '--k': 9 });
  assert.equal(el.classList.size, 0);
  assert.deepEqual(doc.log.at(-1), ['setProperty', '--k', '9']);

  const loose = doc.element({ connected: false });
  doc.log.length = 0;
  setVars(loose, { '--k': 1 });
  assert.deepEqual(doc.log, [['setProperty', '--k', '1']]);
});

/* ── Lưới quét mã nguồn ─────────────────────────────────────────────────────── */

function filesIn(dir, ext = /\.(js|html)$/) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...filesIn(p, ext));
    else if (ext.test(e.name)) out.push(p);
  }
  return out;
}

/** Thay chú thích bằng khoảng trắng cùng độ dài, để phép quét không vấp vào những câu GIẢI THÍCH
 *  innerHTML mà số dòng vẫn đúng. Thô nhưng đủ: chỉ xoá khối chú thích, dòng chú thích trọn
 *  dòng, và chú thích HTML. */
const blank = (m) => m.replace(/[^\n]/g, ' ');
const stripComments = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/^\s*\/\/.*$/gm, blank);

const SOURCES = filesIn(ROOT).map((f) => ({ rel: path.relative(ROOT, f), code: stripComments(fs.readFileSync(f, 'utf8')) }));

test('lưới quét thấy đủ mã client', () => {
  const rels = SOURCES.map((s) => s.rel);
  for (const want of ['app.js', 'menubar.js', 'index.html', 'menubar.html', 'lib/dom.js', 'views/bench.js', 'views/pet.js']) {
    assert.ok(rels.includes(want), `phép quét không thấy ${want}`);
  }
});

/**
 * Chỗ được phép ghi HTML thẳng vào DOM. Mỗi mục phải nói vì sao.
 *
 * lib/dom.js là mount(), cửa ghi duy nhất, và nó được ghi đúng MỘT lần: một lần gán thứ hai
 * trong cùng file là một đường vòng mà danh sách này không được phép che đi.
 */
const HTML_WRITERS = { 'lib/dom.js': 1 };

test('mọi lần ghi HTML đi qua mount()', () => {
  const pattern = /\.(?:innerHTML|outerHTML)\s*=(?!=)|\.insertAdjacentHTML\s*\(|document\.write(?:ln)?\s*\(|createContextualFragment\s*\(|setHTMLUnsafe\s*\(|parseHTMLUnsafe\s*\(|new\s+DOMParser\b/g;
  const hits = [];
  for (const { rel, code } of SOURCES) {
    const n = [...code.matchAll(pattern)].length;
    if (n !== (HTML_WRITERS[rel] ?? 0)) hits.push(`${rel} (${n} chỗ)`);
  }
  assert.deepEqual(hits, [], `ghi HTML ngoài mount(): ${hits.join(', ')} — dùng mount() từ lib/dom.js`);
});

test('không ai đặt biến CSS bằng CSSOM ngoài setVars', () => {
  const hits = [];
  for (const { rel, code } of SOURCES) {
    if (rel === 'lib/dom.js') continue;
    const bad = [
      /\.setProperty\s*\(/g,
      /\.style\s*\[\s*['"`]--/g,
      /setAttribute\s*\(\s*['"`]style['"`]/g,
      /\.cssText\s*=[^;\n]*--/g,
    ].flatMap((re) => [...code.matchAll(re)]);
    if (bad.length) hits.push(`${rel}: ${bad.map((m) => m[0]).join(' | ')}`);
  }
  assert.deepEqual(hits, [], `đặt style ngoài mount()/setVars: ${hits.join('; ')}`);
});

/**
 * WebKit chỉ bỏ khối khai báo chung cho ô bảng khi border, frame, rules hay cellpadding của thẻ
 * table đổi giá trị (`HTMLTableElement::attributeChanged`). Mẫu HTML không dùng bốn thuộc tính
 * ấy, nên thẻ table mà mount() dùng lại giữ nguyên khối chung qua mọi lượt vẽ.
 */
test('không thẻ table nào mang border, frame, rules hay cellpadding', () => {
  const bad = /<table\b[^>]*\s(?:border|frame|rules|cellpadding)\s*=/gi;
  const hits = [];
  for (const { rel, code } of SOURCES) for (const m of code.matchAll(bad)) hits.push(`${rel}: ${m[0].slice(0, 60)}`);
  for (const [label, s] of PAINTED) for (const m of s.matchAll(bad)) hits.push(`${label}: ${m[0].slice(0, 60)}`);
  assert.deepEqual(hits, [], 'đổi giá trị bốn thuộc tính này là mỗi lượt vẽ một khối chung mới, xem khối "Thẻ table dùng lại" ở lib/dom.js');
  assert.ok(PAINTED.some(([, s]) => s.includes('<table')), 'fixture không vẽ bảng nào, phép quét có vẻ đã hụt');
});

/**
 * Chỗ được phép chạm `element.style`. Đọc `el.style` một lần là WebKit đổi style nội tuyến của phần
 * tử sang dạng sửa được, và `MatchResult` có style nội tuyến sửa được thì không vào cache. Nếu
 * phần tử ấy khai biến thì mỗi lần tính lại nó mang bộ biến mới và con cháu nhận mục vĩnh viễn
 * (đo trên WebKit: 24,6 MB mỗi 100 lượt vẽ màn thị trấn khi đọc `style` của `.pet-art`). Mỗi mục
 * nói vì sao chỗ ấy an toàn; số đếm không kể `tag.style` trong bộ đọc thẻ của lib/dom.js, vốn là
 * một object thường.
 */
const STYLE_TOUCH = {
  'app.js': [3, 'tooltip #tip và ô màu trong nó nằm ngoài #view và không khai biến'],
  'lib/dom.js': [3, 'setVars lùi về nội tuyến (hai chỗ), và textarea tạm của legacyCopy'],
};

test('chỉ những chỗ đã xét mới chạm element.style', () => {
  const hits = [];
  for (const { rel, code } of SOURCES) {
    const n = [...code.matchAll(/(?<!\btag)\.style\b/g)].length;
    if (n !== (STYLE_TOUCH[rel]?.[0] ?? 0)) hits.push(`${rel} (${n} chỗ)`);
  }
  assert.deepEqual(hits, [], `chạm element.style ngoài danh sách: ${hits.join(', ')} — dùng setVars hay class, hoặc xét tay rồi ghi vào STYLE_TOUCH`);
});

/* ── `!important` của luật dời so với hoạt hình và luật có sẵn ─────────────────

   Luật dời thêm `!important` vào MỌI khai báo để giả lập thứ bậc của style nội tuyến. Hai chỗ
   nó KHÔNG giả lập được: hoạt hình CSS (thua style nội tuyến thường, nhưng thắng `!important`
   thì không), và một luật `!important` có sẵn trong CSS (thắng style nội tuyến thường, nhưng
   thua hay thắng luật dời tuỳ độ đặc hiệu). Các test dưới đây canh để hai chỗ ấy không bao
   giờ gặp một khai báo đã dời. */

/** Mọi CSS trang nạp: file .css trong public/ và khối style viết thẳng trong HTML, đã bỏ chú thích. */
const CSS = [
  ...filesIn(ROOT, /\.css$/).map((f) => fs.readFileSync(f, 'utf8')),
  ...SOURCES.filter((s) => s.rel.endsWith('.html')).flatMap((s) => [...s.code.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1])),
]
  .join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, '');

function keyframeBlocks(css) {
  const out = [];
  for (const m of css.matchAll(/@(?:-webkit-)?keyframes\s+([\w-]+)\s*\{/g)) {
    let depth = 1;
    let i = m.index + m[0].length;
    while (i < css.length && depth) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') depth--;
      i++;
    }
    out.push({ name: m[1], body: css.slice(m.index + m[0].length, i - 1) });
  }
  return out;
}

const declaredIn = (body) => [...body.matchAll(/(?:^|[{;\s])(-{0,2}[a-zA-Z][\w-]*)\s*:(?!:)/g)].map((m) => m[1]);

/** Thuộc tính thường → tên các @keyframes đổi nó. */
function animatedProps(css) {
  const out = new Map();
  for (const { name, body } of keyframeBlocks(css)) {
    for (const prop of declaredIn(body)) {
      if (isVar(prop)) continue;
      const key = prop.toLowerCase();
      if (!out.has(key)) out.set(key, new Set());
      out.get(key).add(name);
    }
  }
  return out;
}

/** Thuộc tính thường mà một luật nào đó khai `!important`. */
const importantProps = (css) => new Set([...css.matchAll(/(?:^|[{;\s])(-?[a-zA-Z][\w-]*)\s*:[^;{}]*!\s*important/g)].map((m) => m[1].toLowerCase()));

/**
 * Hai tên thuộc tính có đổ vào cùng một giá trị tính ra không: cùng tên, một cái là dạng viết
 * gộp của cái kia (`inset` với `top`, `animation` với `animation-delay`, `border-color` với
 * `border-top-color`), hay hai tên của cùng một thứ (`width` với `inline-size`).
 *
 * Lệch về phía nhận nhầm, vì nhận nhầm chỉ làm test đỏ và buộc người sửa xét tay. `transform`
 * đi chung nhóm với `translate`, `rotate`, `scale` dù CSS coi chúng là bốn thuộc tính riêng: cả
 * bốn cùng dời một hình, và một hoạt hình trên cái này đi cạnh một giá trị bị khoá trên cái kia
 * là chỗ đáng xét tay.
 */
const LINKED = [
  ['top', 'right', 'bottom', 'left', 'inset'],
  ['width', 'inline-size'],
  ['height', 'block-size'],
  ['min-width', 'min-inline-size'],
  ['min-height', 'min-block-size'],
  ['max-width', 'max-inline-size'],
  ['max-height', 'max-block-size'],
  ['transform', 'translate', 'rotate', 'scale'],
  ['gap', 'row-gap', 'column-gap', 'grid-gap'],
  ['font', 'line-height'],
  ['grid-area', 'grid-row', 'grid-column'],
  ['flex-flow', 'flex-direction', 'flex-wrap'],
  ['place-items', 'align-items', 'justify-items'],
  ['place-content', 'align-content', 'justify-content'],
  ['place-self', 'align-self', 'justify-self'],
];

function linkedGroup(name) {
  const parts = name.split('-');
  for (let n = parts.length; n > 0; n--) {
    const g = LINKED.findIndex((group) => group.includes(parts.slice(0, n).join('-')));
    if (g >= 0) return g;
  }
  return -1;
}

function related(a, b) {
  const bare = (s) => s.toLowerCase().replace(/^-(?:webkit|moz|ms|o)-/, '');
  const [x, y] = [bare(a), bare(b)];
  if (x === y) return true;
  const [tx, ty] = [x.split('-'), y.split('-')];
  if (tx[0] === ty[0] && (tx.every((t) => ty.includes(t)) || ty.every((t) => tx.includes(t)))) return true;
  const g = linkedGroup(x);
  return g >= 0 && g === linkedGroup(y);
}

test('related: dạng gộp, tên logic và nhóm biến hình cùng một họ; thuộc tính riêng thì không', () => {
  const yes = [
    ['height', 'height'],
    ['left', 'inset'],
    ['top', 'inset-block-start'],
    ['width', 'inline-size'],
    ['animation', 'animation-delay'],
    ['border-color', 'border-top-color'],
    ['background', 'background-position'],
    ['transform', 'translate'],
    ['grid-row-start', 'grid-area'],
    ['-webkit-mask', 'mask-image'],
    ['Z-Index', 'z-index'],
  ];
  const no = [
    ['animation-delay', 'animation-duration'],
    ['width', 'min-width'],
    ['width', 'height'],
    ['height', 'line-height'],
    ['min-width', 'min-height'],
    ['z-index', 'opacity'],
    ['bottom', 'border-bottom'],
    ['transition-duration', 'animation-duration'],
  ];
  for (const [a, b] of yes) assert.ok(related(a, b) && related(b, a), `${a} ~ ${b}`);
  for (const [a, b] of no) assert.ok(!related(a, b) && !related(b, a), `${a} ≁ ${b}`);
});

/* Đọc thuộc tính style trong mã nguồn. Giá trị viết bằng `${…}` được đoán theo ba cách: một tên
   biến đứng ở chỗ tên khai báo thì tìm `const tên = \`…\`` trong cùng file, một lời gọi không đối
   số thì tìm `const tên = () => \`…\`` ở mọi file, còn chuỗi viết thẳng trong biểu thức (nhánh
   `? \`;--c:…\` : ''`) thì được đọc như văn bản. Biểu thức ở chỗ tên khai báo mà không đoán ra
   chữ nào thì chỗ ấy bị đánh dấu, và test buộc nó phải được xét tay. */

function quotedEnd(code, i) {
  const q = code[i];
  for (i++; i < code.length && code[i] !== q; i++) if (code[i] === '\\') i++;
  return i + 1;
}

function templateEnd(code, i) {
  while (i < code.length) {
    if (code[i] === '\\') i += 2;
    else if (code[i] === '`') return i + 1;
    else if (code[i] === '$' && code[i + 1] === '{') i = exprEnd(code, i + 2) + 1;
    else i++;
  }
  return i;
}

function exprEnd(code, i) {
  let depth = 0;
  while (i < code.length) {
    const c = code[i];
    if (c === '`') i = templateEnd(code, i + 1);
    else if (c === '"' || c === "'") i = quotedEnd(code, i);
    else {
      if (c === '{') depth++;
      else if (c === '}' && !depth--) return i;
      i++;
    }
  }
  return i;
}

/**
 * Chỗ một `${…}` mà phép quét không đọc ra chữ. Ở vị trí giá trị, nó có thể là `var(--x)`, trừ khi
 * ngay sau nó là chữ cái hay `%`: `${w}px` hay `${h}%` chỉ có thể là một con số.
 */
const OPAQUE = '\u0001';
const opaqueValue = (text) => /\u0001(?![A-Za-z%])/.test(text);

/** Thân một template literal, mỗi `${…}` thay bằng `OPAQUE`. */
function flatTemplate(body) {
  let out = '';
  for (let i = 0; i < body.length; ) {
    if (body[i] === '$' && body[i + 1] === '{') {
      i = exprEnd(body, i + 2) + 1;
      out += OPAQUE;
    } else out += body[i++];
  }
  return out;
}

function literalsIn(expr) {
  const out = [];
  for (let i = 0; i < expr.length; ) {
    if (expr[i] === '`') {
      const end = templateEnd(expr, i + 1);
      out.push(flatTemplate(expr.slice(i + 1, end - 1)));
      i = end;
    } else if (expr[i] === '"' || expr[i] === "'") {
      const end = quotedEnd(expr, i);
      out.push(expr.slice(i + 1, end - 1));
      i = end;
    } else i++;
  }
  return out;
}

function definitions(name, code, call) {
  const head = new RegExp(`(?:const|let|var)\\s+${name.replace(/\$/g, '\\$')}\\s*=\\s*${call ? '\\(\\s*\\)\\s*=>\\s*' : ''}`, 'g');
  const out = [];
  for (const m of code.matchAll(head)) {
    // `html` đứng trước backtick vẫn là cùng một chuỗi: `lifeClock` trả template `html` vì
    // `phase()` là giá trị `raw`.
    let i = m.index + m[0].length;
    if (code.startsWith('html`', i)) i += 4;
    if (code[i] === '`') out.push(flatTemplate(code.slice(i + 1, templateEnd(code, i + 1) - 1)));
    else if (code[i] === '"' || code[i] === "'") out.push(code.slice(i + 1, quotedEnd(code, i) - 1));
  }
  return out;
}

/**
 * Mọi thuộc tính style="…" viết trong một file nguồn, cùng mọi lần gọi setVars với object viết
 * thẳng. Trả `{ where, cls, names, unresolved, reads }`, với `names` là tên khai báo đọc được, và
 * `reads` là `'var'` khi chữ viết thẳng có `var(`/`env(`, `'maybe'` khi có một giá trị không đoán
 * được (xem `OPAQUE`), `false` khi chắc chắn không đọc biến.
 */
function styleSitesIn(rel, code, sources) {
  const out = [];
  const line = (at) => code.slice(0, at).split('\n').length;
  for (const m of code.matchAll(/\sstyle="/g)) {
    const head = code.slice(code.lastIndexOf('<', m.index), m.index);
    let text = '';
    let unresolved = false;
    let i = m.index + m[0].length;
    while (i < code.length && code[i] !== '"') {
      if (!(code[i] === '$' && code[i + 1] === '{')) {
        text += code[i++];
        continue;
      }
      const end = exprEnd(code, i + 2);
      const expr = code.slice(i + 2, end).trim();
      let alts = literalsIn(expr);
      const id = expr.match(/^([A-Za-z_$][\w$]*)(\(\s*\))?$/);
      // Ở vị trí tên khai báo, chỗ không đoán được thì đã bị buộc xét tay (UNRESOLVED_OK), và việc
      // xét tay ấy xác nhận luôn nó không đọc biến; ở vị trí giá trị thì nó là `OPAQUE`.
      const atName = /(?:^|;)\s*$/.test(text);
      if (atName) {
        if (id) alts = id[2] ? sources.flatMap((s) => definitions(id[1], s.code, true)) : definitions(id[1], code, false);
        unresolved ||= !alts.length;
      }
      text += alts.length ? `;${alts.join(';')};` : atName ? '0' : OPAQUE;
      i = end + 1;
    }
    const names = text
      .split(';')
      .filter((part) => part.includes(':'))
      .map((part) => part.split(':')[0].trim())
      .filter((n) => /^(?:--|-?[a-zA-Z])[\w-]*$/.test(n));
    const reads = readsVar(text) ? 'var' : opaqueValue(text) ? 'maybe' : false;
    out.push({ where: `${rel}:${line(m.index)}`, cls: head.match(/\sclass="([^"]*)"/)?.[1] ?? '', names, unresolved, reads });
  }
  for (const m of code.matchAll(/\bsetVars\s*\(\s*[^,()]+,\s*\{/g)) {
    const body = code.slice(m.index + m[0].length, exprEnd(code, m.index + m[0].length));
    const names = [...body.matchAll(/(?:^|,)\s*(?:'([^']+)'|"([^"]+)"|([A-Za-z_$][\w$-]*))\s*:/g)].map((k) => k[1] ?? k[2] ?? k[3]);
    out.push({ where: `${rel}:${line(m.index)} setVars`, cls: '', names, unresolved: false, reads: readsVar(body) ? 'var' : 'maybe' });
  }
  return out;
}

test('styleSitesIn: đọc được tên biến, lời gọi, nhánh điều kiện, và đánh dấu chỗ không đoán được', () => {
  const lib = { rel: 'lib.js', code: 'export const clock = () => `--now:${Date.now()}`;\nexport const tagged = () => html`--t:${phase(Date.now())}`;' };
  const code = [
    'const at = `--x:${a}px;z-index:${b}`;',
    'const box = `width:${w}px;height:${h}px`;',
    'html`<i class="a" style="${at};--bw:${w}px"></i>`;',
    'html`<i class="b" style="width:${pct(r.v, max)}%${r.color ? `;--c:${r.color}` : \'\'}"></i>`;',
    'html`<i class="c" style="${box}${clock()}"></i>`;',
    'html`<i class="d" style="${spot};${box}"></i>`;',
    'html`<i class="e" style="color:${ok ? \'red\' : \'blue\'};${r.pos}"></i>`;',
    "setVars(host, { '--k': 1, width: '2px' });",
    'html`<i class="f" style="height:${h}%;top:${y}px"></i>`;',
    'html`<i class="g" style="color:${c};width:2px"></i>`;',
    'html`<i class="h" style="font:10px ${ok ? \'var(--mono)\' : \'serif\'}"></i>`;',
    'html`<i class="i" style="width:1px;${tagged()}"></i>`;',
  ].join('\n');
  const got = styleSitesIn('x.js', code, [lib, { rel: 'x.js', code }]).map(({ where, cls, names, unresolved, reads }) => ({ where, cls, names, unresolved, reads }));
  assert.deepEqual(got, [
    { where: 'x.js:3', cls: 'a', names: ['--x', 'z-index', '--bw'], unresolved: false, reads: 'maybe' },
    { where: 'x.js:4', cls: 'b', names: ['width', '--c'], unresolved: false, reads: 'maybe' },
    { where: 'x.js:5', cls: 'c', names: ['width', 'height', '--now'], unresolved: false, reads: 'maybe' },
    { where: 'x.js:6', cls: 'd', names: ['width', 'height'], unresolved: true, reads: false },
    { where: 'x.js:7', cls: 'e', names: ['color'], unresolved: true, reads: false },
    { where: 'x.js:9', cls: 'f', names: ['height', 'top'], unresolved: false, reads: false },
    { where: 'x.js:10', cls: 'g', names: ['color', 'width'], unresolved: false, reads: 'maybe' },
    { where: 'x.js:11', cls: 'h', names: ['font'], unresolved: false, reads: 'var' },
    { where: 'x.js:12', cls: 'i', names: ['width', '--t'], unresolved: false, reads: 'maybe' },
    { where: 'x.js:8 setVars', cls: '', names: ['--k', 'width'], unresolved: false, reads: 'maybe' },
  ]);
});

/** Thuộc tính style trong chuỗi các màn vẽ từ fixture và trong mã nguồn. */
function hoistSites() {
  const out = [];
  for (const [label, s] of PAINTED) {
    for (const m of s.matchAll(TAG_RE)) {
      const css = m[2].match(/\sstyle="([^"]*)"/)?.[1];
      if (css != null) out.push({ where: label, cls: m[2].match(/\sclass="([^"]*)"/)?.[1] ?? '', names: declNames(css), unresolved: false, reads: readsVar(css) ? 'var' : false });
    }
  }
  for (const { rel, code } of SOURCES) if (rel !== 'lib/dom.js') out.push(...styleSitesIn(rel, code, SOURCES));
  return out;
}

const SITES = hoistSites();
const ANIMATED = animatedProps(CSS);
const IMPORTANT = importantProps(CSS);

/**
 * Chỗ trong mã nguồn có `${…}` đứng ở vị trí tên khai báo mà phép quét không đoán được. Mỗi chỗ đã
 * được đọc tay, và việc đọc tay xác nhận chỗ ấy không khai biến cũng không đọc biến; chỗ mới xuất
 * hiện thì test đỏ để người thêm nó cũng đọc tay.
 */
const UNRESOLVED_OK = [
  { where: /^lib\/pet\.js:/, cls: /\bpet-mark\b/, why: 'markArt tự ghép `at` là left/top, không có biến' },
  { where: /^lib\/town\.js:/, cls: /\bresident\b/, why: '`spot` là một giá trị của SPOT dựng bằng standAt (left/top/width/height), `gait` là animation-delay' },
];

test('lưới quét thuộc tính style: chỗ không đoán được đều đã xét tay', () => {
  const open = SITES.filter((s) => s.unresolved);
  const unknown = open.filter((s) => !UNRESOLVED_OK.some((ok) => ok.where.test(s.where) && ok.cls.test(s.cls)));
  assert.deepEqual(unknown.map((s) => `${s.where} class="${s.cls}"`), [], 'thuộc tính style có ${…} ở chỗ tên khai báo mà phép quét không đọc được');
  for (const ok of UNRESOLVED_OK) {
    assert.ok(open.some((s) => ok.where.test(s.where) && ok.cls.test(s.cls)), `mục xét tay đã cũ, không còn chỗ nào khớp: ${ok.cls}`);
  }
});

/**
 * Chỗ đã xét tay: thuộc tính thường được dời mà CSS có một @keyframes đổi, nhưng hoạt hình ấy
 * không bao giờ chạy trên phần tử này. Một chỗ đụng nhiều @keyframes thì cần một mục cho MỖI cái.
 * `sites` khớp class của thẻ, `where` (nếu có) khớp vị trí.
 *
 * Test bên dưới kiểm lại điều kiện ở mỗi lần chạy, theo một trong hai dạng:
 * - `only`: mọi luật CSS gọi `keyframes` chỉ nhắm vào phần tử mang class `only`, tên hoạt hình
 *   không xuất hiện trong JS hay HTML, và thẻ mang `only` hoặc không có thuộc tính style, hoặc có
 *   một thuộc tính style không bao giờ được dời.
 * - `inline`: không luật CSS nào gọi `keyframes`, và mọi chỗ JS gọi nó nằm trong `animation:` của
 *   một thuộc tính style không bao giờ được dời. Phần tử được dời vì thế không chạy được nó.
 */
const EXCUSED = [
  {
    prop: 'height',
    keyframes: 'mb-blink-lid',
    only: 'mb-lid',
    sites: /\b(?:town-road|pet-art)\b/,
    why: 'mí mắt quản gia ở popover chớp bằng height; đường xá và món đang ăn chỉ khai cỡ hộp của chúng',
  },
  {
    prop: 'background',
    keyframes: 'qb-march',
    only: 'qb-pred',
    sites: /^$/,
    where: /^lib\/chart\.js:/,
    why: 'ô màu chú giải của biểu đồ quạt (`background:${k.c}`, có thể là var(--later)); vân chạy của thanh quota chỉ ở .qb-pred',
  },
  {
    prop: 'background',
    keyframes: 'ring-out',
    inline: true,
    sites: /^$/,
    where: /^lib\/chart\.js:/,
    why: 'cùng ô màu ấy; ring-out chỉ chạy qua animation nội tuyến của vòng đếm ngược, style toàn số',
  },
];

/** Thuộc tính style ở một chỗ có thể được mount() dời không. */
const hoistableSite = (site) => site.names.some(isVar) || Boolean(site.reads);

/** Phần chọn cuối (phần tử được nhắm tới) của từng bộ chọn trong một danh sách. */
function subjects(prelude) {
  const split = (s, at) => {
    const out = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < s.length; i++) {
      if ('(['.includes(s[i])) depth++;
      else if (')]'.includes(s[i])) depth--;
      else if (!depth && at.test(s[i])) {
        out.push(s.slice(start, i));
        start = i + 1;
      }
    }
    return [...out, s.slice(start)];
  };
  return split(prelude, /,/).map((sel) => split(sel.trim(), /[\s>+~]/).at(-1));
}

function requiredClasses(compound) {
  let s = compound;
  while (/\([^()]*\)/.test(s)) s = s.replace(/\([^()]*\)/g, '');
  return [...s.matchAll(/\.([\w-]+)/g)].map((m) => m[1]);
}

/** Phần chọn của mọi luật gọi một @keyframes qua `animation` hay `animation-name`. */
function rulesUsing(css, name) {
  const uses = new RegExp(`(?:^|[;{\\s])animation(?:-name)?\\s*:[^;{}]*(?<![\\w-])${name}(?![\\w-])`);
  return [...css.matchAll(/([^{}]*)\{([^{}]*)\}/g)].filter((m) => uses.test(m[2])).map((m) => m[1].trim());
}

test('ngoại lệ keyframes: điều kiện của từng mục vẫn đúng trên CSS và mã nguồn hôm nay', () => {
  for (const ex of EXCUSED) {
    const frames = [...ANIMATED].filter(([p]) => related(p, ex.prop)).flatMap(([, ks]) => [...ks]);
    assert.ok(frames.includes(ex.keyframes), `${ex.keyframes} không còn đổi ${ex.prop}: mục ngoại lệ đã cũ`);
    const preludes = rulesUsing(CSS, ex.keyframes);
    const word = (w) => new RegExp(`(?<![\\w-])${w}(?![\\w-])`, 'g');
    const line = (code, at) => code.slice(0, at).split('\n').length;
    const siteAt = (rel, code, at) => SITES.find((s) => s.where === `${rel}:${line(code, at)}`);
    if (ex.inline) {
      assert.deepEqual(preludes, [], `${ex.keyframes} có luật CSS gọi, mục ngoại lệ dạng inline không còn đúng`);
      let calls = 0;
      for (const { rel, code } of SOURCES) {
        for (const m of code.matchAll(word(ex.keyframes))) {
          const open = code.lastIndexOf(' style="', m.index);
          const inside = open >= 0 && !code.slice(open + 8, m.index).includes('"') && /animation(?:-name)?\s*:[^;]*$/.test(code.slice(open + 8, m.index));
          assert.ok(inside, `${rel}: ${ex.keyframes} xuất hiện ngoài animation của một thuộc tính style`);
          const site = siteAt(rel, code, open);
          assert.ok(site && !hoistableSite(site), `${rel}: style gọi ${ex.keyframes} có thể được dời`);
          calls++;
        }
      }
      assert.ok(calls > 0, `không chỗ nào gọi ${ex.keyframes}: mục ngoại lệ đã cũ`);
      continue;
    }
    assert.ok(preludes.length > 0, `không luật nào gọi ${ex.keyframes}: bộ đọc CSS có vẻ đã hụt`);
    for (const compound of preludes.flatMap(subjects)) {
      if (compound.includes('::')) continue;
      assert.ok(requiredClasses(compound).includes(ex.only), `${ex.keyframes} chạy trên "${compound}", không chỉ trên .${ex.only}`);
    }
    for (const { rel, code } of SOURCES) {
      assert.ok(!word(ex.keyframes).test(code), `${rel} gọi thẳng ${ex.keyframes}`);
      for (const m of code.matchAll(word(ex.only))) {
        const lt = code.lastIndexOf('<', m.index);
        assert.match(code.slice(lt, m.index), /^<[\w-]+[^>]*\sclass="[^"]*$/, `${rel}: .${ex.only} xuất hiện ngoài thuộc tính class`);
        const tag = code.slice(lt, code.indexOf('>', m.index));
        const style = tag.search(/\sstyle="/);
        if (style < 0) continue;
        const site = siteAt(rel, code, lt + style);
        assert.ok(site && !hoistableSite(site), `${rel}: .${ex.only} nằm trên một thẻ có style có thể được dời`);
      }
    }
  }
});

/**
 * Chỗ trong mã nguồn có một giá trị phép quét không đoán được (`reads: 'maybe'`) và giá trị ấy đụng
 * một @keyframes hay một luật `!important`. Mỗi chỗ đã đọc tay và chắc chắn không bao giờ đọc biến,
 * tức mount() không dời nó. Chỗ mới xuất hiện thì test đỏ để người thêm nó cũng đọc tay.
 */
const OPAQUE_OK = [
  { where: /^lib\/chart\.js:/, cls: /\bar-(?:line|cut|fill)\b/, prop: 'clip-path', why: '`poly`, `under` là polygon() dựng từ số phần trăm' },
  { where: /^lib\/chart\.js:/, cls: /\bdn-w\b/, prop: 'clip-path', why: '`wedge()` trả polygon() dựng từ số độ' },
];

test('thuộc tính thường được dời: không @keyframes nào đổi nó, không luật nào khai nó !important', () => {
  const hits = [];
  const seen = new Set();
  const excused = new Set();
  const opaque = new Set();
  for (const site of SITES) {
    if (!hoistableSite(site)) continue;
    for (const prop of site.names.filter((n) => !isVar(n)).map((n) => n.toLowerCase())) {
      seen.add(prop);
      const frames = [...ANIMATED].filter(([p]) => related(p, prop)).flatMap(([, ks]) => [...ks]);
      const important = [...IMPORTANT].filter((p) => related(p, prop));
      if (!frames.length && !important.length) continue;
      const cover = (k) => EXCUSED.find((e) => e.prop === prop && e.keyframes === k && e.sites.test(site.cls) && (e.where?.test(site.where) ?? true));
      if (frames.length && frames.every(cover) && !important.length) {
        for (const k of frames) excused.add(cover(k));
        continue;
      }
      const ok = site.reads === 'maybe' && !site.names.some(isVar) && OPAQUE_OK.find((o) => o.prop === prop && o.where.test(site.where) && o.cls.test(site.cls));
      if (ok) {
        opaque.add(ok);
        continue;
      }
      hits.push(`${site.where} class="${site.cls}": ${prop} (@keyframes ${frames.join(', ') || '—'}; !important ${important.join(', ') || '—'})`);
    }
  }
  assert.deepEqual(hits, [], 'khai báo thường sẽ mang !important khi dời: giữ nó ra khỏi thuộc tính khai hay đọc biến, hoặc xét tay và ghi vào EXCUSED hay OPAQUE_OK');
  // Lưới phải canh thứ có thật: mỗi tên dưới đây đang được dời ở ít nhất một chỗ.
  for (const want of ['width', 'height', 'z-index', 'animation-delay', 'color', 'font']) assert.ok(seen.has(want), `phép quét không thấy ${want} được dời`);
  assert.equal(excused.size, EXCUSED.length, 'có mục EXCUSED không còn chỗ nào dùng tới');
  assert.equal(opaque.size, OPAQUE_OK.length, 'có mục OPAQUE_OK không còn chỗ nào dùng tới');
});

test('biến do @property khai hoặc @keyframes đổi không bao giờ được đặt nội tuyến', () => {
  const names = new Set([...CSS.matchAll(/@property\s+(--[\w-]+)/g)].map((m) => m[1]));
  for (const { body } of keyframeBlocks(CSS)) for (const n of declaredIn(body)) if (isVar(n)) names.add(n);
  assert.ok(names.has('--tw'), 'phép quét không thấy --tw (@property + mb-twinkle) — bộ đọc CSS có vẻ đã hụt');
  const hits = [];
  for (const name of names) {
    const re = new RegExp(`(?<!var\\(\\s*)${name}(?![\\w-])`);
    for (const { rel, code } of SOURCES) if (re.test(code)) hits.push(`${name} trong ${rel}`);
    for (const [label, s] of PAINTED) {
      if (styleAttrs(s).some((css) => declNames(css).includes(name))) hits.push(`${name} trong chuỗi vẽ của ${label}`);
    }
  }
  assert.deepEqual(hits, [], `đặt nội tuyến một biến có hoạt hình: ${hits.join(', ')}`);
});

test('CSS không khai biến nào với !important', () => {
  const hits = [...CSS.matchAll(/(--[\w-]+)\s*:[^;{}]*!\s*important/g)].map((m) => m[1]);
  assert.deepEqual(hits, [], `biến !important (${hits.join(', ')}) sẽ đổi thứ bậc với class của mount()`);
});
