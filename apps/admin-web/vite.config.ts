import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    extensionAlias: {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
    },
  },
  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      "/tenants": {
        target: "http://127.0.0.1:4310",
        changeOrigin: true,
      },
    },
  },
});
