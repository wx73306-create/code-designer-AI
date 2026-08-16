import type {
  DesignAnalysis,
  DesignDecision,
  ComponentNode,
  QAIssue,
  QAFix,
  DeployResult,
  FileNode,
  StyleMatch,
  GeneratedDesignSystem,
  VisualScore,
  EnhancementPlan,
} from '@/types/agent';
import type { CodeValidationResult } from '@/lib/code-rules/validator';

// =============================================================================
// Design Analysis (Apple.com)
// =============================================================================

export const mockDesignAnalysis: DesignAnalysis = {
  colors: [
    { name: 'Apple Blue', hex: '#0071E3', usage: 'Primary CTA buttons, links' },
    { name: 'Apple Blue Hover', hex: '#0077ED', usage: 'Button hover states' },
    { name: 'Background Light', hex: '#F5F5F7', usage: 'Section backgrounds, cards' },
    { name: 'Background White', hex: '#FFFFFF', usage: 'Primary page background' },
    { name: 'Text Primary', hex: '#1D1D1F', usage: 'Headings, primary text' },
    { name: 'Text Secondary', hex: '#6E6E73', usage: 'Subtitles, descriptions' },
    { name: 'Text Tertiary', hex: '#86868B', usage: 'Captions, footnotes' },
    { name: 'Border Light', hex: '#D2D2D7', usage: 'Dividers, card borders' },
    { name: 'Background Dark', hex: '#000000', usage: 'Dark sections, footer' },
    { name: 'Text On Dark', hex: '#F5F5F7', usage: 'Text on dark backgrounds' },
    { name: 'Success Green', hex: '#34C759', usage: 'Success states, badges' },
    { name: 'Warning Orange', hex: '#FF9500', usage: 'Promotional highlights' },
  ],

  typography: [
    { name: 'Hero Title', family: 'SF Pro Display', weight: 600, size: '56px', usage: 'Hero section main heading' },
    { name: 'Section Title', family: 'SF Pro Display', weight: 600, size: '48px', usage: 'Product section titles' },
    { name: 'Section Subtitle', family: 'SF Pro Display', weight: 400, size: '28px', usage: 'Section taglines' },
    { name: 'Card Title', family: 'SF Pro Display', weight: 600, size: '24px', usage: 'Product card titles' },
    { name: 'Body Large', family: 'SF Pro Text', weight: 400, size: '21px', usage: 'Feature descriptions' },
    { name: 'Body Regular', family: 'SF Pro Text', weight: 400, size: '17px', usage: 'General body text' },
    { name: 'Body Small', family: 'SF Pro Text', weight: 400, size: '14px', usage: 'Captions, footnotes' },
    { name: 'Nav Link', family: 'SF Pro Text', weight: 400, size: '12px', usage: 'Navigation items' },
    { name: 'CTA Button', family: 'SF Pro Text', weight: 400, size: '17px', usage: 'Call-to-action buttons' },
    { name: 'Price', family: 'SF Pro Display', weight: 500, size: '17px', usage: 'Product pricing' },
  ],

  spacing: [4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64, 80, 96, 120],

  borderRadius: [8, 12, 16, 18, 24, 28],

  shadows: [
    { name: 'Card Shadow', value: '0 4px 24px rgba(0, 0, 0, 0.08)' },
    { name: 'Card Hover Shadow', value: '0 8px 40px rgba(0, 0, 0, 0.12)' },
    { name: 'Nav Shadow', value: '0 1px 0 rgba(0, 0, 0, 0.08)' },
    { name: 'Dropdown Shadow', value: '0 12px 48px rgba(0, 0, 0, 0.16)' },
    { name: 'Button Shadow', value: '0 2px 8px rgba(0, 113, 227, 0.24)' },
  ],

  animations: [
    { name: 'Fade In Up', property: 'opacity, transform', duration: '0.8s', easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)' },
    { name: 'Scale In', property: 'transform', duration: '0.6s', easing: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)' },
    { name: 'Slide In Left', property: 'transform, opacity', duration: '0.5s', easing: 'ease-out' },
    { name: 'Hover Scale', property: 'transform', duration: '0.3s', easing: 'ease-in-out' },
    { name: 'Color Transition', property: 'background-color', duration: '0.2s', easing: 'ease' },
    { name: 'Parallax Scroll', property: 'transform', duration: 'scroll-linked', easing: 'linear' },
  ],
};

// =============================================================================
// Design Decision (Design Critic Agent 输出)
// =============================================================================

export const mockDesignDecision: DesignDecision = {
  brandPosition: 'premium technology',
  userFeeling: ['trust', 'innovation', 'future'],
  designGoal: 'create premium emotional experience',
  visualHierarchy: [
    { element: 'hero product image', score: 100 },
    { element: 'headline', score: 90 },
    { element: 'cta button', score: 70 },
    { element: 'feature sections', score: 50 },
    { element: 'footer', score: 30 },
  ],
  structureIssues: [
    { problem: 'feature cards 数量过多 (8 个)', solution: '合并为 3 个核心 feature 大区块' },
    { problem: '部分 section 间距不一致', solution: '统一为 96px 垂直间距节奏' },
  ],
  score: { layout: 18, typography: 17, color: 19, image: 16, premium: 14 },
  totalScore: 84,
  keep: ['hero structure', 'black background', 'large product image', 'SF Pro typography'],
  remove: ['excess feature cards', 'unnecessary shadows', 'redundant dividers'],
  improve: ['spacing rhythm', 'typography scale', 'scroll animations', 'CTA contrast'],
  style: { direction: 'Apple minimal', tone: 'premium' },
};

