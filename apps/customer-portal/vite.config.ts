import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type ProxyOptions } from "vite";

const cloudProxy: ProxyOptions = {
  target: "http://127.0.0.1:4310",
  changeOrigin: true,
  bypass(request) {
    const accept = request.headers.accept;

    if (typeof accept === "string" && accept.includes("text/html")) {
      return "/index.html";
    }
  },
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    extensionAlias: {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
    },
  },
  server: {
    port: 5175,
    strictPort: true,
    proxy: {
      "/m": cloudProxy,
      "/d": cloudProxy,
      "/portal": cloudProxy,
      "/payments": cloudProxy,
    },
  },
});
