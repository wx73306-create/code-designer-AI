import { defineConfig } from 'vitest/config';
import path from 'node:path';

/**
 * Vitest — 最小可用配置。
 *
 * Vitest 不会读取 tsconfig 的 `paths`，因此这里显式声明 `@` 别名，
 * 让被测文件内部的 `@/...` 导入可以被解析。
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
