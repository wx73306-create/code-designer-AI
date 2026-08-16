// =====================================================================
// Design Knowledge Base — RAG-style design rule libraries
// Automatically matched and injected into AI prompts based on
// the vision analysis results to improve generation quality
// =====================================================================

/** A design pattern rule set for a specific website style */
export interface DesignPattern {
  id: string;
  name: string;
  keywords: string[];
  description: string;
  rules: {
    layout: string;
    spacing: string;
    typography: string;
    colors: string[];
    animation: string[];
    components: string[];
    responsive: string;
    hero: string;
    navigation: string;
    cta: string;
    images: string;
  };
  cssStrategy: string;
  codePatterns: string[];
}

// =====================================================================
// Knowledge Base: Design Pattern Libraries
// =====================================================================

export const DESIGN_KNOWLEDGE: DesignPattern[] = [
  {
    id: 'apple-minimal',
    name: 'Apple-style Minimal Luxury',
    keywords: ['apple', 'minimal', 'luxury', 'product', 'clean', 'premium', 'white space', 'sf pro'],
    description: 'Apple-inspired minimal design with large whitespace, center-focused layouts, and subtle scroll animations.',
    rules: {
      layout: 'Center-focused single column. Full viewport hero. Sections alternate between light and dark backgrounds. Max-width containers (980px-1200px) centered.',
      spacing: 'Large whitespace. Section padding 80-120px vertical. Component gap 40-60px. Text line-height 1.4-1.5.',
      typography: 'SF Pro Display for headings (600-700 weight, 48-80px). SF Pro Text for body (400 weight, 17-21px). Tight letter-spacing (-0.02em to -0.04em) on large headings.',
      colors: ['#000000', '#FFFFFF', '#86868b', '#1d1d1f', '#f5f5f7', '#0071E3'],
      animation: ['Scroll-triggered fade-in-up (IntersectionObserver)', 'Parallax on hero images', 'Subtle scale on hover (1.02-1.05)', 'Sticky navigation with blur backdrop'],
      components: ['StickyNavbar (blur backdrop)', 'HeroSection (full viewport, center text)', 'ProductShowcase (large image + specs)', 'FeatureGrid (2-3 column)', 'VideoSection (autoplay muted)', 'CTASection', 'Footer (multi-column links)'],
      responsive: 'Mobile-first. Hide secondary elements on mobile. Stack grids to single column. Reduce font sizes 30%. Touch-friendly CTA buttons (min 44px height).',
      hero: 'Full viewport height. Large centered headline. Subtle gradient background. Product image or 3D model below text. Two CTA buttons (primary filled + secondary outline).',
      navigation: 'Fixed top. Backdrop-filter blur(20px). Semi-transparent background. Logo left, links center, CTA right. Collapses to hamburger on mobile.',
      cta: 'Rounded-full or rounded-lg buttons. Primary: filled blue (#0071E3). Secondary: outline or text link. Hover: slight scale + brightness change.',
      images: 'High-resolution product photography. Dark or gradient backgrounds. Lazy loading with blur placeholder. Aspect ratio preserved.',
    },
    cssStrategy: 'Use CSS custom properties for all design tokens. Prefer system font stack (SF Pro → system-ui). Use clamp() for fluid typography. Tailwind utility classes with custom theme extension.',
    codePatterns: [
      'Use framer-motion useInView for scroll-triggered animations',
      'Implement sticky nav with IntersectionObserver + backdrop-filter',
      'Use next/image for optimized product photography',
      'Prefer CSS Grid for product showcase sections',
    ],
  },
  {
    id: 'material-design',
    name: 'Material Design / Google Style',
    keywords: ['material', 'google', 'card', 'elevation', 'roboto', 'colorful'],
    description: 'Google Material Design with elevation system, card-based layouts, and vibrant accent colors.',
    rules: {
      layout: 'Card-based grid layout. App bar + drawer navigation. FAB (Floating Action Button) for primary actions. 12-column grid system.',
      spacing: '8dp base unit. Margins: 16dp (mobile), 24dp (desktop). Card padding: 16dp. Component spacing: 8-16dp.',
      typography: 'Roboto font family. Type scale: h1(96px) → h6(20px) → body1(16px) → caption(12px). Letter-spacing varies by level.',
      colors: ['#6200EE', '#03DAC6', '#B00020', '#FFFFFF', '#121212', '#1E1E1E'],
      animation: ['Ripple effect on touch/click', 'Shared element transitions', 'Elevation change on press (2dp → 8dp)', 'Fade + slide for page transitions'],
      components: ['AppBar (top)', 'NavigationDrawer (side)', 'Card (elevated)', 'FAB (floating)', 'Chip (filter/tag)', 'DataTable', 'Snackbar (notification)'],
      responsive: 'Breakpoints: 600px (mobile), 960px (tablet), 1280px (desktop). Navigation switches from drawer to rail to persistent.',
      hero: 'Large app bar with gradient or image background. Title + subtitle + action buttons. Optional search overlay.',
      navigation: 'Top app bar (fixed) + side navigation drawer. Drawer collapses to rail on tablet, hidden on mobile (hamburger trigger).',
      cta: 'Elevated button (filled, tonal, outlined, text variants). Ripple effect. Icon + label. Min height 36dp.',
      images: 'Rounded corners (8-16dp). Aspect ratio containers. Placeholder shimmer loading.',
    },
    cssStrategy: 'Use Material Design tokens (md.sys.color, md.sys.elevation). CSS custom properties for theming. Box-shadow for elevation levels (0-24dp).',
    codePatterns: [
      'Implement elevation with layered box-shadows',
      'Use CSS container queries for card responsiveness',
      'Ripple effect via pseudo-element + animation',
      'Theme provider with CSS custom properties',
    ],
  },
  {
    id: 'gaming-cinematic',
    name: 'Gaming / Cinematic Dark',
    keywords: ['game', 'gaming', 'cinematic', 'dark', 'particle', 'neon', 'epic', 'dramatic'],
    description: 'Dark cinematic gaming websites with particle effects, neon accents, full-screen heroes, and dramatic typography.',
    rules: {
      layout: 'Full-screen sections. Overlapping layers. Diagonal or angular section dividers. Video backgrounds.',
      spacing: 'Generous vertical spacing (100-200px sections). Tight internal spacing for UI elements. Asymmetric padding.',
      typography: 'Display fonts (Orbitron, Rajdhani, Bebas Neue). Massive headings (80-150px). Uppercase text. Glitch or glow effects.',
      colors: ['#0a0a0a', '#1a1a2e', '#e94560', '#00ff88', '#ff6600', '#7b2ff7'],
      animation: ['Particle systems (canvas/WebGL)', 'Glitch text effects', 'Parallax layers', 'Neon glow pulses', 'Video auto-play backgrounds', 'Scroll-triggered reveals'],
      components: ['HeroVideo (fullscreen autoplay)', 'ParticleCanvas', 'CharacterShowcase (3D model viewer)', 'NewsGrid', 'TrailerSection', 'PreOrderCTA (glowing)'],
      responsive: 'Simplified on mobile: disable particles, reduce video quality, stack sections. Touch-friendly CTA (min 48px).',
      hero: 'Fullscreen cinematic. Video or WebGL background. Massive title with glow effect. Subtitle + CTA. Scroll indicator with animation.',
      navigation: 'Minimal top bar. Transparent background becoming solid on scroll. Logo + few links. Social icons.',
      cta: 'Glowing neon buttons. Animated border gradients. Hover: glow intensifies + slight lift. Pulse animation on idle.',
      images: 'Dark atmospheric photography. Heavy use of gradients and overlays. Character art with transparent backgrounds.',
    },
    cssStrategy: 'CSS custom properties for neon colors. Heavy use of box-shadow for glow effects. Clip-path for angular dividers. Canvas/WebGL for particles.',
    codePatterns: [
      'Use canvas or react-particles for background effects',
      'Implement glow with layered box-shadows + text-shadow',
      'Use clip-path for diagonal section dividers',
      'Video backgrounds with poster image fallback',
    ],
  },
  {
    id: 'dashboard-saas',
    name: 'SaaS Dashboard / Admin Panel',
    keywords: ['dashboard', 'saas', 'admin', 'data', 'chart', 'table', 'analytics', 'panel', 'management'],
    description: 'Clean SaaS dashboards with sidebar navigation, data visualization, tables, and form-heavy interfaces.',
    rules: {
      layout: 'Sidebar (fixed left, 240-280px) + main content area. Top bar with search + user menu. Content organized in cards/panels.',
      spacing: 'Compact: 16-24px padding. Card gap: 16px. Table row height: 48-56px. Form field gap: 12-16px.',
      typography: 'Inter or similar sans-serif. Sizes: heading(20-24px), body(14px), caption(12px), data(13px mono). Tight spacing for data density.',
      colors: ['#0f172a', '#1e293b', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#f8fafc'],
      animation: ['Skeleton loading states', 'Number counter animations', 'Chart enter animations', 'Slide-in drawers/panels', 'Toast notifications'],
      components: ['Sidebar (collapsible)', 'TopBar (search + user)', 'StatCard (metric + trend)', 'DataTable (sortable/filterable)', 'Chart (line/bar/pie)', 'FormBuilder', 'Modal/Drawer'],
      responsive: 'Sidebar collapses to overlay on mobile. Tables become card lists. Charts stack vertically. Touch-friendly inputs (min 44px height).',
      hero: 'Not applicable — dashboards use welcome/stats section instead. Key metrics in card grid. Quick actions bar.',
      navigation: 'Fixed sidebar with icon + label. Active state highlight. Collapsible to icon-only mode. Top bar for global search, notifications, user menu.',
      cta: 'Small to medium buttons. Primary filled, secondary outline, ghost for tertiary. Icon buttons in tables. Dropdown menus for actions.',
      images: 'Avatars (circular). Status icons. Empty state illustrations. Minimal decorative imagery.',
    },
    cssStrategy: 'CSS Grid for dashboard layouts. Custom scrollbar styling. Dense data tables with sticky headers. Responsive breakpoints for sidebar behavior.',
    codePatterns: [
      'Use CSS Grid with sidebar toggle (grid-template-columns)',
      'Implement data tables with virtual scrolling for large datasets',
      'Chart libraries: recharts or chart.js with responsive containers',
      'Skeleton loading with CSS animation for async data',
    ],
  },
  {
    id: 'ecommerce',
    name: 'E-commerce / Online Store',
    keywords: ['shop', 'store', 'ecommerce', 'product', 'cart', 'buy', 'price', 'checkout', 'retail'],
    description: 'Product-focused e-commerce layouts with grid galleries, quick-view, cart functionality, and conversion-optimized design.',
    rules: {
      layout: 'Header (logo + search + cart) → Hero banner/carousel → Category grid → Product grid → Featured section → Footer. Max-width 1440px.',
      spacing: 'Section padding: 60-80px. Product grid gap: 20-30px. Card padding: 16-20px. Form spacing: 12-16px.',
      typography: 'Clean sans-serif (Inter, Poppins). Headings: 24-36px bold. Product names: 14-16px medium. Prices: 18-24px bold. Sale prices: strikethrough + color.',
      colors: ['#000000', '#FFFFFF', '#e63946', '#2d6a4f', '#f4a261', '#264653', '#f8f9fa'],
      animation: ['Image zoom on hover', 'Add-to-cart micro-animation', 'Carousel auto-slide', 'Quick-view modal slide-in', 'Price counter animation'],
      components: ['ProductCard (image + name + price + rating)', 'CategoryNav (horizontal scroll)', 'CartDrawer (slide-in)', 'ProductGallery (zoom + thumbnails)', 'FilterSidebar', 'CheckoutForm'],
      responsive: 'Product grid: 4 cols → 3 → 2 → 1. Filter becomes bottom sheet on mobile. Sticky add-to-cart bar on mobile product pages.',
      hero: 'Carousel/slider with promotional banners. Navigation arrows + dots. Auto-play with pause on hover. CTA overlay on each slide.',
      navigation: 'Top: mega-menu with categories + sub-categories. Sticky on scroll. Search bar prominent. Cart icon with badge count.',
      cta: '"Add to Cart" primary button (filled, prominent). "Buy Now" secondary. Wishlist heart icon. Quantity selector inline.',
      images: 'Square or 4:5 aspect ratio product photos. White/neutral backgrounds. Multiple angles with thumbnail gallery. Zoom on hover.',
    },
    cssStrategy: 'CSS Grid for product galleries (auto-fill, minmax). Aspect-ratio for consistent card sizes. Custom scrollbar for horizontal category nav.',
    codePatterns: [
      'Use CSS aspect-ratio for uniform product cards',
      'Implement image lazy loading with IntersectionObserver',
      'Cart state with Zustand (persisted to localStorage)',
      'Skeleton cards during product data loading',
    ],
  },
  {
    id: 'portfolio-creative',
    name: 'Creative Portfolio / Agency',
    keywords: ['portfolio', 'agency', 'creative', 'design', 'studio', 'art', 'freelance', 'werk'],
    description: 'Bold creative portfolios with large typography, asymmetric layouts, custom cursors, and experimental interactions.',
    rules: {
      layout: 'Asymmetric grid. Overlapping elements. Full-bleed images. Horizontal scrolling sections. Generous negative space.',
      spacing: 'Extreme whitespace (120-200px sections). Tight typography groupings. Asymmetric padding (left-heavy or right-heavy).',
      typography: 'Mixed serif + sans-serif. Oversized display text (100-200px). Creative text treatments (outlined, mixed case, rotated). Marquee text.',
      colors: ['#0a0a0a', '#f5f0eb', '#ff4d00', '#2d2d2d', '#c9b99a', '#1a1a1a'],
      animation: ['Custom cursor follower', 'Horizontal scroll on drag', 'Text reveal (clip-path or mask)', 'Image parallax on scroll', 'Magnetic buttons', 'Page transitions'],
      components: ['HeroType (oversized typography)', 'ProjectGrid (masonry/asymmetric)', 'Marquee (infinite scroll text)', 'CaseStudy (full-page)', 'AboutTimeline', 'ContactMinimal'],
      responsive: 'Simplified layouts on mobile. Disable custom cursor. Vertical instead of horizontal scroll. Reduced animation complexity.',
      hero: 'Oversized typography filling viewport. Minimal navigation. Creative text arrangement (stacked, overlapping, mixed sizes). Subtle background texture.',
      navigation: 'Minimal. Logo + few links. Often hamburger even on desktop. Full-screen overlay menu with large text. Creative transitions.',
      cta: 'Text links with underline animations. Magnetic hover effects. Arrow indicators. No traditional buttons.',
      images: 'Full-bleed photography. Duotone or color overlay treatments. Asymmetric cropping. Hover reveals or transitions.',
    },
    cssStrategy: 'CSS clip-path for creative shapes. mix-blend-mode for text/image interactions. Custom properties for cursor position. Scroll-driven animations.',
    codePatterns: [
      'Custom cursor with requestAnimationFrame follower',
      'Horizontal scroll with CSS scroll-snap or transform',
      'Text reveal with clip-path animation on IntersectionObserver',
      'Magnetic button effect with mouse position tracking',
    ],
  },
];

// =====================================================================
// Matching Logic
// =====================================================================

/** Match detected website characteristics against the knowledge base */
export function matchDesignPatterns(analysis: {
  colors?: Array<{ hex: string; name?: string; usage?: string }>;
  typography?: Array<{ family?: string; size?: string }>;
  layout?: Record<string, unknown>;
  raw?: string;
}): DesignPattern[] {
  const matches: Array<{ pattern: DesignPattern; score: number }> = [];

  // Build a text fingerprint from the analysis
  const fingerprint = [
    ...analysis.colors?.map(c => `${c.hex} ${c.name || ''} ${c.usage || ''}`) || [],
    ...analysis.typography?.map(t => `${t.family || ''} ${t.size || ''}`) || [],
    JSON.stringify(analysis.layout || {}),
    analysis.raw || '',
  ].join(' ').toLowerCase();

  for (const pattern of DESIGN_KNOWLEDGE) {
    let score = 0;

    // Check keyword matches
    for (const keyword of pattern.keywords) {
      if (fingerprint.includes(keyword.toLowerCase())) {
        score += 2;
      }
    }

    // Check color similarity
    if (analysis.colors?.length) {
      for (const knownColor of pattern.rules.colors) {
        const hasSimilar = analysis.colors.some(c =>
          colorDistance(c.hex, knownColor) < 40
        );
        if (hasSimilar) score += 1;
      }
    }

    // Check font family matches
    if (analysis.typography?.length) {
      const families = analysis.typography.map(t => (t.family || '').toLowerCase());
      if (pattern.rules.typography.toLowerCase().split(' ').some(word =>
        word.length > 3 && families.some(f => f.includes(word))
      )) {
        score += 3;
      }
    }

    if (score > 0) {
      matches.push({ pattern, score });
    }
  }

  // Sort by score descending, return top 2
  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, 2).map(m => m.pattern);
}

