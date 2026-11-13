import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Sede",
        short_name: "Sede",
        lang: "es",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#fafaf9",
        theme_color: "#1c1917",
        icons: [
          {
            src: "icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    extensionAlias: {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/tenants": { target: "http://127.0.0.1:4310", changeOrigin: true },
    },
  },
});
