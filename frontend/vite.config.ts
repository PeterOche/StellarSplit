import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA, type VitePWAOptions } from "vite-plugin-pwa";
import path from "path";

const pwaOptions: Partial<VitePWAOptions> = {
  registerType: "autoUpdate",
  base: "/",
  includeAssets: ["favicon.svg", "apple-touch-icon.png", "mask-icon.svg"],
  manifest: {
    name: "Stellar Split",
    short_name: "Stellar Split",
    description: "Stellar Split PWA",
    theme_color: "#ffffff",
    background_color: "#ffffff",
    display: "standalone",
    icons: [
      {
        src: "pwa-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/pwa-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "pwa-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
  },
  workbox: {
    globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
  },
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), VitePWA(pwaOptions), tailwindcss()],
  define: {
    // Some wallet-kit dependencies expect a Node-like `global` in the browser
    global: 'globalThis',
  },
  // @ts-ignore
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
  resolve: {
    alias: {
      "@src": path.resolve(__dirname, "./src"),
      "@components": path.resolve(__dirname, "./src/components"),
      "@utils": path.resolve(__dirname, "./src/utils"),
    },
  },
});
