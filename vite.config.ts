import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // O app se atualiza sozinho quando uma versão nova é publicada, sem o
      // usuário precisar limpar cache ou reinstalar.
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "HelloWorld — Cobrinha 3D e Afinador",
        short_name: "HelloWorld",
        description:
          "Jogo da cobrinha em 3D e afinador de violão pelo microfone. Funciona offline.",
        lang: "pt-BR",
        theme_color: "#05060a",
        background_color: "#05060a",
        display: "standalone",
        orientation: "any",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "/pwa-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          {
            // O ícone "maskable" tem margem de sobra nas bordas para o Android
            // poder recortá-lo em círculo, gota ou o que o fabricante quiser.
            src: "/pwa-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        // Qualquer rota desconhecida cai no index.html, para /snake continuar
        // abrindo mesmo sem rede.
        navigateFallback: "/index.html",
        runtimeCaching: [
          {
            // As fontes vêm do Google. Guardando-as, o site mantém a tipografia
            // certa offline em vez de cair na fonte do sistema.
            urlPattern: /^https:\/\/fonts\.googleapis\.com\//,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "google-fonts-css" },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\//,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-arquivos",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        // Permite testar o service worker rodando localmente.
        enabled: false,
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        // Separa o three.js num arquivo próprio: ele é pesado e não deve
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
