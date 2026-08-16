// =============================================================================
// ZIP Export Utility — 将导出的网站文件打包为 zip 下载
// 使用 JSZip + file-saver，纯客户端打包
// =============================================================================

import JSZip from 'jszip';
import { saveAs } from 'file-saver';

export interface WebsiteFiles {
  indexHtml: string;
  styleCss: string;
  scriptJs: string;
}

/**
 * 将网站文件打包为 zip 并触发下载
 * @param files - 分离的网站文件 (index.html + style.css + script.js)
 * @param zipName - zip 文件名（不含 .zip 后缀）
 */
export async function exportWebsiteZip(files: WebsiteFiles, zipName: string = 'website'): Promise<void> {
  const zip = new JSZip();

  // 添加文件到 zip（使用标准文件名）
  zip.file('index.html', files.indexHtml);
  zip.file('style.css', files.styleCss);
  zip.file('script.js', files.scriptJs);

  // 添加 README 说明
  zip.file('README.txt', `Code Designer AI - Exported Website
=====================================

Generated: ${new Date().toLocaleString('zh-CN')}
Generator: Code Designer AI (https://codedesigner.ai)

Files:
  - index.html  : Main page (double-click to open in browser)
  - style.css   : Compiled Tailwind CSS styles
  - script.js   : Bundled React application

Usage:
  Simply double-click index.html to view the website.
  No server or build step required.

Note:
  All styles and scripts are self-contained.
  No external dependencies needed (except Tailwind CDN fallback if CSS compilation was skipped).
`);

  // 生成 zip blob 并下载
  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  saveAs(blob, `${zipName}.zip`);
}

/**
 * 将单个 HTML 文件打包为 zip 下载
 * @param html - 自包含的 HTML 字符串
 * @param zipName - zip 文件名
 */
export async function exportSingleHtmlZip(html: string, zipName: string = 'website'): Promise<void> {
  const zip = new JSZip();
  zip.file('index.html', html);

  zip.file('README.txt', `Code Designer AI - Exported Website
=====================================

Generated: ${new Date().toLocaleString('zh-CN')}

Usage: Double-click index.html to open in browser.
`);

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  saveAs(blob, `${zipName}.zip`);
}
