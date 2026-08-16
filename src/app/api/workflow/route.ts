import { NextRequest } from "next/server";
import { liveStats } from "@/lib/live-stats";

// =====================================================================
// SSE Workflow API — Simulates the 6-agent reverse engineering pipeline
// =====================================================================

interface WorkflowEvent {
  type:
    | "agent_update"
    | "log"
    | "analysis"
    | "code"
    | "qa"
    | "deploy"
    | "complete";
  agent: string;
  data: Record<string, unknown>;
  timestamp: string;
}

function createEvent(event: WorkflowEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

function ts(): string {
  return new Date().toISOString();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---- Simulated data for realistic output ----------------------------

const colorPalette = {
  primary: "#0071E3",
  secondary: "#1D1D1F",
  accent: "#AF52DE",
  background: "#0A0A0A",
  foreground: "#EDEDED",
  muted: "#86868B",
};

const typography = {
  heading: { family: "SF Pro Display", weight: 600, sizes: [48, 36, 28, 22] },
  body: { family: "SF Pro Text", weight: 400, size: 16, lineHeight: 1.5 },
  mono: { family: "SF Mono", weight: 400, size: 14 },
};

const componentTree = [
  { name: "Header", type: "navigation", children: ["Logo", "NavLinks", "CTAButton"] },
  { name: "HeroSection", type: "hero", children: ["Headline", "Subheadline", "HeroImage", "CTAButton"] },
  { name: "FeaturesGrid", type: "section", children: ["FeatureCard", "FeatureCard", "FeatureCard"] },
  { name: "TestimonialSection", type: "section", children: ["TestimonialCard", "TestimonialCard"] },
  { name: "PricingTable", type: "section", children: ["PricingCard", "PricingCard", "PricingCard"] },
  { name: "Footer", type: "footer", children: ["FooterLinks", "SocialIcons", "Copyright"] },
];

const sampleComponentCode = `import { motion } from 'framer-motion';

interface HeroSectionProps {
  headline: string;
  subheadline: string;
  ctaText: string;
  onCtaClick: () => void;
}

export function HeroSection({
  headline,
  subheadline,
  ctaText,
  onCtaClick,
}: HeroSectionProps) {
  return (
    <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden">
      <div className="hero-radial absolute inset-0" />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative z-10 text-center max-w-4xl mx-auto px-6"
      >
        <h1 className="text-5xl md:text-7xl font-semibold tracking-tight text-foreground">
          {headline}
        </h1>
        <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
          {subheadline}
        </p>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onCtaClick}
          className="mt-10 px-8 py-3.5 bg-primary text-primary-foreground rounded-full font-medium text-base transition-all hover:brightness-110"
        >
          {ctaText}
        </motion.button>
      </motion.div>
    </section>
  );
}`;

const sampleCSS = `.hero-section {
  position: relative;
  min-height: 80vh;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.hero-section::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(
    ellipse 80% 60% at 50% -20%,
    rgba(0, 113, 227, 0.2) 0%,
    transparent 70%
  );
  pointer-events: none;
}

.hero-headline {
  font-size: clamp(2.5rem, 5vw, 4.5rem);
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.1;
}`;

const qaIssues = [
  { element: "Header", issue: "Logo size mismatch: 42px vs original 40px", severity: "low" },
  { element: "HeroSection", issue: "Heading letter-spacing differs by -0.01em", severity: "low" },
  { element: "FeatureCard", issue: "Border radius 12px vs original 10px", severity: "medium" },
  { element: "CTAButton", issue: "Padding top/bottom off by 2px", severity: "low" },
  { element: "Footer", issue: "Link color #858589 vs original #86868B", severity: "low" },
];

// ---- Main generator -------------------------------------------------

async function* generateWorkflow(url: string): AsyncGenerator<string> {
  // ------------------------------------------------------------------
  // Phase 1: Browser Agent
  // ------------------------------------------------------------------
  yield createEvent({
    type: "agent_update",
    agent: "browser",
    data: { status: "running", action: "Initializing headless browser..." },
    timestamp: ts(),
  });
  await delay(800);

  yield createEvent({
    type: "log",
    agent: "browser",
    data: { action: "page_opened", url, viewport: "1440x900" },
    timestamp: ts(),
  });
  await delay(1200);

  yield createEvent({
    type: "log",
    agent: "browser",
    data: { action: "scrolling", direction: "down", distance: "3200px", duration: "2.1s" },
    timestamp: ts(),
  });
  await delay(1000);

  yield createEvent({
    type: "log",
    agent: "browser",
    data: { action: "scrolling", direction: "up", distance: "3200px", duration: "0.8s" },
    timestamp: ts(),
  });
  await delay(600);

  yield createEvent({
    type: "log",
    agent: "browser",
    data: { action: "screenshot_taken", count: 4, resolution: "1440x900", format: "png" },
    timestamp: ts(),
  });
  await delay(800);

  yield createEvent({
    type: "log",
    agent: "browser",
    data: { action: "html_downloaded", size: "248KB", elements: 1247 },
    timestamp: ts(),
  });
  await delay(600);

  yield createEvent({
    type: "log",
    agent: "browser",
    data: { action: "css_downloaded", files: 8, size: "156KB", rules: 3842 },
    timestamp: ts(),
  });
  await delay(500);

  yield createEvent({
    type: "log",
    agent: "browser",
    data: { action: "assets_downloaded", images: 24, fonts: 3, svgs: 18, totalSize: "4.2MB" },
    timestamp: ts(),
  });
  await delay(400);

  yield createEvent({
    type: "agent_update",
    agent: "browser",
    data: { status: "completed", summary: "Captured 4 screenshots, downloaded HTML (248KB), 8 CSS files, 45 assets" },
    timestamp: ts(),
  });
  await delay(300);

  // ------------------------------------------------------------------
  // Phase 2: Vision Agent
  // ------------------------------------------------------------------
  yield createEvent({
    type: "agent_update",
    agent: "vision",
    data: { status: "running", action: "Processing visual data..." },
    timestamp: ts(),
  });
  await delay(900);

  yield createEvent({
    type: "analysis",
    agent: "vision",
    data: { action: "analyzing_colors", palette: colorPalette, extractedColors: 12, dominantHue: "blue" },
    timestamp: ts(),
  });
  await delay(1400);

  yield createEvent({
    type: "analysis",
    agent: "vision",
    data: { action: "analyzing_typography", fonts: typography, detectedPairs: 3 },
    timestamp: ts(),
  });
  await delay(1200);

  yield createEvent({
    type: "analysis",
    agent: "vision",
    data: {
      action: "analyzing_layout",
      gridType: "12-column",
      breakpoints: [320, 768, 1024, 1440],
      spacing: "8px base unit",
    },
    timestamp: ts(),
  });
  await delay(1000);

  yield createEvent({
    type: "analysis",
    agent: "vision",
    data: {
      action: "analyzing_components",
      detected: 28,
      categories: ["navigation", "hero", "cards", "buttons", "forms", "footer"],
    },
    timestamp: ts(),
  });
  await delay(800);

  yield createEvent({
    type: "analysis",
    agent: "vision",
    data: {
      action: "analysis_complete",
      confidence: 0.94,
      designSystem: { colors: colorPalette, typography, spacing: "8px" },
    },
    timestamp: ts(),
  });
  await delay(400);

  yield createEvent({
    type: "agent_update",
    agent: "vision",
    data: { status: "completed", summary: "Extracted design system: 12 colors, 3 font families, 28 components detected (94% confidence)" },
    timestamp: ts(),
  });
  await delay(300);

  // ------------------------------------------------------------------
  // Phase 3: Planning Agent
  // ------------------------------------------------------------------
  yield createEvent({
    type: "agent_update",
    agent: "planning",
    data: { status: "running", action: "Architecting project structure..." },
    timestamp: ts(),
  });
  await delay(800);

  yield createEvent({
    type: "log",
    agent: "planning",
    data: { action: "generating_structure", pages: 1, sections: 6, estimatedComponents: 18 },
    timestamp: ts(),
  });
  await delay(1200);

  yield createEvent({
    type: "log",
    agent: "planning",
    data: { action: "creating_component_tree", tree: componentTree },
    timestamp: ts(),
  });
  await delay(1000);

  yield createEvent({
    type: "log",
    agent: "planning",
    data: {
      action: "tech_stack_selected",
      framework: "Next.js 15",
      styling: "Tailwind CSS 4",
      animations: "Framer Motion",
      icons: "Lucide React",
      reasoning: "Matched to detected design complexity and component count",
    },
    timestamp: ts(),
  });
  await delay(600);

  yield createEvent({
    type: "agent_update",
    agent: "planning",
    data: {
      status: "completed",
      summary: "Planned 18 components across 6 sections. Stack: Next.js 15 + Tailwind + Framer Motion",
    },
    timestamp: ts(),
  });
  await delay(300);

  // ------------------------------------------------------------------
  // Phase 4: Code Agent
  // ------------------------------------------------------------------
  yield createEvent({
    type: "agent_update",
    agent: "code",
    data: { status: "running", action: "Generating production code..." },
    timestamp: ts(),
  });
  await delay(700);

  const componentsToGenerate = [
    "Header",
    "HeroSection",
    "FeatureCard",
    "FeaturesGrid",
    "TestimonialCard",
    "PricingCard",
    "Footer",
  ];

  for (const comp of componentsToGenerate) {
    yield createEvent({
      type: "code",
      agent: "code",
      data: {
        action: "generating_component",
        component: comp,
        file: `src/components/${comp}.tsx`,
        lines: Math.floor(Math.random() * 80) + 40,
      },
      timestamp: ts(),
    });
    await delay(Math.floor(Math.random() * 400) + 500);
  }

  yield createEvent({
    type: "code",
    agent: "code",
    data: {
      action: "creating_styles",
      file: "src/app/globals.css",
      code: sampleCSS,
      customProperties: 12,
    },
    timestamp: ts(),
  });
  await delay(800);

  yield createEvent({
    type: "code",
    agent: "code",
    data: {
      action: "creating_utils",
      file: "src/lib/utils.ts",
      exports: ["cn", "formatDate", "clamp"],
      code: sampleComponentCode,
    },
    timestamp: ts(),
  });
  await delay(500);

  yield createEvent({
    type: "agent_update",
    agent: "code",
    data: {
      status: "completed",
      summary: "Generated 7 components (612 LOC), global styles, and utility library",
    },
    timestamp: ts(),
  });
  await delay(300);

  // ------------------------------------------------------------------
  // Phase 5: QA Agent
  // ------------------------------------------------------------------
  yield createEvent({
    type: "agent_update",
    agent: "qa",
    data: { status: "running", action: "Running visual comparison..." },
    timestamp: ts(),
  });
  await delay(1000);

  yield createEvent({
    type: "qa",
    agent: "qa",
    data: { action: "running_comparison", method: "pixel-diff", screenshots: 4, baseline: "original", actual: "generated" },
    timestamp: ts(),
  });
  await delay(1200);

  for (const issue of qaIssues) {
    yield createEvent({
      type: "qa",
      agent: "qa",
      data: { action: "found_issue", ...issue },
      timestamp: ts(),
    });
    await delay(500);
  }

  yield createEvent({
    type: "qa",
    agent: "qa",
    data: { action: "auto_fixing", issuesFixed: qaIssues.length, method: "css-adjustment" },
    timestamp: ts(),
  });
  await delay(1500);

  yield createEvent({
    type: "qa",
    agent: "qa",
    data: { action: "re_testing", previousSimilarity: "91.2%", newSimilarity: "97.8%" },
    timestamp: ts(),
  });
  await delay(800);

  yield createEvent({
    type: "qa",
    agent: "qa",
    data: { action: "similarity_reached", score: 0.978, threshold: 0.95, passed: true },
    timestamp: ts(),
  });
  await delay(400);

  yield createEvent({
    type: "agent_update",
    agent: "qa",
    data: {
      status: "completed",
      summary: "Found 5 issues, auto-fixed all. Final visual similarity: 97.8%",
    },
    timestamp: ts(),
  });
  await delay(300);

  // ------------------------------------------------------------------
  // Phase 6: Export Agent (信息导出)
  // ------------------------------------------------------------------
  yield createEvent({
    type: "agent_update",
    agent: "deploy",
    data: { status: "running", action: "Preparing export package..." },
    timestamp: ts(),
  });
  await delay(800);

  yield createEvent({
    type: "deploy",
    agent: "deploy",
    data: { action: "creating_repo", name: "cloned-site", visibility: "private" },
    timestamp: ts(),
  });
  await delay(1000);

  yield createEvent({
    type: "deploy",
    agent: "deploy",
    data: { action: "pushing_code", files: 24, commits: 1, branch: "main" },
    timestamp: ts(),
  });
  await delay(1200);

  yield createEvent({
    type: "deploy",
    agent: "deploy",
    data: { action: "deploying", platform: "Vercel", region: "iad1", buildTime: "42s" },
    timestamp: ts(),
  });
  await delay(2000);

  yield createEvent({
    type: "deploy",
    agent: "deploy",
    data: {
      action: "deployed",
      url: `https://cloned-site-${Date.now().toString(36)}.vercel.app`,
      status: "live",
      lighthouse: { performance: 96, accessibility: 100, bestPractices: 100, seo: 98 },
    },
    timestamp: ts(),
  });
  await delay(300);

  yield createEvent({
    type: "agent_update",
    agent: "deploy",
    data: { status: "completed", summary: "Deployed to Vercel. Lighthouse: 96/100/100/98" },
    timestamp: ts(),
  });
  await delay(200);

  // ------------------------------------------------------------------
  // Complete
  // ------------------------------------------------------------------
  yield createEvent({
    type: "complete",
    agent: "system",
    data: {
      totalDuration: "32.4s",
      agentsUsed: 6,
      componentsGenerated: 18,
      visualSimilarity: "97.8%",
      deployUrl: `https://cloned-site-${Date.now().toString(36)}.vercel.app`,
      summary: `Successfully reverse-engineered ${url} and deployed a pixel-perfect clone.`,
    },
    timestamp: ts(),
  });
}

// =====================================================================
// Route Handler
// =====================================================================

export async function POST(request: NextRequest) {
  // 总控制开关：管理员暂停服务时拒绝所有生成请求
  if (!liveStats.generationEnabled) {
    return new Response(
      JSON.stringify({ error: "网页生成服务已暂停，请稍后再试。" }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await request.json();
    const { url } = body as { url?: string };

    if (!url || typeof url !== "string") {
      return new Response(
        JSON.stringify({ error: "A valid `url` string is required." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const event of generateWorkflow(url)) {
            controller.enqueue(encoder.encode(event));
          }
        } catch (err) {
          const errorEvent = createEvent({
            type: "log",
            agent: "system",
            data: { action: "error", message: err instanceof Error ? err.message : "Unknown error" },
            timestamp: ts(),
          });
          controller.enqueue(encoder.encode(errorEvent));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid request body." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
}
