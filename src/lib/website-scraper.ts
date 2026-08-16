// =====================================================================
// Website Scraper — Extract real CSS/HTML design data from any URL
// Used by the vision step to provide real data to the AI analyzer
// =====================================================================

import { promises as dns } from 'dns';
import net from 'net';

/** Extracted design data from a real website */
export interface ScrapedDesignData {
  url: string;
  title: string;
  metaDescription: string;
  colors: { value: string; context: string }[];
  fonts: { family: string; weights: string[]; sizes: string[] }[];
  spacing: string[];
  borderRadius: string[];
  shadows: string[];
  transitions: string[];
  layoutHints: string[];
  htmlStructure: string;
  cssSnippet: string;
  externalCSSCount: number;
  inlineStyleCount: number;
}

// =====================================================================
// SSRF 防护（修复 P0-3）
// 拦截 localhost / RFC1918 私网 / link-local / 云元数据 / IPv6 私网，
// 并对每一次重定向重新校验目标地址。
// =====================================================================

const BLOCKED_HOSTS = ['localhost', 'metadata.google.internal'];
const MAX_REDIRECTS = 5;

/** 判断 IP 是否为私网 / 回环 / 链路本地 / 云元数据等不可访问地址 */
function isPrivateIP(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 0 || a === 10 || a === 127) return true;          // 0/8, 10/8, 127/8
    if (a === 169 && b === 254) return true;                     // 169.254/16 链路本地 + 云元数据
    if (a === 172 && b >= 16 && b <= 31) return true;            // 172.16/12
    if (a === 192 && b === 168) return true;                     // 192.168/16
    if (a === 100 && b >= 64 && b <= 127) return true;           // 100.64/10 CGNAT
    return false;
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower === '::') return true;          // 回环 / 未指定
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // fc00::/7 本地
    if (/^fe[89ab]/.test(lower)) return true;                    // fe80::/10 链路本地
    const v4 = lower.match(/::ffff:(\d+\.\d+\.\d+\.\d+)/);       // IPv4 映射
    if (v4) return isPrivateIP(v4[1]);
    return false;
  }
  return true; // 未知格式一律拒绝
}

/** 校验 URL 安全性：仅 http/https，拒绝危险主机名与私网 IP（含 DNS 解析后校验） */
async function assertSafeUrl(rawUrl: string): Promise<string> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http and https URLs are allowed');
  }
  const hostname = parsed.hostname.replace(/^\[|\]$/g, '');
  const lowerHost = hostname.toLowerCase();
  if (
    BLOCKED_HOSTS.includes(lowerHost) ||
    lowerHost.endsWith('.local') ||
    lowerHost.endsWith('.internal') ||
    lowerHost.endsWith('.localhost')
  ) {
    throw new Error('Access to this host is not allowed');
  }
  // 主机名本身是 IP：直接校验
  if (net.isIP(hostname)) {
    if (isPrivateIP(hostname)) throw new Error('Access to private/internal addresses is not allowed');
    return parsed.href;
  }
  // 解析 DNS，任一返回 IP 为私网即拒绝
  let addresses: { address: string }[] = [];
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch {
    throw new Error('Could not resolve host');
  }
  for (const { address } of addresses) {
    if (isPrivateIP(address)) {
      throw new Error('Access to private/internal addresses is not allowed');
    }
  }
  return parsed.href;
}

/** 安全 fetch：手动跟随重定向并逐跳校验目标，杜绝重定向绕过 */
async function safeFetch(url: string, init: RequestInit): Promise<Response> {
  let currentUrl = await assertSafeUrl(url);
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const resp = await fetch(currentUrl, { ...init, redirect: 'manual' });
    if (resp.status >= 300 && resp.status < 400) {
      const location = resp.headers.get('location');
      if (!location) throw new Error('Redirect without location header');
      currentUrl = await assertSafeUrl(new URL(location, currentUrl).href);
      continue;
    }
    return resp;
  }
  throw new Error('Too many redirects');
}

