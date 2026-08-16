/**
 * Web Design Knowledge Base — Style Profiles
 * 7 种设计风格档案，每种包含完整的设计哲学、视觉规则、布局规则、
 * 颜色规则、字体规则、组件规则、动画规则和禁止事项。
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StyleProfile {
  id: string;
  name: string;
  nameZh: string;
  description: string;
  philosophy: string[];
  keywords: string[];
  layout: {
    spacing: 'compact' | 'medium' | 'large' | 'extreme';
    grid: string;
    alignment: 'left' | 'center' | 'mixed';
    heroRatio: string;
    density: 'low' | 'medium' | 'high';
    type: string;
  };
  color: {
    background: string[];
    text: string;
    accent: string;
    primary?: string;
    isDark: boolean;
    usesGradient: boolean;
  };
  typography: {
    titleSize: 'small' | 'medium' | 'large' | 'very-large' | 'extreme';
    font: string;
    weight: 'light' | 'regular' | 'medium' | 'semibold' | 'bold';
    lineHeight: 'tight' | 'normal' | 'relaxed';
  };
  components: {
    preferred: string[];
    avoid: string[];
    count: 'few' | 'medium' | 'many';
  };
  image: {
    priority: 'low' | 'medium' | 'high' | 'extreme';
    ratio: string;
    style: string;
  };
  animation: {
    style: 'none' | 'subtle' | 'moderate' | 'expressive';
    effects: string[];
    microInteraction: boolean;
    duration: string;
  };
  avoid: string[];
  rules: string[];
  tokens: {
    spacing: { small: number; medium: number; large: number };
    radius: number;
    shadow: 'none' | 'soft' | 'medium' | 'strong';
  };
}

// ---------------------------------------------------------------------------
// Style Profiles Database
// ---------------------------------------------------------------------------

export const STYLE_PROFILES: StyleProfile[] = [
  // =========================================================================
  // 1. Apple Style — Premium Minimal Technology
  // =========================================================================
  {
    id: 'apple-style',
    name: 'Apple Style',
    nameZh: '苹果风格',
    description: 'Premium minimal technology design with extreme whitespace and product storytelling',
    philosophy: ['simplicity', 'focus', 'emotion', 'product storytelling'],
    keywords: [
      'minimal', 'clean', 'white', 'product', 'premium', 'elegant',
      'whitespace', 'hero image', 'large text', 'centered',
    ],
    layout: {
      spacing: 'extreme',
      grid: '12 column',
      alignment: 'center',
      heroRatio: '60%',
      density: 'low',
      type: 'single column hero',
    },
    color: {
      background: ['#FFFFFF', '#F5F5F7'],
      text: '#1D1D1F',
      accent: '#0071E3',
      isDark: false,
      usesGradient: false,
    },
    typography: {
      titleSize: 'very-large',
      font: 'SF Pro',
      weight: 'bold',
      lineHeight: 'tight',
    },
    components: {
      preferred: ['Hero', 'Product Showcase', 'Feature Highlight', 'Sticky Nav'],
      avoid: ['many cards', 'complex dashboard', 'heavy border', 'sidebar'],
      count: 'few',
    },
    image: {
      priority: 'extreme',
      ratio: 'large',
      style: 'high quality product photography',
    },
    animation: {
      style: 'subtle',
      effects: ['fade', 'scale', 'parallax scroll'],
      microInteraction: false,
      duration: '400-600ms',
    },
    avoid: [
      'cluttered layouts', 'too many colors', 'small fonts', 'busy backgrounds',
      'excessive borders', 'carousel overload', 'pop-ups',
    ],
    rules: [
      'Large whitespace between sections (80-120px)',
      'One hero product image dominates the viewport',
      'Maximum 2-3 colors per page',
      'Typography hierarchy: 56px title → 28px subtitle → 17px body',
      'Center-aligned content with generous padding',
      'Smooth scroll-triggered fade animations',
      'Product images must be high-resolution with clean backgrounds',
    ],
    tokens: {
      spacing: { small: 8, medium: 24, large: 80 },
      radius: 12,
      shadow: 'soft',
    },
  },

  // =========================================================================
  // 2. Stripe Style — Developer-First Technical Beauty
  // =========================================================================
  {
    id: 'stripe-style',
    name: 'Stripe Style',
    nameZh: 'Stripe 风格',
    description: 'Developer-first design with gradient backgrounds, complex grids, and technical elegance',
    philosophy: ['developer first', 'data driven', 'technical beauty', 'clarity'],
    keywords: [
      'gradient', 'purple', 'developer', 'code', 'dashboard', 'technical',
      'glass', 'blur', 'complex grid', 'documentation',
    ],
    layout: {
      spacing: 'medium',
      grid: 'complex multi-column',
      alignment: 'left',
      heroRatio: '50%',
      density: 'medium',
      type: 'complex grid',
    },
    color: {
      background: ['#0A2540', '#FFFFFF'],
      text: '#425466',
      accent: '#635BFF',
      primary: 'purple',
      isDark: false,
      usesGradient: true,
    },
    typography: {
      titleSize: 'large',
      font: 'Sohne / Inter',
      weight: 'semibold',
      lineHeight: 'normal',
    },
    components: {
      preferred: ['Dashboard', 'Code Block', 'Statistics', 'Cards', 'Gradient Hero', 'API Demo'],
      avoid: ['fullscreen images', 'minimal text', 'single column'],
      count: 'many',
    },
    image: {
      priority: 'medium',
      ratio: 'medium',
      style: 'illustrations and UI screenshots',
    },
    animation: {
      style: 'moderate',
      effects: ['gradient shift', 'glass blur', 'slide', 'counter'],
      microInteraction: true,
      duration: '200-400ms',
    },
    avoid: [
      'flat solid backgrounds everywhere', 'no visual hierarchy', 'plain text walls',
      'oversized images without context',
    ],
    rules: [
      'Gradient backgrounds for hero sections (purple → blue → teal)',
      'Code blocks with syntax highlighting as visual elements',
      'Card-based layouts with subtle shadows and borders',
      'Data visualization and statistics prominently displayed',
      'Glass-morphism effects on floating elements',
      'Clear information hierarchy with progressive disclosure',
      'Interactive demos and live API examples',
    ],
    tokens: {
      spacing: { small: 8, medium: 16, large: 64 },
      radius: 8,
      shadow: 'medium',
    },
  },

  // =========================================================================
  // 3. Linear Style — Dark Minimal Developer Tool
  // =========================================================================
  {
    id: 'linear-style',
    name: 'Linear Style',
    nameZh: 'Linear 风格',
    description: 'Dark, minimal, developer-focused design with high density and precise micro-interactions',
    philosophy: ['dark', 'minimal', 'developer', 'efficient', 'precision'],
    keywords: [
      'dark', 'minimal', 'developer', 'efficient', 'tool', 'productivity',
      'command menu', 'dense', 'monochrome', 'keyboard',
    ],
    layout: {
      spacing: 'medium',
      grid: '12 column',
      alignment: 'left',
      heroRatio: '45%',
      density: 'high',
      type: 'feature grid',
    },
    color: {
      background: ['#08090A', '#0F1011'],
      text: '#FFFFFF',
      accent: '#5E6AD2',
      isDark: true,
      usesGradient: false,
    },
    typography: {
      titleSize: 'large',
      font: 'Inter',
      weight: 'medium',
      lineHeight: 'normal',
    },
    components: {
      preferred: ['Command Menu', 'Feature Grid', 'Product Animation', 'Keyboard Shortcuts', 'Changelog'],
      avoid: ['colorful elements', 'large images', 'decorative graphics', 'carousels'],
      count: 'medium',
    },
    image: {
      priority: 'medium',
      ratio: 'medium',
      style: 'product UI screenshots on dark background',
    },
    animation: {
      style: 'subtle',
      effects: ['fade', 'slide-up', 'micro interaction'],
      microInteraction: true,
      duration: '200ms',
    },
    avoid: [
      'bright colors', 'large decorative images', 'playful animations',
      'rounded corners > 8px', 'gradients', 'shadows',
    ],
    rules: [
      'Dark background (#08090A) with white/gray text',
      'High information density — no wasted space',
      'Subtle borders (1px, rgba(255,255,255,0.06)) for separation',
      'Micro-interactions on hover (200ms, ease-out)',
      'Monochrome palette with single accent color',
      'Product screenshots as primary visual content',
      'Keyboard-first interaction patterns',
    ],
    tokens: {
      spacing: { small: 4, medium: 12, large: 48 },
      radius: 6,
      shadow: 'none',
    },
  },

  // =========================================================================
  // 4. Tesla Style — Emotional Fullscreen Immersion
  // =========================================================================
  {
    id: 'tesla-style',
    name: 'Tesla Style',
    nameZh: '特斯拉风格',
    description: 'Emotional, futuristic design with fullscreen imagery and minimal text overlay',
    philosophy: ['emotion', 'technology', 'future', 'immersion'],
    keywords: [
      'fullscreen', 'immersive', 'future', 'electric', 'cinematic',
      'minimal text', 'large image', 'scroll snap', 'dramatic',
    ],
    layout: {
      spacing: 'extreme',
      grid: 'single column',
      alignment: 'center',
      heroRatio: '100%',
      density: 'low',
      type: 'fullscreen sections',
    },
    color: {
      background: ['#000000', '#FFFFFF'],
      text: '#171A20',
      accent: '#3E6AE1',
      isDark: false,
      usesGradient: false,
    },
    typography: {
      titleSize: 'large',
      font: 'Gotham / Montserrat',
      weight: 'medium',
      lineHeight: 'tight',
    },
    components: {
      preferred: ['Fullscreen Hero', 'Scroll Snap Sections', 'Spec Table', 'CTA Bar', 'Video Background'],
      avoid: ['large text blocks', 'many buttons', 'card grids', 'sidebars', 'complex navigation'],
      count: 'few',
    },
    image: {
      priority: 'extreme',
      ratio: 'fullscreen',
      style: 'cinematic photography, dramatic lighting',
    },
    animation: {
      style: 'moderate',
      effects: ['scroll snap', 'parallax', 'fade-in', 'video autoplay'],
      microInteraction: false,
      duration: '600-1000ms',
    },
    avoid: [
      'large text blocks', 'many buttons', 'complex navigation',
      'card grids', 'busy layouts', 'small images',
    ],
    rules: [
      'Each section is a fullscreen viewport (100vh)',
      'Background images/videos dominate — text is overlay',
      'Maximum 2 lines of text per section',
      'Scroll-snap for section-by-section navigation',
      'Minimal UI chrome — no visible borders or cards',
      'CTA buttons are small, understated, bottom-positioned',
      'Dramatic product photography with cinematic lighting',
    ],
    tokens: {
      spacing: { small: 12, medium: 32, large: 96 },
      radius: 4,
      shadow: 'none',
    },
  },

  // =========================================================================
  // 5. Luxury Style — High-End Editorial Elegance
  // =========================================================================
  {
    id: 'luxury-style',
    name: 'Luxury Style',
    nameZh: '奢侈品风格',
    description: 'High-end editorial design with extreme whitespace, serif typography, and photographic focus',
    philosophy: ['exclusivity', 'craftsmanship', 'heritage', 'understated elegance'],
    keywords: [
      'luxury', 'elegant', 'serif', 'editorial', 'fashion', 'premium',
      'gold', 'black', 'photography', 'exclusive', 'bespoke',
    ],
    layout: {
      spacing: 'extreme',
      grid: '12 column editorial',
      alignment: 'center',
      heroRatio: '70%',
      density: 'low',
      type: 'editorial spread',
    },
    color: {
      background: ['#FFFFFF', '#FAFAF8', '#000000'],
      text: '#1A1A1A',
      accent: '#B8860B',
      isDark: false,
      usesGradient: false,
    },
    typography: {
      titleSize: 'very-large',
      font: 'Didot / Playfair Display',
      weight: 'light',
      lineHeight: 'relaxed',
    },
    components: {
      preferred: ['Fullscreen Image', 'Editorial Spread', 'Lookbook', 'Minimal Nav', 'Text Overlay'],
      avoid: ['cards', 'buttons with backgrounds', 'icons', 'grids of items', 'badges'],
      count: 'few',
    },
    image: {
      priority: 'extreme',
      ratio: 'large',
      style: 'professional fashion/product photography, artistic',
    },
    animation: {
      style: 'subtle',
      effects: ['slow fade', 'parallax', 'letter spacing reveal'],
      microInteraction: false,
      duration: '800-1200ms',
    },
    avoid: [
      'bright colors', 'rounded corners', 'shadows', 'icons',
      'busy patterns', 'multiple CTAs', 'countdown timers', 'pop-ups',
    ],
    rules: [
      'Extreme whitespace — content occupies < 40% of viewport',
      'Serif typography for headings (Didot, Playfair, Bodoni)',
      'Letter-spacing on uppercase labels (0.2-0.4em)',
      'Full-bleed photography as primary content',
      'Maximum 2 typefaces per page',
      'Muted color palette — black, white, one metallic accent',
      'Slow, deliberate animations (800ms+)',
    ],
    tokens: {
      spacing: { small: 16, medium: 48, large: 120 },
      radius: 0,
      shadow: 'none',
    },
  },

  // =========================================================================
  // 6. SaaS Style — Modern Product-Led Growth
  // =========================================================================
  {
    id: 'saas-style',
    name: 'SaaS Style',
    nameZh: 'SaaS 风格',
    description: 'Modern SaaS product design with clear value propositions, social proof, and conversion focus',
    philosophy: ['clarity', 'trust', 'conversion', 'product-led'],
    keywords: [
      'saas', 'product', 'startup', 'conversion', 'testimonial',
      'pricing', 'feature', 'benefit', 'cta', 'modern',
    ],
    layout: {
      spacing: 'large',
      grid: '12 column',
      alignment: 'center',
      heroRatio: '50%',
      density: 'medium',
      type: 'section-based funnel',
    },
    color: {
      background: ['#FFFFFF', '#F8FAFC'],
      text: '#1E293B',
      accent: '#2563EB',
      primary: 'blue',
      isDark: false,
      usesGradient: false,
    },
    typography: {
      titleSize: 'large',
      font: 'Inter / Plus Jakarta Sans',
      weight: 'bold',
      lineHeight: 'normal',
    },
    components: {
      preferred: ['Hero + CTA', 'Feature Grid', 'Testimonials', 'Pricing Table', 'Logo Bar', 'FAQ'],
      avoid: ['fullscreen images', 'dark themes', 'experimental layouts'],
      count: 'many',
    },
    image: {
      priority: 'medium',
      ratio: 'medium',
      style: 'product screenshots, illustrations',
    },
    animation: {
      style: 'moderate',
      effects: ['fade-up', 'counter', 'scroll reveal', 'hover lift'],
      microInteraction: true,
      duration: '300-500ms',
    },
    avoid: [
      'dark backgrounds', 'experimental navigation', 'no clear CTA',
      'walls of text', 'missing social proof',
    ],
    rules: [
      'Clear value proposition above the fold (headline + subtext + CTA)',
      'Social proof early: logo bar, testimonials, metrics',
      'Feature sections with icon + title + description pattern',
      'Pricing table with 3 tiers (highlight recommended)',
      'Multiple CTAs throughout the page funnel',
      'Trust signals: security badges, uptime stats, customer count',
      'Clean, readable typography with clear hierarchy',
    ],
    tokens: {
      spacing: { small: 8, medium: 24, large: 72 },
      radius: 12,
      shadow: 'soft',
    },
  },

  // =========================================================================
  // 7. Gaming Style — High-Energy Neon Immersion
  // =========================================================================
  {
    id: 'gaming-style',
    name: 'Gaming Style',
    nameZh: '游戏风格',
    description: 'High-contrast, neon-accented design with 3D elements, particles, and aggressive typography',
    philosophy: ['energy', 'immersion', 'community', 'competition'],
    keywords: [
      'gaming', 'neon', 'dark', '3d', 'particle', 'esports',
      'high contrast', 'aggressive', 'glow', 'cyberpunk',
    ],
    layout: {
      spacing: 'medium',
      grid: 'asymmetric',
      alignment: 'mixed',
      heroRatio: '80%',
      density: 'high',
      type: 'immersive asymmetric',
    },
    color: {
      background: ['#0D0D0D', '#1A1A2E'],
      text: '#FFFFFF',
      accent: '#00FF88',
      primary: 'neon green',
      isDark: true,
      usesGradient: true,
    },
    typography: {
      titleSize: 'extreme',
      font: 'Rajdhani / Orbitron',
      weight: 'bold',
      lineHeight: 'tight',
    },
    components: {
      preferred: ['Video Hero', '3D Element', 'Particle Background', 'Neon Card', 'Stats Counter', 'Tournament Bracket'],
      avoid: ['plain text sections', 'minimal layouts', 'light backgrounds', 'serif fonts'],
      count: 'many',
    },
    image: {
      priority: 'high',
      ratio: 'large',
      style: '3D renders, game art, neon-lit photography',
    },
    animation: {
      style: 'expressive',
      effects: ['particle', 'glow pulse', '3d rotate', 'glitch', 'counter', 'parallax'],
      microInteraction: true,
      duration: '200-600ms',
    },
    avoid: [
      'light backgrounds', 'serif fonts', 'minimal design', 'muted colors',
      'static layouts', 'corporate imagery',
    ],
    rules: [
      'Dark background (#0D0D0D) with neon accent colors',
      'High contrast — text must pop against dark surfaces',
      'Glow effects on interactive elements (box-shadow with accent color)',
      'Particle or animated backgrounds for depth',
      'Aggressive, condensed typography for headings',
      '3D transforms and perspective on cards/elements',
      'Stats and numbers prominently displayed with counters',
    ],
    tokens: {
      spacing: { small: 8, medium: 20, large: 64 },
      radius: 8,
      shadow: 'strong',
    },
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getProfileById(id: string): StyleProfile | undefined {
  return STYLE_PROFILES.find((p) => p.id === id);
}

export function getAllProfileIds(): string[] {
  return STYLE_PROFILES.map((p) => p.id);
}
