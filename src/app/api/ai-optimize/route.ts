// =============================================================================
// /api/ai-optimize — AI-powered code optimization for workspace actions
// =============================================================================
// Actions: visual, hero, premium, mobile
// Receives current code files, calls AI to optimize, returns updated code
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getRequestAuth } from '@/lib/admin-session';

export const dynamic = 'force-dynamic';

const ACTION_PROMPTS: Record<string, string> = {
  visual: `You are a senior UI designer. Optimize the visual hierarchy, spacing, and typography of the following React components.
Improve: font sizes, margins, paddings, visual weight distribution, color contrast.
Keep the same component structure and functionality.
Return the COMPLETE updated code for each file, prefixed with ---FILE: filename---`,

  hero: `You are a senior product designer. Redesign the Hero section component with a more premium, impactful layout.
Apply: larger typography, more dramatic spacing, better visual hierarchy, subtle gradient backgrounds.
Keep the same props interface and imports.
Return the COMPLETE updated code for each file, prefixed with ---FILE: filename---`,

  premium: `You are a luxury brand designer. Apply premium design principles to the following React components.
Improve: shadows (layered, subtle), gradients (sophisticated), micro-interactions (hover states), border-radius (consistent), spacing (generous).
Keep the same component structure and functionality.
Return the COMPLETE updated code for each file, prefixed with ---FILE: filename---`,

  mobile: `You are a responsive design expert. Optimize the following React components for mobile devices.
Improve: touch targets (min 44px), font sizes (readable on small screens), layout (stack vertically on mobile), spacing (appropriate for touch).
Add responsive Tailwind classes (sm:, md:, lg:) where needed.
Keep the same component structure and functionality.
Return the COMPLETE updated code for each file, prefixed with ---FILE: filename---`,
};

export async function POST(request: NextRequest) {
  // Auth check — accept user or admin session
  if (!getRequestAuth(request).authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, files, url } = body;

    if (!action || !ACTION_PROMPTS[action]) {
      return NextResponse.json(
        { error: `Unknown action: ${action}. Valid actions: ${Object.keys(ACTION_PROMPTS).join(', ')}` },
        { status: 400 },
      );
    }

    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ error: 'No code files provided' }, { status: 400 });
    }

    // Build the prompt with current code
    const codeContext = files
      .map(([filename, code]: [string, string]) => `---FILE: ${filename}---\n${code}`)
      .join('\n\n');

    const systemPrompt = ACTION_PROMPTS[action];
    const userPrompt = `${systemPrompt}

Current code:
${codeContext}

${url ? `Original website: ${url}` : ''}

Return the COMPLETE updated code for each file. Each file must start with ---FILE: filename--- on its own line.`;

    // Forward cookies from the incoming request to /api/mimo for auth
    const cookieHeader = request.headers.get('cookie') || '';

    // Call the AI model via /api/mimo endpoint
    const mimoRes = await fetch(`${request.nextUrl.origin}/api/mimo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieHeader,
      },
      body: JSON.stringify({
        step: 'optimize',
        prompt: userPrompt,
        code: codeContext.slice(0, 6000),
      }),
    });

    if (!mimoRes.ok) {
      throw new Error(`AI service returned ${mimoRes.status}`);
    }

    const result = await mimoRes.json();

    // Parse the AI response to extract updated files
    const updatedFiles = parseUpdatedFiles(result.code || result.response || result.optimizedCode || '');

    if (updatedFiles.length === 0) {
      // If parsing failed, return the raw response for the client to handle
      return NextResponse.json({
        success: true,
        action,
        files: [],
        rawResponse: (result.code || result.response || '').slice(0, 10000),
        message: 'AI optimization completed (raw response)',
      });
    }

    return NextResponse.json({
      success: true,
      action,
      files: updatedFiles,
      message: `Optimization "${action}" completed: ${updatedFiles.length} file(s) updated`,
    });
  } catch (error) {
    console.error('[ai-optimize] error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Optimization failed' },
      { status: 500 },
    );
  }
}

/**
 * Parse AI response to extract updated file contents
 * Expected format: ---FILE: filename---\ncode content
 */
function parseUpdatedFiles(response: string): [string, string][] {
  if (!response) return [];

  const files: [string, string][] = [];
  const fileRegex = /---FILE:\s*(.+?)---\n([\s\S]*?)(?=---FILE:|$)/g;
  let match;

  while ((match = fileRegex.exec(response)) !== null) {
    const filename = match[1].trim();
    const code = match[2].trim();
    if (filename && code) {
      files.push([filename, code]);
    }
  }

  return files;
}
