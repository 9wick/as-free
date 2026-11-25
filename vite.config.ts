import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: {
    // 型の宣言が長く、既定の 100 桁では差分の大半が折り返しになるため広げる
    printWidth: 120,
  },
  lint: {
    plugins: ["typescript", "unicorn", "oxc", "import"],
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",
    },
    overrides: [
      {
        files: ["src/**/*.test.ts"],
        rules: {
          // 型の契約テストは、型だけを確かめる式を値として使わずに書く
          "eslint/no-unused-expressions": "off",
          // mapValues の mapper が受け取る値は型の上では lens で、Promise.all に Promise でない値を混ぜる場合も確かめる
          "typescript/await-thenable": "off",
        },
      },
    ],
    options: {
      typeAware: true,
      typeCheck: true,
      denyWarnings: true,
      reportUnusedDisableDirectives: "error",
    },
  },
});
