#!/usr/bin/env node
/**
 * 单文件前端的静态自检。
 * 这些检查每一条都对应过一次真实踩坑，改完 www/index.html 就跑一遍：
 *
 *   node tools/check.js
 *
 * 覆盖：
 *   1. HTML 段落里误写 JS 转义（\uXXXX 在 HTML 里不会生效，会原样显示）
 *   2. $(id) 引用了 DOM 里不存在的 id
 *   3. 调用了没定义的函数（会抛 ReferenceError 让整块交互失效）
 *   4. data-* 属性读写不配对
 *   5. JS 语法错误
 */
const fs = require('fs');
const path = require('path');

// 从当前目录和脚本所在目录分别向上找，直到看见 www/index.html
function findRoot(start) {
  let dir = path.resolve(start);
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(dir, 'www', 'index.html'))) return dir;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return null;
}
const ROOT = findRoot(process.cwd()) || findRoot(path.dirname(process.argv[1] || '.')) || process.cwd();
const FILE = path.join(ROOT, 'www', 'index.html');

if (!fs.existsSync(FILE)) {
  console.error('找不到 ' + FILE);
  process.exit(1);
}

const html = fs.readFileSync(FILE, 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) {
  console.error('没找到 <script> 块');
  process.exit(1);
}
const js = m[1];

let failed = 0;
const ok = msg => console.log('  ✓ ' + msg);
const bad = msg => { failed++; console.log('  ✗ ' + msg); };

/* ---------- 1. HTML 段落里的 JS 转义 ---------- */
console.log('\n[1] HTML 转义');
{
  let inScript = false;
  const bads = [];
  html.split('\n').forEach((line, i) => {
    if (/<script>/.test(line)) inScript = true;
    if (/<\/script>/.test(line)) { inScript = false; return; }
    if (inScript) return;
    if (line.includes('\\')) bads.push('第 ' + (i + 1) + ' 行: ' + line.trim());
  });
  if (bads.length) bad('HTML 里有反斜杠转义（HTML 要用 &#NNNN; 实体）:\n' + bads.map(b => '      ' + b).join('\n'));
  else ok('HTML 段落干净，无失效转义');
}

