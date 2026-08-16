// =============================================================================
// /api/design-memory — Create and search design memories
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  saveDesignMemory,
  searchDesignMemories,
  getAllDesignMemories,
  getMemoryStats,
} from '@/lib/services/design-memory';

export const dynamic = 'force-dynamic';

/**
 * POST — Create a new design memory
 * Body: { websiteId, websiteName, websiteUrl, style, color, typography, layout, component, animation }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.websiteId || !body.websiteName || !body.websiteUrl) {
      return NextResponse.json(
        { error: 'Missing required fields: websiteId, websiteName, websiteUrl' },
        { status: 400 },
      );
    }

    const memory = await saveDesignMemory({
      websiteId: body.websiteId,
      websiteName: body.websiteName,
      websiteUrl: body.websiteUrl,
      category: body.category,
      style: body.style || {},
      color: body.color || {},
      typography: body.typography || {},
      layout: body.layout || {},
      component: body.component || [],
      animation: body.animation || {},
      sourceReport: body.sourceReport,
      confidence: body.confidence,
    });

    return NextResponse.json({
      success: true,
      memoryId: memory.id,
      message: `Design memory saved for ${body.websiteName}`,
    });
  } catch (error) {
    console.error('[design-memory] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save memory' },
      { status: 500 },
    );
  }
}

/**
 * GET — Search or list design memories
 * Query params:
 *   - q: search query (keyword matching)
 *   - limit: max results (default 20)
 *   - stats: if "true", return statistics instead of memories
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '20');
    const stats = searchParams.get('stats') === 'true';

    if (stats) {
      const memoryStats = await getMemoryStats();
      return NextResponse.json(memoryStats);
    }

    if (query) {
      const results = await searchDesignMemories(query, limit);
      return NextResponse.json({ results, count: results.length });
    }

    // List all
    const memories = await getAllDesignMemories(limit);
    return NextResponse.json({ memories, count: memories.length });
  } catch (error) {
    console.error('[design-memory] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to search memories' },
      { status: 500 },
    );
  }
}
