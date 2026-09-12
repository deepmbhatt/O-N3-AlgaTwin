import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    // HPC/shared hosts often exhaust the kernel inotify quota. Polling keeps
    // hot reload working without requiring privileged sysctl changes.
    watch: {
      usePolling: true,
      interval: 800,
    },
    proxy: {
      '/algatwin': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/algatwin/, ''),
      },
    },
  },
});
