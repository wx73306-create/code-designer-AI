// =============================================================================
// Content Extractor — Extract real data arrays from component source code
// Based on ZIP→HTML SOP report: components contain const features = [...], etc.
// =============================================================================

interface ExtractedContent {
  navItems: { label: string; href: string }[];
  features: { title: string; description: string; icon?: string }[];
  testimonials: { name: string; quote: string; role?: string }[];
  stats: { value: string; label: string }[];
  plans: { name: string; price: string; features: string[] }[];
  footerLinks: { category: string; links: { label: string; href: string }[] }[];
  brandColors: string[]; // Real brand colors found in component code
  heroTitle?: string;
  heroSubtitle?: string;
  ctaButtons: { text: string; primary?: boolean }[];
}

/**
 * Extract structured content data from component source code.
 * Finds arrays like: const features = [{ title: "...", description: "..." }, ...]
 * Also extracts brand colors from Tailwind arbitrary values (bg-[#FB7299]).
 */
export function extractComponentData(codeMap: Map<string, string>): ExtractedContent {
  const result: ExtractedContent = {
    navItems: [], features: [], testimonials: [], stats: [],
    plans: [], footerLinks: [], brandColors: [], ctaButtons: [],
  };

  const allCode = Array.from(codeMap.values()).join('\n');

  // Extract brand colors from Tailwind arbitrary values: bg-[#xxx], text-[#xxx]
  const colorMatches = allCode.matchAll(/(?:bg|text|border|from|to|via)-\[#([0-9a-fA-F]{3,8})\]/g);
  const colorSet = new Set<string>();
  for (const m of colorMatches) {
    const hex = '#' + m[1].toUpperCase();
    // Filter out common non-brand colors
    if (!['#FFFFFF', '#000000', '#000', '#FFF', '#F5F5F7', '#FAFAFC', '#F9F9FB', '#E2E8F0', '#09090B', '#1D1D1F'].includes(hex)) {
      colorSet.add(hex);
    }
  }
  result.brandColors = Array.from(colorSet).slice(0, 8);

  // Extract string arrays that look like nav items: ["Features", "Pricing", "Docs"]
  const navPattern = /(?:navItems|navLinks|menuItems|links)\s*(?:=\s*\[|:\s*\[)\s*"([^"]+)"\s*(?:,\s*"([^"]+)")*/gi;
  const navMatch = allCode.match(/(?:navItems|navLinks|menuItems)\s*[=:]\s*\[([\s\S]*?)\]/i);
  if (navMatch) {
    const items = navMatch[1].matchAll(/["']([^"']+)["']/g);
    for (const item of items) {
      if (item[1].length < 30 && !item[1].includes('/')) {
        result.navItems.push({ label: item[1], href: '#' });
      }
    }
  }

  // Extract data arrays with title/description pattern (features, testimonials, etc.)
  const dataArrays = allCode.matchAll(/(?:const|let|var)\s+(\w+)\s*(?::\s*\w+\[\])?\s*=\s*\[([\s\S]*?)\]\s*(?:;|$)/g);
  for (const m of dataArrays) {
    const name = m[1].toLowerCase();
    const body = m[2];

    // Extract title/name + description pairs from object literals
    const objects = body.matchAll(/\{\s*([\s\S]*?)\s*\}/g);
    for (const obj of objects) {
      const content = obj[1];
      const title = content.match(/(?:title|name|heading|label)\s*:\s*["'`]([^"'`]+)["'`]/)?.[1];
      const desc = content.match(/(?:description|desc|text|quote|content|detail)\s*:\s*["'`]([^"'`]+)["'`]/)?.[1];
      const icon = content.match(/(?:icon|emoji)\s*:\s*["'`]([^"'`]+)["'`]/)?.[1];
      const value = content.match(/(?:value|number|count|stat)\s*:\s*["'`]([^"'`]+)["'`]/)?.[1];
      const role = content.match(/(?:role|position|company|title)\s*:\s*["'`]([^"'`]+)["'`]/)?.[1];

      if (title && desc) {
        if (name.includes('feature') || name.includes('benefit')) {
          result.features.push({ title, description: desc, icon });
        } else if (name.includes('testimonial') || name.includes('review')) {
          result.testimonials.push({ name: title, quote: desc, role });
        } else if (name.includes('stat') || name.includes('metric')) {
          result.stats.push({ value: title, label: desc });
        } else {
          result.features.push({ title, description: desc, icon });
        }
      } else if (value && (title || desc)) {
        result.stats.push({ value, label: title || desc || '' });
      } else if (title && !desc && name.includes('nav')) {
        result.navItems.push({ label: title, href: '#' });
      }
    }
  }

  // Extract hero title/subtitle — prioritize specific hero variables
  const heroTitle = allCode.match(/(?:heroTitle|mainTitle|pageTitle)\s*[:=]\s*["'`]([^"'`]{3,80})["'`]/)?.[1];
  const heroSub = allCode.match(/(?:heroSubtitle|heroDescription|subtitle|tagline)\s*[:=]\s*["'`]([^"'`]{10,200})["'`]/)?.[1];
  if (heroTitle) result.heroTitle = heroTitle;
  if (heroSub) result.heroSubtitle = heroSub;

  // Extract CTA button text
  const ctaMatches = allCode.matchAll(/(?:cta|button|btn)\w*\s*[:=]\s*["'`]([^"'`]{2,30})["'`]/gi);
  for (const c of ctaMatches) {
    result.ctaButtons.push({ text: c[1], primary: result.ctaButtons.length === 0 });
  }

  return result;
}

/**
 * Check if design tokens look like a generic Apple template.
 * Returns true if the tokens are dominated by #0071E3 + SF Pro regardless of target brand.
 */
export function isGenericTemplate(cssContent: string, brandColors: string[]): boolean {
  const hasAppleBlue = /#0071E3/i.test(cssContent);
  const hasSFPro = /SF Pro/i.test(cssContent);
  const hasRealBrand = brandColors.some(c => c !== '#0071E3' && c !== '#0077ED' && c !== '#005BB5');
  return hasAppleBlue && hasSFPro && hasRealBrand;
}

/**
 * Generate HTML cards from extracted feature data.
 */
function renderFeatureCards(features: ExtractedContent['features']): string {
  if (features.length === 0) return '';
  return features.map(f => `
    <div class="p-6 bg-white rounded-xl border border-gray-100 shadow-sm card-hover">
      ${f.icon ? `<div class="text-3xl mb-3">${f.icon}</div>` : '<div class="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center mb-3"><div class="w-5 h-5 rounded bg-blue-500"></div></div>'}
      <h3 class="font-semibold text-gray-900 text-lg mb-2">${f.title}</h3>
      <p class="text-sm text-gray-500 leading-relaxed">${f.description}</p>
    </div>`).join('\n');
}

/**
 * Generate HTML testimonial cards from extracted data.
 */
function renderTestimonials(testimonials: ExtractedContent['testimonials']): string {
  if (testimonials.length === 0) return '';
  return testimonials.map(t => `
    <div class="p-6 bg-gray-50 rounded-xl border border-gray-100">
      <blockquote class="text-sm text-gray-700 italic leading-relaxed mb-4">"${t.quote}"</blockquote>
      <div class="flex items-center">
        <div class="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-sm">${t.name.charAt(0)}${(t.name.split(' ')[1] || '').charAt(0)}</div>
        <div class="ml-3">
          <div class="font-semibold text-gray-900 text-sm">${t.name}</div>
          ${t.role ? `<div class="text-xs text-gray-500">${t.role}</div>` : ''}
        </div>
      </div>
    </div>`).join('\n');
}

/**
 * Generate HTML stat blocks from extracted data.
 */
function renderStats(stats: ExtractedContent['stats']): string {
  if (stats.length === 0) return '';
  return stats.map(s => `
    <div class="text-center">
      <div class="text-3xl md:text-4xl font-bold text-gray-900 mb-1">${s.value}</div>
      <div class="text-sm text-gray-500">${s.label}</div>
    </div>`).join('\n');
}

// =============================================================================
// Preview Utilities — shared by code-section, qa-section, deploy-section
// Converts generated React/Next.js code into self-contained HTML for iframe preview
// =============================================================================

// HTML void elements that should not have closing tags
const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

// Known HTML elements (lowercase) that should be preserved as-is
const HTML_ELEMENTS = new Set([
  'div', 'span', 'p', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'img', 'br', 'hr', 'input', 'button', 'form',
  'label', 'select', 'option', 'textarea', 'table', 'thead', 'tbody',
  'tr', 'td', 'th', 'nav', 'header', 'footer', 'main', 'section',
  'article', 'aside', 'figure', 'figcaption', 'video', 'audio',
  'canvas', 'svg', 'path', 'circle', 'rect', 'line', 'polygon',
  'polyline', 'g', 'defs', 'use', 'symbol', 'text', 'tspan',
  'iframe', 'embed', 'object', 'param', 'source', 'track', 'map',
  'area', 'col', 'colgroup', 'caption', 'fieldset', 'legend',
  'datalist', 'output', 'progress', 'meter', 'details', 'summary',
  'dialog', 'slot', 'template', 'pre', 'code', 'blockquote', 'em',
  'strong', 'small', 'sub', 'sup', 'mark', 'del', 'ins', 'abbr',
  'cite', 'dfn', 'time', 'var', 'samp', 'kbd', 'b', 'i', 'u', 's',
  'q', 'ruby', 'rt', 'rp', 'bdi', 'bdo', 'wbr',
]);

// Framer Motion props that must be stripped from JSX
const MOTION_PROPS = new Set([
  'initial', 'animate', 'exit', 'transition', 'whileHover', 'whileTap',
  'whileDrag', 'whileFocus', 'whileInView', 'variants', 'layoutId',
  'layout', 'layoutDependency', 'drag', 'dragConstraints', 'dragElastic',
  'dragMomentum', 'dragSnapToOrigin', 'dragPropagation',
  'onAnimationStart', 'onAnimationComplete', 'onDragStart', 'onDrag',
  'onDragEnd', 'onDragTransitionEnd', 'onDirectionLock',
  'onMeasureDragConstraints', 'onViewportEnter', 'onViewportLeave',
  'onPanStart', 'onPan', 'onPanEnd', 'onPanSessionStart',
  'onTapStart', 'onTap', 'onTapCancel', 'onHoverStart', 'onHoverEnd',
]);

// Next.js components that should be converted to HTML equivalents
const NEXT_COMPONENT_MAP: Record<string, string> = {
  'Image': 'img',
  'Link': 'a',
  'NextImage': 'img',
  'NextLink': 'a',
};

/**
 * Strip JavaScript logic from a component file, keeping only the JSX return body.
 */
function extractJsxReturn(code: string): string {
  // Remove import statements (multiline)
  let cleaned = code.replace(/^import\s+[\s\S]*?;?\s*$/gm, '');
  // Remove export type / interface declarations
  cleaned = cleaned.replace(/^export\s+(type|interface)\s+[\s\S]*?^}/gm, '');
  cleaned = cleaned.replace(/^type\s+\w+[\s\S]*?^}/gm, '');
  cleaned = cleaned.replace(/^interface\s+\w+[\s\S]*?^}/gm, '');
  // Remove 'use client' / 'use strict' directives
  cleaned = cleaned.replace(/^['"]use\s+(client|strict)['"]\s*;?\s*$/gm, '');

  // Find the LAST return( ... ) that contains JSX
  const returnRegex = /return\s*\(/g;
  let lastMatch: { body: string } | null = null;
  let match;

  while ((match = returnRegex.exec(cleaned)) !== null) {
    const startIdx = match.index + match[0].length;
    let depth = 1;
    let i = startIdx;
    let inString = false;
    let stringChar = '';
    let inTemplate = false;

    while (i < cleaned.length && depth > 0) {
      const ch = cleaned[i];
      const prev = i > 0 ? cleaned[i - 1] : '';

      if (inString) {
        if (ch === stringChar && prev !== '\\') inString = false;
      } else if (inTemplate) {
        if (ch === '`' && prev !== '\\') inTemplate = false;
      } else {
        if (ch === '"' || ch === "'") { inString = true; stringChar = ch; }
        else if (ch === '`') inTemplate = true;
        else if (ch === '(') depth++;
        else if (ch === ')') depth--;
      }
      i++;
    }

    if (depth === 0) {
      const body = cleaned.slice(startIdx, i - 1);
      if (/<[a-z][\s/>]/.test(body) || /<[A-Z]/.test(body)) {
        lastMatch = { body };
      }
    }
  }

  return lastMatch?.body || '';
}

/**
 * Resolve component references: replace <ComponentName /> with actual JSX.
 */
function resolveComponents(jsx: string, componentMap: Map<string, string>): string {
  let result = jsx;
  let iterations = 0;

  // Track component tag → resolved HTML tag mapping for correct closing tags
  const closingTagMap = new Map<string, string>();

  while (iterations < 10) {
    let changed = false;

    const tagRegex = /<(\/?)(?!(?:div|span|p|a|h[1-6]|ul|ol|li|img|br|hr|input|button|form|label|select|option|textarea|table|thead|tbody|tr|td|th|nav|header|footer|main|section|article|aside|figure|figcaption|video|audio|canvas|svg|path|circle|rect|line|polygon|polyline|g|defs|use|symbol|text|tspan|iframe|embed|object|param|source|track|map|area|col|colgroup|caption|fieldset|legend|datalist|output|progress|meter|details|summary|dialog|slot|template|pre|code|blockquote|em|strong|small|sub|sup|b|i|u|s|q)\b)([A-Z]\w*)(?:\.[\w]+)?(\s[^>]*)?\s*(\/?)>/g;

    result = result.replace(tagRegex, (fullMatch, slash, tagName, _dotPart, attrs, selfClose) => {
      if (slash) {
        // Closing tag: use tracked tag or fallback to div
        const resolvedTag = closingTagMap.get(tagName) || 'div';
        return `</${resolvedTag}>`;
      }

      const fullTag = fullMatch.match(/<([\w.]+)/)?.[1] || tagName;

      // motion.xxx → HTML tag
      if (fullTag.startsWith('motion.')) {
        const htmlTag = fullTag.split('.')[1] || 'div';
        closingTagMap.set(tagName, htmlTag);
        if (selfClose) return `<${htmlTag}${attrs || ''}></${htmlTag}>`;
        return `<${htmlTag}${attrs || ''}>`;
      }

      // AnimatePresence / StrictMode / Fragment → strip
      if (tagName === 'AnimatePresence' || tagName === 'StrictMode' || tagName === 'Fragment') {
        closingTagMap.set(tagName, '');
        return '';
      }

      // Known component in map → inline its JSX
      const componentJsx = componentMap.get(tagName);
      if (componentJsx) {
        changed = true;
        closingTagMap.set(tagName, '');
        return componentJsx;
      }

      // Next.js component mapping
      const mappedTag = NEXT_COMPONENT_MAP[tagName];
      if (mappedTag) {
        closingTagMap.set(tagName, mappedTag);
        if (selfClose) return `<${mappedTag}${attrs || ''}>`;
        return `<${mappedTag}${attrs || ''}>`;
      }

      // Unknown component → div
      closingTagMap.set(tagName, 'div');
      if (selfClose) return `<div${attrs || ''}></div>`;
      return `<div${attrs || ''}>`;
    });

    if (!changed) break;
    iterations++;
  }

  // Clean up remaining closing tags for stripped components
  result = result.replace(/<\/(?:AnimatePresence|StrictMode|Fragment)\s*>/g, '');
  result = result.replace(/<\/[A-Z]\w*(?:\.\w+)?\s*>/g, (match) => {
    const tagName = match.match(/<\/([A-Z]\w*)/)?.[1] || '';
    const resolved = closingTagMap.get(tagName);
    if (resolved === '') return ''; // stripped component
    return `</${resolved || 'div'}>`;
  });

  return result;
}

/**
 * Remove all JSX expression attributes from a tag string.
 * Handles: prop={value}, prop={complex(expr)}, prop={{...}}, prop={fn()}
 */
function stripJsxAttributes(attrs: string): string {
  if (!attrs) return '';

  let result = attrs;

  // Remove Framer Motion props with any value type
  for (const prop of MOTION_PROPS) {
    // prop={{...}} (object value with nested braces)
    result = result.replace(new RegExp(`\\s+${prop}\\s*=\\s*\\{\\{[^}]*(?:\\{[^}]*\\}[^}]*)*\\}\\}`, 'g'), '');
    // prop={{...}} simple
    result = result.replace(new RegExp(`\\s+${prop}\\s*=\\s*\\{\\{[^}]*\\}\\}`, 'g'), '');
    // prop={[...]} (array value)
    result = result.replace(new RegExp(`\\s+${prop}\\s*=\\s*\\{\\[[^\\]]*\\]\\}`, 'g'), '');
    // prop={{...}} with nested
    result = result.replace(new RegExp(`\\s+${prop}\\s*=\\s*\\{[^{}]*(?:\\{[^{}]*\\}[^{}]*)*\\}`, 'g'), '');
    // prop="string" or prop={expr}
    result = result.replace(new RegExp(`\\s+${prop}\\s*=\\s*"[^"]*"`, 'g'), '');
    result = result.replace(new RegExp(`\\s+${prop}\\s*=\\s*\\{[^}]*\\}`, 'g'), '');
    // prop (boolean shorthand)
    result = result.replace(new RegExp(`\\s+${prop}\\b(?!=)`), '');
  }

  // Remove event handlers: on[A-Z]...={...} (with nested braces)
  result = result.replace(/\s+on[A-Z]\w*\s*=\s*\{(?:[^{}]|\{(?:[^{}]|\{[^}]*\})*\})*\}/g, '');
  result = result.replace(/\s+on[A-Z]\w*\s*=\s*\{[^}]*\}/g, '');
  result = result.replace(/\s+on[A-Z]\w*\s*=\s*"[^"]*"/g, '');

  // Convert JSX expression attributes to HTML for important visual attributes
  // src={"url"} → src="url", alt={"text"} → alt="text", href={"url"} → href="url"
  const PRESERVED_ATTRS = ['src', 'alt', 'href', 'width', 'height', 'fill', 'priority', 'quality', 'sizes', 'placeholder', 'title', 'id', 'type', 'name', 'value', 'target', 'rel'];
  for (const attr of PRESERVED_ATTRS) {
    // attr={"string literal"} → attr="string literal"
    result = result.replace(new RegExp(`\\s+${attr}\\s*=\\s*\\{\\s*"([^"]*)"\\s*\\}`, 'g'), ` ${attr}="$1"`);
    result = result.replace(new RegExp(`\\s+${attr}\\s*=\\s*\\{\\s*'([^']*)'\\s*\\}`, 'g'), ` ${attr}="$1"`);
    // attr={number} → attr="number" (for width/height)
    result = result.replace(new RegExp(`\\s+${attr}\\s*=\\s*\\{\\s*(\\d+(?:\\.\\d+)?)\\s*\\}`, 'g'), ` ${attr}="$1"`);
    // attr={true} → attr (boolean), attr={false} → remove
    result = result.replace(new RegExp(`\\s+${attr}\\s*=\\s*\\{\\s*true\\s*\\}`, 'g'), ` ${attr}`);
    result = result.replace(new RegExp(`\\s+${attr}\\s*=\\s*\\{\\s*false\\s*\\}`, 'g'), '');
  }

  // Remove ref, key, dangerouslySetInnerHTML
  result = result.replace(/\s+(?:ref|key|dangerouslySetInnerHTML)\s*=\s*(?:"[^"]*"|\{(?:[^{}]|\{[^}]*\})*\}|\{[^}]*\})/g, '');

  // Remove spread props: {...props}, {...rest}, {...spread}
  result = result.replace(/\s+\{\.\.\.[\w.]+\}/g, '');
  result = result.replace(/\s+\{\.\.\.\w+(?:\s*,\s*\w+)*\}/g, '');

  // Convert style={{...}} to HTML style="..." BEFORE generic prop stripping
  result = result.replace(/\s+style\s*=\s*\{\{([^}]*(?:\{[^}]*\}[^}]*)*)\}\}/g, (_match, inner) => {
    const cssProps: string[] = [];
    const propRegex = /(\w+)\s*:\s*(?:'([^']*)'|"([^"]*)"|`([^`]*)`|(\d+(?:\.\d+)?))/g;
    let propMatch;
    while ((propMatch = propRegex.exec(inner)) !== null) {
      const [, prop, v1, v2, v3, v4] = propMatch;
      const value = v1 ?? v2 ?? v3 ?? v4 ?? '';
      const kebab = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
      const needsUnit = !['opacity', 'zIndex', 'z-index', 'fontWeight', 'font-weight', 'lineHeight', 'line-height', 'flex', 'order', 'columns'].includes(prop);
      const finalValue = v4 && needsUnit ? `${value}px` : value;
      cssProps.push(`${kebab}:${finalValue}`);
    }
    if (cssProps.length === 0) return '';
    return ` style="${cssProps.join(';')}"`;
  });
  result = result.replace(/\s+style\s*=\s*\{`[^`]*`\}/g, '');

  // Remove any remaining prop={complex_expression} with nested braces
  result = result.replace(/\s+\w+\s*=\s*\{(?:[^{}]|\{(?:[^{}]|\{[^}]*\})*\})*\}/g, '');
  // Simpler fallback for single-level
  result = result.replace(/\s+\w+\s*=\s*\{[^}]*\}/g, '');

  return result;
}

/**
 * Transform JSX syntax into browser-renderable HTML.
 */
function transformJsxToHtml(jsx: string): string {
  let html = jsx;

  // 0. Remove JSX comments: {/* ... * /}
  html = html.replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

  // 1. className → class
  html = html.replace(/\bclassName\s*=/g, 'class=');

  // 2. Handle template literals in class: class={`... ${expr} ...`}
  html = html.replace(/class\s*=\s*\{`([^`]*)`\}/g, (_match, content: string) => {
    const cleaned = content.replace(/\$\{[^}]*\}/g, '').replace(/\s+/g, ' ').trim();
    return `class="${cleaned}"`;
  });

  // 3. Handle cn() and other function calls in class: class={cn('a', 'b')}
  html = html.replace(/class\s*=\s*\{(?:[^{}]|\{[^}]*\})*\}/g, (_match) => {
    // Try to extract static string arguments
    const strings = _match.match(/['"]([^'"]+)['"]/g);
    if (strings) {
      const classes = strings.map(s => s.replace(/['"]/g, '')).join(' ');
      return `class="${classes}"`;
    }
    return 'class=""';
  });

  // 4. Process all HTML tags: strip JSX attributes
  html = html.replace(/<(\w[\w.]*)((?:\s+[^>]*?)?)\s*(\/?)>/g, (fullMatch, tag, attrs, selfClose) => {
    // Skip if this looks like a closing tag
    if (fullMatch.startsWith('</')) return fullMatch;

    const cleanedAttrs = stripJsxAttributes(attrs || '');

    // Handle self-closing void elements
    if (selfClose && VOID_ELEMENTS.has(tag.toLowerCase())) {
      return `<${tag}${cleanedAttrs}>`;
    }
    // Handle self-closing non-void elements
    if (selfClose) {
      return `<${tag}${cleanedAttrs}></${tag}>`;
    }
    return `<${tag}${cleanedAttrs}>`;
  });

  // 5. Remove standalone JSX expressions: {variable}, {condition && <...>}, {arr.map(...)}
  // Multi-pass to handle nested braces
  for (let pass = 0; pass < 3; pass++) {
    html = html.replace(/\{(?:[^{}]|\{[^{}]*\})*\}/g, (match) => {
      const inner = match.slice(1, -1).trim();
      // Keep string literals: {"text"} → text
      if (/^['"]/.test(inner) && /['"]$/.test(inner)) {
        return inner.slice(1, -1);
      }
      // Remove everything else (variables, expressions, function calls)
      return '';
    });
  }

  // 6. Remove remaining spread props
  html = html.replace(/\{\.\.\.[\w.]+\}/g, '');

  // 7. Fix self-closing void tags that still have />
  html = html.replace(/<(br|hr|img|input|meta|link|area|base|col|embed|param|source|track|wbr)([^>]*)\/>/g, '<$1$2>');

  // 8. Remove empty attributes: href="" → remove if empty, class="" → keep
  html = html.replace(/\s+(href|src|alt|title|id|for|action|method|type|name|value|placeholder|target|rel)=""/g, '');

  // 9. Remove remaining JSX artifacts
  html = html.replace(/<>\s*<\/>/g, '');
  html = html.replace(/<React\.Fragment\s*\/?>/g, '');
  html = html.replace(/<\/React\.Fragment>/g, '');
  html = html.replace(/<Fragment\s*\/?>/g, '');
  html = html.replace(/<\/Fragment>/g, '');

  // 10. Remove any remaining JavaScript that leaked through (line-by-line)
  const lines = html.split('\n');
  const filteredLines = lines.filter(line => {
    const trimmed = line.trim();
    if (!trimmed) return true;
    // Skip pure JS lines
    if (/^(const|let|var|function|return|import|export|\/\/|\/\*|\*|if\s*\(|else\b|switch|case\b|for\s*\(|while\s*\(|try\b|catch\b|throw)\b/.test(trimmed)) return false;
    if (/^[\w.]+\s*=\s*/.test(trimmed) && !trimmed.includes('<')) return false;
    if (/^(.*=>)\s*[{(]/.test(trimmed) && !trimmed.includes('<')) return false;
    if (/^[\w.]+\s*\([^)]*\)\s*;?\s*$/.test(trimmed) && !trimmed.includes('<')) return false;
    if (/^\)\s*;?\s*$/.test(trimmed)) return false;
    if (/^}\s*;?\s*$/.test(trimmed)) return false;
    if (/^\]\s*;?\s*$/.test(trimmed)) return false;
    // Skip lines that are just closing braces with optional semicolons
    if (/^[})\];]+\s*$/.test(trimmed)) return false;
    return true;
  });

  return filteredLines.join('\n');
}

/**
 * Post-process HTML to fix common structural issues from JSX→HTML conversion.
 * Handles: nested html/body, motion.* tags, Fragment markers, broken attributes, JS leaks.
 */
export function postProcessHtml(html: string, content?: ExtractedContent): string {
  let result = html;

  // 1. Strip nested <html> and <body> tags (keep their content)
  result = result.replace(/<html[^>]*>/gi, '');
  result = result.replace(/<\/html>/gi, '');
  result = result.replace(/<body[^>]*>/gi, '');
  result = result.replace(/<\/body>/gi, '');

  // 2. Convert remaining motion.xxx opening tags to plain HTML
  //    Handles: <motion.div ...>, <motion.nav ...>, <motion.section ...>, etc.
  result = result.replace(/<motion\.(\w+)(\s[^>]*)?\s*(\/?)>/g, (_match, tag, attrs, selfClose) => {
    const cleanedAttrs = (attrs || '')
      // Strip Framer Motion props (initial, animate, exit, transition, while*, variants, etc.)
      .replace(/\s+(?:initial|animate|exit|transition|whileHover|whileTap|whileDrag|whileFocus|whileInView|variants|layoutId|layout|layoutDependency|viewport|once|amount|as)\s*=\s*(?:\{(?:[^{}]|\{[^{}]*\})*\}|"[^"]*")/g, '')
      // Strip event handlers
      .replace(/\s+on[A-Z]\w*\s*=\s*(?:\{(?:[^{}]|\{[^{}]*\})*\}|"[^"]*")/g, '')
      // Strip remaining JSX expressions
      .replace(/\s+\w+\s*=\s*\{[^}]*\}/g, '');
    if (selfClose) return `<${tag}${cleanedAttrs}></${tag}>`;
    return `<${tag}${cleanedAttrs}>`;
  });

  // Convert remaining motion.xxx closing tags
  result = result.replace(/<\/motion\.(\w+)\s*>/g, '</$1>');

  // 3. Strip Framer Motion props from ALL remaining tags (in case motion.* was already converted)
  result = result.replace(/(<\w+)(\s[^>]*>)/g, (_match, tagStart, rest) => {
    const cleaned = rest
      .replace(/\s+(?:initial|animate|exit|transition|whileHover|whileTap|whileDrag|whileFocus|whileInView|variants|layoutId|layout|layoutDependency|viewport|once|amount)\s*=\s*(?:\{(?:[^{}]|\{[^{}]*\})*\}|"[^"]*")/g, '')
      .replace(/\s+as\s*=\s*(?:"[^"]*"|\{[^}]*\})/g, '');
    return tagStart + cleaned;
  });

  // 4. Remove AnimatePresence, StrictMode, LayoutGroup wrapper tags
  result = result.replace(/<(?:AnimatePresence|StrictMode|LayoutGroup)(?:\s[^>]*)?>[\s\S]*?<\/(?:AnimatePresence|StrictMode|LayoutGroup)>/g, (match) => {
    // Keep inner content, strip wrapper
    return match
      .replace(/^<(?:AnimatePresence|StrictMode|LayoutGroup)(?:\s[^>]*)?>/, '')
      .replace(/<\/(?:AnimatePresence|StrictMode|LayoutGroup)>$/, '');
  });
  // Self-closing or standalone open/close tags
  result = result.replace(/<(?:AnimatePresence|StrictMode|LayoutGroup)(?:\s[^>]*)?\s*\/?>/g, '');
  result = result.replace(/<\/(?:AnimatePresence|StrictMode|LayoutGroup)\s*>/g, '');

  // 5. Remove Fragment markers
  result = result.replace(/<>\s*/g, '');
  result = result.replace(/\s*<\/>/g, '');
  result = result.replace(/<React\.Fragment[^>]*>/g, '');
  result = result.replace(/<\/React\.Fragment>/g, '');
  result = result.replace(/<Fragment[^>]*>/g, '');
  result = result.replace(/<\/Fragment>/g, '');

  // 6. Fix broken class attributes where transition/duration leaked into class value
  //    e.g., hover:bg-[#005cbf]-all duration-300 → hover:bg-[#005cbf] transition-all duration-300
  //    Only targets classes with ]-all pattern (Tailwind arbitrary value + leaked -all suffix)
  result = result.replace(/class="([^"]*)"/g, (_match, classes: string) => {
    let fixed = classes
      // Fix: xxx]-all duration-NNN → xxx] transition-all duration-NNN
      .replace(/(\S+\])-all\s+duration-(\d+)/g, '$1 transition-all duration-$2')
      // Fix: xxx]-all transform → xxx] transition-all transform
      .replace(/(\S+\])-all\s+transform/g, '$1 transition-all transform')
      // Fix standalone: xxx]-all at end → xxx] transition-all
      .replace(/(\S+\])-all(?=\s|$)/g, '$1 transition-all');
    // Fix -ease merging: hover:scale-[1.02]-ease → hover:scale-[1.02] ease
    fixed = fixed.replace(/(\S+(?:\]|\d))-(ease|linear)(?=\s|$)/g, '$1 $2');
    // Remove duplicate classes
    const parts = fixed.split(/\s+/);
    const seen = new Set<string>();
    const deduped = parts.filter(p => {
      if (!p) return false;
      if (seen.has(p)) return false;
      seen.add(p);
      return true;
    });
    return `class="${deduped.join(' ')}"`;
  });

  // 6b. Fix broken class patterns: xxx]-colors → xxx] transition-colors
  //     e.g., hover:text-[#0071E3]-colors → hover:text-[#0071E3] transition-colors
  //     e.g., hover:bg-[rgba(0,0,0,0.05)]-colors → hover:bg-[rgba(0,0,0,0.05)] transition-colors
  //     Also catches bare -colors without ] (e.g., hover:text-blue-colors)
  //     Note: lookahead uses $ (not ") because we're inside a captured class value
  result = result.replace(/class="([^"]*)"/g, (_match, classes: string) => {
    let fixed = classes
      .replace(/(\S+\])-colors(?=\s|$)/g, '$1 transition-colors')
      .replace(/(\S+\])-all(?=\s|$)/g, '$1 transition-all')
      // Catch patterns like "hover:text-[#xxx]-colors" where ] is part of arbitrary value
      .replace(/(\S+)-colors(?=\s|$)/g, (_m, base) => {
        // Don't modify valid Tailwind classes
        if (/^(text|bg|border|ring|outline|accent|caret|fill|stroke|transition)-colors$/.test(base)) return _m;
        return `${base} transition-colors`;
      });
    return `class="${fixed}"`;
  });

  // 6c. Strip @apply, @layer, and @screen blocks from <style> content
  //     These Tailwind build-time directives are NOT processed by the CDN script
  //     and produce zero CSS output, leaving elements completely unstyled
  result = result.replace(/<style>([\s\S]*?)<\/style>/g, (_match, cssContent: string) => {
    let cleaned = cssContent;
    // Remove @layer blocks (base, components, utilities)
    cleaned = cleaned.replace(/@layer\s+\w+\s*\{[\s\S]*?\n\}/g, '');
    // Remove @apply lines
    cleaned = cleaned.replace(/^\s*@apply\s+.*$/gm, '');
    // Remove @screen blocks
    cleaned = cleaned.replace(/@screen\s+\w+\s*\{[\s\S]*?\n\}/g, '');
    // Remove empty media queries left behind
    cleaned = cleaned.replace(/@media[^{]*\{\s*\}/g, '');
    return `<style>${cleaned}</style>`;
  });

  // 6d-0. CRITICAL: Fix malformed opening tags with no closing > that have text content on next line
  //        This MUST run before bare element detection (6d) to prevent incorrect class injection.
  //        Pattern: <h1\n        iPhone 15 Pro\n      </h1> → <h1 class="...">iPhone 15 Pro</h1>
  //        Pattern: <p\n        Titanium...\n      </p> → <p class="...">Titanium...</p>
  const headingClassMap: Record<string, string> = {
    h1: 'text-[clamp(32px,5vw,64px)] font-bold leading-[1.05] tracking-tight text-[#1d1d1f] mb-4',
    h2: 'text-[clamp(28px,4vw,48px)] font-bold leading-[1.1] tracking-tight text-[#1d1d1f] mb-4',
    h3: 'text-[clamp(20px,3vw,32px)] font-semibold leading-[1.2] text-[#1d1d1f] mb-3',
    h4: 'text-[20px] font-semibold text-[#1d1d1f] mb-2',
    h5: 'text-[17px] font-semibold text-[#1d1d1f] mb-2',
    h6: 'text-[15px] font-semibold text-[#86868b] mb-2',
  };
  for (const [tag, cls] of Object.entries(headingClassMap)) {
    // <h1\n        Title\n      </h1>
    result = result.replace(
      new RegExp(`<${tag}\\s*\\n\\s*([^<\\n]+)\\n\\s*</${tag}>`, 'g'),
      (_match, text) => `<${tag} class="${cls}">${text.trim()}</${tag}>`
    );
  }
  // <p\n        Text\n      </p>
  result = result.replace(
    /<p\s*\n\s*([^<\n]+)\n\s*<\/p>/g,
    (_match, text) => `<p class="text-[17px] text-[#86868b] leading-[1.5] max-w-2xl mb-6">${text.trim()}</p>`
  );

  // 6d. Add default styles to bare (unstyled) semantic elements
  //     AI often generates <h1>Title</h1> without any class attribute
  result = result
    // Bare <h1> → add large bold heading styles
    .replace(/<h1(?![^>]*class=)([^>]*)>/g,
      '<h1$1 class="text-[clamp(32px,5vw,64px)] font-bold leading-[1.05] tracking-tight text-[#1d1d1f] mb-4">')
    // Bare <h2> → add heading styles
    .replace(/<h2(?![^>]*class=)([^>]*)>/g,
      '<h2$1 class="text-[clamp(28px,4vw,48px)] font-bold leading-[1.1] tracking-tight text-[#1d1d1f] mb-4">')
    // Bare <h3> → add sub-heading styles
    .replace(/<h3(?![^>]*class=)([^>]*)>/g,
      '<h3$1 class="text-[clamp(20px,3vw,32px)] font-semibold leading-[1.2] text-[#1d1d1f] mb-3">')
    // Bare <p> → add body text styles (but NOT <path>, <pre>, <polygon> etc.)
    .replace(/<p(?=[\s>])(?![^>]*class=)([^>]*)>/g,
      '<p$1 class="text-[17px] text-[#86868b] leading-[1.5] max-w-2xl">');

  // 6e. Fix malformed heading tags with missing > (e.g., <h2\n  Designed by Apple> → <h2 class="...">Designed by Apple</h2>)
  result = result.replace(/<(h[1-6])([^>]*)\n\s*([^<]+)>/g, (_match, tag, attrs, text) => {
    const cleanText = text.replace(/>$/, '').trim();
    const hasClass = /class=/.test(attrs);
    if (hasClass) return `<${tag}${attrs}>${cleanText}</${tag}>`;
    const sizeMap: Record<string, string> = {
      h1: 'text-[clamp(32px,5vw,64px)] font-bold leading-[1.05] tracking-tight text-[#1d1d1f] mb-4',
      h2: 'text-[clamp(28px,4vw,48px)] font-bold leading-[1.1] tracking-tight text-[#1d1d1f] mb-4',
      h3: 'text-[clamp(20px,3vw,32px)] font-semibold leading-[1.2] text-[#1d1d1f] mb-3',
      h4: 'text-[20px] font-semibold text-[#1d1d1f] mb-2',
      h5: 'text-[17px] font-semibold text-[#1d1d1f] mb-2',
      h6: 'text-[15px] font-semibold text-[#86868b] mb-2',
    };
    return `<${tag} class="${sizeMap[tag] || ''}">${cleanText}</${tag}>`;
  });

  // 6e2. Fix malformed h/p with text on next line AND separate closing tag
  //      Pattern: <h1\n        Title\n      </h1> → <h1 class="...">Title</h1>
  result = result.replace(/<(h[1-6])(\s*)\n(\s*)([^<\n]+)\n\s*<\/(h[1-6])>/g, (_match, tag, _ws1, _ws2, text, _closeTag) => {
    const cleanText = text.trim();
    const sizeMap: Record<string, string> = {
      h1: 'text-[clamp(32px,5vw,64px)] font-bold leading-[1.05] tracking-tight text-[#1d1d1f] mb-4',
      h2: 'text-[clamp(28px,4vw,48px)] font-bold leading-[1.1] tracking-tight text-[#1d1d1f] mb-4',
      h3: 'text-[clamp(20px,3vw,32px)] font-semibold leading-[1.2] text-[#1d1d1f] mb-3',
      h4: 'text-[20px] font-semibold text-[#1d1d1f] mb-2',
      h5: 'text-[17px] font-semibold text-[#1d1d1f] mb-2',
      h6: 'text-[15px] font-semibold text-[#86868b] mb-2',
    };
    return `<${tag} class="${sizeMap[tag] || ''}">${cleanText}</${tag}>`;
  });

  // 6f. Fix bare <p> with content on next line: <p\n  Some text\n</p> (not <path>!)
  result = result.replace(/<p(?=[\s>])(?![^>]*class=)([^>]*)\n\s*([^<]+)\n\s*<\/p>/g, (_match, attrs, text) => {
    return `<p class="text-[17px] text-[#86868b] leading-[1.5] max-w-2xl mb-6"${attrs}>${text.trim()}</p>`;
  });

  // 6g. Ensure body has proper background from design tokens if present
  //     Look for --color-background in CSS vars and apply to body
  const bgColorMatch = result.match(/--color-background(?:-light)?:\s*(#[0-9a-fA-F]{3,8})/);
  if (bgColorMatch && !/body\{[^}]*background/.test(result)) {
    result = result.replace(
      /body\{([^}]*)\}/,
      `body{$1; background-color:${bgColorMatch[1]}}`
    );
  }

  // 7. Fix malformed opening tags (no closing >)
  //    Pattern: <section ...attrs...\n    <div → <section ...attrs...>\n    <div
  result = result.replace(/<(section|div|main|header|footer|nav|article|aside)([^>]*)\n(\s*<)/g, '<$1$2>\n$3');

  // 8. Remove orphaned JavaScript lines that leaked through
  const lines = result.split('\n');
  const filtered = lines.filter(line => {
    const t = line.trim();
    if (!t) return true;
    // Pure JS statements
    if (/^(const|let|var|function|return|import|export|\/\/|\/\*|\*)\b/.test(t)) return false;
    if (/^(if|else|switch|case|for|while|try|catch|throw|finally)\b/.test(t) && !t.includes('<')) return false;
    if (/^[\w.]+\s*=\s*/.test(t) && !t.includes('<')) return false;
    if (/^(.*=>)\s*[{(]/.test(t) && !t.includes('<')) return false;
    if (/^[\w.]+\s*\([^)]*\)\s*;?\s*$/.test(t) && !t.includes('<')) return false;
    if (/^[})\];]+\s*$/.test(t)) return false;
    if (/^\)\s*;?\s*$/.test(t)) return false;
    // Template literal artifacts
    if (/^\$\{[^}]*\}$/.test(t)) return false;
    return true;
  });
  result = filtered.join('\n');

  // 9. Fix comprehensive emoji encoding corruption
  result = result
    .replace(/馃摫/g, '📱')
    .replace(/漏/g, '©')
    .replace(/鉁/g, '✓')
    .replace(/馃崺/g, '🎨')
    .replace(/鉁ゕ/g, '⚡')
    .replace(/馃敜/g, '🔧')
    .replace(/馃帀/g, '💻')
    .replace(/馃/g, '🚀');

  // 10. Convert JSX component tags to inline SVG or remove
  const SVG_ICONS: Record<string, string> = {
    Github: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>',
    Twitter: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
    Linkedin: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>',
    Menu: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>',
    ArrowRight: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>',
    Search: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
  };
  for (const [name, svg] of Object.entries(SVG_ICONS)) {
    result = result.replace(new RegExp(`<${name}(?:\\s[^>]*)?\\s*/>`, 'g'), svg);
    result = result.replace(new RegExp(`<${name}(?:\\s[^>]*)?>[^<]*</${name}>`, 'g'), svg);
  }
  // Remove remaining unknown PascalCase tags (React components)
  result = result.replace(/<\/?([A-Z][a-zA-Z0-9]*)(?:\s[^>]*)?\s*\/?>/g, '');

  // 11. Fill empty containers with extracted or placeholder content
  // Smart nav: use extracted nav items if available
  if (content && content.navItems.length > 0) {
    const navHtml = content.navItems.map(n =>
      `<a href="${n.href}" class="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors">${n.label}</a>`
    ).join('');
    result = result.replace(/<nav([^>]*)>\s*<\/nav>/g, `<nav$1 class="flex items-center space-x-8">${navHtml}</nav>`);
  } else {
    result = result.replace(/<nav([^>]*)>\s*<\/nav>/g,
      '<nav$1 class="flex items-center space-x-8"><a href="#" class="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors">Features</a><a href="#" class="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors">Pricing</a><a href="#" class="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors">Docs</a></nav>');
  }
  // Smart ul: use extracted content if available
  if (content && content.footerLinks.length > 0) {
    const firstCategory = content.footerLinks[0];
    const liHtml = firstCategory.links.map(l =>
      `<li><a href="${l.href}" class="text-sm text-gray-500 hover:text-blue-600 transition-colors">${l.label}</a></li>`
    ).join('');
    result = result.replace(/<ul([^>]*)>\s*<\/ul>/g, `<ul$1 class="space-y-2">${liHtml}</ul>`);
  } else {
    result = result.replace(/<ul([^>]*)>\s*<\/ul>/g,
      '<ul$1 class="space-y-2"><li><a href="#" class="text-sm text-gray-500 hover:text-blue-600 transition-colors">Overview</a></li><li><a href="#" class="text-sm text-gray-500 hover:text-blue-600 transition-colors">Features</a></li><li><a href="#" class="text-sm text-gray-500 hover:text-blue-600 transition-colors">Pricing</a></li></ul>');
  }
  // Smart grid: use extracted features if available, otherwise placeholder cards
  // Only fill the FIRST empty grid to avoid duplicating the same cards everywhere
  if (content && content.features.length > 0) {
    const cardsHtml = renderFeatureCards(content.features);
    result = result.replace(/(<div[^>]*class="[^"]*grid[^"]*"[^>]*>)\s*(<\/div>)/, `$1${cardsHtml}$2`);
  } else {
    result = result.replace(/(<div[^>]*class="[^"]*grid[^"]*"[^>]*>)\s*(<\/div>)/,
      '$1<div class="p-6 bg-white rounded-xl border border-gray-100 shadow-sm"><h3 class="font-semibold text-gray-900 mb-2">Feature One</h3><p class="text-sm text-gray-500">Powerful capability for modern workflows.</p></div><div class="p-6 bg-white rounded-xl border border-gray-100 shadow-sm"><h3 class="font-semibold text-gray-900 mb-2">Feature Two</h3><p class="text-sm text-gray-500">Built for speed and reliability at scale.</p></div><div class="p-6 bg-white rounded-xl border border-gray-100 shadow-sm"><h3 class="font-semibold text-gray-900 mb-2">Feature Three</h3><p class="text-sm text-gray-500">Seamless integration with your stack.</p></div>$2');
  }

  // 12. Add classes to bare buttons (no class attribute)
  //     Case 1: text on same line: <button>Get started</button>
  result = result.replace(/<button(?![^>]*class=)([^>]*)>(\s*[^<\s])/g,
    '<button class="px-6 py-3 bg-[#0071E3] text-white font-semibold rounded-lg hover:bg-[#005bb5] transition-all hover:scale-[1.02] cursor-pointer"$1>$2');
  //     Case 2: text on next line: <button\n        Get started\n      </button>
  result = result.replace(/<button(?![^>]*class=)([^>]*)>\n\s*([^<\n]+)\n\s*<\/button>/g,
    '<button class="px-6 py-3 bg-[#0071E3] text-white font-semibold rounded-lg hover:bg-[#005bb5] transition-all hover:scale-[1.02] cursor-pointer"$1>$2</button>');
  //     Case 3: empty button with only whitespace: <button>\n      </button>
  result = result.replace(/<button(?![^>]*class=)([^>]*)>\s*<\/button>/g,
    '<button class="px-6 py-3 bg-[#0071E3] text-white font-semibold rounded-lg hover:bg-[#005bb5] transition-all hover:scale-[1.02] cursor-pointer"$1>Action</button>');
  //     Case 4: > on next line: <button\n  >text</button> or <button\n  >\n  text\n</button>
  result = result.replace(/<button(?![^>]*class=)\s*\n\s*>([^<]*)<\/button>/g,
    '<button class="px-6 py-3 bg-[#0071E3] text-white font-semibold rounded-lg hover:bg-[#005bb5] transition-all hover:scale-[1.02] cursor-pointer">$1</button>');
  result = result.replace(/<button(?![^>]*class=)\s*\n\s*>\s*\n\s*([^<\n]+)\s*\n\s*<\/button>/g,
    '<button class="px-6 py-3 bg-[#0071E3] text-white font-semibold rounded-lg hover:bg-[#005bb5] transition-all hover:scale-[1.02] cursor-pointer">$1</button>');
  //     Case 5: no > at all: <button\n  text\n</button>
  result = result.replace(/<button(?![^>]*class=)\s*\n\s*([^<\n]+)\s*\n\s*<\/button>/g,
    '<button class="px-6 py-3 bg-[#0071E3] text-white font-semibold rounded-lg hover:bg-[#005bb5] transition-all hover:scale-[1.02] cursor-pointer">$1</button>');
  //     Case 6: no > and empty: <button\n  \n</button>
  result = result.replace(/<button(?![^>]*class=)\s*\n\s*\n\s*<\/button>/g,
    '<button class="px-6 py-3 bg-[#0071E3] text-white font-semibold rounded-lg hover:bg-[#005bb5] transition-all hover:scale-[1.02] cursor-pointer">Action</button>');

  return result;
}

/**
 * Build a self-contained HTML document from a Map of generated source files.
 */
export function buildPreviewHtml(codeMap: Map<string, string>): string {
  let cssContent = '';
  const componentJsxMap = new Map<string, string>();
  const pageJsxParts: string[] = [];

  // Phase 0: Extract structured content from component source code
  const extractedContent = extractComponentData(codeMap);

  // Phase 1: Collect CSS and extract JSX from each file
  for (const [filename, code] of codeMap.entries()) {
    if (filename.endsWith('.css')) {
      cssContent += code.replace(/@tailwind\s+(base|components|utilities);?/g, '') + '\n';
      continue;
    }
    if (!filename.endsWith('.tsx') && !filename.endsWith('.jsx')) continue;

    const jsxBody = extractJsxReturn(code);
    if (!jsxBody) continue;

    const isPage = filename.includes('page.tsx') || filename.includes('layout.tsx');
    const componentName = filename.split('/').pop()?.replace(/\.(tsx|jsx)$/, '') || '';

    if (isPage) {
      pageJsxParts.push(jsxBody);
    } else {
      componentJsxMap.set(componentName, jsxBody);
    }
  }

  // Phase 2: Resolve component references
  let resolvedParts: string[] = [];
  for (const jsx of pageJsxParts) {
    resolvedParts.push(resolveComponents(jsx, componentJsxMap));
  }

  if (resolvedParts.length === 0) {
    resolvedParts = Array.from(componentJsxMap.values());
  }

  // Phase 3: Transform JSX to HTML
  const htmlParts = resolvedParts.map(transformJsxToHtml);

  // Phase 4: Build the final HTML document
  const rawBody = htmlParts.length > 0
    ? htmlParts.join('\n')
    : '<div class="p-8 text-center text-gray-400"><p>暂无可预览的组件代码</p></div>';

  // Phase 5: Comprehensive post-processing (motion tags, fragments, attributes, emoji)
  const fixedBody = postProcessHtml(rawBody, extractedContent);

  // Phase 6: Brand color correction — replace generic Apple blue with real brand colors
  let finalBody = fixedBody;
  if (isGenericTemplate(cssContent, extractedContent.brandColors) && extractedContent.brandColors.length > 0) {
    const realBrand = extractedContent.brandColors[0];
    // Replace generic #0071E3 with real brand color in the rendered HTML
    finalBody = finalBody.replace(/#0071E3/gi, realBrand);
    finalBody = finalBody.replace(/#005bb5/gi, realBrand);
    finalBody = finalBody.replace(/#0077ED/gi, realBrand);
  }

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<script src="https://cdn.tailwindcss.com"><\/script>
<script>
tailwind.config = {
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', 'Segoe UI', 'sans-serif'],
      },
    },
  },
}
<\/script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth}
body{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text","Helvetica Neue","Segoe UI",sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;background:#fff;transition:background 0.3s,color 0.3s}
img{max-width:100%;height:auto;display:block}
a{color:inherit;text-decoration:none;transition:color 0.2s}
a:hover{color:inherit}

/* Dark mode support */
.dark{--bg:#000;--text:#fff;--surface:#1d1d1f}
.dark body{background:var(--bg);color:var(--text)}

/* Scroll-triggered fade-in animations */
.fade-in-up{opacity:0;transform:translateY(30px);transition:opacity 0.6s ease,transform 0.6s ease}
.fade-in-up.visible{opacity:1;transform:translateY(0)}

/* Card hover effects */
.card-hover{transition:transform 0.2s ease,box-shadow 0.2s ease}
.card-hover:hover{transform:translateY(-4px);box-shadow:0 8px 24px rgba(0,0,0,0.12)}

/* Button hover effects */
button,.btn{transition:all 0.2s ease}
button:hover,.btn:hover{transform:translateY(-2px)}

/* Custom scrollbar */
::-webkit-scrollbar{width:8px;height:8px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:#c4c4c6;border-radius:4px}
::-webkit-scrollbar-thumb:hover{background:#b0b4ba}

/* CSS animations */
@keyframes blink{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.1)}}
@keyframes wiggle{0%,100%{transform:rotate(0)}25%{transform:rotate(-8deg)}75%{transform:rotate(8deg)}}
@keyframes floaty{0%,100%{transform:translateY(0)}50%{transform:translateY(-16px)}}

${cssContent}
</style>
</head>
<body>
${finalBody}
<script>
// Scroll-triggered animations
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.fade-in-up').forEach(el => {
  observer.observe(el);
});

// Sticky nav with scroll effect
const nav = document.querySelector('nav');
if (nav) {
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 10);
  });
}

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    const href = this.getAttribute('href');
    if (href === '#') return;
    e.preventDefault();
    const target = document.querySelector(href);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });
});
<\/script>
</body>
</html>`;
}
