// =============================================================================
// Next.js Instrumentation — runs once on server startup
//
// This entry file is compiled for BOTH the Node.js and Edge runtimes, so it
// must stay free of Node-only APIs. All Node-only work lives in
// `./instrumentation-node` and is pulled in through a guarded dynamic import.
// =============================================================================

export async function register() {
  // Only run on the server (not in Edge runtime)
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { register: registerNode } = await import('./instrumentation-node');
  await registerNode();
}