// =============================================================================
// Component Tree (Apple.com)
// =============================================================================

export const mockComponentTree: ComponentNode = {
  name: 'AppleHomePage',
  type: 'page',
  children: [
    {
      name: 'Navbar',
      type: 'component',
      children: [
        {
          name: 'AppleLogo',
          type: 'element',
          children: [],
          props: { width: 14, height: 44, ariaLabel: 'Apple' },
        },
        {
          name: 'NavLinks',
          type: 'container',
          children: [
            { name: 'NavLink', type: 'element', children: [], props: { label: 'Store' } },
            { name: 'NavLink', type: 'element', children: [], props: { label: 'Mac' } },
            { name: 'NavLink', type: 'element', children: [], props: { label: 'iPad' } },
            { name: 'NavLink', type: 'element', children: [], props: { label: 'iPhone' } },
            { name: 'NavLink', type: 'element', children: [], props: { label: 'Watch' } },
            { name: 'NavLink', type: 'element', children: [], props: { label: 'Vision' } },
            { name: 'NavLink', type: 'element', children: [], props: { label: 'AirPods' } },
            { name: 'NavLink', type: 'element', children: [], props: { label: 'TV & Home' } },
            { name: 'NavLink', type: 'element', children: [], props: { label: 'Entertainment' } },
            { name: 'NavLink', type: 'element', children: [], props: { label: 'Accessories' } },
            { name: 'NavLink', type: 'element', children: [], props: { label: 'Support' } },
          ],
          props: { layout: 'horizontal', gap: 24 },
        },
        {
          name: 'NavActions',
          type: 'container',
          children: [
            { name: 'SearchIcon', type: 'element', children: [], props: { icon: 'Search', size: 16 } },
            { name: 'BagIcon', type: 'element', children: [], props: { icon: 'ShoppingBag', size: 16 } },
          ],
          props: { layout: 'horizontal', gap: 16 },
        },
      ],
      props: { height: 44, position: 'fixed', backdropBlur: true, zIndex: 9999 },
    },
    {
      name: 'HeroSection',
      type: 'component',
      children: [
        { name: 'HeroTitle', type: 'text', children: [], props: { text: 'iPhone 16 Pro', fontSize: '56px', weight: 600 } },
        { name: 'HeroSubtitle', type: 'text', children: [], props: { text: 'Hello, Apple Intelligence.', fontSize: '28px', weight: 400 } },
        {
          name: 'HeroCTA',
          type: 'container',
          children: [
            { name: 'CTALink', type: 'element', children: [], props: { label: 'Learn more', variant: 'link', color: '#0071E3' } },
            { name: 'CTALink', type: 'element', children: [], props: { label: 'Buy', variant: 'link', color: '#0071E3' } },
          ],
          props: { layout: 'horizontal', gap: 24 },
        },
        { name: 'HeroImage', type: 'element', children: [], props: { src: '/images/iphone-hero.jpg', alt: 'iPhone 16 Pro', width: 980 } },
      ],
      props: { background: '#000000', textColor: '#F5F5F7', textAlign: 'center', paddingTop: 100 },
    },
    {
      name: 'ProductSection',
      type: 'component',
      children: [
        { name: 'ProductTitle', type: 'text', children: [], props: { text: 'MacBook Air', fontSize: '48px', weight: 600 } },
        { name: 'ProductSubtitle', type: 'text', children: [], props: { text: 'Lean. Mean. M4 machine.', fontSize: '28px' } },
        {
          name: 'ProductCTA',
          type: 'container',
          children: [
            { name: 'CTALink', type: 'element', children: [], props: { label: 'Learn more', variant: 'link' } },
            { name: 'CTALink', type: 'element', children: [], props: { label: 'Buy', variant: 'link' } },
          ],
          props: { layout: 'horizontal', gap: 24 },
        },
        { name: 'ProductImage', type: 'element', children: [], props: { src: '/images/macbook-air.jpg', alt: 'MacBook Air' } },
      ],
      props: { background: '#F5F5F7', textColor: '#1D1D1F', textAlign: 'center' },
    },
    {
      name: 'FeatureGrid',
      type: 'component',
      children: [
        {
          name: 'ProductCard',
          type: 'component',
          children: [
            { name: 'CardTitle', type: 'text', children: [], props: { text: 'Apple Watch Series 10' } },
            { name: 'CardSubtitle', type: 'text', children: [], props: { text: 'Thinstant classic.' } },
            { name: 'CardCTA', type: 'element', children: [], props: { label: 'Learn more' } },
            { name: 'CardImage', type: 'element', children: [], props: { src: '/images/watch-s10.jpg' } },
          ],
          props: { variant: 'dark', background: '#000000' },
        },
        {
          name: 'ProductCard',
          type: 'component',
          children: [
            { name: 'CardTitle', type: 'text', children: [], props: { text: 'iPad Pro' } },
            { name: 'CardSubtitle', type: 'text', children: [], props: { text: 'Unbelievably thin. Incredibly powerful.' } },
            { name: 'CardCTA', type: 'element', children: [], props: { label: 'Learn more' } },
            { name: 'CardImage', type: 'element', children: [], props: { src: '/images/ipad-pro.jpg' } },
          ],
          props: { variant: 'light', background: '#F5F5F7' },
        },
        {
          name: 'ProductCard',
          type: 'component',
          children: [
            { name: 'CardTitle', type: 'text', children: [], props: { text: 'AirPods Pro 2' } },
            { name: 'CardSubtitle', type: 'text', children: [], props: { text: 'Hearing Aid. Hearing Test. Hearing Protection.' } },
            { name: 'CardCTA', type: 'element', children: [], props: { label: 'Learn more' } },
            { name: 'CardImage', type: 'element', children: [], props: { src: '/images/airpods-pro.jpg' } },
          ],
          props: { variant: 'light', background: '#FFFFFF' },
        },
        {
          name: 'ProductCard',
          type: 'component',
          children: [
            { name: 'CardTitle', type: 'text', children: [], props: { text: 'Apple Vision Pro' } },
            { name: 'CardSubtitle', type: 'text', children: [], props: { text: 'Welcome to the era of spatial computing.' } },
            { name: 'CardCTA', type: 'element', children: [], props: { label: 'Learn more' } },
            { name: 'CardImage', type: 'element', children: [], props: { src: '/images/vision-pro.jpg' } },
          ],
          props: { variant: 'dark', background: '#000000' },
        },
      ],
      props: { layout: 'grid', columns: 2, gap: 12, padding: 12 },
    },
    {
      name: 'VideoSection',
      type: 'component',
      children: [
        { name: 'VideoTitle', type: 'text', children: [], props: { text: 'Apple TV+' } },
        { name: 'VideoSubtitle', type: 'text', children: [], props: { text: 'Stream award-winning Apple Originals.' } },
        { name: 'VideoPlayer', type: 'element', children: [], props: { src: '/video/apple-tv-promo.mp4', autoplay: true, muted: true } },
        { name: 'CTAButton', type: 'element', children: [], props: { label: 'Stream now', variant: 'filled', color: '#FFFFFF' } },
      ],
      props: { background: '#000000', fullBleed: true },
    },
    {
      name: 'CTASection',
      type: 'component',
      children: [
        { name: 'CTATitle', type: 'text', children: [], props: { text: 'Trade In', fontSize: '48px' } },
        { name: 'CTADescription', type: 'text', children: [], props: { text: 'Get credit toward your next Apple product.' } },
        { name: 'CTAButton', type: 'element', children: [], props: { label: 'Get your estimate', variant: 'link', color: '#0071E3' } },
        { name: 'CTAImage', type: 'element', children: [], props: { src: '/images/trade-in.jpg' } },
      ],
      props: { background: '#F5F5F7', textAlign: 'center' },
    },
    {
      name: 'Footer',
      type: 'component',
      children: [
        {
          name: 'FooterDisclaimer',
          type: 'container',
          children: [
            { name: 'DisclaimerText', type: 'text', children: [], props: { fontSize: '12px', color: '#6E6E73' } },
          ],
          props: { borderBottom: '1px solid #D2D2D7' },
        },
        {
          name: 'FooterLinks',
          type: 'container',
          children: [
            {
              name: 'FooterColumn',
              type: 'container',
              children: [
                { name: 'ColumnTitle', type: 'text', children: [], props: { text: 'Shop and Learn' } },
                { name: 'FooterLink', type: 'element', children: [], props: { label: 'Store' } },
                { name: 'FooterLink', type: 'element', children: [], props: { label: 'Mac' } },
                { name: 'FooterLink', type: 'element', children: [], props: { label: 'iPad' } },
                { name: 'FooterLink', type: 'element', children: [], props: { label: 'iPhone' } },
                { name: 'FooterLink', type: 'element', children: [], props: { label: 'Watch' } },
              ],
              props: { width: '20%' },
            },
            {
              name: 'FooterColumn',
              type: 'container',
              children: [
                { name: 'ColumnTitle', type: 'text', children: [], props: { text: 'Services' } },
                { name: 'FooterLink', type: 'element', children: [], props: { label: 'Apple Music' } },
                { name: 'FooterLink', type: 'element', children: [], props: { label: 'Apple TV+' } },
                { name: 'FooterLink', type: 'element', children: [], props: { label: 'Apple Arcade' } },
                { name: 'FooterLink', type: 'element', children: [], props: { label: 'iCloud' } },
              ],
              props: { width: '20%' },
            },
            {
              name: 'FooterColumn',
              type: 'container',
              children: [
                { name: 'ColumnTitle', type: 'text', children: [], props: { text: 'Apple Store' } },
                { name: 'FooterLink', type: 'element', children: [], props: { label: 'Find a Store' } },
                { name: 'FooterLink', type: 'element', children: [], props: { label: 'Genius Bar' } },
                { name: 'FooterLink', type: 'element', children: [], props: { label: 'Today at Apple' } },
                { name: 'FooterLink', type: 'element', children: [], props: { label: 'Apple Camp' } },
              ],
              props: { width: '20%' },
            },
            {
              name: 'FooterColumn',
              type: 'container',
              children: [
                { name: 'ColumnTitle', type: 'text', children: [], props: { text: 'For Business' } },
                { name: 'FooterLink', type: 'element', children: [], props: { label: 'Apple and Business' } },
                { name: 'FooterLink', type: 'element', children: [], props: { label: 'Shop for Business' } },
              ],
              props: { width: '20%' },
            },
            {
              name: 'FooterColumn',
              type: 'container',
              children: [
                { name: 'ColumnTitle', type: 'text', children: [], props: { text: 'Apple Values' } },
                { name: 'FooterLink', type: 'element', children: [], props: { label: 'Accessibility' } },
                { name: 'FooterLink', type: 'element', children: [], props: { label: 'Environment' } },
                { name: 'FooterLink', type: 'element', children: [], props: { label: 'Privacy' } },
                { name: 'FooterLink', type: 'element', children: [], props: { label: 'Supply Chain' } },
              ],
              props: { width: '20%' },
            },
          ],
          props: { layout: 'grid', columns: 5, gap: 24, padding: '24px 0' },
        },
        {
          name: 'FooterBottom',
          type: 'container',
          children: [
            { name: 'Copyright', type: 'text', children: [], props: { text: 'Copyright 2025 Apple Inc. All rights reserved.' } },
            { name: 'LegalLinks', type: 'container', children: [
              { name: 'FooterLink', type: 'element', children: [], props: { label: 'Privacy Policy' } },
              { name: 'FooterLink', type: 'element', children: [], props: { label: 'Terms of Use' } },
              { name: 'FooterLink', type: 'element', children: [], props: { label: 'Sales and Refunds' } },
              { name: 'FooterLink', type: 'element', children: [], props: { label: 'Site Map' } },
            ], props: { layout: 'horizontal', gap: 16 } },
            { name: 'LocaleSelector', type: 'element', children: [], props: { label: 'United States' } },
          ],
          props: { borderTop: '1px solid #D2D2D7', padding: '16px 0' },
        },
      ],
      props: { background: '#F5F5F7', padding: '0 16px', maxWidth: 980 },
    },
  ],
  props: { lang: 'en', dir: 'ltr' },
};

