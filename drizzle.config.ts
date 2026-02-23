import { defineConfig } from "drizzle-kit";

export default defineConfig({
    schema: "./src/core/chorus/db/schema.ts",
    dialect: "sqlite",
});
