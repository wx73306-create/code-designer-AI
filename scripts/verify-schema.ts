// =====================================================================
// verify:schema —— WebsitePackage 契约的真机验收（S-02）
// ---------------------------------------------------------------------
// vitest 里已经覆盖了通过/失败用例，这里做的是**产物级**验收：
//   1. 真实的 fixture 包（提交在仓库里的样例）必须过校验；
//   2. 真实生产者 createEmptyPackage() 的输出必须过校验；
//   3. 三类典型违约（缺字段 / 多字段 / 类型错）必须**全部**被拒。
// 任何一项不符即 exit(1)，可直接挂进 CI。
//
// 为什么要有这一层（而不只跑 vitest）：
//   契约的价值在于「所有人都拿同一份样例对表」。上面这些检查跑在**真实文件**上，
//   任何人改了 schema 又没同步样例，这里立刻会红。
// =====================================================================

import { createEmptyPackage, WEBSITE_PACKAGE_VERSION } from '@/types/website-package';
import {
  describeValidationErrors,
  inspectWebsitePackage,
  validateWebsitePackage,
  WEBSITE_PACKAGE_REQUIRED_KEYS,
} from '@/lib/schemas';
import substantiveFixture from '@/lib/schemas/__fixtures__/substantive-package.json';

let failures = 0;

function check(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`  ✅ ${label}`);
  } else {
    failures++;
    console.log(`  ❌ ${label}${detail ? `\n      ${detail}` : ''}`);
  }
}

console.log('='.repeat(78));
console.log(`WebsitePackage 契约验收  schema v${WEBSITE_PACKAGE_VERSION}`);
console.log(`顶层必填字段（${WEBSITE_PACKAGE_REQUIRED_KEYS.length}）：${WEBSITE_PACKAGE_REQUIRED_KEYS.join(', ')}`);
console.log('='.repeat(78));

console.log('\n[1] 正向：真实产物必须通过');
{
  const r = validateWebsitePackage(substantiveFixture);
  check('仓库样例包（__fixtures__/substantive-package.json）通过', r.ok, r.ok ? undefined : describeValidationErrors(r.errors));
}
{
  const r = validateWebsitePackage(createEmptyPackage('https://example.com'));
  check('createEmptyPackage() 输出通过', r.ok, r.ok ? undefined : describeValidationErrors(r.errors));
}

console.log('\n[2] 反向：典型违约必须被拒');
{
  const bad: Record<string, unknown> = JSON.parse(JSON.stringify(substantiveFixture));
  delete bad.layout;
  const r = validateWebsitePackage(bad);
  check('缺少顶层必填字段被拒', !r.ok && r.errors.some((e) => e.message.includes('layout')));
}
{
  const bad: Record<string, unknown> = JSON.parse(JSON.stringify(substantiveFixture));
  bad.debugDump = 1;
  const r = validateWebsitePackage(bad);
  check('出现未声明字段被拒（闭集契约）', !r.ok && r.errors.some((e) => e.message.includes('debugDump')));
}
{
  const bad: Record<string, unknown> = JSON.parse(JSON.stringify(substantiveFixture));
  (bad.styles as Record<string, unknown>).spacing = { base: 4, scale: [], containerMaxWidth: 'x', sectionPadding: 'y' };
  const r = validateWebsitePackage(bad);
  check('类型错被拒且路径精确', !r.ok && r.errors.some((e) => e.path === '$.styles.spacing.base'));
}

console.log('\n[3] 语义：「未知」不等于「非法」');
{
  const pkg: Record<string, unknown> = JSON.parse(JSON.stringify(substantiveFixture));
  (pkg.layout as Record<string, unknown>).flow = [];
  check('layout.flow 为空数组仍合法（没测过 ≠ 猜值）', validateWebsitePackage(pkg).ok);
}
{
  const pkg: Record<string, unknown> = JSON.parse(JSON.stringify(substantiveFixture));
  delete pkg.interaction;
  check('interaction 缺失仍合法（未采集 ≠ 无交互）', validateWebsitePackage(pkg).ok);
}

console.log('\n[4] 空壳体检（契约通过但没料 —— downstream 最该预警的形态）');
{
  const h = inspectWebsitePackage(createEmptyPackage('https://example.com'));
  check('空包的 substantive=false', h.ok && !h.substantive);
  check('空包列出空维度', h.emptyParts.includes('dom.sections') && h.emptyParts.includes('styles.colors'));
  console.log(`      空维度：${h.emptyParts.join(', ')}`);
}
{
  const h = inspectWebsitePackage(substantiveFixture);
  check('样例包的 substantive=true', h.ok && h.substantive);
}

console.log('\n' + '='.repeat(78));
if (failures === 0) {
  console.log('✅ 契约验收全部通过');
} else {
  console.log(`❌ 契约验收失败 ${failures} 项`);
}
console.log('='.repeat(78));

process.exit(failures === 0 ? 0 : 1);
