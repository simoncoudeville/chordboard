import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      devOptions: {
        enabled: true,
      },
      manifest: {
        name: "ChordPilot",
        short_name: "ChordPilot",
        description: "MIDI chord pad controller with scale-aware voicings.",
        start_url: "/chordpilot/",
        scope: "/chordpilot/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#FF0000",
        theme_color: "#FF0000",
        icons: [
          {
            src: "icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
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
