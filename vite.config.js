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
        name: "Chordboard",
        short_name: "Chordboard",
        description: "MIDI chord pad controller with scale-aware voicings.",
        start_url: "/chordboard/",
        scope: "/chordboard/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#0d0d0d",
        theme_color: "#0d0d0d",
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
            src: "icons/icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
  // Ensure correct asset paths when hosted at https://<user>.github.io/chordboard/
  base: "/chordboard/",
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