/** Format matched patterns into prompt context for the AI */
export function formatKnowledgeContext(patterns: DesignPattern[]): string {
  if (patterns.length === 0) return '';

  let context = `\n## 匹配到的设计规则知识库\n`;
  context += `以下是与该网站风格最匹配的设计规范，请在生成代码时参考：\n\n`;

  for (const pattern of patterns) {
    context += `### ${pattern.name}\n`;
    context += `${pattern.description}\n\n`;
    context += `- **布局策略**: ${pattern.rules.layout}\n`;
    context += `- **间距系统**: ${pattern.rules.spacing}\n`;
    context += `- **字体规范**: ${pattern.rules.typography}\n`;
    context += `- **色彩方案**: ${pattern.rules.colors.join(', ')}\n`;
    context += `- **动画效果**: ${pattern.rules.animation.join(', ')}\n`;
    context += `- **Hero区域**: ${pattern.rules.hero}\n`;
    context += `- **导航设计**: ${pattern.rules.navigation}\n`;
    context += `- **CTA按钮**: ${pattern.rules.cta}\n`;
    context += `- **CSS策略**: ${pattern.cssStrategy}\n`;
    context += `- **代码模式**:\n`;
    for (const p of pattern.codePatterns) {
      context += `  - ${p}\n`;
    }
    context += `\n`;
  }

  return context;
}

// =====================================================================
// Utilities
// =====================================================================

/** Calculate color distance between two hex colors (simple Euclidean in RGB) */
function colorDistance(hex1: string, hex2: string): number {
  try {
    const r1 = parseInt(hex1.slice(1, 3), 16);
    const g1 = parseInt(hex1.slice(3, 5), 16);
    const b1 = parseInt(hex1.slice(5, 7), 16);
    const r2 = parseInt(hex2.slice(1, 3), 16);
    const g2 = parseInt(hex2.slice(3, 5), 16);
    const b2 = parseInt(hex2.slice(5, 7), 16);
    return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
  } catch {
    return 999;
  }
}