// =============================================================================
// Generated Code (component name -> source code)
// =============================================================================

export const mockGeneratedCode = new Map<string, string>([
  [
    'Navbar.tsx',
    `'use client';

import { useState } from 'react';
import { Search, ShoppingBag, Menu, X } from 'lucide-react';

const NAV_LINKS = [
  'Store', 'Mac', 'iPad', 'iPhone', 'Watch',
  'Vision', 'AirPods', 'TV & Home', 'Entertainment',
  'Accessories', 'Support',
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-[9999] h-11 bg-black/80 backdrop-blur-xl border-b border-white/10">
      <div className="mx-auto flex h-full max-w-[980px] items-center justify-between px-4">
        {/* Apple Logo */}
        <a href="/" aria-label="Apple" className="text-white/90 hover:text-white transition-colors">
          <svg width="14" height="44" viewBox="0 0 14 44" fill="currentColor">
            <path d="M13.0729 17.6825C13.0729 ... (Apple logo SVG path)" />
          </svg>
        </a>

        {/* Desktop Navigation */}
        <ul className="hidden lg:flex items-center gap-6">
          {NAV_LINKS.map((link) => (
            <li key={link}>
              <a
                href={\`/\${link.toLowerCase().replace(/ & /g, '-')}\`}
                className="text-[12px] text-white/80 hover:text-white transition-colors"
              >
                {link}
              </a>
            </li>
          ))}
        </ul>

        {/* Actions */}
        <div className="flex items-center gap-4">
          <button aria-label="Search" className="text-white/80 hover:text-white transition-colors">
            <Search size={16} />
          </button>
          <button aria-label="Shopping bag" className="text-white/80 hover:text-white transition-colors">
            <ShoppingBag size={16} />
          </button>
          <button
            aria-label="Menu"
            className="lg:hidden text-white/80 hover:text-white"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="lg:hidden bg-black/95 backdrop-blur-xl">
          <ul className="flex flex-col px-8 py-4 gap-4">
            {NAV_LINKS.map((link) => (
              <li key={link}>
                <a href={\`/\${link.toLowerCase()}\`} className="text-sm text-white/80 hover:text-white">
                  {link}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </nav>
  );
}
`,
  ],
  [
    'HeroSection.tsx',
    `'use client';

import { motion } from 'framer-motion';

export function HeroSection() {
  return (
    <section className="relative bg-black text-center pt-[100px] pb-8 overflow-hidden">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="mx-auto max-w-[980px] px-4"
      >
        <h1 className="text-[56px] font-semibold tracking-tight text-[#F5F5F7] leading-tight">
          iPhone 16 Pro
        </h1>

        <p className="mt-2 text-[28px] font-normal text-[#F5F5F7]">
          Hello, Apple Intelligence.
        </p>

        <div className="mt-4 flex items-center justify-center gap-6">
          <a
            href="/iphone-16-pro"
            className="text-[17px] text-[#0071E3] hover:underline"
          >
            Learn more &gt;
          </a>
          <a
            href="/buy/iphone-16-pro"
            className="text-[17px] text-[#0071E3] hover:underline"
          >
            Buy &gt;
          </a>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1, delay: 0.3, ease: 'easeOut' }}
        className="mt-8 flex justify-center"
      >
        <img
          src="/images/iphone-hero.jpg"
          alt="iPhone 16 Pro"
          width={980}
          height={580}
          className="w-full max-w-[980px]"
          priority
        />
      </motion.div>
    </section>
  );
}
`,
  ],
  [
    'ProductSection.tsx',
    `'use client';

import { motion } from 'framer-motion';

interface ProductSectionProps {
  title: string;
  subtitle: string;
  imageSrc: string;
  imageAlt: string;
  background?: 'light' | 'dark';
  learnMoreHref: string;
  buyHref: string;
}

export function ProductSection({
  title,
  subtitle,
  imageSrc,
  imageAlt,
  background = 'light',
  learnMoreHref,
  buyHref,
}: ProductSectionProps) {
  const isDark = background === 'dark';

  return (
    <section
      className={\`text-center py-16 \${isDark ? 'bg-black text-[#F5F5F7]' : 'bg-[#F5F5F7] text-[#1D1D1F]'}\`}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 0.6 }}
        className="mx-auto max-w-[980px] px-4"
      >
        <h2 className="text-[48px] font-semibold tracking-tight leading-tight">
          {title}
        </h2>
        <p className="mt-1 text-[28px]">{subtitle}</p>

        <div className="mt-4 flex items-center justify-center gap-6">
          <a href={learnMoreHref} className="text-[17px] text-[#0071E3] hover:underline">
            Learn more &gt;
          </a>
          <a href={buyHref} className="text-[17px] text-[#0071E3] hover:underline">
            Buy &gt;
          </a>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className="mt-8 flex justify-center px-4"
      >
        <img
          src={imageSrc}
          alt={imageAlt}
          className="w-full max-w-[980px] rounded-2xl"
        />
      </motion.div>
    </section>
  );
}
`,
  ],
  [
    'FeatureGrid.tsx',
    `'use client';

import { motion } from 'framer-motion';

interface ProductCard {
  title: string;
  subtitle: string;
  imageSrc: string;
  variant: 'dark' | 'light';
  learnMoreHref: string;
}

const PRODUCTS: ProductCard[] = [
  {
    title: 'Apple Watch Series 10',
    subtitle: 'Thinstant classic.',
    imageSrc: '/images/watch-s10.jpg',
    variant: 'dark',
    learnMoreHref: '/watch',
  },
  {
    title: 'iPad Pro',
    subtitle: 'Unbelievably thin. Incredibly powerful.',
    imageSrc: '/images/ipad-pro.jpg',
    variant: 'light',
    learnMoreHref: '/ipad-pro',
  },
  {
    title: 'AirPods Pro 2',
    subtitle: 'Hearing Aid. Hearing Test. Hearing Protection.',
    imageSrc: '/images/airpods-pro.jpg',
    variant: 'light',
    learnMoreHref: '/airpods-pro',
  },
  {
    title: 'Apple Vision Pro',
    subtitle: 'Welcome to the era of spatial computing.',
    imageSrc: '/images/vision-pro.jpg',
    variant: 'dark',
    learnMoreHref: '/vision-pro',
  },
];

export function FeatureGrid() {
  return (
    <section className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3">
      {PRODUCTS.map((product, idx) => {
        const isDark = product.variant === 'dark';
        return (
          <motion.div
            key={product.title}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, delay: idx * 0.1 }}
            className={\`relative flex flex-col items-center text-center rounded-3xl overflow-hidden p-12 min-h-[580px] \${
              isDark ? 'bg-black text-[#F5F5F7]' : 'bg-[#F5F5F7] text-[#1D1D1F]'
            }\`}
          >
            <h3 className="text-[24px] font-semibold">{product.title}</h3>
            <p className="mt-1 text-[21px]">{product.subtitle}</p>
            <a
              href={product.learnMoreHref}
              className="mt-3 text-[17px] text-[#0071E3] hover:underline"
            >
              Learn more &gt;
            </a>
            <div className="mt-auto w-full">
              <img
                src={product.imageSrc}
                alt={product.title}
                className="w-full object-cover rounded-xl"
              />
            </div>
          </motion.div>
        );
      })}
    </section>
  );
}
`,
  ],
  [
    'VideoSection.tsx',
    `'use client';

import { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

export function VideoSection() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          videoRef.current?.play();
        } else {
          videoRef.current?.pause();
        }
      },
      { threshold: 0.3 },
    );

    if (videoRef.current) observer.observe(videoRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="relative bg-black text-[#F5F5F7] overflow-hidden">
      <div className="relative z-10 text-center pt-16 pb-8">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-[48px] font-semibold"
        >
          Apple TV+
        </motion.h2>
        <p className="mt-2 text-[21px]">
          Stream award-winning Apple Originals.
        </p>
        <a
          href="/apple-tv-plus"
          className="mt-4 inline-block text-[17px] text-[#0071E3] hover:underline"
        >
          Stream now &gt;
        </a>
      </div>

      <video
        ref={videoRef}
        src="/video/apple-tv-promo.mp4"
        muted
        loop
        playsInline
        className="w-full"
        poster="/images/apple-tv-poster.jpg"
      />
    </section>
  );
}
`,
  ],
  [
    'CTASection.tsx',
    `'use client';

import { motion } from 'framer-motion';

export function CTASection() {
  return (
    <section className="bg-[#F5F5F7] text-center py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="mx-auto max-w-[980px] px-4"
      >
        <h2 className="text-[48px] font-semibold text-[#1D1D1F] tracking-tight">
          Trade In
        </h2>
        <p className="mt-2 text-[21px] text-[#6E6E73]">
          Get credit toward your next Apple product.
        </p>
        <a
          href="/trade-in"
          className="mt-4 inline-block text-[17px] text-[#0071E3] hover:underline"
        >
          Get your estimate &gt;
        </a>
        <div className="mt-8">
          <img
            src="/images/trade-in.jpg"
            alt="Apple Trade In"
            className="mx-auto w-full max-w-[700px] rounded-2xl"
          />
        </div>
      </motion.div>
    </section>
  );
}
`,
  ],
  [
    'Footer.tsx',
    `'use client';

const FOOTER_SECTIONS = [
  {
    title: 'Shop and Learn',
    links: ['Store', 'Mac', 'iPad', 'iPhone', 'Watch', 'Vision', 'AirPods', 'TV & Home'],
  },
  {
    title: 'Services',
    links: ['Apple Music', 'Apple TV+', 'Apple Arcade', 'iCloud', 'Apple One', 'Apple Card'],
  },
  {
    title: 'Apple Store',
    links: ['Find a Store', 'Genius Bar', 'Today at Apple', 'Apple Camp', 'Financing', 'Order Status'],
  },
  {
    title: 'For Business',
    links: ['Apple and Business', 'Shop for Business'],
  },
  {
    title: 'Apple Values',
    links: ['Accessibility', 'Environment', 'Privacy', 'Supply Chain'],
  },
];

export function Footer() {
  return (
    <footer className="bg-[#F5F5F7] text-[#6E6E73] text-[12px] px-4">
      <div className="mx-auto max-w-[980px]">
        {/* Disclaimer */}
        <div className="py-4 border-b border-[#D2D2D7]">
          <p className="leading-relaxed">
            * Monthly pricing is available when you select Apple Card Monthly Installments (ACMI)
            as payment type at checkout at Apple...
          </p>
        </div>

        {/* Link Columns */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-6 py-6">
          {FOOTER_SECTIONS.map((section) => (
            <div key={section.title}>
              <h3 className="font-semibold text-[#1D1D1F] mb-2">{section.title}</h3>
              <ul className="space-y-1.5">
                {section.links.map((link) => (
                  <li key={link}>
                    <a href="#" className="hover:text-[#1D1D1F] hover:underline transition-colors">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 py-4 border-t border-[#D2D2D7]">
          <p>Copyright &copy; 2025 Apple Inc. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <a href="#" className="hover:text-[#1D1D1F] hover:underline">Privacy Policy</a>
            <span className="text-[#D2D2D7]">|</span>
            <a href="#" className="hover:text-[#1D1D1F] hover:underline">Terms of Use</a>
            <span className="text-[#D2D2D7]">|</span>
            <a href="#" className="hover:text-[#1D1D1F] hover:underline">Sales and Refunds</a>
            <span className="text-[#D2D2D7]">|</span>
            <a href="#" className="hover:text-[#1D1D1F] hover:underline">Site Map</a>
          </div>
          <span>United States</span>
        </div>
      </div>
    </footer>
  );
}
`,
  ],
  [
    'page.tsx',
    `import { Navbar } from '@/components/Navbar';
import { HeroSection } from '@/components/HeroSection';
import { ProductSection } from '@/components/ProductSection';
import { FeatureGrid } from '@/components/FeatureGrid';
import { VideoSection } from '@/components/VideoSection';
import { CTASection } from '@/components/CTASection';
import { Footer } from '@/components/Footer';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">
      <Navbar />
      <HeroSection />
      <ProductSection
        title="MacBook Air"
        subtitle="Lean. Mean. M4 machine."
        imageSrc="/images/macbook-air.jpg"
        imageAlt="MacBook Air"
        background="light"
        learnMoreHref="/macbook-air"
        buyHref="/buy/macbook-air"
      />
      <FeatureGrid />
      <VideoSection />
      <CTASection />
      <Footer />
    </main>
  );
}
`,
  ],
]);

