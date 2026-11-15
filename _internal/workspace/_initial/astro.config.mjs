import { defineConfig } from 'astro/config';

export default defineConfig({
  vite: {
    server: {
      headers: {
        'Content-Security-Policy': "frame-ancestors 'self' http://localhost:*",
      },
    },
  },
});
