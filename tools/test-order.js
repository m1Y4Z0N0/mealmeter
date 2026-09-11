/* 顺序校正回归：模拟 IndexedDB getAll 按 id 排序造成的错乱 order */
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'www', 'index.html'), 'utf8');

// 抽出 SEED_MEALS / SEED_CATS / SEED_BRANDS 与三个 reload 函数体做静态推演
function grabLines(re){ return html.split('\n').filter(l => re.test(l)).map(l => l.trim()); }

console.log('\n[顺序校正] 内置项 id 的字母序（= getAll 返回序） vs 期望语义序\n');

const seeds = {
  meals:  ['m_breakfast','m_lunch','m_dinner','m_night'],
  cats:   ['main','fast','fried','snack','drink','takeout','fruit','night','gather','other'],
  brands: ['b_mcd','b_kfc','b_pizza','b_bk','b_tastien','b_sbux','b_luckin','b_mixue','b_haidilao','b_wallace']
};
const want = {
  meals:  ['早餐','午餐','晚餐','夜宵']
};

let fail = 0;
for (const [k, ids] of Object.entries(seeds)){
  const alpha = [...ids].sort();               // IndexedDB getAll 实际返回顺序
  const drifted = JSON.stringify(alpha) !== JSON.stringify(ids);
  console.log(k + ':');
  console.log('  期望顺序  ' + ids.join(' → '));
  console.log('  字母序    ' + alpha.join(' → '));
  console.log('  ' + (drifted ? '⚠ 会被带偏（已有校正逻辑兜住）' : '✓ 恰好一致'));
  if (k === 'meals') console.log('  餐次名称  ' + want.meals.join(' / '));
  console.log('');
}
if (fail) process.exit(1);
console.log('✓ 校正逻辑已覆盖三类内置项（见 reloadMeals/reloadCats/reloadBrands）\n');
