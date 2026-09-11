/* 持久化回归测试：验证「写入 → 重启 → 读回」数据不丢
   把 index.html 里的 DB 层原样抽出来跑，不依赖浏览器。
   运行：NODE_PATH=<node workspace>/node_modules node tools/test-persist.js */
const fs = require('fs');
const path = require('path');

require('fake-indexeddb/auto');

const html = fs.readFileSync(path.join(__dirname, '..', 'www', 'index.html'), 'utf8');

// ---------- 从 index.html 抽真实源码，避免测试与实现漂移 ----------
function grab(startRe, endRe, label){
  const lines = html.split('\n');
  const s = lines.findIndex(l => startRe.test(l));
  if (s < 0) throw new Error('找不到起始锚点: ' + label);
  const e = lines.findIndex((l, i) => i > s && endRe.test(l));
  if (e < 0) throw new Error('找不到结束锚点: ' + label);
  return lines.slice(s, e + 1).join('\n');
}

const dbSrc = grab(/^const DB = \(\(\) => \{/, /^\}\)\(\);/, 'DB 模块闭包');

let pass = 0, fail = 0;
function ok(name, cond, extra){
  if (cond){ pass++; console.log('  \u2713 ' + name); }
  else { fail++; console.log('  \u2717 ' + name + (extra ? '  → ' + extra : '')); }
}

(async () => {
  console.log('\n[持久化回归] 模拟重启：写入 → 断开 → 重开 → 读回\n');

  // ===== 第一会话：写入 =====
  const DB1 = new Function('indexedDB', dbSrc + '\nreturn DB;')(indexedDB);
  await DB1.put({id:'r1', amt:2000, cat:'fast', ts:1000, meal:'m_lunch', brand:'b_mcd', photos:['p1'], note:'午饭'});
  await DB1.put({id:'r2', amt:600,  cat:'drink', ts:1001, meal:'m_lunch', brand:null, photos:[], note:'饮料'});
  await DB1.putPhoto({id:'p1', blob:'fake-blob'});
  await DB1.putCat({id:'c1', name:'快餐', icon:'x', color:'#EF9F27', heavy:false, order:0});
  await DB1.putMeal({id:'m_lunch', name:'午餐', order:1});
  await DB1.putMeal({id:'m_dinner', name:'晚餐', order:2});
  await DB1.putBrand({id:'b_mcd', name:'麦当劳', order:0});
  await DB1.setMeta('budget', 4000);
  await DB1.setMeta('theme', 'dark');

  // ===== 第二会话：全新 DB 句柄（等同应用重启） =====
  // 关键：清掉 require 缓存里的连接池，强制走一次全新的 open
  const DB2 = new Function('indexedDB', dbSrc + '\nreturn DB;')(indexedDB);

  console.log('设置项（此前重启会归零的那批）');
  const budget = await DB2.getMeta('budget');
  const theme  = await DB2.getMeta('theme');
  ok('每日预算读回 4000 分（¥40）', budget === 4000, '实际 ' + JSON.stringify(budget) + ' (' + typeof budget + ')');
  ok('主题读回 dark', theme === 'dark', '实际 ' + JSON.stringify(theme));

  console.log('\n记录');
  const recs = await DB2.all();
  ok('两条记录都在', recs.length === 2, '实际 ' + recs.length);
  const r1 = recs.find(r => r.id === 'r1');
  ok('记录金额/分类/餐次/品牌完整', r1 && r1.amt === 2000 && r1.cat === 'fast' && r1.meal === 'm_lunch' && r1.brand === 'b_mcd');

  console.log('\n分类 / 餐次 / 品牌（ka0RU 担心的那批）');
  ok('分类读回', (await DB2.allCats()).length === 1);
  const meals = await DB2.allMeals();
  ok('餐次读回 2 个', meals.length === 2, '实际 ' + meals.length);
  ok('品牌读回', (await DB2.allBrands()).length === 1);

  console.log('\n照片');
  const ph = await DB2.getPhoto('p1');
  ok('照片 blob 读回', ph && ph.blob === 'fake-blob');

  console.log('\n删除后重启不复活');
  const DB3 = new Function('indexedDB', dbSrc + '\nreturn DB;')(indexedDB);
  await DB3.delMeal('m_dinner');
  const DB4 = new Function('indexedDB', dbSrc + '\nreturn DB;')(indexedDB);
  ok('删掉的餐次不会回来', (await DB4.allMeals()).length === 1);

  console.log('\n清理后重启保持为空');
  const DB5 = new Function('indexedDB', dbSrc + '\nreturn DB;')(indexedDB);
  await DB5.clear();
  const DB6 = new Function('indexedDB', dbSrc + '\nreturn DB;')(indexedDB);
  ok('记录清空后仍为空', (await DB6.all()).length === 0);

  console.log('\n' + (fail ? '\u2717 ' + fail + ' 项失败，' + pass + ' 项通过' : '\u2713 全部 ' + pass + ' 项通过'));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('\n测试异常：', e); process.exit(2); });
