// SPA fallback for static hosts (GitHub Pages serves 404.html for unknown paths).
import { copyFileSync, existsSync } from 'node:fs'

const dist = new URL('../dist/', import.meta.url)
if (existsSync(new URL('index.html', dist))) {
  copyFileSync(new URL('index.html', dist), new URL('404.html', dist))
  console.log('postbuild: wrote dist/404.html')
}