// =============================================================================
// QA Issues
// =============================================================================

export const mockQAIssues: QAIssue[] = [
  {
    type: 'spacing',
    description: 'Navbar padding-top is 2px off (expected 44px, got 42px)',
    severity: 'minor',
    fixed: true,
  },
  {
    type: 'color',
    description: 'Hero CTA link color is #0077ED instead of #0071E3',
    severity: 'cosmetic',
    fixed: true,
  },
  {
    type: 'typography',
    description: 'Section subtitle font weight is 500 instead of 400',
    severity: 'minor',
    fixed: true,
  },
  {
    type: 'layout',
    description: 'Product grid gap is 16px instead of 12px on mobile viewport',
    severity: 'major',
    fixed: true,
  },
  {
    type: 'border-radius',
    description: 'Feature card border-radius is 20px instead of 24px',
    severity: 'minor',
    fixed: true,
  },
  {
    type: 'image',
    description: 'Hero image aspect ratio mismatch (expected 16:9, got 16:9.2)',
    severity: 'cosmetic',
    fixed: true,
  },
  {
    type: 'animation',
    description: 'Fade-in duration is 0.6s instead of 0.8s on hero section',
    severity: 'cosmetic',
    fixed: true,
  },
  {
    type: 'spacing',
    description: 'Footer column gap is 32px instead of 24px on desktop',
    severity: 'minor',
    fixed: true,
  },
  {
    type: 'color',
    description: 'Footer text color is #6E6E73 on light background - passes WCAG AA',
    severity: 'cosmetic',
    fixed: false,
  },
  {
    type: 'responsive',
    description: 'Nav links overflow on 768px viewport (hidden correctly via mobile menu)',
    severity: 'minor',
    fixed: false,
  },
];

