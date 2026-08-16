// =====================================================================
// /api/screenshot — Capture website screenshots for visual reference
// =====================================================================

import { NextRequest, NextResponse } from 'next/server';
import { captureWebsiteScreenshots } from '@/lib/screenshot';

export const runtime = 'nodejs';
export const maxDuration = 60; // 60s timeout for screenshot capture

export async function POST(request: NextRequest) {
  try {
    const { url, fullPage = true } = await request.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Validate URL
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return NextResponse.json({ error: 'Only http/https URLs are supported' }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    console.log(`[Screenshot] Capturing ${url}...`);
    const result = await captureWebsiteScreenshots(url, { fullPage });
    console.log(`[Screenshot] Captured: hero=${Math.round(result.heroBase64.length / 1024)}KB, full=${Math.round(result.fullPageBase64.length / 1024)}KB`);

    return NextResponse.json({
      success: true,
      heroBase64: result.heroBase64,
      fullPageBase64: result.fullPageBase64,
      width: result.width,
      height: result.height,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Screenshot] Error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
