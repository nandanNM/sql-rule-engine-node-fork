import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    // Integration tests talk to Postgres, so give them room and run serially to
    // avoid cross-test interference on shared connections.
    testTimeout: 20000,
    hookTimeout: 20000,
    fileParallelism: false,
  },
});