/** Fetch and parse a website, extracting design-relevant CSS and HTML data */
export async function scrapeWebsite(targetUrl: string): Promise<ScrapedDesignData> {
  // Normalize URL
  let url = targetUrl.trim();
  if (!url.startsWith('http')) url = 'https://' + url;

  // Fetch HTML with browser-like headers (SSRF-safe: validates URL + redirects)
  const response = await safeFetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${url}`);
  }

  const html = await response.text();

  // --- Extract page metadata ---
  const title = extractBetween(html, '<title>', '</title>') || url;
  const metaDescription = extractMeta(html, 'description') || '';

  // --- Extract inline <style> content ---
  const inlineStyles = extractAllBetween(html, '<style', '</style>')
    .map(s => {
      // Remove the opening tag attributes, keep only CSS content
      const closeBracket = s.indexOf('>');
      return closeBracket >= 0 ? s.slice(closeBracket + 1) : s;
    })
    .join('\n');

  // --- Extract external CSS URLs ---
  const externalCSSUrls = extractLinkStylesheets(html);

  // --- Fetch up to 3 external stylesheets ---
  let externalCSS = '';
  let fetchedCount = 0;
  for (const cssUrl of externalCSSUrls.slice(0, 3)) {
    try {
      const absUrl = new URL(cssUrl, url).href;
      const cssResp = await safeFetch(absUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
        signal: AbortSignal.timeout(8000),
      });
      if (cssResp.ok) {
        const cssText = await cssResp.text();
        externalCSS += `\n/* ${cssUrl} */\n` + cssText.slice(0, 15000);
        fetchedCount++;
      }
    } catch {
      // Skip failed stylesheet fetches
    }
  }

  const allCSS = inlineStyles + '\n' + externalCSS;

  // --- Extract design tokens from CSS ---
  const colors = extractColors(allCSS, html);
  const fonts = extractFonts(allCSS);
  const spacing = extractSpacing(allCSS);
  const borderRadius = extractBorderRadius(allCSS);
  const shadows = extractShadows(allCSS);
  const transitions = extractTransitions(allCSS);
  const layoutHints = extractLayoutHints(allCSS, html);

  // --- Extract HTML structure summary ---
  const htmlStructure = extractHTMLStructure(html);

  // --- Trim CSS for AI context (keep most relevant parts) ---
  const cssSnippet = trimCSSForAI(allCSS, 12000);

  return {
    url,
    title,
    metaDescription,
    colors,
    fonts,
    spacing,
    borderRadius,
    shadows,
    transitions,
    layoutHints,
    htmlStructure,
    cssSnippet,
    externalCSSCount: fetchedCount,
    inlineStyleCount: inlineStyles.length > 0 ? 1 : 0,
  };
}

// ---- Extraction Helpers ----

function extractBetween(html: string, open: string, close: string): string {
  const i = html.indexOf(open);
  if (i === -1) return '';
  const j = html.indexOf(close, i + open.length);
  if (j === -1) return '';
  return html.slice(i + open.length, j).trim();
}

function extractAllBetween(html: string, open: string, close: string): string[] {
  const results: string[] = [];
  let searchFrom = 0;
  while (true) {
    const i = html.indexOf(open, searchFrom);
    if (i === -1) break;
    const j = html.indexOf(close, i + open.length);
    if (j === -1) break;
    results.push(html.slice(i, j + close.length));
    searchFrom = j + close.length;
    if (results.length > 20) break; // limit
  }
  return results;
}

function extractMeta(html: string, name: string): string {
  const regex = new RegExp(`<meta[^>]*name=["']${name}["'][^>]*content=["']([^"']*)["']`, 'i');
  const match = html.match(regex);
  if (match) return match[1];
  const regex2 = new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*name=["']${name}["']`, 'i');
  const match2 = html.match(regex2);
  return match2 ? match2[1] : '';
}

function extractLinkStylesheets(html: string): string[] {
  const urls: string[] = [];
  const regex = /<link[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']*)["'][^>]*>/gi;
  let match;
  while ((match = regex.exec(html)) !== null && urls.length < 10) {
    urls.push(match[1]);
  }
  // Also try reversed order: href before rel
  const regex2 = /<link[^>]*href=["']([^"']*)["'][^>]*rel=["']stylesheet["'][^>]*>/gi;
  while ((match = regex2.exec(html)) !== null && urls.length < 10) {
    if (!urls.includes(match[1])) urls.push(match[1]);
  }
  return urls;
}

// ---- CSS Token Extraction ----

function extractColors(css: string, html: string): { value: string; context: string }[] {
  const colorMap = new Map<string, string>();

  // Match hex colors
  const hexRegex = /#(?:[0-9a-fA-F]{3}){1,2}\b/g;
  let match;
  while ((match = hexRegex.exec(css)) !== null) {
    const hex = match[0].toUpperCase();
    if (hex.length === 4 || hex.length === 7) {
      if (!colorMap.has(hex)) {
        // Try to find context around this color
        const idx = css.indexOf(match[0]);
        const context = extractPropertyContext(css, idx);
        colorMap.set(hex, context);
      }
    }
  }

  // Match rgb/rgba
  const rgbRegex = /rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*[\d.]+)?\s*\)/g;
  while ((match = rgbRegex.exec(css)) !== null) {
    const val = match[0];
    if (!colorMap.has(val) && colorMap.size < 30) {
      const context = extractPropertyContext(css, match.index);
      colorMap.set(val, context);
    }
  }

  // Match CSS custom properties with color values
  const varRegex = /--[\w-]+\s*:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|[a-z]+)/gi;
  while ((match = varRegex.exec(css)) !== null && colorMap.size < 40) {
    const propName = match[0].split(':')[0].trim();
    const value = match[0].split(':')[1].trim();
    if (isColorValue(value)) {
      colorMap.set(value, `CSS variable ${propName}`);
    }
  }

  // Also check inline styles in HTML
  const inlineStyleRegex = /style=["'][^"']*(?:color|background)[^"']*["']/gi;
  while ((match = inlineStyleRegex.exec(html)) !== null && colorMap.size < 50) {
    const style = match[0];
    const innerHex = style.match(/#[0-9a-fA-F]{3,8}/);
    if (innerHex && !colorMap.has(innerHex[0])) {
      colorMap.set(innerHex[0].toUpperCase(), 'inline style');
    }
  }

  return Array.from(colorMap.entries())
    .slice(0, 30)
    .map(([value, context]) => ({ value, context }));
}

function extractFonts(css: string): { family: string; weights: string[]; sizes: string[] }[] {
  const fontMap = new Map<string, { weights: Set<string>; sizes: Set<string> }>();

  // font-family declarations
  const familyRegex = /font-family\s*:\s*([^;}\n]+)/gi;
  let match;
  while ((match = familyRegex.exec(css)) !== null) {
    const families = match[1].split(',').map(f => f.trim().replace(/['"]/g, '')).filter(f => f.length > 1 && f !== 'inherit');
    for (const family of families) {
      if (!fontMap.has(family)) {
        fontMap.set(family, { weights: new Set(), sizes: new Set() });
      }
    }
  }

  // font-weight declarations
  const weightRegex = /font-weight\s*:\s*([^;}\n]+)/gi;
  while ((match = weightRegex.exec(css)) !== null) {
    const weight = match[1].trim();
    // Associate with nearest font-family (simplified)
    for (const [, data] of fontMap) {
      data.weights.add(weight);
    }
  }

  // font-size declarations
  const sizeRegex = /font-size\s*:\s*([^;}\n]+)/gi;
  while ((match = sizeRegex.exec(css)) !== null) {
    const size = match[1].trim();
    for (const [, data] of fontMap) {
      data.sizes.add(size);
    }
  }

  return Array.from(fontMap.entries())
    .slice(0, 10)
    .map(([family, data]) => ({
      family,
      weights: Array.from(data.weights).slice(0, 6),
      sizes: Array.from(data.sizes).slice(0, 8),
    }));
}

function extractSpacing(css: string): string[] {
  const values = new Set<string>();
  const props = ['margin', 'padding', 'gap', 'margin-top', 'margin-bottom', 'padding-top', 'padding-bottom'];
  for (const prop of props) {
    const regex = new RegExp(`${prop}\\s*:\\s*([^;}\n]+)`, 'gi');
    let match;
    while ((match = regex.exec(css)) !== null && values.size < 20) {
      const val = match[1].trim();
      // Extract individual values
      val.split(/\s+/).forEach(v => {
        if (/^\d+(\.\d+)?(px|rem|em|vh|vw|%)$/.test(v)) {
          values.add(v);
        }
      });
    }
  }
  return Array.from(values).slice(0, 15);
}

function extractBorderRadius(css: string): string[] {
  const values = new Set<string>();
  const regex = /border-radius\s*:\s*([^;}\n]+)/gi;
  let match;
  while ((match = regex.exec(css)) !== null) {
    const val = match[1].trim();
    val.split(/\s+/).forEach(v => {
      if (/^\d+(\.\d+)?(px|rem|em|%)$/.test(v) || v === '50%' || v === '9999px') {
        values.add(v);
      }
    });
  }
  return Array.from(values).slice(0, 10);
}

function extractShadows(css: string): string[] {
  const values = new Set<string>();
  const regex = /(?:box-shadow|text-shadow)\s*:\s*([^;}\n]+)/gi;
  let match;
  while ((match = regex.exec(css)) !== null && values.size < 10) {
    const val = match[1].trim();
    if (val !== 'none' && val !== 'inherit') {
      values.add(val);
    }
  }
  return Array.from(values);
}

function extractTransitions(css: string): string[] {
  const values = new Set<string>();
  const regex = /(?:transition|animation)\s*:\s*([^;}\n]+)/gi;
  let match;
  while ((match = regex.exec(css)) !== null && values.size < 10) {
    const val = match[1].trim();
    if (val !== 'none' && val !== 'inherit') {
      values.add(val);
    }
  }
  return Array.from(values);
}

