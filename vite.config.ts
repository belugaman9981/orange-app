import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // Same reason as below: this optional dynamic import shouldn't be pre-bundled.
    exclude: ["@anthropic-ai/sdk"],
  },
  build: {
    rollupOptions: {
      // jev.ts's optional bootstrap() dynamically imports this only if you call it;
      // it isn't a real dependency of the app, so don't try to bundle it.
      external: ["@anthropic-ai/sdk"],
    },
  },
});
