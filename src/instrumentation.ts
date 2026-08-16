// =============================================================================
// Next.js Instrumentation — runs once on server startup
// P2-9: Check database schema and auto-sync if tables are missing
// =============================================================================

export async function register() {
  // Only run on the server (not in Edge runtime)
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  try {
    const { prisma } = await import('@/lib/prisma');

    // Quick health check — try a simple query
    await prisma.$queryRaw`SELECT 1`;

    // Check if critical tables exist by querying them
    const tables = ['User', 'Quota', 'Generation', 'DesignMemory'];
    const missing: string[] = [];

    for (const table of tables) {
      try {
        // Try to count rows — will throw if table doesn't exist
        await (prisma as any)[table.charAt(0).toLowerCase() + table.slice(1)]?.count?.();
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
        const { stdout, stderr } = await execAsync('npx prisma db push --skip-generate', {
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
