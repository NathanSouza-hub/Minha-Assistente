import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // A versão nova espera a pessoa tocar em "Atualizar" (components/AvisoAtualizacao.tsx). Com
      // 'autoUpdate' o worker novo trocava o cache por baixo da tela aberta, que seguia com o JS
      // antigo e quebrava ao carregar uma tela sob demanda ou ao receber dados num formato novo.
      registerType: 'prompt',
      // O registro é feito pelo useRegisterSW do aviso, não por um script injetado no index.html.
      injectRegister: false,
      // Ícones e <link>s gerados a partir de public/favicon.svg (pwa-assets.config.ts).
      pwaAssets: { config: true, overrideManifestIcons: true },
      manifest: {
        name: 'Minha Assistente',
        short_name: 'Assistente',
        description: 'Pagamentos, agenda, remédios, rotina, viagens e compras num só lugar.',
        lang: 'pt-BR',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f3f6fc',
        theme_color: '#f3f6fc',
      },
      workbox: {
        // O worker do MSW só existe para desenvolvimento.
        globIgnores: ['**/mockServiceWorker.js'],
        // Recebe os lembretes (Web Push) e abre a tela certa ao tocar na notificação.
        importScripts: ['sw-push.js'],
        navigateFallback: '/index.html',
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
})