// =============================================================================
// QA Fixes
// =============================================================================

export const mockQAFixes: QAFix[] = [
  {
    issue: 'Navbar padding',
    description: 'Adjusted nav padding-top from 42px to 44px to match original',
    applied: true,
  },
  {
    issue: 'CTA link color',
    description: 'Updated CTA link color from #0077ED to #0071E3 in tailwind config',
    applied: true,
  },
  {
    issue: 'Subtitle weight',
    description: 'Changed subtitle font-weight from 500 to 400 in ProductSection',
    applied: true,
  },
  {
    issue: 'Grid gap',
    description: 'Fixed responsive grid gap from gap-4 to gap-3 on mobile breakpoint',
    applied: true,
  },
  {
    issue: 'Card radius',
    description: 'Updated border-radius from rounded-2xl (16px) to rounded-3xl (24px)',
    applied: true,
  },
  {
    issue: 'Image aspect',
    description: 'Added aspect-ratio: 16/9 and object-fit: cover to hero image',
    applied: true,
  },
  {
    issue: 'Animation timing',
    description: 'Updated hero fade-in transition duration from 0.6s to 0.8s',
    applied: true,
  },
  {
    issue: 'Footer gap',
    description: 'Reduced footer grid gap from gap-8 to gap-6 for desktop columns',
    applied: true,
  },
];

