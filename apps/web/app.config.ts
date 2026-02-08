import { defineConfig } from '@solidjs/start/config';
import tailwindcss from '@tailwindcss/vite';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  ssr: false, // Client-side only static site
  server: {
    prerender: {
      crawlLinks: true
    }
  },
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        'abr-parser/browser': resolve(__dirname, '../../packages/abr-parser/dist/browser.mjs'),
        'abr-parser': resolve(__dirname, '../../packages/abr-parser/dist/index.mjs')
      }
    }
  }
});
