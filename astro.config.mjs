// @ts-check
import { defineConfig } from "astro/config";

import react from "@astrojs/react";

export default defineConfig({
  integrations: [
    react(),
    {
      name: "separate-command-caches",
      hooks: {
        "astro:config:setup": ({ command, updateConfig }) => {
          // Builds and sync/check can run while the background dev server is
          // alive. Keep their optimized React runtimes out of its dev cache.
          updateConfig({
            vite: { cacheDir: `./node_modules/.vite/astro-${command}` },
          });
        },
      },
    },
  ],
  // Match the origins already allowed by the sibling Bareblekk API.
  server: { port: 5173 },
  vite: {
    server: {
      strictPort: true,
      proxy: {
        "/api": {
          target: process.env.BAREBLEKK_API_ORIGIN || "http://127.0.0.1:8787",
          changeOrigin: true,
        },
      },
    },
  },
});
