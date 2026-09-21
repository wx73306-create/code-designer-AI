import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 归档死代码：已排除出 tsconfig，同样不参与 lint。
    // 详见 src/legacy/agents/README.md —— 它不该再产生任何门禁噪音。
    "src/legacy/**",
  ]),
]);

export default eslintConfig;
