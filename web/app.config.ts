import { defineConfig } from "@solidjs/start/config";

export default defineConfig({
  ssr: false, // Client-side only static site
  server: {
    prerender: {
      crawlLinks: true,
    },
  },
});
