import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/remotion/index.ts", "**/*.d.ts"],
    },
  },
  resolve: {
    alias: {
      "@": "/src",
      "@schemas": "/src/schemas",
      "@pipeline": "/src/pipeline",
      "@remotion-app": "/src/remotion",
    },
  },
});