// =============================================================================
// Deploy Result
// =============================================================================

export const mockDeployResult: DeployResult = {
  url: 'https://demo-preview.invalid/（演示占位，未真实部署）',
  githubUrl: 'https://github.example.invalid/demo（演示占位）',
  status: 'live',
  deployTime: 23.4,
  buildStatus: 'success',
  demo: true, // 演示数据：未发生真实部署，UI 必须显著标注
};

// =============================================================================
// Project Structure (file tree)
// =============================================================================

export const mockProjectStructure: FileNode[] = [
  {
    name: 'src',
    type: 'directory',
    children: [
      {
        name: 'app',
        type: 'directory',
        children: [
          { name: 'layout.tsx', type: 'file', language: 'typescript' },
          { name: 'page.tsx', type: 'file', language: 'typescript' },
          { name: 'globals.css', type: 'file', language: 'css' },
          {
            name: 'api',
            type: 'directory',
            children: [
              {
                name: 'og',
                type: 'directory',
                children: [
                  { name: 'route.tsx', type: 'file', language: 'typescript' },
                ],
              },
            ],
          },
        ],
      },
      {
        name: 'components',
        type: 'directory',
        children: [
          { name: 'Navbar.tsx', type: 'file', language: 'typescript' },
          { name: 'HeroSection.tsx', type: 'file', language: 'typescript' },
          { name: 'ProductSection.tsx', type: 'file', language: 'typescript' },
          { name: 'FeatureGrid.tsx', type: 'file', language: 'typescript' },
          { name: 'VideoSection.tsx', type: 'file', language: 'typescript' },
          { name: 'CTASection.tsx', type: 'file', language: 'typescript' },
          { name: 'Footer.tsx', type: 'file', language: 'typescript' },
          {
            name: 'ui',
            type: 'directory',
            children: [
              { name: 'button.tsx', type: 'file', language: 'typescript' },
              { name: 'link.tsx', type: 'file', language: 'typescript' },
              { name: 'image.tsx', type: 'file', language: 'typescript' },
            ],
          },
        ],
      },
      {
        name: 'lib',
        type: 'directory',
        children: [
          { name: 'utils.ts', type: 'file', language: 'typescript' },
          { name: 'constants.ts', type: 'file', language: 'typescript' },
        ],
      },
      {
        name: 'styles',
        type: 'directory',
        children: [
          { name: 'tokens.css', type: 'file', language: 'css' },
          { name: 'animations.css', type: 'file', language: 'css' },
        ],
      },
      {
        name: 'types',
        type: 'directory',
        children: [
          { name: 'index.ts', type: 'file', language: 'typescript' },
        ],
      },
    ],
  },
  {
    name: 'public',
    type: 'directory',
    children: [
      {
        name: 'images',
        type: 'directory',
        children: [
          { name: 'iphone-hero.jpg', type: 'file', language: 'image' },
          { name: 'macbook-air.jpg', type: 'file', language: 'image' },
          { name: 'watch-s10.jpg', type: 'file', language: 'image' },
          { name: 'ipad-pro.jpg', type: 'file', language: 'image' },
          { name: 'airpods-pro.jpg', type: 'file', language: 'image' },
          { name: 'vision-pro.jpg', type: 'file', language: 'image' },
          { name: 'trade-in.jpg', type: 'file', language: 'image' },
          { name: 'apple-tv-poster.jpg', type: 'file', language: 'image' },
        ],
      },
      {
        name: 'video',
        type: 'directory',
        children: [
          { name: 'apple-tv-promo.mp4', type: 'file', language: 'video' },
        ],
      },
      {
        name: 'fonts',
        type: 'directory',
        children: [
          { name: 'SF-Pro-Display-Semibold.woff2', type: 'file', language: 'font' },
          { name: 'SF-Pro-Display-Regular.woff2', type: 'file', language: 'font' },
          { name: 'SF-Pro-Text-Regular.woff2', type: 'file', language: 'font' },
        ],
      },
    ],
  },
  { name: 'tailwind.config.ts', type: 'file', language: 'typescript' },
  { name: 'next.config.ts', type: 'file', language: 'typescript' },
  { name: 'tsconfig.json', type: 'file', language: 'json' },
  { name: 'package.json', type: 'file', language: 'json' },
  { name: '.gitignore', type: 'file', language: 'text' },
  { name: 'README.md', type: 'file', language: 'markdown' },
];

