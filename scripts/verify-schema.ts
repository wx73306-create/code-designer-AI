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
import { buildWebsitePackage } from '@/lib/website-package/adapter';
import { decodeScreenshotDataUrl } from '@/lib/website-package/screenshot';
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

console.log('\n[5] 「未知」与「缺失」的判据：undefined 等价于缺失（2026-09-26 生产事故回归）');
{
  // 事故：生产者在构造对象时把取不到的字段显式赋成 undefined
  // （`'key' in obj === true` 而 `obj.key === undefined`），旧校验器因此对
  // 「本来就没有」的可选字段做类型检查，报出 11 处**假违约**；
  // 而 code 步骤的契约闸门是硬拒绝 → 每一次生成都 422 失败。
  type A = Record<string, unknown>;

  const pkg: Record<string, unknown> = JSON.parse(JSON.stringify(substantiveFixture));
  (pkg.assets as A[]).forEach((a) => {
    a.hash = undefined;
    a.width = undefined;
    a.localPath = undefined;
  });
  (pkg.metadata as A).favicon = undefined;
  (pkg.metadata as A).openGraph = undefined;
  (pkg.metadata as A).canonical = undefined;
  (pkg.animations as A[]).forEach((a) => {
    a.properties = undefined;
    a.delay = undefined;
  });

  const r = validateWebsitePackage(pkg);
  check(
    '缺省字段被显式赋成 undefined 时仍判定合法（undefined 不是 JSON 值）',
    r.ok,
    r.ok ? undefined : describeValidationErrors(r.errors),
  );

  // 反向：**必填**字段被显式赋成 undefined，必须算「缺失」而不是「存在」。
  // 否则 `{ layout: undefined }` 会被当成「有 layout」，把缺字段放过去。
  const missing: Record<string, unknown> = JSON.parse(JSON.stringify(substantiveFixture));
  missing.layout = undefined;
  const rMissing = validateWebsitePackage(missing);
  check(
    '必填字段被显式赋成 undefined 时判定为「缺失」（反向锁死）',
    !rMissing.ok && rMissing.errors.some((e) => e.message.includes('layout')),
    describeValidationErrors(rMissing.errors),
  );
}

console.log('\n[6] 真实生产者：buildWebsitePackage 的输出必须过契约');
{
  // **这一条是事故的直接补丁。** 之前 verify:schema 只校验手写样例
  // （__fixtures__），样例是按 schema 写的，所以永远绿 —— 而真实生产者
  // 的输出从未被这道闸门看过一眼。契约与生产者一旦分叉，只有到线上才暴露。
  const scraped = {
    url: 'https://example.com',
    title: 'Example — Official Site',
    metaDescription: 'A short description.',
    colors: [
      { value: '#0a0a0a', context: 'text primary' },
      { value: '#0071e3', context: 'primary button background' },
      { value: '#f5f5f7', context: 'section background' },
    ],
    fonts: [
      { family: 'Inter', weights: ['400', '700'], sizes: ['16px', '48px'] },
      { family: 'SF Mono', weights: ['400'], sizes: ['14px'] },
    ],
    spacing: ['8px', '16px', '24px', '48px'],
    borderRadius: ['8px', '12px'],
    shadows: ['0 1px 3px rgba(0,0,0,0.1)'],
    transitions: ['opacity 0.3s ease-in-out', 'all 0.2s linear'],
    layoutHints: ['hero-centered', 'sticky-header'],
    htmlStructure:
      '<html lang="en"><head><link rel="canonical" href="https://example.com/"></head>'
      + '<body><header class="site-header"><nav class="nav"></nav></header>'
      + '<main><section class="hero"><img src="/hero.png"></section>'
      + '<section class="features"></section></main><footer></footer></body></html>',
    cssSnippet: ':root { --brand: #0071e3; } .grid { display: grid; gap: 24px; }',
    externalCSSCount: 2,
    inlineStyleCount: 5,
  };

  const produced = buildWebsitePackage({ scraped } as never);
  const r = validateWebsitePackage(produced);
  check(
    '无采集时 buildWebsitePackage 的输出过契约',
    r.ok,
    r.ok ? undefined : describeValidationErrors(r.errors),
  );

  const withInteraction = buildWebsitePackage({
    scraped,
    interaction: {
      scrolls: [{ trigger: 'load', type: 'reveal', target: '.hero', properties: ['opacity'] }],
      clicks: [{ trigger: 'click', type: 'toggle', target: '.nav', properties: ['height'] }],
      states: [{ trigger: 'hover', type: 'state', target: 'a', properties: ['color'] }],
      animations: [{ name: 'fade', type: 'fade', duration: '0.3s', easing: 'ease', target: '.hero', properties: ['opacity'] }],
      meta: { capturedAt: '2026-09-26T00:00:00.000Z', source: 'verify-schema' },
    },
  } as never);
  const r2 = validateWebsitePackage(withInteraction);
  check(
    '带 interaction 的真实输出过契约',
    r2.ok,
    r2.ok ? undefined : describeValidationErrors(r2.errors),
  );

  check(
    '真实输出同时是「有料」的（substantive）',
    inspectWebsitePackage(produced).substantive,
    inspectWebsitePackage(produced).emptyParts.join(', '),
  );

  // 截图入包（P1-06 / P1-10）也纳入契约验收。
  // **为什么必须在这里而不只在单测**：单测断言的是「我期望的字段形状」，
  // 这里断言的是「这个形状真的能过契约」。两者漏掉的是不同的东西 ——
  // 上一次事故就是「单测全绿但真实输出过不了契约」。
  const png = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png, 0);
  png.writeUInt32BE(13, 8);
  png.write('IHDR', 12, 'ascii');
  png.writeUInt32BE(1280, 16);
  png.writeUInt32BE(800, 20);
  const shot = decodeScreenshotDataUrl(png.toString('base64'));
  check('截图 base64 能解析出真实宽高', shot !== null && shot.width === 1280 && shot.height === 800);

  const withShot = buildWebsitePackage({ scraped, screenshot: shot ?? undefined } as never);
  const r3 = validateWebsitePackage(withShot);
  check(
    '带 screenshot 的真实输出过契约',
    r3.ok,
    r3.ok ? undefined : describeValidationErrors(r3.errors),
  );
  check(
    '截图不再被算作空块（日志不会声称注入了一个不存在的块）',
    !inspectWebsitePackage(withShot).emptyParts.includes('screenshots'),
    inspectWebsitePackage(withShot).emptyParts.join(', '),
  );
}

console.log('\n' + '='.repeat(78));
if (failures === 0) {
  console.log('✅ 契约验收全部通过');
} else {
  console.log(`❌ 契约验收失败 ${failures} 项`);
}
console.log('='.repeat(78));

process.exit(failures === 0 ? 0 : 1);
