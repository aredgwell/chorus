import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
    resolve: {
        alias: {
            "@ui": path.resolve(__dirname, "./src/ui"),
            "@core": path.resolve(__dirname, "./src/core"),
            "@": path.resolve(__dirname, "./src"),
        },
    },
    test: {
        globals: true,
        include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    },
});
