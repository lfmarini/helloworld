import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        // Separa o three.js num arquivo proprio: ele e pesado e nao deve
        // entrar no bundle inicial junto com o React.
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (
              id.includes("three") ||
              id.includes("@react-three") ||
              id.includes("postprocessing")
            ) {
              return "three";
            }
          }
        },
      },
    },
  },
});
