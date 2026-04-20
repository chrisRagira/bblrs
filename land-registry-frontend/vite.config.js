import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host:'0.0.0.0',
    allowedHosts: true,
    proxy: {
      // Forward /api calls to the Express backend during development
      "/api": {
        target:      "http://0.0.0.0:3000",
        changeOrigin: true,
      },
    },
  },
});
