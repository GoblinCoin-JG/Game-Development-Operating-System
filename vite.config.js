import { defineConfig } from "vite";
export default defineConfig({
  server: { host: "127.0.0.1" },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          three: [
            "three",
            "three/addons/controls/OrbitControls.js",
            "three/addons/loaders/GLTFLoader.js",
          ],
        },
      },
    },
  },
});
