import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  // Ensure correct asset paths when hosted at https://<user>.github.io/chordpilot/
  base: "/chordpilot/",
  server: {
    host: true,
    port: 3000,
    allowedHosts: [
      // Allow all ngrok-free.app subdomains
      // /.ngrok-free\.app$/
      "e2dd09b86534.ngrok-free.app",
    ],
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./tests/setup.ts",
    include: ["tests/**/*.spec.js"],
    css: true,
    coverage: {
      reporter: ["text", "html"],
    },
  },
});