// =============================================================================
// Style Match (Style Matcher Agent 输出)
// =============================================================================

export const mockStyleMatch: StyleMatch = {
  matchedStyle: 'Apple Style',
  matchedStyleId: 'apple-style',
  confidence: 92,
  secondaryStyle: 'SaaS Style',
  scores: {
    'Apple Style': 92,
    'Stripe Style': 55,
    'Linear Style': 40,
    'Tesla Style': 70,
    'Luxury Style': 48,
    'SaaS Style': 62,
    'Gaming Style': 22,
  },
  breakdown: {
    layout: 28,
    color: 23,
    components: 22,
    typography: 19,
    total: 92,
  },
  reasoning: '该网页最符合「苹果风格」设计体系（置信度基于四维评分）。布局维度匹配度最高（28/30），体现了简约、聚焦的设计理念。次要匹配为「SaaS 风格」，可作为辅助参考。',
};

// =============================================================================
// Generated Design System (Design System Generator 输出)
// =============================================================================

export const mockDesignSystem: GeneratedDesignSystem = {
  style: 'Apple Style',
  philosophy: ['simplicity', 'focus', 'emotion', 'product storytelling'],
  tokens: {
    spacing: { small: 8, medium: 24, large: 80 },
    radius: 12,
    shadow: 'soft',
    colors: {
      background: ['#FFFFFF', '#F5F5F7'],
      text: '#1D1D1F',
      accent: '#0071E3',
    },
    typography: {
      font: 'SF Pro',
      titleSize: '64px',
      weight: 'bold',
      lineHeight: 'tight',
    },
  },
  rules: [
    'Large whitespace between sections (80-120px)',
    'One hero product image dominates the viewport',
    'Maximum 2-3 colors per page',
    'Typography hierarchy: 56px title → 28px subtitle → 17px body',
    'Center-aligned content with generous padding',
    'Smooth scroll-triggered fade animations',
    'Product images must be high-resolution with clean backgrounds',
  ],
  avoid: [
    'cluttered layouts', 'too many colors', 'small fonts', 'busy backgrounds',
    'excessive borders', 'carousel overload', 'pop-ups',
  ],
  components: {
    preferred: ['Hero', 'Product Showcase', 'Feature Highlight', 'Sticky Nav'],
    avoid: ['many cards', 'complex dashboard', 'heavy border', 'sidebar'],
  },
};

