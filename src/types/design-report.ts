// =============================================================================
// Design Intelligence Report — AI 对网站设计语言的深度理解
// =============================================================================

export interface DesignReport {
  website: {
    name: string;
    url: string;
    analyzedAt: string;
  };

  score: {
    total: number;
    visual: number;
    layout: number;
    brand: number;
    typography: number;
    detail: number;
  };

  brandPosition: {
    keywords: string[];
    description: string;
    industry: string;
    audience: string;
  };

  visualLanguage: {
    style: string;
    mood: string;
    density: string;
    whitespace: string;
    motion: string;
    imagery: string;
  };

  colorSystem: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    accent: string;
    text: string;
    textSecondary: string;
    tokens: Record<string, string>;
  };

  typography: {
    heading: string;
    body: string;
    mono: string;
    scale: { label: string; size: string; weight: string }[];
    lineHeight: string;
    letterSpacing: string;
  };

  layout: {
    grid: string;
    maxWidth: string;
    breakpoints: string[];
    sections: { name: string; type: string; description: string }[];
  };

  components: {
    name: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    file: string;
  }[];
}

// =============================================================================
// Mock data for demo
// =============================================================================

export const MOCK_APPLE_REPORT: DesignReport = {
  website: {
    name: 'Apple',
    url: 'https://apple.com',
    analyzedAt: new Date().toISOString(),
  },

  score: { total: 96, visual: 98, layout: 95, brand: 97, typography: 96, detail: 94 },

  brandPosition: {
    keywords: ['Premium Technology', 'Minimal Luxury', 'Future-oriented', 'Human-centered'],
    description: '该网站通过极简布局、大面积留白、高质量产品视觉，传达高端科技品牌形象。每个页面聚焦单一产品，通过沉浸式滚动叙事和精致的微交互，营造奢华的数字体验。',
    industry: 'Consumer Technology',
    audience: 'Premium consumers, creative professionals',
  },

  visualLanguage: {
    style: 'Minimalism',
    mood: 'Premium & Aspirational',
    density: 'Low — generous whitespace',
    whitespace: 'Very High — 60%+',
    motion: 'Scroll-driven reveal, subtle parallax',
    imagery: 'Product-centric, high-resolution, studio lighting',
  },

  colorSystem: {
    primary: '#0071E3',
    secondary: '#1D1D1F',
    background: '#FFFFFF',
    surface: '#F5F5F7',
    accent: '#FF375F',
    text: '#1D1D1F',
    textSecondary: '#6E6E73',
    tokens: {
      '--color-primary': '#0071E3',
      '--color-secondary': '#1D1D1F',
      '--color-bg': '#FFFFFF',
      '--color-surface': '#F5F5F7',
      '--color-accent': '#FF375F',
      '--color-text': '#1D1D1F',
      '--color-text-secondary': '#6E6E73',
      '--color-border': 'rgba(0,0,0,0.08)',
    },
  },

  typography: {
    heading: 'SF Pro Display',
    body: 'SF Pro Text',
    mono: 'SF Mono',
    scale: [
      { label: 'Display', size: '96px', weight: '700' },
      { label: 'H1', size: '56px', weight: '600' },
      { label: 'H2', size: '40px', weight: '600' },
      { label: 'H3', size: '28px', weight: '600' },
      { label: 'Body', size: '17px', weight: '400' },
      { label: 'Caption', size: '12px', weight: '400' },
    ],
    lineHeight: '1.47',
    letterSpacing: '-0.022em',
  },

  layout: {
    grid: '12-column centered',
    maxWidth: '980px',
    breakpoints: ['734px', '1068px', '1440px'],
    sections: [
      { name: 'Navigation', type: 'fixed-header', description: 'Transparent glass blur navbar, shrinks on scroll' },
      { name: 'Hero', type: 'full-bleed', description: 'Full viewport product showcase with large typography' },
      { name: 'Product Grid', type: 'bento-grid', description: 'Asymmetric card grid with hover animations' },
      { name: 'Feature Section', type: 'alternating', description: 'Image-text alternating layout with scroll reveal' },
      { name: 'Footer', type: 'mega-footer', description: 'Multi-column link grid with legal information' },
    ],
  },

  components: [
    { name: 'Navbar', description: '固定透明导航栏，滚动时毛玻璃效果', priority: 'high', file: 'Navbar.tsx' },
    { name: 'HeroSection', description: '全屏产品展示，大标题 + 产品图 + CTA', priority: 'high', file: 'HeroSection.tsx' },
    { name: 'ProductGrid', description: '不对称卡片网格展示多个产品线', priority: 'high', file: 'ProductGrid.tsx' },
    { name: 'FeatureSection', description: '图文交替的特性展示区域', priority: 'medium', file: 'FeatureSection.tsx' },
    { name: 'VideoSection', description: '嵌入式视频展示区域', priority: 'medium', file: 'VideoSection.tsx' },
    { name: 'CTASection', description: '行动号召区域，引导用户购买', priority: 'medium', file: 'CTASection.tsx' },
    { name: 'Footer', description: '多列链接页脚，含法律信息', priority: 'low', file: 'Footer.tsx' },
  ],
};