function extractLayoutHints(css: string, html: string): string[] {
  const hints: string[] = [];

  // Check for grid
  if (/display\s*:\s*(?:inline-)?grid/i.test(css)) hints.push('Uses CSS Grid');
  if (/display\s*:\s*(?:inline-)?flex/i.test(css)) hints.push('Uses Flexbox');

  // Check for max-width
  const maxW = css.match(/max-width\s*:\s*(\d+(?:\.\d+)?(?:px|rem|em))/i);
  if (maxW) hints.push(`max-width: ${maxW[1]}`);

  // Check for responsive patterns
  if (/@media/i.test(css)) {
    const breakpoints = css.match(/@media[^{]*\{[^}]*\}/gi) || [];
    hints.push(`${breakpoints.length} media queries detected`);
  }

  // Check for position patterns
  if (/position\s*:\s*fixed/i.test(css)) hints.push('Uses fixed positioning');
  if (/position\s*:\s*sticky/i.test(css)) hints.push('Uses sticky positioning');

  // Check for backdrop-filter
  if (/backdrop-filter/i.test(css)) hints.push('Uses backdrop-filter (glass/frosted effects)');

  // Check for CSS custom properties
  const customProps = css.match(/--[\w-]+/g) || [];
  if (customProps.length > 5) hints.push(`${new Set(customProps).size} CSS custom properties`);

  // Check HTML structure hints
  if (/<nav[\s>]/i.test(html)) hints.push('Has <nav> element');
  if (/<header[\s>]/i.test(html)) hints.push('Has <header> element');
  if (/<footer[\s>]/i.test(html)) hints.push('Has <footer> element');
  if (/<main[\s>]/i.test(html)) hints.push('Has <main> element');
  if (/<section[\s>]/i.test(html)) hints.push('Uses <section> elements');

  return hints;
}

