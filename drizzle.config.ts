import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  out: "./drizzle",
  schema: resolve(rootDir, "apps/web/worker/lib/schema.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgres://postgres:postgres@127.0.0.1:5432/workerflow",
  },
  strict: true,
  verbose: true,
});
