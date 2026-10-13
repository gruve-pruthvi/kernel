import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      // Tests run against a frozen copy of the sample content, so editing content/ never breaks them.
      // tests/shipped-content.test.ts still validates the real content/ by relative import.
      { find: /^@\/content$/, replacement: fileURLToPath(new URL("./tests/fixtures/content/index.ts", import.meta.url)) },
      { find: "@", replacement: fileURLToPath(new URL("./", import.meta.url)) },
    ],
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
  },
});
