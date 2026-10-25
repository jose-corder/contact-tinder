/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

// GitHub Pages serves from /<repo>/ ; local dev and other hosts from /
const base = process.env.GITHUB_PAGES ? '/contact-tinder/' : '/'
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
let revision = ''
try {
  revision = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
} catch { /* Source archives need no Git installation. */ }

export default defineConfig({
  base,
  define: { 'import.meta.env.VITE_APP_VERSION': JSON.stringify(`${version}${revision ? `+${revision}` : ''}`) },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/*.svg', 'icons/*.png', 'demo.vcf'],
      manifest: {
        name: 'Contacts.',
        short_name: 'Contacts.',
        description: 'Swipe through your address book. Delete, work, personal. Everything stays on your device.',
        theme_color: '#F4EFE6',
        background_color: '#F4EFE6',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        id: base,
        lang: 'en',
        dir: 'ltr',
        categories: ['productivity', 'utilities'],
        shortcuts: [
          { name: 'Continue', url: base },
          { name: 'Review', url: `${base}review` },
          { name: 'Export', url: `${base}export` },
        ].map((shortcut) => ({ ...shortcut, icons: [{ src: `${base}icons/icon-192.png`, sizes: '192x192', type: 'image/png' }] })),
        orientation: 'portrait',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: `${base}index.html`,
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,vcf}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 20000, // integration tests render whole routes; CI runners are slow
    hookTimeout: 20000,
    include: ['tests/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
  },
})
