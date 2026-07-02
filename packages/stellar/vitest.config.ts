import { defineConfig } from "vitest/config";

export default defineConfig({
  // Resolve NodeNext-style `.js` relative imports to their `.ts` sources.
  resolve: {
    extensionAlias: { ".js": [".ts", ".js"] },
  },
  test: {
    include: ["test/**/*.test.ts"],
  },
});
