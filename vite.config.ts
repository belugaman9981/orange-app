import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "ACUMEN_");
  const target = env.ACUMEN_BRIDGE_URL || "http://127.0.0.1:8765";
  const url = new URL(target);
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("ACUMEN_BRIDGE_URL must be a local HTTP origin, for example http://127.0.0.1:8765");
  }
  const proxy = { "/acumen/api/": { target, changeOrigin: true, rewrite: (path: string) => path.replace(/^\/acumen/, ""), timeout: 125000, proxyTimeout: 125000 } };
  return {
    server: { host: "127.0.0.1", proxy },
    preview: { host: "127.0.0.1", proxy },
    plugins: [react()],
    optimizeDeps: {
      // The optional bootstrap import should not be pre-bundled.
      exclude: ["@anthropic-ai/sdk"],
    },
    build: {
      rollupOptions: {
        // jev.ts imports the SDK only if bootstrap() is called.
        external: ["@anthropic-ai/sdk"],
      },
    },
  };
});
