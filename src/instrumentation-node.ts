// =============================================================================
// Node.js-only Instrumentation — imported dynamically from instrumentation.ts
// P2-9: Check database schema and auto-sync if tables are missing
//
// IMPORTANT: This module must ONLY be loaded from the Node.js runtime.
// It uses Node.js APIs (child_process, process.cwd) that do not exist in
// the Edge Runtime. Keep it behind the dynamic import in instrumentation.ts
// so Turbopack does not pull it into the Edge bundle.
// =============================================================================

export async function register() {
  try {
    const { prisma } = await import('@/lib/prisma');

    // Quick health check — try a simple query
    await prisma.$queryRaw`SELECT 1`;

    // Check if critical tables exist by querying them
    const tables = ['User', 'Quota', 'Generation', 'DesignMemory'];
    const missing: string[] = [];

    // Delegate lookup is dynamic, so model access cannot be typed statically.
    const models = prisma as unknown as Record<string, { count?: () => Promise<number> } | undefined>;

    for (const table of tables) {
      try {
        // Try to count rows — will throw if table doesn't exist
        const delegate = models[table.charAt(0).toLowerCase() + table.slice(1)];
        await delegate?.count?.();
      } catch {
        missing.push(table);
      }
    }

    if (missing.length > 0) {
      console.warn(`[DB Schema] Missing tables detected: ${missing.join(', ')}`);
      console.warn('[DB Schema] Attempting auto-sync with prisma db push...');

      try {
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);
        const { stderr } = await execAsync('npx prisma db push --skip-generate', {
          timeout: 60_000,
          cwd: process.cwd(),
        });
        if (stderr && !stderr.includes('already in sync')) {
          console.warn('[DB Schema] Push stderr:', stderr);
        }
        console.log('[DB Schema] ✓ Database schema synced successfully');
      } catch (pushErr) {
        console.error('[DB Schema] ✗ Auto-sync failed:', pushErr instanceof Error ? pushErr.message : pushErr);
        console.error('[DB Schema] Please run `npx prisma db push` manually');
      }
    } else {
      console.log('[DB Schema] ✓ All tables present');
    }
  } catch (err) {
    console.error('[DB Schema] Startup check failed:', err instanceof Error ? err.message : err);
  }
}
