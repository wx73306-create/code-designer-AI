// =============================================================================
// Design Memory Service — save, search, and retrieve design patterns
// =============================================================================

import { prisma } from '@/lib/prisma';

export interface DesignMemoryInput {
  websiteId: string;
  websiteName: string;
  websiteUrl: string;
  category?: string;
  style: Record<string, any>;
  color: Record<string, any>;
  typography: Record<string, any>;
  layout: Record<string, any>;
  component: any[];
  animation: Record<string, any>;
  sourceReport?: string;
  confidence?: number;
}

/**
 * Save a new design memory extracted from a website analysis
 */
export async function saveDesignMemory(input: DesignMemoryInput) {
  // Check if memory for this website already exists
  const existing = await prisma.designMemory.findFirst({
    where: { websiteId: input.websiteId },
  });

  if (existing) {
    // Update existing memory with new analysis
    return prisma.designMemory.update({
      where: { id: existing.id },
      data: {
        style: input.style,
        color: input.color,
        typography: input.typography,
        layout: input.layout,
        component: input.component,
        animation: input.animation,
        category: input.category,
        confidence: input.confidence ?? 0.8,
        sourceReport: input.sourceReport,
      },
    });
  }

  // Create new memory
  return prisma.designMemory.create({
    data: {
      websiteId: input.websiteId,
      websiteName: input.websiteName,
      websiteUrl: input.websiteUrl,
      category: input.category,
      style: input.style,
      color: input.color,
      typography: input.typography,
      layout: input.layout,
      component: input.component,
      animation: input.animation,
      sourceReport: input.sourceReport,
      confidence: input.confidence ?? 0.8,
    },
  });
}

/**
 * Search design memories by category or keyword matching
 * (Phase 1: keyword-based; Phase 3 will add vector similarity)
 */
export async function searchDesignMemories(query: string, limit: number = 5) {
  const keywords = query.toLowerCase().split(/\s+/).filter(Boolean);

  // Get all memories and score by keyword match
  const all = await prisma.designMemory.findMany({
    orderBy: { usageCount: 'desc' },
    take: 50,
  });

  // Simple relevance scoring
  const scored = all.map(memory => {
    const styleKeywords = ((memory.style as any)?.keywords || [])
      .map((k: string) => k.toLowerCase());
    const mood = ((memory.style as any)?.mood || '').toLowerCase();
    const category = (memory.category || '').toLowerCase();

    let score = 0;
    for (const kw of keywords) {
      if (category.includes(kw)) score += 3;
      if (styleKeywords.some((sk: string) => sk.includes(kw))) score += 2;
      if (mood.includes(kw)) score += 2;
      if (memory.websiteName.toLowerCase().includes(kw)) score += 4;
    }

    // Boost by usage count (popular memories are more reliable)
    score += Math.min(memory.usageCount * 0.1, 2);

    return { ...memory, score };
  });

  return scored
    .filter(m => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Get all design memories (for admin browser)
 */
export async function getAllDesignMemories(limit: number = 100, offset: number = 0) {
  return prisma.designMemory.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
  });
}

/**
 * Get a single design memory by ID
 */
export async function getDesignMemory(id: string) {
  return prisma.designMemory.findUnique({ where: { id } });
}

/**
 * Increment usage count when a memory is used in generation
 */
export async function incrementMemoryUsage(id: string) {
  return prisma.designMemory.update({
    where: { id },
    data: { usageCount: { increment: 1 } },
  });
}

/**
 * Get design memories by category
 */
export async function getMemoriesByCategory(category: string, limit: number = 10) {
  return prisma.designMemory.findMany({
    where: { category },
    orderBy: { usageCount: 'desc' },
    take: limit,
  });
}

/**
 * Find similar designs based on style keywords
 */
export async function findSimilarDesigns(
  styleKeywords: string[],
  excludeId?: string,
  limit: number = 3,
) {
  const all = await prisma.designMemory.findMany({
    where: excludeId ? { id: { not: excludeId } } : undefined,
    orderBy: { usageCount: 'desc' },
    take: 50,
  });

  const scored = all.map(memory => {
    const memKeywords = ((memory.style as any)?.keywords || [])
      .map((k: string) => k.toLowerCase());
    let score = 0;
    for (const kw of styleKeywords) {
      if (memKeywords.some((mk: string) => mk.includes(kw.toLowerCase()))) score += 2;
    }
    return { ...memory, similarity: Math.min(score / (styleKeywords.length * 2), 1) };
  });

  return scored
    .filter(m => m.similarity > 0.1)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

/**
 * Get memory statistics
 */
export async function getMemoryStats() {
  const total = await prisma.designMemory.count();
  const categories = await prisma.designMemory.groupBy({
    by: ['category'],
    _count: { id: true },
  });
  const avgConfidence = await prisma.designMemory.aggregate({
    _avg: { confidence: true },
  });

  return {
    totalMemories: total,
    categories: categories.map(c => ({
      category: c.category || 'uncategorized',
      count: c._count.id,
    })),
    avgConfidence: avgConfidence._avg.confidence || 0,
  };
}
