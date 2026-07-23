import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The dev server (this app, port 5173) forwards any /api/* request to the
// backend server (port 3001) so the browser can call fetch("/api/parse")
// without running into cross-origin issues.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
