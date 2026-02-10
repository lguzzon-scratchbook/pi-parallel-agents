import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts", "test/**/*.test.ts"],
    exclude: ["node_modules", "dist"],
    testTimeout: 10000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.ts"],
      exclude: [
        "tests/**",
        "test/**",
        "node_modules/**",
        "dist/**",
        "*.config.*",
        "**/*.d.ts",
        "**/*.md",
        "src/index.ts", // Main extension entry, tested via integration
        "src/executor.ts", // Integration with pi subprocess API
        "src/dag.ts", // Complex DAG execution with subprocess API
        "src/parallel.ts", // Mostly unit tested, integration with subprocess
        "src/render.ts", // Formatting functions, tested but needs integration
      ],
      thresholds: {
        statements: 80,
        branches: 66,
        functions: 80,
        lines: 80,
      },
    },
  },
});
