import { defineConfig } from '@solidjs/start/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  ssr: false, // Client-side only static site
  server: {
    prerender: {
      crawlLinks: true
    }
  },
  vite: {
    plugins: [tailwindcss()]
  }
});
