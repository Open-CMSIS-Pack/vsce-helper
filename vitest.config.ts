import { fileURLToPath } from "url";
import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        root: fileURLToPath(new URL("./src", import.meta.url)),
        coverage: {
            provider: "v8",
            reporter: ['lcov', 'text'],
        },
    },
  });