function extractHTMLStructure(html: string): string {
  // Extract the main structural elements (without content)
  const lines: string[] = [];
  const tagRegex = /<(html|head|body|header|nav|main|section|article|aside|footer|div|form|h[1-6])[^>]*>/gi;
  let match;
  let count = 0;
  while ((match = tagRegex.exec(html)) !== null && count < 40) {
    const tag = match[0].replace(/\s+/g, ' ').trim();
    if (tag.length < 200) {
      lines.push(tag);
      count++;
    }
  }
  return lines.join('\n');
}

function trimCSSForAI(css: string, maxChars: number): string {
  if (css.length <= maxChars) return css;

  // Remove comments
  let trimmed = css.replace(/\/\*[\s\S]*?\*\//g, '');

  // Remove empty rules
  trimmed = trimmed.replace(/[^{}]+\{\s*\}/g, '');

  // Collapse whitespace
  trimmed = trimmed.replace(/\s+/g, ' ').replace(/\s*{\s*/g, '{').replace(/\s*}\s*/g, '}\n');

  if (trimmed.length <= maxChars) return trimmed;

  // If still too long, prioritize design-system-relevant rules
  const rules = trimmed.split('}').map(r => r.trim() + '}').filter(r => r.length > 5);
  const priorityRules: string[] = [];
  const otherRules: string[] = [];

  for (const rule of rules) {
    if (/:root/i.test(rule) || /--[\w-]+/.test(rule) || /body\s*{/.test(rule) ||
        /font-family|color:|background|border-radius|box-shadow|transition|animation/i.test(rule)) {
      priorityRules.push(rule);
    } else {
      otherRules.push(rule);
    }
  }

  let result = priorityRules.join('\n');
  if (result.length < maxChars) {
    const remaining = maxChars - result.length;
    result += '\n' + otherRules.join('\n').slice(0, remaining);
  }

  return result.slice(0, maxChars);
}

// ---- Utility ----

function extractPropertyContext(css: string, index: number): string {
  // Find the nearest CSS property name before this index
  const before = css.slice(Math.max(0, index - 200), index);
  const propMatch = before.match(/([\w-]+)\s*:\s*[^;]*$/);
  return propMatch ? propMatch[1] : 'unknown';
}

function isColorValue(value: string): boolean {
  return /^#[0-9a-fA-F]{3,8}$/.test(value) ||
         /^rgba?\(/.test(value) ||
         /^(red|blue|green|yellow|orange|purple|pink|white|black|gray|grey|transparent|currentColor)$/i.test(value);
}
