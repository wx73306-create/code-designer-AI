// =============================================================================
// /api/export-project — Generate complete project ZIP for React/Next.js export
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { generateProjectFiles } from '@/lib/export/project-generator';
import type { ExportFormat } from '@/types/export';
import JSZip from 'jszip';
import { getRequestAuth } from '@/lib/admin-session';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // P1 安全修复：导出接口需要登录认证（接受 user 或 admin session）
  if (!getRequestAuth(request).authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const format: ExportFormat = body.format || 'nextjs';
    const projectName: string = body.projectName || 'my-project';
    const files: [string, string][] = Array.isArray(body.files) ? body.files : [];

    if (files.length === 0) {
      return NextResponse.json({ error: '没有可导出的代码' }, { status: 400 });
    }

    // Convert to GeneratedCodeEntry format
    const codeEntries = files.map(([filename, code]) => ({ filename, code }));

    // Generate project files
    const projectFiles = generateProjectFiles(format, codeEntries, projectName);

    // Create ZIP using JSZip
    const zip = new JSZip();
    const projectFolder = zip.folder(projectName);

    if (!projectFolder) {
      throw new Error('Failed to create project folder');
    }

    for (const file of projectFiles) {
      projectFolder.file(file.path, file.content);
    }

    // Generate ZIP blob
    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    // Return as downloadable response
    return new NextResponse(Buffer.from(zipBuffer), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${projectName}.zip"`,
      },
    });
  } catch (error) {
    console.error('[export-project] error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '导出失败' },
      { status: 500 },
    );
  }
}
