import Link from 'next/link';

export const metadata = {
  title: '使用文档 - Code Designer AI',
  description: 'Code Designer AI 完整使用文档，包括产品简介、核心功能、使用流程和最佳实践',
};

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-[#FAFBFF]" style={{ scrollBehavior: 'smooth' }}>
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[#e5e7eb] bg-white/80 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] flex items-center justify-center">
              <span className="text-white text-sm font-bold">&lt;/&gt;</span>
            </div>
            <span className="text-[17px] font-bold text-[#111827]">Code Designer AI</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-[13px] text-[#64748B] hover:text-[#111827] transition-colors">← 返回首页</Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-16">
        <div className="prose prose-slate max-w-none">
          {/* Hero */}
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold text-[#6366F1] bg-[#6366F1]/10 mb-4">
              使用文档
            </span>
            <h1 className="text-[40px] sm:text-[48px] font-extrabold text-[#111827] tracking-tight mb-4">
              Code Designer AI<br />使用文档
            </h1>
            <p className="text-[16px] text-[#64748B] max-w-[520px] mx-auto leading-relaxed">
              从输入网站到导出完整项目，AI 自动完成设计分析、代码生成和项目部署
            </p>
          </div>

          {/* Table of Contents */}
          <nav className="mb-16 p-6 rounded-2xl bg-white border border-[#e5e7eb] shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
            <h2 className="text-[16px] font-bold text-[#111827] mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-[#6366F1]/10 flex items-center justify-center text-[#6366F1] text-[12px]">☰</span>
              目录
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { id: 'intro', label: '1. 产品简介' },
                { id: 'features', label: '2. 产品核心功能' },
                { id: 'workflow', label: '3. 使用流程' },
                { id: 'tips', label: '4. 最佳使用建议' },
                { id: 'skills', label: '5. 使用技巧' },
                { id: 'faq', label: '6. 常见问题' },
                { id: 'positioning', label: '7. 产品定位' },
                { id: 'quickstart', label: '快速开始' },
              ].map(item => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] text-[#475569] hover:text-[#6366F1] hover:bg-[#6366F1]/5 transition-colors duration-200"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#6366F1]/40" />
                  {item.label}
                </a>
              ))}
            </div>
          </nav>

          {/* Section 1 */}
          <Section id="intro" title="1. 产品简介">
            <p><strong>Code Designer AI</strong> 是一款 AI 网页设计与开发智能体。</p>
            <p>通过 AI 视觉分析、设计理解和代码生成技术，用户只需输入一个网页链接，即可自动完成：</p>
            <FeatureList items={[
              '网页设计分析', 'UI 风格提取', '页面复刻',
              '设计优化', '前端代码生成', '完整项目导出',
            ]} />
            <p>让不会代码的用户也能快速创建专业级网站。</p>
          </Section>

          {/* Section 2 */}
          <Section id="features" title="2. 产品核心功能">
            {/* AI Analysis */}
            <SubSection title="① AI 网页分析（Website Analysis）">
              <p>支持输入：</p>
              <FeatureList items={['网站 URL', '网页截图', '网站文件 ZIP']} />
              <p className="mt-4">AI 自动分析三个维度：</p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                <InfoCard title="Brand Position" subtitle="品牌定位" items={['Premium Technology', 'Minimal Luxury', 'Future-oriented']} />
                <InfoCard title="Visual Language" subtitle="视觉语言" items={['设计风格', '色彩体系', '字体系统', '页面布局', '动效方式']} />
                <InfoCard title="Component Extraction" subtitle="组件拆解" items={['Navbar', 'Hero', 'Feature Section', 'Gallery', 'Footer']} />
              </div>
              <p className="mt-4">生成完整 <strong>Website Intelligence Report</strong></p>
            </SubSection>

            {/* Dual Mode */}
            <SubSection title="② 双模式设计">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-4">
                <ModeCard
                  mode="Mode 1"
                  title="Pixel Copy"
                  subtitle="精准复刻模式"
                  goal="最大程度还原原网站视觉效果"
                  items={['保留布局', '保留颜色', '保留组件结构', '保留交互逻辑']}
                  suitable={['网站学习', '设计研究', '快速迁移']}
                  color="#2563EB"
                />
                <ModeCard
                  mode="Mode 2"
                  title="Design Evolution"
                  subtitle="设计升级模式"
                  goal="保留核心设计语言，同时提升视觉体验"
                  items={['页面布局', '字体比例', '用户体验', '动效表现', '响应式适配']}
                  suitable={['品牌官网', '商业网站', '产品展示页']}
                  color="#8B5CF6"
                />
              </div>
            </SubSection>

            {/* Workspace */}
            <SubSection title="③ AI Design Workspace 工作台">
              <p>类似 Figma + Cursor 的 AI 设计环境。工作区包含三个区域：</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                <InfoCard title="Design Report" subtitle="左侧面板" items={['Brand Position', 'Colors', 'Typography', 'Layout', 'Components']} />
                <InfoCard title="Live Preview" subtitle="中间预览" items={['桌面端预览', '平板预览', '移动端预览']} />
                <InfoCard title="Code Editor" subtitle="右侧代码" items={['HTML', 'React', 'Next.js', 'Tailwind']} />
              </div>
            </SubSection>

            {/* AI Optimization */}
            <SubSection title="④ AI 智能优化">
              <p>点击 AI 优化按钮，AI 会自动修改网站：</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                <InfoCard title="优化视觉" items={['排版', '间距', '色彩', '层级']} />
                <InfoCard title="重新设计 Hero" items={['首屏视觉', '标题布局', '产品展示']} />
                <InfoCard title="提升高级感" items={['字体', '留白', '动效', '视觉比例']} />
                <InfoCard title="移动端适配" items={['手机布局', '响应式组件', '交互体验']} />
              </div>
            </SubSection>

            {/* Export */}
            <SubSection title="⑤ Export 项目导出">
              <p>完成设计后，可导出完整项目：</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                <InfoCard title="Web" subtitle="HTML + CSS + JS" items={['快速展示', '静态部署']} />
                <InfoCard title="React" items={['React 组件', 'Tailwind 样式', '项目结构']} />
                <InfoCard title="Next.js" subtitle="生产级项目" items={['App Router', 'Components', 'Tailwind', '配置文件']} />
                <InfoCard title="Full Project ZIP" subtitle="完整项目" items={['package.json', 'src/', 'components/', 'assets/', 'README.md']} />
              </div>
            </SubSection>
          </Section>

          {/* Section 3 */}
          <Section id="workflow" title="3. 使用流程">
            <div className="space-y-6 mt-4">
              <StepCard step={1} title="输入网站" desc="输入网站 URL（如 https://example.com），点击「开始 AI 分析」" />
              <StepCard step={2} title="等待 AI 分析" desc="AI 依次执行：访问网站 → 视觉识别 → 设计语言分析 → 生成 Design System → 创建页面结构" />
              <StepCard step={3} title="查看设计报告" desc="查看网站风格、配色方案、字体系统、页面结构，确认 AI 理解结果" />
              <StepCard step={4} title="进入 Workspace" desc="在工作台查看 AI 分析、页面效果和源代码，并进行优化" />
              <StepCard step={5} title="导出项目" desc="选择 HTML / React / Next.js，点击 Export 获得完整项目文件" />
            </div>
          </Section>

          {/* Section 4 */}
          <Section id="tips" title="4. 最佳使用建议">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-4">
              <div className="p-6 rounded-2xl bg-[#2563EB]/5 border border-[#2563EB]/10">
                <h3 className="text-[16px] font-bold text-[#111827] mb-2">想快速学习优秀网站</h3>
                <p className="text-[14px] text-[#64748B] mb-3">选择 <strong>Pixel Copy</strong> 模式</p>
                <p className="text-[13px] text-[#64748B]">推荐输入：Apple、Tesla、Stripe、Linear</p>
                <p className="text-[13px] text-[#64748B] mt-1">学习设计结构和视觉语言</p>
              </div>
              <div className="p-6 rounded-2xl bg-[#8B5CF6]/5 border border-[#8B5CF6]/10">
                <h3 className="text-[16px] font-bold text-[#111827] mb-2">想制作商业网站</h3>
                <p className="text-[14px] text-[#64748B] mb-3">选择 <strong>Design Evolution</strong> 模式</p>
                <p className="text-[13px] text-[#64748B]">输入你的品牌官网</p>
                <p className="text-[13px] text-[#64748B] mt-1">AI 分析行业风格 → 优化设计 → 生成高级版本</p>
              </div>
            </div>
          </Section>

          {/* Section 5 */}
          <Section id="skills" title="5. 使用技巧">
            <SubSection title="提供高质量输入">
              <FeatureList items={['桌面端完整网页', '高清截图', '清晰网站结构']} />
              <p className="mt-2">输入质量越高，生成效果越好。</p>
            </SubSection>
            <SubSection title="添加设计要求">
              <p>例如输入：</p>
              <div className="mt-2 p-4 rounded-xl bg-[#f8f9fa] border border-[#e5e7eb] text-[14px] text-[#333] italic">
                &ldquo;创建一个类似 Apple 风格的科技官网，强调极简、高端、未来感。&rdquo;
              </div>
              <p className="mt-2">AI 会结合网页分析 + 设计要求，生成更符合需求的结果。</p>
            </SubSection>
          </Section>

          {/* Section 6 */}
          <Section id="faq" title="6. 常见问题">
            <div className="space-y-6 mt-4">
              <FaqItem
                q="生成的网站和原网站不一致？"
                a="选择 Pixel Copy 模式，并提供高清截图或完整 URL。"
              />
              <FaqItem
                q="可以修改生成的网站吗？"
                a="可以。进入 Workspace，使用 AI 优化按钮或直接修改代码。"
              />
              <FaqItem
                q="可以用于商业项目吗？"
                a="可以导出 React、Next.js 项目继续开发。建议根据目标网站版权情况合理使用。"
              />
            </div>
          </Section>

          {/* Section 7 */}
          <Section id="positioning" title="7. 产品定位">
            <p><strong>Code Designer AI</strong> 不只是网页生成工具。</p>
            <p>它是一套 <strong>AI 网页设计理解与开发系统</strong>。</p>
            <div className="flex items-center gap-3 flex-wrap mt-4 text-[14px] text-[#64748B]">
              {['网页分析', '设计知识提取', 'AI 优化', '代码生成'].map((s, i, arr) => (
                <span key={s} className="flex items-center gap-3">
                  <span className="font-medium text-[#111827]">{s}</span>
                  {i < arr.length - 1 && <span className="text-[#d1d5db]">→</span>}
                </span>
              ))}
            </div>
            <p className="mt-4">帮助用户快速创造高质量数字产品。</p>
          </Section>

          {/* Quick Start */}
          <Section id="quickstart" title="快速开始">
            <div className="mt-4 p-6 rounded-2xl bg-gradient-to-br from-[#6366F1]/5 to-[#8B5CF6]/5 border border-[#6366F1]/10">
              <div className="flex items-center gap-3 flex-wrap text-[15px]">
                {['输入网站 URL', 'AI 分析', '查看 Design Report', 'Workspace 优化', 'Export 项目', '完成网站开发'].map((s, i, arr) => (
                  <span key={s} className="flex items-center gap-3">
                    <span className="font-semibold text-[#111827]">{s}</span>
                    {i < arr.length - 1 && <span className="text-[#6366F1]/40">→</span>}
                  </span>
                ))}
              </div>
            </div>
            <p className="mt-6 text-center text-[16px] font-semibold text-[#6366F1]">
              Code Designer AI —— 让 AI 真正理解设计。
            </p>
          </Section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#e5e7eb] py-8 mt-16">
        <div className="max-w-4xl mx-auto px-6 flex items-center justify-between">
          <span className="text-[12px] text-[#94A3B8]">© 2025 Code Designer AI</span>
          <Link href="/" className="text-[12px] text-[#6366F1] hover:underline">返回首页</Link>
        </div>
      </footer>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-16">
      <h2 className="text-[24px] sm:text-[28px] font-bold text-[#111827] tracking-tight mb-4 pb-3 border-b border-[#e5e7eb]">{title}</h2>
      <div className="text-[15px] text-[#475569] leading-[1.8] space-y-3">{children}</div>
    </section>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-8">
      <h3 className="text-[18px] font-bold text-[#111827] mb-3">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function FeatureList({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-wrap gap-2 mt-2">
      {items.map(item => (
        <li key={item} className="px-3 py-1.5 rounded-lg bg-[#f1f5f9] text-[13px] text-[#475569]">{item}</li>
      ))}
    </ul>
  );
}

function InfoCard({ title, subtitle, items }: { title: string; subtitle?: string; items: string[] }) {
  return (
    <div className="p-4 rounded-xl bg-white border border-[#e5e7eb] shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
      <h4 className="text-[14px] font-bold text-[#111827]">{title}</h4>
      {subtitle && <p className="text-[12px] text-[#94A3B8] mt-0.5">{subtitle}</p>}
      <ul className="mt-2 space-y-1">
        {items.map(item => (
          <li key={item} className="text-[12px] text-[#64748B] flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-[#94A3B8]" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ModeCard({ mode, title, subtitle, goal, items, suitable, color }: {
  mode: string; title: string; subtitle: string; goal: string; items: string[]; suitable: string[]; color: string;
}) {
  return (
    <div className="p-6 rounded-2xl bg-white border border-[#e5e7eb] shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color }}>{mode}</span>
      <h3 className="text-[20px] font-bold text-[#111827] mt-1">{title}</h3>
      <p className="text-[13px] text-[#94A3B8] mt-0.5">{subtitle}</p>
      <div className="mt-4 p-3 rounded-lg text-[13px] text-[#475569] italic" style={{ background: `${color}08` }}>
        {goal}
      </div>
      <div className="mt-4">
        <p className="text-[12px] font-semibold text-[#111827] mb-2">AI 自动优化：</p>
        <ul className="space-y-1">
          {items.map(item => (
            <li key={item} className="text-[12px] text-[#64748B] flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full" style={{ background: color }} />
              {item}
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-4">
        <p className="text-[12px] font-semibold text-[#111827] mb-2">适合：</p>
        <div className="flex flex-wrap gap-1.5">
          {suitable.map(s => (
            <span key={s} className="px-2 py-0.5 rounded-md text-[11px] font-medium" style={{ background: `${color}10`, color }}>
              {s}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function StepCard({ step, title, desc }: { step: number; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-4">
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] flex items-center justify-center shrink-0 text-white text-[14px] font-bold">
        {step}
      </div>
      <div>
        <h3 className="text-[16px] font-bold text-[#111827] mb-1">{title}</h3>
        <p className="text-[14px] text-[#64748B] leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <div className="p-5 rounded-xl bg-white border border-[#e5e7eb]">
      <h3 className="text-[15px] font-bold text-[#111827] mb-2">Q：{q}</h3>
      <p className="text-[14px] text-[#64748B] leading-relaxed">A：{a}</p>
    </div>
  );
}