// =============================================================================
// Visual Score (Visual Evaluation Agent 输出 — 六维视觉评分)
// =============================================================================

export const mockVisualScore: VisualScore = {
  overall_score: 81.5,
  scores: {
    layout_score: 85,
    visual_balance: 78,
    spacing_score: 80,
    color_score: 90,
    typography_score: 86,
    premium_score: 72,
  },
  problems: [
    { type: 'premium', description: 'Feature 区域卡片过多，模板感较强，建议改为叙事性 section' },
    { type: 'premium', description: 'Hero 视觉冲击力不足，建议加大到 70vh 并使用真实产品图' },
    { type: 'spacing', description: '内容区域 Section 间距不足，缺乏呼吸感' },
    { type: 'balance', description: '部分区块左重右轻，图文比例失衡' },
  ],
  round: 1,
};

// =============================================================================
// Code Validation (Code Validator 输出 — Premium Design Rules 规则校验)
// =============================================================================

export const mockCodeValidation: CodeValidationResult = {
  passed: false,
  score: 74,
  violations: [
    {
      ruleId: 'COMP-002',
      ruleName: 'Card 使用限制',
      severity: 'warning',
      message: '检测到 4 个 Card 组件（> 3），Card 应仅用于补充内容',
      count: 4,
    },
    {
      ruleId: 'VIS-003',
      ruleName: '禁止随机 Icon',
      severity: 'warning',
      message: '检测到 14 个 Icon 引用，疑似"每个 Feature 一个 Icon"的模板化用法',
      count: 14,
    },
  ],
  checksRun: 5,
  cardCount: 4,
  gradientCount: 0,
  oversizedRadiusCount: 0,
  iconCount: 14,
  heroHeightOk: true,
};

// =============================================================================
// Enhancement Plan (Enhancement Agent 输出 — 设计升级方案)
// =============================================================================

export const mockEnhancementPlan: EnhancementPlan = {
  preserve: {
    layout: 'hero centered, single-column product storytelling',
    style: 'minimal technology, black-white-gray with restrained accent',
  },
  improve: [
    { category: 'typography', before: 'small headline (36px)', after: 'large cinematic headline (72px)' },
    { category: 'animation', before: 'static sections', after: 'scroll reveal + subtle parallax' },
    { category: 'spacing', before: 'dense content (48px gaps)', after: 'generous whitespace (96px+ section gaps)' },
    { category: 'component', before: '6 feature cards grid', after: '3-card grid + narrative image-text section' },
    { category: 'image', before: 'small product thumbnails', after: 'large immersive product hero imagery' },
  ],
};
