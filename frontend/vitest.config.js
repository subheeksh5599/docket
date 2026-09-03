import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    mainFields: ['module', 'jsnext:main', 'main'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
    server: {
      deps: {
        // let vitest externalize @testing-library/react so its ESM build
        // (with proper react-dom interop) is used, avoiding the CJS
        // `_reactDom.default.render` break under React 19
        inline: [],
      },
    },
  },
});