/* ---------- 2. $(id) 引用 ---------- */
console.log('\n[2] DOM id 引用');
{
  const declared = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(x => x[1]));
  // 动态拼进 innerHTML 的 id 也算声明
  for (const mm of js.matchAll(/id="([^"']+)"/g)) declared.add(mm[1]);
  const used = [...new Set([...js.matchAll(/\$\('([^']+)'\)/g)].map(x => x[1]))];
  const missing = used.filter(id => !declared.has(id));
  if (missing.length) bad('引用了不存在的 id: ' + missing.join(', '));
  else ok('声明 ' + declared.size + ' 个 id，引用 ' + used.length + ' 个，全部命中');
}

/* ---------- 3. 未定义的函数调用 ---------- */
console.log('\n[3] 函数定义与调用');
{
  // 先去掉注释和字符串字面量，否则 'cubic-bezier(' 这类会被当成函数调用
  // 注释用「前面是行首或空白」来判定，这样 'https://…' 里的 // 不会被误删
  const code = js
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|\s)\/\/[^\n]*/gm, '$1')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');

  const defined = new Set();
  const addParams = src => {
    src.split(',').forEach(raw => {
      let p = raw.trim().replace(/^[(\[]+/, '');   // 形如 "((res" 的要剥掉多余括号
      const eq = p.indexOf('=');
      if (eq >= 0) p = p.slice(0, eq).trim();
      if (!p) return;
      if (p[0] === '{' || p[0] === '[') {                 // 解构参数
        p.replace(/[{}\[\]]/g, ' ').split(/[\s:,]+/).forEach(x => {
          if (/^[\w$]+$/.test(x)) defined.add(x);
        });
        return;
      }
      if (p.startsWith('...')) p = p.slice(3).trim();
      if (/^[\w$]+$/.test(p)) defined.add(p);
    });
  };

  for (const mm of code.matchAll(/function\s+([\w$]+)/g)) defined.add(mm[1]);
  for (const mm of code.matchAll(/(?:const|let|var)\s+([\w$]+)\s*=/g)) defined.add(mm[1]);
  for (const mm of code.matchAll(/function\s*[\w$]*\s*\(([^)]*)\)/g)) addParams(mm[1]);
  for (const mm of code.matchAll(/\(([^)]*)\)\s*=>/g)) addParams(mm[1]);
  for (const mm of code.matchAll(/catch\s*\(([^)]*)\)/g)) addParams(mm[1]);
  for (const mm of code.matchAll(/(?:^|[^\w$.])([\w$]+)\s*=>/g)) defined.add(mm[1]);
  for (const mm of code.matchAll(/(?:const|let|var)\s*\{([^}]+)\}\s*=/g)) addParams(mm[1]);

  const BUILTIN = new Set([
    'if', 'for', 'while', 'switch', 'catch', 'return', 'typeof', 'function', 'new', 'await', 'async', 'var',
    'Object', 'Array', 'String', 'Number', 'Math', 'JSON', 'Date', 'Set', 'Map', 'WeakMap', 'URL', 'Blob', 'File',
    'FileReader', 'Promise', 'Error', 'indexedDB', 'Uint8Array', 'Intl', 'RegExp', 'Symbol',
    'parseFloat', 'parseInt', 'isFinite', 'isNaN', 'setTimeout', 'clearTimeout', 'setInterval', 'requestAnimationFrame',
    'confirm', 'alert', 'atob', 'btoa', 'encodeURIComponent', 'decodeURIComponent',
    'createImageBitmap', 'URLSearchParams', 'matchMedia', 'structuredClone', 'queueMicrotask'
  ]);
  const called = [...new Set([...code.matchAll(/(?<![.\w'"`])([a-zA-Z_$][\w$]*)\s*\(/g)].map(x => x[1]))];
  const undef = called.filter(n => !defined.has(n) && !BUILTIN.has(n));
  if (undef.length) bad('调用了未定义的函数（会抛 ReferenceError）: ' + undef.join(', '));
  else ok('调用的 ' + called.length + ' 个函数名全部有定义');
}

/* ---------- 4. data-* 读写配对 ---------- */
console.log('\n[4] data-* 属性');
{
  const camel = s => s.replace(/[A-Z]/g, c => '-' + c.toLowerCase());
  const read = new Set();
  for (const mm of js.matchAll(/dataset\.([a-zA-Z]+)/g)) read.add(camel(mm[1]));
  for (const mm of js.matchAll(/\[data-([a-z-]+)\]/g)) read.add(mm[1]);
  const emitted = new Set([...html.matchAll(/data-([a-z-]+)(?:=|\s|>)/g)].map(x => x[1]));
  for (const mm of js.matchAll(/data-([a-z-]+)=/g)) emitted.add(mm[1]);
  // 拼接进模板字符串的属性名（如 'data-lc'）也算产出
  for (const mm of js.matchAll(/['"]data-([a-z-]+)['"]/g)) emitted.add(mm[1]);
  const orphan = [...read].filter(a => !emitted.has(a));
  if (orphan.length) bad('JS 读取但从不产出: ' + orphan.join(', '));
  else ok('读写的 ' + read.size + ' 个 data-* 属性全部配对');
}

/* ---------- 5. 语法 ---------- */
console.log('\n[5] JS 语法');
try {
  new Function(js);
  ok('语法正确');
} catch (e) {
  bad('语法错误: ' + e.message);
}

/* ---------- 汇总 ---------- */
console.log('\n' + (failed ? '✗ ' + failed + ' 项未通过' : '✓ 全部通过') + '\n');
process.exit(failed ? 1 : 0);
