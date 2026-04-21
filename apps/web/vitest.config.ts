import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    alias: {
      "cloudflare:workers": fileURLToPath(
        new URL("./tests/test-support/cloudflare-workers.ts", import.meta.url),
      ),
    },
  },
});
