import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      include: ['src'],
      rollupTypes: true,
    }),
  ],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        browser: resolve(__dirname, 'src/browser.ts'),
      },
      name: 'AbrParser',
      formats: ['es', 'cjs'],
      fileName: (format, entryName) => `${entryName}.${format === 'es' ? 'mjs' : 'cjs'}`,
    },
    rollupOptions: {
      // Node.js built-ins and dependencies are external
      external: ['fs', 'path', 'uuid', 'zod', 'pngjs'],
      output: {
        globals: {
          uuid: 'uuid',
          zod: 'zod',
          pngjs: 'pngjs',
        },
      },
    },
    sourcemap: true,
    minify: false,
  },
});
